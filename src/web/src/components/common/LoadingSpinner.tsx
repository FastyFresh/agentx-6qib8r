import React from 'react'; // v18.2.0
import styles from '../../styles/animations.css';

interface LoadingSpinnerProps {
  /**
   * Size of the spinner in pixels or CSS units
   * @default "24px"
   */
  size?: string | number;
  
  /**
   * Color of the spinner, defaults to theme primary color
   * @default "var(--color-primary)"
   */
  color?: string;
  
  /**
   * Optional additional CSS classes
   */
  className?: string;
  
  /**
   * Accessibility label for screen readers
   * @default "Loading..."
   */
  ariaLabel?: string;
}

/**
 * Normalizes size value with proper CSS units
 * @param size - Size value to normalize
 * @returns Normalized size with CSS units
 */
const getSizeWithUnits = (size: string | number): string => {
  if (typeof size === 'number') {
    return `${size}px`;
  }
  return size;
};

/**
 * A circular loading spinner component implementing Material Design 3.0 motion principles.
 * Features GPU-accelerated animations and accessibility support.
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = React.memo(({
  size = '24px',
  color = 'var(--color-primary)',
  className = '',
  ariaLabel = 'Loading...'
}) => {
  const normalizedSize = getSizeWithUnits(size);
  
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
      className={`${styles.spinner} ${className}`.trim()}
      style={{
        width: normalizedSize,
        height: normalizedSize,
        display: 'inline-block',
      }}
    >
      <svg
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{
            transformOrigin: 'center',
            strokeDasharray: '56.549',
            strokeDashoffset: '20.000',
          }}
        />
      </svg>
    </div>
  );
});

// Display name for React DevTools
LoadingSpinner.displayName = 'LoadingSpinner';

export default LoadingSpinner;