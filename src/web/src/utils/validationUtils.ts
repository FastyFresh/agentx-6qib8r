/**
 * Validation Utilities
 * Comprehensive form and data validation with Zod schemas and enhanced security checks
 * @version 1.0.0
 */

import { z } from 'zod'; // ^3.22.0
import { VALIDATION_ERRORS } from '../constants/errorMessages';

// Security-focused logging utility
const logValidationError = (functionName: string, value: unknown, error: unknown): void => {
  console.error(`Validation error in ${functionName}:`, {
    value: typeof value === 'string' ? value.substring(0, 100) : typeof value,
    error,
    timestamp: new Date().toISOString()
  });
};

/**
 * Sanitizes input to prevent XSS attacks
 * @param input - Value to sanitize
 */
const sanitizeInput = (input: unknown): string => {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>]/g, '');
};

/**
 * Validates if a required field has a non-empty value
 * @param value - Value to validate
 */
export const validateRequired = (value: unknown): boolean => {
  try {
    const schema = z.any().refine((val) => {
      if (val === undefined || val === null) return false;
      if (typeof val === 'string') return val.trim().length > 0;
      if (Array.isArray(val)) return val.length > 0;
      if (typeof val === 'object') return Object.keys(val).length > 0;
      return true;
    }, { message: VALIDATION_ERRORS.REQUIRED_FIELD });

    const sanitizedValue = typeof value === 'string' ? sanitizeInput(value) : value;
    schema.parse(sanitizedValue);
    return true;
  } catch (error) {
    logValidationError('validateRequired', value, error);
    return false;
  }
};

/**
 * Validates email format using RFC 5322 standard
 * @param email - Email to validate
 */
export const validateEmail = (email: string): boolean => {
  try {
    const emailSchema = z.string()
      .email()
      .transform(val => val.toLowerCase().trim())
      .refine(val => {
        // Enhanced email validation pattern based on RFC 5322
        const pattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return pattern.test(val);
      }, { message: VALIDATION_ERRORS.INVALID_EMAIL });

    const sanitizedEmail = sanitizeInput(email);
    emailSchema.parse(sanitizedEmail);
    return true;
  } catch (error) {
    logValidationError('validateEmail', email, error);
    return false;
  }
};

/**
 * Validates password against enhanced security requirements
 * @param password - Password to validate
 */
export const validatePassword = (password: string): boolean => {
  try {
    const passwordSchema = z.string()
      .min(8)
      .refine(val => {
        const hasUppercase = /[A-Z]/.test(val);
        const hasLowercase = /[a-z]/.test(val);
        const hasNumber = /[0-9]/.test(val);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(val);
        const noCommonPatterns = !/^(password|123456|qwerty)/i.test(val);
        
        return hasUppercase && hasLowercase && hasNumber && hasSpecial && noCommonPatterns;
      }, { message: VALIDATION_ERRORS.INVALID_PASSWORD });

    passwordSchema.parse(password);
    return true;
  } catch (error) {
    logValidationError('validatePassword', '********', error);
    return false;
  }
};

/**
 * Validates URL format and security
 * @param url - URL to validate
 */
export const validateUrl = (url: string): boolean => {
  try {
    const urlSchema = z.string()
      .url()
      .refine(val => {
        try {
          const urlObj = new URL(val);
          // Enforce HTTPS
          if (urlObj.protocol !== 'https:') return false;
          
          // Check against allowed domains (example)
          const allowedDomains = ['api.example.com', 'platform.example.com'];
          return allowedDomains.some(domain => urlObj.hostname.endsWith(domain));
        } catch {
          return false;
        }
      }, { message: 'Invalid or insecure URL' });

    const sanitizedUrl = sanitizeInput(url);
    urlSchema.parse(sanitizedUrl);
    return true;
  } catch (error) {
    logValidationError('validateUrl', url, error);
    return false;
  }
};

/**
 * Validates UUID v4 format
 * @param uuid - UUID to validate
 */
export const validateUUID = (uuid: string): boolean => {
  try {
    const uuidSchema = z.string()
      .uuid()
      .refine(val => {
        // UUID v4 format validation
        const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidV4Pattern.test(val);
      }, { message: 'Invalid UUID format' });

    const sanitizedUuid = sanitizeInput(uuid);
    uuidSchema.parse(sanitizedUuid);
    return true;
  } catch (error) {
    logValidationError('validateUUID', uuid, error);
    return false;
  }
};