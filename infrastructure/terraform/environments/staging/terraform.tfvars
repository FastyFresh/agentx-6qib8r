# AWS Region Configuration
aws_region = "us-west-2"

# Environment Identifier
environment = "staging"

# VPC Configuration
vpc_cidr = "10.1.0.0/16"

# EKS Cluster Configuration
cluster_name = "agent-ai-staging"
eks_config = {
  cluster_version  = "1.27"
  cluster_name     = "agent-ai-staging"
  enabled_logs     = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
  retention_days   = 30
  public_access    = false
  private_access   = true
  security_groups  = []
  service_ipv4_cidr = "172.20.0.0/16"
}

# Node Groups Configuration
node_groups = {
  general = {
    instance_types    = ["t3.large"]
    ami_type         = "AL2_x86_64"
    capacity_type    = "ON_DEMAND"
    disk_size        = 50
    desired_size     = 2
    max_size         = 4
    min_size         = 2
    max_unavailable  = 1
    labels = {
      Environment = "staging"
      Type       = "general"
    }
    taints = []
  }
}

# RDS Configuration
db_config = {
  instance_class    = "db.t3.large"
  engine           = "postgres"
  engine_version   = "15.3"
  allocated_storage = 50
  storage_type     = "gp3"
  multi_az         = false
  backup_retention = 7
  backup_window    = "03:00-04:00"
  username         = "agent_ai_staging"
  password         = "TO_BE_SET_BY_SECRETS_MANAGER"
}

# ElastiCache Configuration
cache_config = {
  node_type             = "cache.t3.medium"
  num_cache_nodes      = 2
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
  allowed_ips          = ["10.1.0.0/16"]
  ssl_policy          = "ELBSecurityPolicy-TLS-1-2-2017-01"
  waf_enabled         = true
  shield_advanced     = false
}

# Monitoring Configuration
monitoring_config = {
  metrics_enabled     = true
  detailed_monitoring = true
  retention_days     = 30
  log_types          = ["application", "system", "security"]
  alarm_email        = "staging-alerts@agent-ai-platform.com"
  dashboard_enabled  = true
}

# Backup Configuration
backup_config = {
  retention_period = 30
  backup_window   = "02:00-03:00"
  enabled         = true
  transition_days = {
    glacier      = 90
    deep_archive = 180
  }
}

# Resource Tags
tags = {
  Project     = "AGENT-AI-Platform"
  Environment = "staging"
  ManagedBy   = "Terraform"
  CostCenter  = "staging-infrastructure"
  Team        = "platform-engineering"
}