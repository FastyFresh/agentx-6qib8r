import React from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { BaseComponentProps, Size } from '../../types/common.types';
import LoadingSpinner from '../LoadingSpinner';
import styles from './IconButton.module.css';

/**
 * Props interface for the IconButton component
 * Extends BaseComponentProps for consistent prop structure
 */
export interface IconButtonProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'tertiary';
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  ariaLabel: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  tabIndex?: number;
}

/**
 * Returns the appropriate CSS classes for the icon button size
 * @param size - Size enum value
 */
const getSizeClasses = (size: Size): string => {
  switch (size) {
    case Size.SMALL:
      return styles.sizeSmall;
    case Size.LARGE:
      return styles.sizeLarge;
    default:
      return styles.sizeMedium;
  }
};

/**
 * IconButton component implementing Material Design 3.0 specifications
 * Features circular button with icon, ripple effect, and full accessibility support
 */
const IconButton: React.FC<IconButtonProps> = React.memo(({
  variant = 'primary',
  size = Size.MEDIUM,
  disabled = false,
  loading = false,
  icon,
  onClick,
  ariaLabel,
  onKeyDown,
  tabIndex = 0,
  className,
  testId,
}) => {
  /**
   * Handles keyboard events for accessibility
   * @param event - Keyboard event
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
    }
    onKeyDown?.(event);
  };

  const buttonClasses = classNames(
    styles.iconButton,
    styles[`variant${variant.charAt(0).toUpperCase()}${variant.slice(1)}`],
    getSizeClasses(size),
    {
      [styles.disabled]: disabled,
      [styles.loading]: loading,
    },
    className
  );

  return (
    <button
      type="button"
      className={buttonClasses}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      tabIndex={disabled ? -1 : tabIndex}
      data-testid={testId}
    >
      <div className={styles.rippleContainer}>
        {loading ? (
          <LoadingSpinner
            size={size === Size.SMALL ? 16 : size === Size.LARGE ? 24 : 20}
            className={styles.spinner}
          />
        ) : (
          <span className={styles.iconWrapper}>
            {icon}
          </span>
        )}
      </div>
    </button>
  );
});

// Display name for React DevTools
IconButton.displayName = 'IconButton';

export default IconButton;