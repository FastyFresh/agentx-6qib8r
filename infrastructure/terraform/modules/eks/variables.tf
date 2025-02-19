# Terraform AWS EKS Module Variables
# Version: ~> 1.5

variable "cluster_name" {
  type        = string
  description = "Name of the EKS cluster. Must be between 1-100 characters and contain only alphanumeric characters and hyphens."

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]{0,98}[a-zA-Z0-9]$", var.cluster_name))
    error_message = "Cluster name must start with a letter, end with an alphanumeric character, be between 1-100 characters, and only contain alphanumeric characters and hyphens."
  }
}

variable "vpc_id" {
  type        = string
  description = "ID of the VPC where the EKS cluster will be deployed."
}

variable "subnet_ids" {
  type        = list(string)
  description = "List of subnet IDs where the EKS cluster and node groups will be deployed. Must specify at least 2 subnets in different availability zones."

  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "At least 2 subnet IDs must be provided for high availability."
  }
}

variable "kubernetes_version" {
  type        = string
  description = "Kubernetes version for the EKS cluster. Must be a valid EKS version (e.g., 1.27, 1.28)."
  default     = "1.27"

  validation {
    condition     = can(regex("^1\\.(2[7-9]|[3-9][0-9])$", var.kubernetes_version))
    error_message = "Kubernetes version must be 1.27 or higher."
  }
}

variable "node_groups" {
  type = map(object({
    instance_types = list(string)
    desired_size   = number
    min_size      = number
    max_size      = number
    disk_size     = number
    labels        = map(string)
    taints = list(object({
      key    = string
      value  = string
      effect = string
    }))
  }))
  description = "Map of node group configurations for the EKS cluster."

  validation {
    condition = alltrue([
      for ng in var.node_groups : (
        ng.min_size <= ng.desired_size &&
        ng.desired_size <= ng.max_size &&
        ng.disk_size >= 20 &&
        length(ng.instance_types) > 0
      )
    ])
    error_message = "Invalid node group configuration. Ensure min_size <= desired_size <= max_size, disk_size >= 20GB, and at least one instance type is specified."
  }
}

variable "cluster_endpoint_private_access" {
  type        = bool
  default     = true
  description = "Whether the Amazon EKS private API server endpoint is enabled."
}

variable "cluster_endpoint_public_access" {
  type        = bool
  default     = false
  description = "Whether the Amazon EKS public API server endpoint is enabled."
}

variable "cluster_log_types" {
  type        = list(string)
  default     = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
  description = "List of the desired control plane logging to enable for the EKS cluster."

  validation {
    condition = alltrue([
      for log_type in var.cluster_log_types :
      contains(["api", "audit", "authenticator", "controllerManager", "scheduler"], log_type)
    ])
    error_message = "Invalid log type specified. Allowed values are: api, audit, authenticator, controllerManager, scheduler."
  }
}

variable "tags" {
  type = map(string)
  default = {
    "Environment" = "production"
    "Terraform"   = "true"
  }
  description = "Tags to be applied to all resources created by this module."

  validation {
    condition     = contains(keys(var.tags), "Environment")
    error_message = "Tags must include an 'Environment' tag."
  }
}