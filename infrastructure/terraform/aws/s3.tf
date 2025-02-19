# AWS Provider version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# S3 bucket for the AGENT AI Platform
resource "aws_s3_bucket" "agent_platform_bucket" {
  bucket = "agent-platform-${var.environment}"
  # Prevent accidental deletion of this bucket
  force_destroy = false

  tags = {
    Name               = "agent-platform-${var.environment}"
    Environment        = var.environment
    ManagedBy         = "Terraform"
    SecurityLevel     = "High"
    DataClassification = "Confidential"
  }
}

# Enable versioning for the bucket
resource "aws_s3_bucket_versioning" "bucket_versioning" {
  bucket = aws_s3_bucket.agent_platform_bucket.id
  versioning_configuration {
    status = "Enabled"
    # Enable MFA delete for additional security
    mfa_delete = "Enabled"
  }
}

# Configure server-side encryption using KMS
resource "aws_s3_bucket_server_side_encryption_configuration" "bucket_encryption" {
  bucket = aws_s3_bucket.agent_platform_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = data.aws_kms_key.key.arn
    }
    bucket_key_enabled = true
  }
}

# Configure lifecycle rules for object management
resource "aws_s3_bucket_lifecycle_configuration" "lifecycle_rule" {
  bucket = aws_s3_bucket.agent_platform_bucket.id

  rule {
    id     = "backup_retention"
    status = "Enabled"

    # Transition objects to STANDARD_IA after 30 days
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    # Delete objects after 90 days
    expiration {
      days = 90
    }

    # Move noncurrent versions to Glacier after 30 days
    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER"
    }
  }
}

# Block all public access
resource "aws_s3_bucket_public_access_block" "bucket_public_access_block" {
  bucket = aws_s3_bucket.agent_platform_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable access logging
resource "aws_s3_bucket_logging" "bucket_logging" {
  bucket = aws_s3_bucket.agent_platform_bucket.id

  target_bucket = aws_s3_bucket.agent_platform_bucket.id
  target_prefix = "access-logs/"
}

# CORS configuration for web access
resource "aws_s3_bucket_cors_configuration" "bucket_cors" {
  bucket = aws_s3_bucket.agent_platform_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["https://*.agent-platform.com"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Bucket policy to enforce SSL-only access
resource "aws_s3_bucket_policy" "bucket_policy" {
  bucket = aws_s3_bucket.agent_platform_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceSSLOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.agent_platform_bucket.arn,
          "${aws_s3_bucket.agent_platform_bucket.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# Output the bucket name
output "bucket_name" {
  value       = aws_s3_bucket.agent_platform_bucket.id
  description = "The name of the S3 bucket"
}

# Output the bucket ARN
output "bucket_arn" {
  value       = aws_s3_bucket.agent_platform_bucket.arn
  description = "The ARN of the S3 bucket"
}