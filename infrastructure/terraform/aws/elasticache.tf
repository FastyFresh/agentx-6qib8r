# AWS ElastiCache Redis configuration for AGENT AI Platform
# Provider version: ~> 5.0

# Redis subnet group for secure placement in private subnets
resource "aws_elasticache_subnet_group" "redis_subnet_group" {
  name        = "agent-platform-cache-subnet-group"
  description = "Subnet group for AGENT AI Platform Redis cluster with multi-AZ support"
  subnet_ids  = var.private_subnet_ids

  tags = {
    Name        = "agent-platform-cache-subnet-group"
    Project     = "AGENT AI Platform"
    Environment = var.environment
    Terraform   = "true"
    ManagedBy   = "terraform"
  }
}

# Security group for Redis cluster access control
resource "aws_security_group" "redis_sg" {
  name        = "agent-platform-redis-sg"
  description = "Security group for AGENT AI Platform Redis cluster with strict access controls"
  vpc_id      = var.vpc_id

  ingress {
    description = "Redis access from application subnets"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [for subnet in data.aws_subnet.private : subnet.cidr_block]
  }

  egress {
    description = "Outbound access for updates and maintenance"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "agent-platform-redis-sg"
    Project     = "AGENT AI Platform"
    Environment = var.environment
    Terraform   = "true"
    ManagedBy   = "terraform"
  }
}

# Data source to fetch private subnet information
data "aws_subnet" "private" {
  count = length(var.private_subnet_ids)
  id    = var.private_subnet_ids[count.index]
}

# Redis cluster configuration
resource "aws_elasticache_cluster" "redis_cluster" {
  cluster_id               = "agent-platform-redis"
  engine                   = "redis"
  engine_version          = "7.0"
  node_type               = var.cache_config.node_type
  num_cache_nodes         = var.cache_config.num_cache_nodes
  parameter_group_name    = "default.redis7.0"
  port                    = var.cache_config.port
  subnet_group_name       = aws_elasticache_subnet_group.redis_subnet_group.name
  security_group_ids      = [aws_security_group.redis_sg.id]

  # Encryption configuration
  at_rest_encryption_enabled    = var.security_config.encryption_at_rest
  transit_encryption_enabled    = var.security_config.encryption_in_transit
  auth_token                   = var.security_config.encryption_in_transit ? random_password.redis_auth[0].result : null
  
  # High availability configuration
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  # Backup configuration
  snapshot_retention_limit = var.backup_config.retention_period
  snapshot_window         = var.backup_config.backup_window
  maintenance_window      = var.cache_config.maintenance_window

  # Monitoring and notification
  notification_topic_arn    = var.monitoring_config.metrics_enabled ? var.sns_topic_arn : null
  apply_immediately         = false
  auto_minor_version_upgrade = true

  tags = {
    Name               = "agent-platform-redis"
    Project            = "AGENT AI Platform"
    Environment        = var.environment
    Terraform          = "true"
    ManagedBy         = "terraform"
    Backup            = "required"
    SecurityCompliance = "required"
  }
}

# Generate random auth token for Redis if encryption in transit is enabled
resource "random_password" "redis_auth" {
  count   = var.security_config.encryption_in_transit ? 1 : 0
  length  = 32
  special = false
}

# Output: Redis cluster endpoint
output "redis_endpoint" {
  description = "Redis cluster endpoint for application configuration"
  value       = aws_elasticache_cluster.redis_cluster.cache_nodes[0].address
}

# Output: Redis cluster port
output "redis_port" {
  description = "Redis cluster port for application connectivity"
  value       = aws_elasticache_cluster.redis_cluster.port
}

# Output: Redis auth token (if encryption in transit is enabled)
output "redis_auth_token" {
  description = "Redis authentication token for secure access"
  value       = var.security_config.encryption_in_transit ? random_password.redis_auth[0].result : null
  sensitive   = true
}