# CollabEdit — Real-Time Collaborative Code Editor

A full-stack collaborative code editor built with Operational Transforms, WebSockets, Redis pub/sub, and CodeMirror 6.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, TypeScript, CodeMirror 6, Zustand, Tailwind CSS v4 |
| Backend | FastAPI, Python 3.12, SQLAlchemy 2 (async), Alembic |
| Realtime | Native WebSockets, Redis pub/sub |
| Storage | PostgreSQL 16 |

---

## Quick Start

### With Docker Compose (recommended)

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

### Local Development

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Start postgres and redis (or use docker for just infra)
docker compose up postgres redis -d

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

---

## How Operational Transforms Work

### The Problem

Two users editing the same document simultaneously will produce conflicting operations. Without conflict resolution, the last write wins and one user's changes are lost.

Example:
```
Document: "hello"
User A types at position 5: insert(" world")  → wants "hello world"
User B deletes from 0-5: delete(0, 5)         → wants ""
```

If both operations are applied naively in different orders, users end up with different documents. OT solves this.

### The Solution: Transform

The core function is `transform(opA, opB)`:

> "OpA and opB were created against the same document state.  
> OpB has already been applied.  
> What should opA become (opA') so that applying opA' after opB gives the correct result?"

For the example above:
- `transform(insert(5, " world"), delete(0, 5))` → `insert(0, " world")`
- The insert is shifted left by 5 (the deletion removed those chars)
- Result: ` world` — both intentions preserved

### Four Transform Cases

```
insert vs insert:
  if opB.pos <= opA.pos → shift opA right by opB.text.length
  (tiebreak: server/opB wins)

insert vs delete:
  if opA.pos <= opB.pos → no change
  if opA.pos inside deleted range → clamp to opB.pos
  if opA.pos > opB.end → shift opA left by opB.length

delete vs insert:
  if opB.pos <= opA.pos → shift delete range right
  if opB.pos inside delete range → expand delete to include inserted text
  if opB.pos >= opA.end → no change

delete vs delete:
  if opB entirely before opA → shift opA left by opB.length
  if opB entirely after opA → no change
  if overlap → reduce opA.length by the overlap (already deleted)
  if opA entirely inside opB → opA becomes no-op (length=0)
```

### Client State Machine

Each client tracks:
- `revision` — the last server revision this client has seen
- `pendingOps` — ops sent to server but not yet ACK'd

```
On local edit:
  1. Apply op immediately to local document (optimistic update)
  2. Record op in pendingOps
  3. Send { type: "op", op, revision } to server

On server ACK:
  1. Remove the earliest pendingOp (it's been accepted)
  2. Update local revision to server's new revision

On remote op received:
  1. Transform remote op against each of our pendingOps
     → remoteOp' is safe to apply to our local document
  2. Apply remoteOp' to the editor
  3. Also transform each pendingOp against the original remote op
     → keeps our pendingOps valid against the updated document
```

### Server-Side OT

When the server receives an op from a client:
1. Fetch all ops from `client.revision + 1` to `server.revision` (concurrent ops the client hasn't seen)
2. Transform the client's op against each of those concurrent ops
3. Apply the result to the document, increment revision
4. ACK to sender with new revision
5. Broadcast transformed op to all other clients

### Why Revision Numbers?

Each op carries the client's current revision (which server ops they've seen). The server uses this to know which ops were "concurrent" — happened while the client was working without seeing them. Without revision tracking, we can't determine what to transform against.

### Redis Pub/Sub for Horizontal Scaling

Each FastAPI worker maintains WebSocket connections only for clients that connected to it. When an op arrives at worker-1, it needs to reach clients on worker-2.

Solution: after server OT, publish the broadcast payload to Redis channel `room:{room_id}`. Every worker subscribes to this channel and forwards messages to its local WebSocket clients.

```
client-A → worker-1 (op arrives)
worker-1 → Redis PUBLISH room:xyz
Redis    → worker-1 SUBSCRIBE (local broadcast, excluding client-A)
Redis    → worker-2 SUBSCRIBE (broadcast to all local clients)
```

This makes the system horizontally scalable: you can run N FastAPI workers behind a load balancer.

### Presence System

Cursor positions are stored in Redis hash `presence:{room_id}` with a 30-second TTL:
- On cursor move: client sends `{ type: "presence", cursor: {line, ch} }`
- Server writes `HSET presence:{room_id} {user_id} {json}` + `EXPIRE 30s`
- Server broadcasts via Redis pub/sub to all room clients
- On disconnect: `HDEL presence:{room_id} {user_id}` + leave broadcast
- Clients ping every 15s to refresh TTL while connected

---

## API Reference

```
POST /api/rooms                     Create a room
GET  /api/rooms/{code}              Get room by 8-char code
PUT  /api/rooms/{room_id}           Update room (name/language)
GET  /api/rooms/{room_id}/ops       Get ops since revision N

WS   /ws/{room_id}?user_id=X&user_name=Y    WebSocket connection
```

### WebSocket Message Types

**Client → Server:**
- `{ type: "op", op, revision, user_id, user_name }` — edit operation
- `{ type: "presence", cursor: {line, ch} }` — cursor update
- `{ type: "language_change", language }` — change syntax highlighting
- `{ type: "room_update", name }` — rename room

**Server → Client:**
- `{ type: "sync", content, revision, language }` — full state on join
- `{ type: "ack", revision }` — op accepted, new revision
- `{ type: "remote_op", op, revision, user_id, user_name }` — another user's op
- `{ type: "presence", user_id, user_name, color, cursor }` — cursor update
- `{ type: "presence_leave", user_id }` — user disconnected
- `{ type: "language_change", language }` — language changed
- `{ type: "room_update", name }` — room renamed

---

## Database Schema

```sql
rooms (
  id UUID PRIMARY KEY,
  code VARCHAR(8) UNIQUE,   -- shareable room code
  name VARCHAR(100),
  language VARCHAR(20),
  content TEXT,             -- current document snapshot
  revision INTEGER,         -- current server revision
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

operations (
  id BIGSERIAL PRIMARY KEY,
  room_id UUID → rooms.id,
  revision INTEGER,         -- server revision when applied
  user_id VARCHAR(36),
  user_name VARCHAR(50),
  op_type VARCHAR(10),      -- 'insert' or 'delete'
  position INTEGER,
  text TEXT,                -- present for insert ops
  length INTEGER,           -- present for delete ops
  created_at TIMESTAMPTZ,
  UNIQUE(room_id, revision)
)
```

The operations table serves as the source of truth for OT history. Clients reconnecting after a disconnect can request ops since their last known revision and catch up without a full resync.

Ops beyond the last 1000 per room are pruned to bound table growth.
