# AWS region configuration
variable "aws_region" {
  type        = string
  description = "AWS region where resources will be deployed"
  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-\\d{1}$", var.aws_region))
    error_message = "AWS region must be in the format: xx-xxxx-#, e.g., us-east-1"
  }
}

# Environment configuration
variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# VPC configuration
variable "vpc_config" {
  type = object({
    cidr_block           = string
    public_subnet_cidrs  = list(string)
    private_subnet_cidrs = list(string)
    enable_nat_gateway   = bool
    single_nat_gateway   = bool
    enable_vpn_gateway   = bool
  })
  description = "VPC configuration including CIDR blocks and subnet configuration"
  default = {
    cidr_block           = "10.0.0.0/16"
    public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
    private_subnet_cidrs = ["10.0.4.0/24", "10.0.5.0/24", "10.0.6.0/24"]
    enable_nat_gateway   = true
    single_nat_gateway   = false
    enable_vpn_gateway   = false
  }
}

# EKS cluster configuration
variable "eks_config" {
  type = object({
    cluster_version  = string
    cluster_name     = string
    enabled_logs     = list(string)
    retention_days   = number
    public_access    = bool
    private_access   = bool
    security_groups  = list(string)
    service_ipv4_cidr = string
  })
  description = "EKS cluster configuration including version and logging"
}

# Node groups configuration
variable "node_groups" {
  type = map(object({
    instance_types    = list(string)
    ami_type         = string
    capacity_type    = string
    disk_size        = number
    desired_size     = number
    max_size         = number
    min_size         = number
    max_unavailable  = number
    labels           = map(string)
    taints          = list(object({
      key    = string
      value  = string
      effect = string
    }))
  }))
  description = "Detailed configuration for EKS node groups including instance types, scaling, and taints"
  default = {
    default = {
      instance_types    = ["t3.medium"]
      ami_type         = "AL2_x86_64"
      capacity_type    = "ON_DEMAND"
      disk_size        = 50
      desired_size     = 2
      max_size         = 4
      min_size         = 1
      max_unavailable  = 1
      labels           = {}
      taints          = []
    }
  }
}

# RDS configuration
variable "db_config" {
  type = object({
    instance_class    = string
    engine           = string
    engine_version   = string
    allocated_storage = number
    storage_type     = string
    multi_az         = bool
    backup_retention = number
    backup_window    = string
    username         = string
    password         = string
  })
  description = "RDS configuration including instance type, storage, and backup settings"
  sensitive   = true
}

# ElastiCache configuration
variable "cache_config" {
  type = object({
    node_type             = string
    num_cache_nodes      = number
    engine               = string
    engine_version      = string
    parameter_group_family = string
    port                 = number
    maintenance_window   = string
  })
  description = "ElastiCache configuration including node type, number of nodes, and engine version"
}

# Security configuration
variable "security_config" {
  type = object({
    encryption_at_rest    = bool
    encryption_in_transit = bool
    key_rotation         = bool
    allowed_ips          = list(string)
    ssl_policy          = string
    waf_enabled         = bool
    shield_advanced     = bool
  })
  description = "Security configuration including encryption settings, key rotation, and network policies"
  sensitive   = true
}

# Monitoring configuration
variable "monitoring_config" {
  type = object({
    metrics_enabled     = bool
    detailed_monitoring = bool
    retention_days     = number
    log_types          = list(string)
    alarm_email        = string
    dashboard_enabled  = bool
  })
  description = "Monitoring configuration including metrics collection and alerting settings"
}

# Backup configuration
variable "backup_config" {
  type = object({
    retention_period = number
    backup_window   = string
    enabled         = bool
    transition_days = object({
      glacier      = number
      deep_archive = number
    })
  })
  description = "Backup configuration including retention periods and schedule"
}

# Resource tagging
variable "tags" {
  type        = map(string)
  description = "Common tags to be applied to all resources"
  default = {
    Project     = "AGENT-AI-Platform"
    ManagedBy   = "Terraform"
    Environment = "dev"
  }
}