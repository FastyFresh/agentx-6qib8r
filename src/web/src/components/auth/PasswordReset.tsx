import React, { useState, useCallback, useEffect } from 'react'; // ^18.2.0
import { useNavigate, useSearchParams } from 'react-router-dom'; // ^6.11.0
import { useRateLimit, useSecurityLog } from '@auth0/auth0-react'; // ^2.0.0
import { useAuth } from '../../hooks/useAuth';
import FormField from '../common/FormField';
import { Size, Severity } from '../../types/common.types';

interface PasswordResetFormData {
  email: string;
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
}

interface PasswordStrengthRequirements {
  hasMinLength: boolean;
  hasUpperCase: boolean;
  hasLowerCase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

const PasswordReset: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resetPassword, error, isLoading } = useAuth();
  const { isRateLimited, incrementAttempts } = useRateLimit('password-reset', 5, 900000); // 5 attempts per 15 minutes
  const { logSecurityEvent } = useSecurityLog();

  // Form state
  const [formData, setFormData] = useState<PasswordResetFormData>({
    email: searchParams.get('email') || '',
    resetToken: searchParams.get('token') || '',
    newPassword: '',
    confirmPassword: ''
  });

  // Validation state
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof PasswordResetFormData, string>>>({});
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrengthRequirements>({
    hasMinLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false
  });

  // Validate password requirements in real-time
  const validatePassword = useCallback((password: string): PasswordStrengthRequirements => {
    return {
      hasMinLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
  }, []);

  // Handle input changes with validation
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'newPassword') {
      setPasswordStrength(validatePassword(value));
    }

    // Clear validation errors on input change
    setValidationErrors(prev => ({ ...prev, [name]: '' }));
  }, [validatePassword]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isRateLimited) {
      setValidationErrors({
        newPassword: 'Too many attempts. Please try again later.'
      });
      return;
    }

    // Validate all requirements are met
    const strength = validatePassword(formData.newPassword);
    const isPasswordValid = Object.values(strength).every(Boolean);

    if (!isPasswordValid) {
      setValidationErrors({
        newPassword: 'Password does not meet all requirements'
      });
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setValidationErrors({
        confirmPassword: 'Passwords do not match'
      });
      return;
    }

    try {
      incrementAttempts();
      
      await resetPassword({
        email: formData.email,
        token: formData.resetToken,
        newPassword: formData.newPassword
      });

      logSecurityEvent({
        type: 'password-reset-success',
        email: formData.email,
        timestamp: new Date().toISOString()
      });

      // Redirect to login page on success
      navigate('/login', { 
        state: { 
          message: 'Password reset successful. Please log in with your new password.',
          severity: Severity.SUCCESS 
        } 
      });
    } catch (err) {
      logSecurityEvent({
        type: 'password-reset-failure',
        email: formData.email,
        error: err,
        timestamp: new Date().toISOString()
      });
    }
  };

  // Check token validity on mount
  useEffect(() => {
    if (!formData.resetToken || !formData.email) {
      navigate('/login', { 
        state: { 
          message: 'Invalid or expired password reset link.',
          severity: Severity.ERROR 
        } 
      });
    }
  }, [formData.resetToken, formData.email, navigate]);

  return (
    <form 
      onSubmit={handleSubmit}
      className="password-reset-form"
      aria-labelledby="password-reset-title"
    >
      <h1 id="password-reset-title" className="password-reset-title">
        Reset Your Password
      </h1>

      <FormField
        label="Email"
        required
        size={Size.MEDIUM}
        error={validationErrors.email}
        disabled
      >
        <input
          type="email"
          name="email"
          value={formData.email}
          readOnly
          aria-readonly="true"
          className="form-input"
        />
      </FormField>

      <FormField
        label="New Password"
        required
        size={Size.MEDIUM}
        error={validationErrors.newPassword}
        helperText="Password must be at least 8 characters and include uppercase, lowercase, number, and special character"
      >
        <input
          type="password"
          name="newPassword"
          value={formData.newPassword}
          onChange={handleInputChange}
          className="form-input"
          aria-invalid={!!validationErrors.newPassword}
          autoComplete="new-password"
        />
      </FormField>

      <div className="password-requirements" role="status" aria-live="polite">
        <ul>
          {Object.entries(passwordStrength).map(([requirement, isMet]) => (
            <li key={requirement} className={isMet ? 'requirement-met' : 'requirement-pending'}>
              <span aria-hidden="true">{isMet ? '✓' : '○'}</span>
              {requirement.replace(/([A-Z])/g, ' $1').toLowerCase()}
            </li>
          ))}
        </ul>
      </div>

      <FormField
        label="Confirm Password"
        required
        size={Size.MEDIUM}
        error={validationErrors.confirmPassword}
      >
        <input
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleInputChange}
          className="form-input"
          aria-invalid={!!validationErrors.confirmPassword}
          autoComplete="new-password"
        />
      </FormField>

      {error && (
        <div className="error-message" role="alert">
          {error.message}
        </div>
      )}

      <button
        type="submit"
        className="submit-button"
        disabled={isLoading || isRateLimited}
        aria-busy={isLoading}
      >
        {isLoading ? 'Resetting Password...' : 'Reset Password'}
      </button>
    </form>
  );
};

export default PasswordReset;