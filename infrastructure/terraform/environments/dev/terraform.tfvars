# AWS Region Configuration
aws_region = "us-east-1"  # Most cost-effective region for development

# VPC Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = ["us-east-1a", "us-east-1b"]  # Minimum AZs for dev environment
enable_nat_gateway = true  # Required for private subnet connectivity

# EKS Cluster Configuration
cluster_name = "agent-ai-dev"
kubernetes_version = "1.27"  # Latest stable version

# Node Groups Configuration - Development Sizing
node_groups = {
  default = {
    instance_types    = ["t3.medium"]  # Cost-effective instance type for dev
    desired_size     = 2
    min_size        = 1
    max_size        = 3  # Limited scaling for dev environment
    disk_size       = 20  # Minimum required disk size
    labels = {
      Environment = "development"
      Project     = "agent-ai"
    }
    taints = []  # No taints for dev environment
  }
}

# RDS Configuration
db_config = {
  instance_class    = "db.t3.medium"  # Cost-effective instance for dev
  engine           = "postgres"
  engine_version   = "15.3"
  allocated_storage = 20  # Minimum storage for dev
  storage_type     = "gp3"
  multi_az         = false  # Single AZ for dev environment
  backup_retention = 7  # 7 days retention for dev
  backup_window    = "03:00-04:00"
  username         = "admin"
  password         = "DevPassword123!"  # Should be replaced with SSM parameter
}

# ElastiCache Configuration
cache_config = {
  node_type             = "cache.t3.micro"  # Cost-effective cache for dev
  num_cache_nodes      = 1  # Single node for dev
  engine               = "redis"
  engine_version      = "7.0"
  parameter_group_family = "redis7"
  port                 = 6379
  maintenance_window   = "sun:05:00-sun:06:00"
}

# Security Configuration
security_config = {
  encryption_at_rest    = true
  encryption_in_transit = true
  key_rotation         = true
  allowed_ips          = ["0.0.0.0/0"]  # Should be restricted to dev team IPs
  ssl_policy          = "ELBSecurityPolicy-TLS-1-2-2017-01"
  waf_enabled         = false  # Disabled for dev environment
  shield_advanced     = false  # Disabled for dev environment
}

# Monitoring Configuration
monitoring_config = {
  metrics_enabled     = true
  detailed_monitoring = false  # Basic monitoring for dev
  retention_days     = 7  # Shorter retention for dev
  log_types          = ["api", "audit"]  # Basic logging for dev
  alarm_email        = "dev-team@example.com"
  dashboard_enabled  = true
}

# Backup Configuration
backup_config = {
  retention_period = 7  # 7 days retention for dev
  backup_window   = "03:00-04:00"
  enabled         = true
  transition_days = {
    glacier      = 0  # No Glacier transition for dev
    deep_archive = 0  # No Deep Archive transition for dev
  }
}

# Resource Tags
tags = {
  Environment = "development"
  Project     = "agent-ai-platform"
  ManagedBy   = "terraform"
  Team        = "platform-engineering"
  CostCenter  = "dev-ops"
  Terraform   = "true"
}