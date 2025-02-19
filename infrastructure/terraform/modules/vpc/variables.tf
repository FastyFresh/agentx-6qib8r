# Terraform ~> 1.5

variable "vpc_cidr" {
  type        = string
  description = "The CIDR block for the VPC. Must be a valid IPv4 CIDR block."
  
  validation {
    condition     = can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", var.vpc_cidr))
    error_message = "The VPC CIDR block must be a valid IPv4 CIDR notation (e.g., 10.0.0.0/16)."
  }

  validation {
    condition     = tonumber(split("/", var.vpc_cidr)[1]) <= 24 && tonumber(split("/", var.vpc_cidr)[1]) >= 16
    error_message = "The VPC CIDR block must have a prefix length between /16 and /24."
  }
}

variable "environment" {
  type        = string
  description = "Environment name for resource tagging and identification (e.g., production, staging, development)."
  
  validation {
    condition     = can(regex("^[a-zA-Z0-9-]+$", var.environment))
    error_message = "Environment name must contain only alphanumeric characters and hyphens."
  }

  validation {
    condition     = length(var.environment) >= 3 && length(var.environment) <= 32
    error_message = "Environment name must be between 3 and 32 characters long."
  }
}

variable "availability_zones" {
  type        = list(string)
  description = "List of AWS Availability Zones for multi-AZ deployment within the selected region."
  
  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones must be specified for high availability."
  }

  validation {
    condition     = alltrue([for az in var.availability_zones : can(regex("^[a-z]{2}-[a-z]+-[0-9][a-z]$", az))])
    error_message = "Availability zones must be in the correct format (e.g., us-east-1a)."
  }
}

variable "enable_dns_hostnames" {
  type        = bool
  default     = true
  description = "Enable DNS hostnames in the VPC. Required for EC2 instances to receive DNS names."
}

variable "enable_dns_support" {
  type        = bool
  default     = true
  description = "Enable DNS resolution in the VPC. Required for internal DNS resolution and Route 53 private hosted zones."
}

variable "enable_nat_gateway" {
  type        = bool
  default     = true
  description = "Enable NAT Gateway deployment for private subnet internet access. One NAT Gateway per AZ will be deployed for high availability."
}

variable "tags" {
  type        = map(string)
  description = "Additional tags to apply to all VPC resources for better resource management and cost allocation."
  default     = {
    Terraform   = "true"
    ManagedBy   = "terraform"
  }

  validation {
    condition     = length(var.tags) <= 50
    error_message = "Maximum of 50 tags can be specified."
  }

  validation {
    condition     = alltrue([for k, v in var.tags : length(k) <= 128 && length(v) <= 256])
    error_message = "Tag keys must be <= 128 characters and values <= 256 characters."
  }
}