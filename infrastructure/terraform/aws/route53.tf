# AWS Provider version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for common configurations
locals {
  domain_name = var.environment == "prod" ? "agent-ai.com" : "${var.environment}.agent-ai.com"
  common_tags = {
    Environment = var.environment
    Terraform   = "true"
    Service     = "DNS"
    Platform    = "AGENT-AI"
  }
}

# Primary Route 53 hosted zone
resource "aws_route53_zone" "route53_zone" {
  name          = local.domain_name
  comment       = "Managed by Terraform - AGENT AI Platform DNS Zone"
  tags          = local.common_tags
  force_destroy = false

  lifecycle {
    prevent_destroy = true
  }
}

# CloudFront distribution DNS record
resource "aws_route53_record" "cloudfront_record" {
  zone_id = aws_route53_zone.route53_zone.zone_id
  name    = local.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = true
  }
}

# ACM certificate validation records
resource "aws_route53_record" "validation_records" {
  for_each = {
    for dvo in aws_acm_certificate.acm_certificate.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id         = aws_route53_zone.route53_zone.zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

# Health check for the domain
resource "aws_route53_health_check" "health_check" {
  fqdn              = local.domain_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"

  tags = merge(local.common_tags, {
    Name = "agent-ai-platform-health-check"
  })
}

# DNS failover record for multi-region support
resource "aws_route53_record" "failover_record" {
  zone_id = aws_route53_zone.route53_zone.zone_id
  name    = "api.${local.domain_name}"
  type    = "A"

  failover_routing_policy {
    type = "PRIMARY"
  }

  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = true
  }

  health_check_id = aws_route53_health_check.health_check.id
  set_identifier  = "primary"
}

# Outputs
output "route53_zone_id" {
  value       = aws_route53_zone.route53_zone.zone_id
  description = "Zone ID for the Route 53 hosted zone"
}

output "route53_name_servers" {
  value       = aws_route53_zone.route53_zone.name_servers
  description = "List of name servers for the Route 53 zone"
}

output "health_check_id" {
  value       = aws_route53_health_check.health_check.id
  description = "ID of the Route 53 health check for monitoring"
}