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
    ManagedBy   = "Terraform"
    Service     = "CDN"
  }
}

# ACM Certificate for CloudFront distribution
resource "aws_acm_certificate" "acm_certificate" {
  provider          = aws.us-east-1  # ACM certificate must be in us-east-1 for CloudFront
  domain_name       = local.domain_name
  validation_method = "DNS"
  
  tags = local.common_tags

  lifecycle {
    create_before_destroy = true
  }
}

# CloudFront Origin Access Identity
resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "OAI for AGENT AI Platform S3 bucket"
}

# CloudFront Response Headers Policy
resource "aws_cloudfront_response_headers_policy" "security_headers" {
  name = "security-headers-policy"

  security_headers_config {
    strict_transport_security {
      override        = true
      max_age_sec    = 31536000
      include_subdomains = true
      preload        = true
    }

    content_security_policy {
      override                = true
      content_security_policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.agent-ai.com;"
    }

    frame_options {
      override     = true
      frame_option = "DENY"
    }

    referrer_policy {
      override        = true
      referrer_policy = "strict-origin-when-cross-origin"
    }

    xss_protection {
      override   = true
      protection = true
      mode_block = true
    }
  }
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled    = true
  http_version       = "http2and3"
  price_class        = "PriceClass_All"
  aliases            = [local.domain_name]
  default_root_object = "index.html"
  comment            = "AGENT AI Platform CDN Distribution"

  origin {
    domain_name = aws_s3_bucket.agent_platform_bucket.bucket_regional_domain_name
    origin_id   = "S3-agent-platform-origin"

    origin_shield {
      enabled              = true
      origin_shield_region = "us-east-1"
    }

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
    }

    custom_header {
      name  = "X-Origin-Verify"
      value = "agent-platform-cdn"
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-agent-platform-origin"
    compress        = true

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"]

      cookies {
        forward = "none"
      }
    }

    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.security_headers.arn
    }
  }

  # Custom error responses for SPA
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.acm_certificate.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  web_acl_id = aws_wafv2_web_acl.cdn_waf.id
  tags       = local.common_tags
}

# CloudFront Function for additional security headers
resource "aws_cloudfront_function" "security_headers" {
  name    = "security-headers"
  runtime = "cloudfront-js-1.0"
  comment = "Add security headers to all responses"
  publish = true
  code    = <<-EOF
function handler(event) {
    var response = event.response;
    var headers = response.headers;

    headers['strict-transport-security'] = { value: 'max-age=31536000; includeSubdomains; preload'};
    headers['x-content-type-options'] = { value: 'nosniff'};
    headers['x-frame-options'] = { value: 'DENY'};
    headers['x-xss-protection'] = { value: '1; mode=block'};
    
    return response;
}
EOF
}

# Outputs
output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.main.id
  description = "The ID of the CloudFront distribution"
}

output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.main.domain_name
  description = "The domain name of the CloudFront distribution"
}