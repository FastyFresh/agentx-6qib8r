import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react'; // ^14.0.0
import { describe, test, expect, beforeEach, jest } from '@jest/globals'; // ^29.6.0
import { axe, toHaveNoViolations } from '@axe-core/react'; // ^4.7.0
import { Auth0Client } from '@auth0/auth0-react'; // ^2.2.0
import LoginForm from '../../../../src/components/auth/LoginForm';
import { useAuth } from '../../../../src/hooks/useAuth';
import { VALIDATION_ERRORS } from '../../../../src/constants/errorMessages';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock useAuth hook
jest.mock('../../../../src/hooks/useAuth');

// Mock Auth0 client
jest.mock('@auth0/auth0-react', () => ({
  Auth0Client: jest.fn()
}));

describe('LoginForm', () => {
  // Test handlers
  const mockOnSuccess = jest.fn();
  const mockOnMFARequired = jest.fn();
  const mockLogin = jest.fn();
  const mockHandleMFAChallenge = jest.fn();
  const mockRefreshToken = jest.fn();

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    // Mock useAuth implementation
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: null,
      handleMFAChallenge: mockHandleMFAChallenge,
      refreshToken: mockRefreshToken
    });
  });

  test('renders form with all required fields', () => {
    render(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
      />
    );

    // Verify form elements
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
  });

  test('validates form inputs correctly', async () => {
    render(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
      />
    );

    // Submit empty form
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // Check validation errors
    await waitFor(() => {
      expect(screen.getByText(VALIDATION_ERRORS.REQUIRED_FIELD)).toBeInTheDocument();
    });

    // Test invalid email
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'invalid-email' }
    });

    await waitFor(() => {
      expect(screen.getByText(VALIDATION_ERRORS.INVALID_EMAIL)).toBeInTheDocument();
    });

    // Test invalid password
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'weak' }
    });

    await waitFor(() => {
      expect(screen.getByText(VALIDATION_ERRORS.PASSWORD_REQUIREMENTS)).toBeInTheDocument();
    });
  });

  test('handles successful login flow', async () => {
    mockLogin.mockResolvedValue({ success: true });

    render(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
      />
    );

    // Fill form with valid data
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'StrongPass1!' }
    });
    fireEvent.click(screen.getByLabelText(/remember me/i));

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'StrongPass1!',
        rememberMe: true
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  test('handles MFA flow correctly', async () => {
    mockLogin.mockResolvedValue({
      mfaRequired: true,
      mfaToken: 'mfa-token-123',
      mfaMethod: 'totp'
    });

    render(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
      />
    );

    // Submit valid credentials
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'StrongPass1!' }
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockOnMFARequired).toHaveBeenCalledWith('mfa-token-123', 'totp');
    });
  });

  test('handles login errors correctly', async () => {
    const errorMessage = 'Invalid credentials';
    mockLogin.mockRejectedValue(new Error(errorMessage));

    render(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
      />
    );

    // Submit form
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'StrongPass1!' }
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  test('implements rate limiting for failed attempts', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));

    render(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
      />
    );

    // Attempt login multiple times
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      await waitFor(() => {
        if (i < 5) {
          expect(screen.getByText(/attempts remaining/i)).toBeInTheDocument();
        } else {
          expect(screen.getByText(/too many failed attempts/i)).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
        }
      });
    }
  });

  test('meets accessibility requirements', async () => {
    const { container } = render(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
      />
    );

    // Run accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Test keyboard navigation
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const rememberMeCheckbox = screen.getByLabelText(/remember me/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    emailInput.focus();
    expect(document.activeElement).toBe(emailInput);

    fireEvent.keyDown(emailInput, { key: 'Tab' });
    expect(document.activeElement).toBe(passwordInput);

    fireEvent.keyDown(passwordInput, { key: 'Tab' });
    expect(document.activeElement).toBe(rememberMeCheckbox);

    fireEvent.keyDown(rememberMeCheckbox, { key: 'Tab' });
    expect(document.activeElement).toBe(submitButton);
  });

  test('handles password visibility toggle', () => {
    render(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
      />
    );

    const passwordInput = screen.getByLabelText(/password/i);
    const toggleButton = screen.getByRole('button', { name: /show password/i });

    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('integrates with Auth0 client correctly', async () => {
    const mockAuth0Login = jest.fn();
    (Auth0Client as jest.Mock).mockImplementation(() => ({
      loginWithRedirect: mockAuth0Login
    }));

    render(
      <LoginForm
        onSuccess={mockOnSuccess}
        onMFARequired={mockOnMFARequired}
      />
    );

    // Submit valid credentials
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'StrongPass1!' }
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
  });
});