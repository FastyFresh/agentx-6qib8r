import { object, string } from 'yup'; // ^1.2.0
import { VALIDATION_ERRORS } from '../constants/errorMessages';
import type { LoginCredentials, MFAVerificationData } from '../types/auth.types';

/**
 * Regular expressions for enhanced validation
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const MFA_CODE_REGEX = /^\d{6}$/;
const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

/**
 * Login form validation schema
 * Validates email format and password complexity requirements
 */
export const loginSchema = object().shape<Record<keyof LoginCredentials, any>>({
  email: string()
    .required(VALIDATION_ERRORS.REQUIRED_FIELD)
    .matches(EMAIL_REGEX, VALIDATION_ERRORS.INVALID_EMAIL)
    .email(VALIDATION_ERRORS.INVALID_EMAIL)
    .trim(),
  password: string()
    .required(VALIDATION_ERRORS.REQUIRED_FIELD)
    .min(8, VALIDATION_ERRORS.PASSWORD_REQUIREMENTS)
    .matches(PASSWORD_REGEX, VALIDATION_ERRORS.PASSWORD_REQUIREMENTS)
    .trim(),
  rememberMe: string().optional()
});

/**
 * MFA verification form validation schema
 * Validates 6-digit OTP code format and MFA token presence
 */
export const mfaVerificationSchema = object().shape<Record<keyof MFAVerificationData, any>>({
  code: string()
    .required(VALIDATION_ERRORS.REQUIRED_FIELD)
    .matches(MFA_CODE_REGEX, VALIDATION_ERRORS.INVALID_MFA_CODE)
    .length(6, VALIDATION_ERRORS.INVALID_MFA_CODE)
    .trim(),
  mfaToken: string()
    .required(VALIDATION_ERRORS.REQUIRED_FIELD)
    .trim(),
  rememberDevice: string().optional()
});

/**
 * Password reset form validation schema
 * Enforces strong password requirements and confirmation matching
 */
export const passwordResetSchema = object().shape({
  password: string()
    .required(VALIDATION_ERRORS.REQUIRED_FIELD)
    .min(8, VALIDATION_ERRORS.PASSWORD_REQUIREMENTS)
    .matches(PASSWORD_REGEX, VALIDATION_ERRORS.PASSWORD_REQUIREMENTS)
    .trim(),
  confirmPassword: string()
    .required(VALIDATION_ERRORS.REQUIRED_FIELD)
    .oneOf([string().ref('password')], VALIDATION_ERRORS.PASSWORDS_DONT_MATCH)
    .trim()
});

/**
 * Email validation schema for password recovery request
 * Validates email format for password reset initiation
 */
export const passwordRecoverySchema = object().shape({
  email: string()
    .required(VALIDATION_ERRORS.REQUIRED_FIELD)
    .matches(EMAIL_REGEX, VALIDATION_ERRORS.INVALID_EMAIL)
    .email(VALIDATION_ERRORS.INVALID_EMAIL)
    .trim()
});