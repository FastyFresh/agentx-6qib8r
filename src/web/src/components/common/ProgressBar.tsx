import React, { memo, useCallback } from 'react';
import classNames from 'classnames';
import '../styles/variables.css';
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  value: number;
  maxValue?: number;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  animated?: boolean;
  indeterminate?: boolean;
  showLabel?: boolean;
  className?: string;
  ariaLabel?: string;
  ariaValuetext?: string;
}

const calculateProgressWidth = (value: number, maxValue: number): string => {
  const percentage = Math.min(Math.max((value / maxValue) * 100, 0), 100);
  return `${Math.round(percentage)}%`;
};

const ProgressBar: React.FC<ProgressBarProps> = memo(({
  value,
  maxValue = 100,
  variant = 'primary',
  animated = true,
  indeterminate = false,
  showLabel = false,
  className,
  ariaLabel,
  ariaValuetext,
}) => {
  const getProgressWidth = useCallback(() => {
    if (indeterminate) return '100%';
    return calculateProgressWidth(value, maxValue);
  }, [value, maxValue, indeterminate]);

  const progressClasses = classNames(
    styles.progressBar,
    styles[`variant-${variant}`],
    {
      [styles.animated]: animated && !indeterminate,
      [styles.indeterminate]: indeterminate,
    },
    className
  );

  const progressValue = Math.round((value / maxValue) * 100);
  const defaultAriaLabel = `Progress bar ${indeterminate ? 'loading' : `${progressValue}% complete`}`;

  return (
    <div className={styles.container}>
      <div
        role="progressbar"
        className={progressClasses}
        aria-valuenow={indeterminate ? undefined : progressValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={ariaValuetext || `${progressValue} percent`}
        aria-label={ariaLabel || defaultAriaLabel}
        aria-busy={indeterminate}
      >
        <div 
          className={styles.fill}
          style={{ width: getProgressWidth() }}
        />
      </div>
      {showLabel && !indeterminate && (
        <span className={styles.label} aria-hidden="true">
          {progressValue}%
        </span>
      )}
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;

// CSS Module definition
const styles = {
  container: `
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--spacing-scale-3);
  `,
  progressBar: `
    width: 100%;
    height: 4px;
    background-color: var(--color-background);
    border-radius: var(--border-radius-md);
    overflow: hidden;
    position: relative;
  `,
  fill: `
    height: 100%;
    background-color: var(--color-primary);
    border-radius: var(--border-radius-md);
    transition: width var(--transition-normal) ease-in-out;
    transform-origin: left;
  `,
  animated: `
    & .fill {
      transition: width var(--transition-normal) ease-in-out;
    }
  `,
  indeterminate: `
    & .fill {
      position: absolute;
      width: 50%;
      animation: indeterminate 2s infinite linear;
      transform-origin: left;
    }
  `,
  label: `
    font-family: var(--font-family-primary);
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
    min-width: 48px;
    text-align: right;
  `,
  'variant-primary': `
    & .fill {
      background-color: var(--color-primary);
    }
  `,
  'variant-secondary': `
    & .fill {
      background-color: var(--color-secondary);
    }
  `,
  'variant-success': `
    & .fill {
      background-color: var(--color-success);
    }
  `,
  'variant-warning': `
    & .fill {
      background-color: var(--color-warning);
    }
  `,
  'variant-error': `
    & .fill {
      background-color: var(--color-error);
    }
  `,
  '@keyframes indeterminate': `
    0% {
      transform: translateX(-100%) scaleX(1);
    }
    50% {
      transform: translateX(0%) scaleX(0.5);
    }
    100% {
      transform: translateX(100%) scaleX(1);
    }
  `,
} as const;