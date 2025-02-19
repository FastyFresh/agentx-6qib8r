# RDS Module Outputs
# Exposes essential database connection and resource information
# Provider version: hashicorp/terraform ~> 1.5

output "db_instance_endpoint" {
  description = "Connection endpoint for the RDS instance in the format of hostname:port"
  value       = aws_db_instance.this.endpoint
  sensitive   = true
}

output "db_instance_port" {
  description = "Port number on which the RDS instance accepts connections (PostgreSQL default: 5432)"
  value       = aws_db_instance.this.port
}

output "db_instance_arn" {
  description = "Amazon Resource Name (ARN) of the RDS instance for IAM policy and cross-account access configuration"
  value       = aws_db_instance.this.arn
}

output "db_instance_address" {
  description = "DNS hostname of the RDS instance for flexible connection string construction"
  value       = aws_db_instance.this.address
  sensitive   = true
}

output "db_subnet_group_id" {
  description = "ID of the DB subnet group for VPC networking and security group configuration"
  value       = aws_db_subnet_group.this.id
}

output "db_subnet_group_arn" {
  description = "ARN of the DB subnet group for cross-account resource policies and IAM configuration"
  value       = aws_db_subnet_group.this.arn
}