import React from 'react'; // ^18.2.0
import { Card } from './Card';
import { notificationService } from '../../services/notificationService';
import { BaseComponentProps, Severity } from '../../types/common.types';

/**
 * Props interface for the ErrorBoundary component
 */
interface ErrorBoundaryProps extends BaseComponentProps {
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKey?: string;
}

/**
 * Interface for error boundary state
 */
interface ErrorState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error boundary component that provides comprehensive error handling with proper logging,
 * metrics tracking, and accessible error UI
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  /**
   * Updates state when an error occurs
   */
  static getDerivedStateFromError(error: Error): ErrorState {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  /**
   * Handles error reporting and notification
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Update state with error details
    this.setState({
      error,
      errorInfo
    });

    // Log sanitized error details in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        componentStack: errorInfo.componentStack
      });
    }

    // Track error metrics
    notificationService.trackError({
      error: {
        name: error.name,
        message: error.message,
        componentStack: errorInfo.componentStack
      }
    });

    // Send error notification
    notificationService.addNotification({
      message: 'An error occurred in the application',
      severity: Severity.ERROR,
      category: 'system'
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  /**
   * Handles error state reset when resetKey changes
   */
  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.props.resetKey !== prevProps.resetKey &&
      this.state.hasError
    ) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null
      });
    }
  }

  render(): React.ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, className } = this.props;

    if (hasError) {
      // Render custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI with proper accessibility
      return (
        <Card
          className={className}
          variant="outlined"
          testId="error-boundary-fallback"
          aria-live="polite"
          role="alert"
        >
          <div className="error-boundary">
            <h2 className="error-boundary__title">
              Something went wrong
            </h2>
            <p className="error-boundary__message">
              {error?.message || 'An unexpected error occurred'}
            </p>
            <button
              className="error-boundary__retry-button"
              onClick={() => this.setState({ hasError: false })}
              aria-label="Retry"
            >
              Try again
            </button>
          </div>
        </Card>
      );
    }

    return children;
  }
}

export default ErrorBoundary;