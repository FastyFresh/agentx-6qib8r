# AWS Provider version ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for resource naming and configuration
locals {
  db_name             = "agent_platform_${var.environment}"
  backup_window       = "03:00-04:00"
  maintenance_window  = "Mon:04:00-Mon:05:00"
}

# IAM role for RDS enhanced monitoring
resource "aws_iam_role" "rds_monitoring_role" {
  name = "rds-monitoring-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# Attach the enhanced monitoring policy to the IAM role
resource "aws_iam_role_policy_attachment" "rds_monitoring_policy" {
  role       = aws_iam_role.rds_monitoring_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# RDS parameter group for PostgreSQL optimization
resource "aws_db_parameter_group" "postgres" {
  family = "postgres15"
  name   = "agent-platform-pg15-${var.environment}"

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  tags = var.tags
}

# Security group for RDS instance
resource "aws_security_group" "rds" {
  name        = "agent-platform-rds-${var.environment}"
  description = "Security group for Agent Platform RDS instance"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "PostgreSQL access from VPC"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "agent-platform-rds-${var.environment}"
  })
}

# RDS subnet group
resource "aws_db_subnet_group" "main" {
  name        = "agent-platform-${var.environment}"
  description = "RDS subnet group for Agent Platform"
  subnet_ids  = module.vpc.private_subnet_ids

  tags = var.tags
}

# Main RDS instance
resource "aws_db_instance" "main" {
  identifier     = "agent-platform-${var.environment}"
  engine         = "postgres"
  engine_version = "15"

  # Instance specifications
  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  iops                  = 3000

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  multi_az              = true

  # Database configuration
  db_name  = local.db_name
  username = var.db_username
  password = var.db_password
  port     = 5432

  # Backup and maintenance
  backup_retention_period = 30
  backup_window          = local.backup_window
  maintenance_window     = local.maintenance_window
  copy_tags_to_snapshot  = true

  # Monitoring and insights
  monitoring_interval                   = 60
  monitoring_role_arn                  = aws_iam_role.rds_monitoring_role.arn
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  enabled_cloudwatch_logs_exports      = ["postgresql", "upgrade"]

  # Security
  storage_encrypted        = true
  kms_key_id              = data.aws_kms_key.rds.arn
  deletion_protection     = true
  skip_final_snapshot     = false
  final_snapshot_identifier = "${local.db_name}-final-snapshot"

  # Parameter group
  parameter_group_name = aws_db_parameter_group.postgres.name

  # Auto minor version upgrade
  auto_minor_version_upgrade = true

  tags = merge(var.tags, {
    Name = "agent-platform-${var.environment}"
  })
}

# Outputs
output "rds_endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = aws_db_instance.main.endpoint
}

output "rds_arn" {
  description = "The ARN of the RDS instance"
  value       = aws_db_instance.main.arn
}