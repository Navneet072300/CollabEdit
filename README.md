# CollabEdit — Real-Time Collaborative Code Editor

A full-stack collaborative code editor with Operational Transform conflict resolution, WebSocket collaboration, multi-language code execution, a VS Code-style file tree, and live web preview. Deployed on Amazon EKS via Terraform.

**Live:** `http://k8s-collabed-collabed-802658f071-1632454566.us-east-1.elb.amazonaws.com`

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, TypeScript, CodeMirror 6, Zustand, Tailwind CSS v4 |
| Backend | FastAPI, Python 3.12, SQLAlchemy 2 (async), Alembic |
| Realtime | Native WebSockets, Redis pub/sub |
| Storage | PostgreSQL 16 (RDS), Redis 7 (ElastiCache) |
| Infra | Amazon EKS, Terraform, AWS ALB, ECR |
| CI | GitHub Actions (lint → build → push to ECR) |

---

## Features

- **Real-time collaboration** — multiple users edit simultaneously with OT conflict resolution
- **Live cursors & presence** — see where each collaborator is in real time
- **Code execution** — run code directly in the browser across 11 languages
- **VS Code-style file tree** — create, rename, delete files and folders; multi-file tabs
- **Web preview** — live iframe preview for HTML/CSS projects with asset inlining
- **11 languages** — Python, JavaScript, TypeScript, Go, Rust, Java, C, C++, C#, Ruby, SQL
- **Shareable rooms** — join via 8-character room code, no signup required

---

## Quick Start

### Docker Compose (local)

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API docs | http://localhost:8000/docs |

### Local Development

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

docker compose up postgres redis -d   # infra only

alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `frontend/.env.local` for local dev.

---

## Deployment (AWS EKS)

### Prerequisites

- AWS CLI configured
- Terraform >= 1.6
- kubectl
- helm

### 1. Bootstrap Terraform state

```bash
./scripts/bootstrap-state.sh
```

Creates the S3 bucket and DynamoDB table used for Terraform state.

### 2. Provision infrastructure

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # fill in values
terraform init
terraform apply
```

This provisions:
- VPC with public/private subnets across 3 AZs
- EKS 1.30 cluster with managed node group
- RDS PostgreSQL 16 (encrypted, deletion-protected)
- ElastiCache Redis 7.1 (TLS + auth)
- ECR repositories for backend and frontend
- AWS Load Balancer Controller
- IAM OIDC role for GitHub Actions (keyless auth)

### 3. Configure GitHub secrets

| Secret | Value |
|---|---|
| `AWS_ROLE_ARN` | `terraform output -raw github_actions_role_arn` |
| `TF_DB_PASSWORD` | your DB password |
| `DATABASE_URL` | `terraform output -raw rds_database_url` |
| `REDIS_URL` | `terraform output -raw redis_url` |

### 4. Update kubeconfig

```bash
aws eks update-kubeconfig --name collabedit-production-cluster --region us-east-1
```

### 5. Deploy

```bash
# Apply all manifests
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/configmap.yaml

# Patch secrets (edit script with real values first)
bash scripts/patch-secrets.sh

# Apply workloads
kubectl apply -f infra/k8s/backend/
kubectl apply -f infra/k8s/frontend/
kubectl apply -f infra/k8s/ingress.yaml
kubectl apply -f infra/k8s/hpa.yaml

# Restart to pick up latest images
kubectl rollout restart deployment/backend deployment/frontend -n collabedit
```

Get the public URL:
```bash
kubectl get ingress -n collabedit
```

### 6. Update config without rebuilding

Edit the ConfigMap and restart — no image rebuild needed:
```bash
kubectl edit configmap collabedit-config -n collabedit
kubectl rollout restart deployment/frontend deployment/backend -n collabedit
```

---

## CI/CD

**GitHub Actions** (`.github/workflows/ci.yml`) runs on every push to `main`:

1. TypeScript type check
2. Python lint (ruff)
3. Build and push Docker images to ECR (tagged with commit SHA + `latest`)

After CI completes, deploy manually:
```bash
kubectl rollout restart deployment/backend deployment/frontend -n collabedit
kubectl rollout status deployment/backend deployment/frontend -n collabedit --timeout=300s
```

---

## Architecture

```
Browser
  │
  ▼
AWS ALB (internet-facing)
  ├── /api/*  ──► backend pods (FastAPI)
  ├── /ws/*   ──► backend pods (WebSocket)
  └── /*      ──► frontend pods (Next.js)

backend pods
  ├── RDS PostgreSQL  (rooms, files, operations)
  └── ElastiCache Redis  (pub/sub fanout + presence)
```

Redis pub/sub allows horizontal scaling — any backend pod can receive a WebSocket op and fan it out to clients connected to other pods via the shared channel `room:{room_id}`.

---

## How Operational Transforms Work

### The Problem

Two users editing simultaneously produce conflicting operations. Without conflict resolution, the last write wins.

```
Document: "hello"
User A: insert(" world") at position 5  → wants "hello world"
User B: delete(0, 5)                    → wants ""
```

Applied naively in different orders, users diverge. OT solves this.

### Transform Function

`transform(opA, opB)` answers:
> "opA and opB were created against the same document state. opB has already been applied. What should opA become so that applying it after opB gives the correct result?"

**Four cases:**

| opA \ opB | insert | delete |
|---|---|---|
| **insert** | shift right if opB.pos ≤ opA.pos | clamp/shift based on overlap |
| **delete** | expand or shift right | reduce length by overlap, no-op if fully covered |

### Client State Machine

```
local edit  →  apply optimistically  →  add to pendingOps  →  send to server
server ACK  →  remove from pendingOps  →  update revision
remote op   →  transform against pendingOps  →  apply to editor
```

### Server-Side OT

1. Fetch all ops since `client.revision` (concurrent ops)
2. Transform client op against each concurrent op
3. Apply result, increment revision
4. ACK sender, broadcast to others via Redis

---

## API Reference

```
POST /api/rooms                          Create room
GET  /api/rooms/{code}                   Get room by code
PUT  /api/rooms/{room_id}                Rename room

GET  /api/rooms/{room_id}/files          List files
POST /api/rooms/{room_id}/files          Create file or folder
PUT  /api/rooms/{room_id}/files/{id}     Rename file
DEL  /api/rooms/{room_id}/files/{id}     Delete file

POST /api/execute                        Execute code

WS   /ws/{room_id}?user_id=X&user_name=Y
```

### WebSocket Messages

**Client → Server**

| Type | Payload |
|---|---|
| `op` | `{ op, revision, user_id, user_name, file_id }` |
| `join_file` | `{ file_id }` |
| `presence` | `{ cursor: { line, ch } }` |
| `language_change` | `{ language, file_id }` |
| `room_update` | `{ name }` |

**Server → Client**

| Type | Payload |
|---|---|
| `file_tree` | array of file objects |
| `file_sync` | `{ content, revision, language, file_id }` |
| `ack` | `{ revision }` |
| `remote_op` | `{ op, revision, user_id, user_name, file_id }` |
| `presence` | `{ user_id, user_name, color, cursor }` |
| `presence_leave` | `{ user_id }` |

---

## Database Schema

```sql
rooms       (id, code, name, language, content, revision, created_at, updated_at)
files       (id, room_id, path, name, content, language, is_folder, revision)
operations  (id, room_id, file_id, revision, user_id, op_type, position, text, length, created_at)
```

`operations` is the OT history log. Clients reconnecting after a disconnect request ops since their last revision to catch up without a full resync.
