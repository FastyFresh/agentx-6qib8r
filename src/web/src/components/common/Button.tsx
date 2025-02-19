import React from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { BaseComponentProps, Size } from '../../types/common.types';
import styles from './Button.module.css';

/**
 * Props interface for the Button component extending base component props
 */
interface ButtonProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'tertiary';
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  ariaLabel?: string;
  theme?: 'light' | 'dark' | 'system';
}

/**
 * Generates size-specific CSS classes based on Material Design 3.0 specifications
 */
const getSizeClasses = (size: Size): string => {
  const sizeMap = {
    [Size.SMALL]: styles.buttonSmall,
    [Size.MEDIUM]: styles.buttonMedium,
    [Size.LARGE]: styles.buttonLarge
  };
  return sizeMap[size] || sizeMap[Size.MEDIUM];
};

/**
 * Determines theme-specific CSS classes based on current theme and system preferences
 */
const getThemeClasses = (theme: 'light' | 'dark' | 'system'): string => {
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? styles.buttonDark : styles.buttonLight;
  }
  return theme === 'dark' ? styles.buttonDark : styles.buttonLight;
};

/**
 * Material Design 3.0 Button Component
 * Implements MD3 specifications with theme awareness and accessibility support
 */
const Button: React.FC<ButtonProps> = React.memo(({
  variant = 'primary',
  size = Size.MEDIUM,
  disabled = false,
  loading = false,
  type = 'button',
  onClick,
  ariaLabel,
  theme = 'system',
  className,
  children,
  testId
}) => {
  // Compose class names based on props
  const buttonClasses = classNames(
    styles.button,
    styles[`button${variant.charAt(0).toUpperCase()}${variant.slice(1)}`],
    getSizeClasses(size),
    getThemeClasses(theme),
    {
      [styles.buttonDisabled]: disabled,
      [styles.buttonLoading]: loading
    },
    className
  );

  // Handle keyboard interaction for accessibility
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
    }
  };

  return (
    <button
      type={type}
      className={buttonClasses}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      aria-busy={loading}
      onKeyDown={handleKeyDown}
      data-testid={testId}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      {loading && (
        <span className={styles.buttonSpinner} aria-hidden="true">
          <svg className={styles.spinnerSvg} viewBox="0 0 24 24">
            <circle
              className={styles.spinnerCircle}
              cx="12"
              cy="12"
              r="10"
              fill="none"
              strokeWidth="3"
            />
          </svg>
        </span>
      )}
      <span className={styles.buttonContent}>{children}</span>
    </button>
  );
});

// Display name for debugging
Button.displayName = 'Button';

export default Button;