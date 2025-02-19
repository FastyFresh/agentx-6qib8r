import React from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { BaseComponentProps } from '../../types/common.types';
import Button from './Button';
import IconButton from './IconButton';
import styles from './Toolbar.module.css';

/**
 * Props interface for the Toolbar component with enhanced positioning and styling controls
 */
interface ToolbarProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'surface';
  position?: 'top' | 'bottom';
  sticky?: boolean;
  elevated?: boolean;
  startActions?: React.ReactNode;
  endActions?: React.ReactNode;
}

/**
 * Generates CSS class names for the toolbar based on its configuration
 */
const getToolbarClasses = (
  variant: string,
  position: string,
  sticky: boolean,
  elevated: boolean,
  className?: string
): string => {
  return classNames(
    styles.toolbar,
    styles[`toolbar${variant.charAt(0).toUpperCase()}${variant.slice(1)}`],
    styles[`position${position.charAt(0).toUpperCase()}${position.slice(1)}`],
    {
      [styles.toolbarSticky]: sticky,
      [styles.toolbarElevated]: elevated,
      [styles.toolbarAnimated]: sticky || elevated
    },
    className
  );
};

/**
 * Material Design 3.0 Toolbar Component
 * Implements MD3 specifications with enhanced positioning and theming support
 */
const Toolbar: React.FC<ToolbarProps> = React.memo(({
  variant = 'primary',
  position = 'top',
  sticky = false,
  elevated = true,
  startActions,
  endActions,
  className,
  children,
  testId
}) => {
  return (
    <div
      role="toolbar"
      aria-orientation="horizontal"
      className={getToolbarClasses(variant, position, sticky, elevated, className)}
      data-testid={testId}
    >
      {startActions && (
        <div className={styles.toolbarSection} data-section="start">
          {startActions}
        </div>
      )}

      {children && (
        <div className={styles.toolbarContent}>
          {children}
        </div>
      )}

      {endActions && (
        <div className={styles.toolbarSection} data-section="end">
          {endActions}
        </div>
      )}
    </div>
  );
});

// Display name for debugging
Toolbar.displayName = 'Toolbar';

export default Toolbar;

// CSS Module definition (Toolbar.module.css)
const styles = {
  toolbar: `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-scale-3) var(--spacing-scale-4);
    min-height: 56px;
    width: 100%;
    box-sizing: border-box;
    background-color: var(--color-surface);
    color: var(--color-text-primary);
    z-index: var(--z-index-sticky);
    transition: box-shadow var(--transition-normal) var(--animation-easing-standard),
                transform var(--transition-normal) var(--animation-easing-standard);

    @media (--tablet) {
      min-height: 64px;
      padding: var(--spacing-scale-4) var(--spacing-scale-5);
    }
  `,

  toolbarPrimary: `
    background-color: var(--color-primary);
    color: var(--color-surface);
  `,

  toolbarSecondary: `
    background-color: var(--color-secondary);
    color: var(--color-surface);
  `,

  toolbarSurface: `
    background-color: var(--color-surface);
    color: var(--color-text-primary);
  `,

  toolbarSticky: `
    position: sticky;
    top: 0;
    left: 0;
    right: 0;
  `,

  toolbarElevated: `
    box-shadow: var(--shadow-md);
  `,

  toolbarAnimated: `
    will-change: transform, box-shadow;
    backface-visibility: hidden;
    perspective: 1000px;
  `,

  positionTop: `
    top: 0;
  `,

  positionBottom: `
    bottom: 0;
  `,

  toolbarSection: `
    display: flex;
    align-items: center;
    gap: var(--spacing-scale-3);

    &[data-section="start"] {
      margin-right: auto;
    }

    &[data-section="end"] {
      margin-left: auto;
    }
  `,

  toolbarContent: `
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-width: 0;
    margin: 0 var(--spacing-scale-4);

    @media (--mobile) {
      margin: 0 var(--spacing-scale-3);
    }
  `
};