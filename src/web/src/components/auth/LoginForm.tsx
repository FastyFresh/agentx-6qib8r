import React, { memo, useState, useCallback } from 'react'; // ^18.2.0
import { useForm } from 'react-hook-form'; // ^7.45.0
import { yupResolver } from '@hookform/resolvers/yup'; // ^3.1.0
import { useAuth } from '../../hooks/useAuth';
import { loginSchema } from '../../validation/authSchema';
import FormField from '../common/FormField';
import { Size } from '../../types/common.types';
import { VALIDATION_ERRORS } from '../../constants/errorMessages';

interface LoginFormProps {
  onSuccess: () => void;
  onMFARequired: (mfaToken: string, method: 'totp' | 'sms') => void;
  className?: string;
  rememberMe?: boolean;
}

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

/**
 * Secure and accessible login form component with MFA support
 * Implements OAuth 2.0 + OIDC with Auth0 integration
 * @version 1.0.0
 */
const LoginForm: React.FC<LoginFormProps> = memo(({
  onSuccess,
  onMFARequired,
  className,
  rememberMe = false
}) => {
  // Form state management with validation
  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe
    }
  });

  // Authentication state and methods
  const { login, isLoading, error, resetError } = useAuth();

  // Password visibility toggle state
  const [showPassword, setShowPassword] = useState(false);

  // Track failed login attempts
  const [loginAttempts, setLoginAttempts] = useState(0);
  const MAX_LOGIN_ATTEMPTS = 5;

  /**
   * Handles form submission with proper error handling and MFA flow
   */
  const handleSubmit = useCallback(async (data: LoginFormData) => {
    try {
      clearErrors();
      resetError();

      if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        setError('root', {
          message: 'Too many failed attempts. Please try again later.'
        });
        return;
      }

      const result = await login({
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe
      });

      if (result.mfaRequired) {
        onMFARequired(result.mfaToken, result.mfaMethod);
      } else {
        setLoginAttempts(0);
        onSuccess();
      }
    } catch (err: any) {
      setLoginAttempts(prev => prev + 1);
      setError('root', {
        message: err.message || 'Authentication failed'
      });
    }
  }, [login, onSuccess, onMFARequired, loginAttempts, setError, clearErrors, resetError]);

  /**
   * Toggles password visibility
   */
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  return (
    <form
      className={`login-form ${className || ''}`}
      onSubmit={handleFormSubmit(handleSubmit)}
      noValidate
      aria-label="Login form"
    >
      {/* Email field */}
      <FormField
        label="Email"
        error={errors.email?.message}
        required
        size={Size.MEDIUM}
        testId="login-email-field"
      >
        <input
          type="email"
          {...register('email')}
          className="form-input"
          autoComplete="email"
          aria-invalid={!!errors.email}
          disabled={isLoading}
        />
      </FormField>

      {/* Password field with visibility toggle */}
      <FormField
        label="Password"
        error={errors.password?.message}
        required
        size={Size.MEDIUM}
        testId="login-password-field"
      >
        <div className="password-field">
          <input
            type={showPassword ? 'text' : 'password'}
            {...register('password')}
            className="form-input"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            disabled={isLoading}
          />
          <button
            type="button"
            className="password-toggle"
            onClick={togglePasswordVisibility}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={0}
          >
            {showPassword ? '👁️' : '👁️‍🗨️'}
          </button>
        </div>
      </FormField>

      {/* Remember me checkbox */}
      <FormField
        label="Remember me"
        size={Size.SMALL}
        testId="login-remember-field"
      >
        <input
          type="checkbox"
          {...register('rememberMe')}
          className="form-checkbox"
          disabled={isLoading}
        />
      </FormField>

      {/* Error messages */}
      {(error || errors.root) && (
        <div
          className="login-error"
          role="alert"
          aria-live="polite"
        >
          {error?.message || errors.root?.message}
        </div>
      )}

      {/* Rate limiting warning */}
      {loginAttempts > 2 && (
        <div
          className="login-warning"
          role="alert"
        >
          {`${MAX_LOGIN_ATTEMPTS - loginAttempts} attempts remaining before temporary lockout`}
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        className="login-submit"
        disabled={isLoading || loginAttempts >= MAX_LOGIN_ATTEMPTS}
        aria-busy={isLoading}
      >
        {isLoading ? 'Signing in...' : 'Sign in'}
      </button>

      {/* Password recovery link */}
      <a
        href="/forgot-password"
        className="forgot-password"
        tabIndex={0}
      >
        Forgot password?
      </a>
    </form>
  );
});

// Display name for debugging
LoginForm.displayName = 'LoginForm';

export default LoginForm;