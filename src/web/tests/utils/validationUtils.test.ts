/**
 * Validation Utilities Test Suite
 * Comprehensive test coverage for form input validation and security checks
 * @version 1.0.0
 */

import { describe, it, expect } from '@jest/globals'; // ^29.6.0
import {
  validateRequired,
  validateEmail,
  validatePassword,
  validateUrl,
  validateUUID
} from '../../src/utils/validationUtils';
import { VALIDATION_ERRORS } from '../../src/constants/errorMessages';

describe('validateRequired', () => {
  it('should return false for undefined values', () => {
    expect(validateRequired(undefined)).toBe(false);
  });

  it('should return false for null values', () => {
    expect(validateRequired(null)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(validateRequired('')).toBe(false);
  });

  it('should return false for whitespace string', () => {
    expect(validateRequired('   ')).toBe(false);
  });

  it('should return true for valid string', () => {
    expect(validateRequired('test')).toBe(true);
  });

  it('should return false for empty array', () => {
    expect(validateRequired([])).toBe(false);
  });

  it('should return true for non-empty array', () => {
    expect(validateRequired([1, 2, 3])).toBe(true);
  });

  it('should return false for empty object', () => {
    expect(validateRequired({})).toBe(false);
  });

  it('should return true for non-empty object', () => {
    expect(validateRequired({ key: 'value' })).toBe(true);
  });

  it('should handle numbers correctly', () => {
    expect(validateRequired(0)).toBe(true);
    expect(validateRequired(1)).toBe(true);
  });

  it('should handle boolean values correctly', () => {
    expect(validateRequired(false)).toBe(true);
    expect(validateRequired(true)).toBe(true);
  });
});

describe('validateEmail', () => {
  it('should return false for undefined email', () => {
    expect(validateEmail(undefined as unknown as string)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(validateEmail('')).toBe(false);
  });

  it('should return false for invalid email format', () => {
    expect(validateEmail('invalid.email')).toBe(false);
    expect(validateEmail('invalid@')).toBe(false);
    expect(validateEmail('@domain.com')).toBe(false);
  });

  it('should return true for valid email format', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('user.name+tag@example.com')).toBe(true);
    expect(validateEmail('user-name@domain.co.uk')).toBe(true);
  });

  it('should handle SQL injection patterns', () => {
    expect(validateEmail("' OR '1'='1")).toBe(false);
    expect(validateEmail('user@domain.com; DROP TABLE users;')).toBe(false);
  });

  it('should validate international email formats', () => {
    expect(validateEmail('user@domain.香港')).toBe(true);
    expect(validateEmail('用户@domain.com')).toBe(true);
  });

  it('should enforce length constraints', () => {
    const longEmail = 'a'.repeat(256) + '@example.com';
    expect(validateEmail(longEmail)).toBe(false);
  });
});

describe('validatePassword', () => {
  it('should return false for undefined password', () => {
    expect(validatePassword(undefined as unknown as string)).toBe(false);
  });

  it('should enforce minimum length requirement', () => {
    expect(validatePassword('Abc123!')).toBe(false); // 7 characters
    expect(validatePassword('Abc123!@')).toBe(true); // 8 characters
  });

  it('should require uppercase letters', () => {
    expect(validatePassword('abc123!@')).toBe(false);
    expect(validatePassword('Abc123!@')).toBe(true);
  });

  it('should require lowercase letters', () => {
    expect(validatePassword('ABC123!@')).toBe(false);
    expect(validatePassword('ABc123!@')).toBe(true);
  });

  it('should require numbers', () => {
    expect(validatePassword('Abcdef!@')).toBe(false);
    expect(validatePassword('Abcdef1!')).toBe(true);
  });

  it('should require special characters', () => {
    expect(validatePassword('Abcdef12')).toBe(false);
    expect(validatePassword('Abcdef12!')).toBe(true);
  });

  it('should reject common password patterns', () => {
    expect(validatePassword('Password123!')).toBe(false);
    expect(validatePassword('Qwerty123!')).toBe(false);
  });

  it('should handle maximum length constraints', () => {
    const longPassword = 'Aa1!' + 'a'.repeat(100);
    expect(validatePassword(longPassword)).toBe(false);
  });
});

describe('validateUrl', () => {
  it('should return false for undefined URL', () => {
    expect(validateUrl(undefined as unknown as string)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(validateUrl('')).toBe(false);
  });

  it('should enforce HTTPS protocol', () => {
    expect(validateUrl('http://api.example.com')).toBe(false);
    expect(validateUrl('https://api.example.com')).toBe(true);
  });

  it('should validate against allowed domains', () => {
    expect(validateUrl('https://api.example.com/path')).toBe(true);
    expect(validateUrl('https://platform.example.com/api')).toBe(true);
    expect(validateUrl('https://malicious.com')).toBe(false);
  });

  it('should handle URLs with query parameters', () => {
    expect(validateUrl('https://api.example.com/path?key=value')).toBe(true);
  });

  it('should handle URLs with fragments', () => {
    expect(validateUrl('https://api.example.com/path#section')).toBe(true);
  });

  it('should reject malicious URL patterns', () => {
    expect(validateUrl('https://api.example.com/<script>')).toBe(false);
    expect(validateUrl('https://api.example.com/path/../../')).toBe(false);
  });

  it('should validate URL length constraints', () => {
    const longUrl = 'https://api.example.com/' + 'a'.repeat(2048);
    expect(validateUrl(longUrl)).toBe(false);
  });
});

describe('validateUUID', () => {
  it('should return false for undefined UUID', () => {
    expect(validateUUID(undefined as unknown as string)).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(validateUUID('')).toBe(false);
  });

  it('should validate correct UUID v4 format', () => {
    expect(validateUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(false); // v1
    expect(validateUUID('123e4567-e89b-42d3-a456-426614174000')).toBe(true); // v4
  });

  it('should be case insensitive', () => {
    expect(validateUUID('123E4567-E89B-42D3-A456-426614174000')).toBe(true);
  });

  it('should reject malformed UUIDs', () => {
    expect(validateUUID('123e4567-e89b-42d3-a456')).toBe(false); // incomplete
    expect(validateUUID('123e4567-e89b-42d3-a456-42661417400')).toBe(false); // too short
    expect(validateUUID('123e4567-e89b-42d3-a456-4266141740000')).toBe(false); // too long
  });

  it('should reject UUIDs with invalid characters', () => {
    expect(validateUUID('123e4567-e89b-42d3-a456-42661417400g')).toBe(false);
    expect(validateUUID('123e4567-e89b-42d3-a456-42661417400/')).toBe(false);
  });

  it('should validate hyphen placement', () => {
    expect(validateUUID('123e4567e89b42d3a456426614174000')).toBe(false);
    expect(validateUUID('123e4567-e89b42d3-a456-426614174000')).toBe(false);
  });
});