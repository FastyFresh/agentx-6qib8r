# RDS Module for PostgreSQL Database Infrastructure
# Implements high availability, encryption, and performance optimization
# Provider version: hashicorp/aws ~> 5.0

locals {
  db_name         = "agent_platform_${var.environment}"
  db_port         = 5432
  engine          = "postgres"
  engine_version  = "15"
}

# DB subnet group for multi-AZ deployment
resource "aws_db_subnet_group" "this" {
  name        = "${local.db_name}-subnet-group"
  subnet_ids  = var.private_subnet_ids
  
  tags = {
    Name        = "${local.db_name}-subnet-group"
    Environment = var.environment
  }
}

# Primary RDS instance with high availability and security configurations
resource "aws_db_instance" "this" {
  identifier     = local.db_name
  engine         = local.engine
  engine_version = local.engine_version
  
  # Instance specifications
  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  
  # Database configuration
  db_name  = local.db_name
  username = var.db_username
  password = var.db_password
  port     = local.db_port
  
  # Network configuration
  db_subnet_group_name    = aws_db_subnet_group.this.name
  vpc_security_group_ids  = [var.security_group_id]
  multi_az               = true
  
  # Encryption and security
  storage_encrypted = true
  kms_key_id       = var.kms_key_arn
  
  # Backup configuration
  backup_retention_period = var.backup_retention_period
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"
  
  # Performance monitoring
  performance_insights_enabled          = true
  performance_insights_retention_period = var.performance_insights_retention_period
  monitoring_interval                   = 60
  monitoring_role_arn                  = var.monitoring_role_arn
  
  # Upgrade and protection settings
  auto_minor_version_upgrade = true
  deletion_protection       = true
  skip_final_snapshot      = false
  final_snapshot_identifier = "${local.db_name}-final-snapshot"
  
  # Resource tagging
  tags = {
    Name        = local.db_name
    Environment = var.environment
  }
}