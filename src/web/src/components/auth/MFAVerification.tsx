import React, { useState, useCallback } from 'react'; // ^18.2.0
import { useAuth } from '../../hooks/useAuth';
import { MFAVerificationData } from '../../types/auth.types';
import TextField from '../common/TextField';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';
import styles from './MFAVerification.module.css';

interface MFAVerificationProps {
  mfaToken: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  maxAttempts?: number;
}

/**
 * MFA Verification component implementing secure Time-based OTP verification
 * with comprehensive error handling and rate limiting
 */
const MFAVerification: React.FC<MFAVerificationProps> = ({
  mfaToken,
  onSuccess,
  onError,
  maxAttempts = 5
}) => {
  // Local state management
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [rememberDevice, setRememberDevice] = useState<boolean>(false);

  // Auth hook for MFA verification
  const { verifyMFA, isLoading, verificationAttempts } = useAuth();

  /**
   * Handles MFA code submission with validation and rate limiting
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setError('');

    // Validate code format
    if (!/^\d{6}$/.test(code)) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    // Check rate limiting
    if (verificationAttempts >= maxAttempts) {
      setError(`Too many attempts. Please try again in 15 minutes.`);
      return;
    }

    try {
      const verificationData: MFAVerificationData = {
        code,
        mfaToken,
        rememberDevice
      };

      await verifyMFA(verificationData);
      setCode('');
      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Verification failed';
      setError(errorMessage);
      onError?.(err as Error);
    }
  }, [code, mfaToken, rememberDevice, verifyMFA, maxAttempts, onSuccess, onError, verificationAttempts]);

  /**
   * Handles code input with real-time validation
   */
  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Only allow numeric input
    if (!/^\d*$/.test(value)) {
      return;
    }

    // Limit to 6 digits
    if (value.length <= 6) {
      setCode(value);
      setError('');
    }
  }, []);

  return (
    <div className={styles.container} role="dialog" aria-labelledby="mfa-title">
      <h2 id="mfa-title" className={styles.title}>
        Two-Factor Authentication
      </h2>
      
      <p className={styles.description}>
        Please enter the 6-digit code from your authenticator app
      </p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <TextField
          name="mfaCode"
          value={code}
          onChange={handleCodeChange}
          placeholder="Enter code"
          type="tel"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoFocus
          required
          disabled={isLoading}
          error={error}
          aria-label="Enter 6-digit MFA code"
          testId="mfa-code-input"
        />

        <label className={styles.rememberDevice}>
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
            disabled={isLoading}
          />
          Remember this device for 30 days
        </label>

        <div className={styles.actions}>
          <Button
            type="submit"
            disabled={isLoading || code.length !== 6}
            loading={isLoading}
            ariaLabel="Verify MFA code"
            testId="mfa-submit-button"
          >
            {isLoading ? (
              <LoadingSpinner size={20} />
            ) : (
              'Verify'
            )}
          </Button>
        </div>

        {error && (
          <div 
            className={styles.error} 
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}

        {verificationAttempts > 0 && (
          <div className={styles.attempts}>
            Attempts remaining: {maxAttempts - verificationAttempts}
          </div>
        )}
      </form>
    </div>
  );
};

export default MFAVerification;