variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used as prefix for all resources"
  type        = string
  default     = "collabedit"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

# ── VPC ───────────────────────────────────────────────────────────────────────
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# ── EKS ───────────────────────────────────────────────────────────────────────
variable "eks_cluster_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.30"
}

variable "node_instance_type" {
  description = "EC2 instance type for EKS managed nodes"
  type        = string
  default     = "t3.medium"
}

variable "node_desired_size" {
  description = "Desired number of worker nodes"
  type        = number
  default     = 2
}

variable "node_min_size" {
  description = "Minimum number of worker nodes"
  type        = number
  default     = 1
}

variable "node_max_size" {
  description = "Maximum number of worker nodes"
  type        = number
  default     = 5
}

# ── RDS ───────────────────────────────────────────────────────────────────────
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "collabedit"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "collabedit"
}

variable "db_password" {
  description = "PostgreSQL master password (store in GitHub secrets, never commit)"
  type        = string
  sensitive   = true
}

variable "db_allocated_storage" {
  description = "Initial storage in GB for RDS"
  type        = number
  default     = 20
}

# ── ElastiCache ───────────────────────────────────────────────────────────────
variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

# ── GitHub Actions OIDC ───────────────────────────────────────────────────────
variable "github_repo" {
  description = "GitHub repo in org/repo format for OIDC trust"
  type        = string
  default     = "Navneet072300/CollabEdit"
}

# ── ACM ───────────────────────────────────────────────────────────────────────
variable "domain_name" {
  description = "Primary domain name for the application (e.g. collabedit.example.com)"
  type        = string
  default     = ""
}
