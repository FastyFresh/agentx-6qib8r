# Terraform variables definition file for RDS module
# Configures PostgreSQL database instances with high availability, encryption, and performance optimization
# Version: hashicorp/terraform ~> 1.5

variable "environment" {
  type        = string
  description = "Environment name for resource tagging and naming (e.g., prod, staging, dev)"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID where RDS instance will be deployed"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for RDS deployment in multiple availability zones"
}

variable "db_instance_class" {
  type        = string
  description = "RDS instance type for compute and memory allocation"
  default     = "db.t3.large"
}

variable "db_allocated_storage" {
  type        = number
  description = "Initial storage allocation in GB for RDS instance"
  default     = 100
}

variable "db_max_allocated_storage" {
  type        = number
  description = "Maximum storage allocation in GB for autoscaling"
  default     = 1000
}

variable "db_username" {
  type        = string
  description = "Master username for RDS instance"
  sensitive   = true
}

variable "db_password" {
  type        = string
  description = "Master password for RDS instance"
  sensitive   = true
}

variable "multi_az" {
  type        = bool
  description = "Enable multi-AZ deployment for high availability"
  default     = true
}

variable "kms_key_arn" {
  type        = string
  description = "KMS key ARN for RDS storage encryption using AES-256"
}

variable "backup_retention_period" {
  type        = number
  description = "Number of days to retain automated backups"
  default     = 30
}

variable "performance_insights_enabled" {
  type        = bool
  description = "Enable Performance Insights for monitoring database performance"
  default     = true
}

variable "performance_insights_retention_period" {
  type        = number
  description = "Retention period for Performance Insights data in days"
  default     = 7
}

variable "monitoring_interval" {
  type        = number
  description = "Enhanced Monitoring interval in seconds (0 to disable, 1, 5, 10, 15, 30, 60)"
  default     = 60
}

variable "monitoring_role_arn" {
  type        = string
  description = "IAM role ARN for Enhanced Monitoring permissions"
}

variable "security_group_id" {
  type        = string
  description = "Security group ID for RDS instance network access control"
}