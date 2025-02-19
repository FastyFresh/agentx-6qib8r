import React from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { BaseComponentProps } from '../../types/common.types';
import { useTheme } from '../../hooks/useTheme';

/**
 * Card variant types following Material Design 3.0 specifications
 */
export type CardVariant = 'default' | 'outlined' | 'elevated';

/**
 * Props interface for the Card component
 */
export interface CardProps extends BaseComponentProps {
  elevation?: 1 | 2 | 3 | 4 | 5;
  noPadding?: boolean;
  variant?: CardVariant;
  focusable?: boolean;
  onClick?: () => void;
}

/**
 * Card component implementing Material Design 3.0 specifications
 * Provides a container with elevation, padding, and theming support
 */
export const Card = React.memo<CardProps>(({
  children,
  className,
  testId = 'card',
  elevation = 1,
  noPadding = false,
  variant = 'default',
  focusable = false,
  onClick
}) => {
  const { theme, isDarkMode } = useTheme();

  // Calculate elevation shadow based on theme and elevation prop
  const getElevationShadow = (level: number): string => {
    const shadowOpacity = isDarkMode ? 0.4 : 0.2;
    const shadowColor = `rgba(0, 0, 0, ${shadowOpacity})`;
    
    switch (level) {
      case 1:
        return `0 1px 3px ${shadowColor}, 0 1px 2px ${shadowColor}`;
      case 2:
        return `0 3px 6px ${shadowColor}, 0 2px 4px ${shadowColor}`;
      case 3:
        return `0 10px 20px ${shadowColor}, 0 3px 6px ${shadowColor}`;
      case 4:
        return `0 15px 25px ${shadowColor}, 0 5px 10px ${shadowColor}`;
      case 5:
        return `0 20px 40px ${shadowColor}, 0 7px 14px ${shadowColor}`;
      default:
        return `0 1px 3px ${shadowColor}, 0 1px 2px ${shadowColor}`;
    }
  };

  // Dynamic styles based on props and theme
  const cardStyles = {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    borderRadius: theme.shape.borderRadius,
    padding: noPadding ? 0 : theme.spacing(2),
    transition: theme.transitions.create(['box-shadow', 'transform'], {
      duration: theme.transitions.duration.standard
    }),
    ...(variant === 'outlined' && {
      border: `1px solid ${theme.palette.divider}`
    }),
    ...(variant === 'elevated' && {
      boxShadow: getElevationShadow(elevation)
    }),
    ...(onClick && {
      cursor: 'pointer',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: getElevationShadow(elevation + 1)
      }
    })
  };

  // Compose class names
  const cardClasses = classNames(
    'card',
    `card--${variant}`,
    {
      'card--clickable': !!onClick,
      'card--no-padding': noPadding,
      [`card--elevation-${elevation}`]: variant === 'elevated'
    },
    className
  );

  // Handle keyboard interaction for focusable cards
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (focusable && onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={cardClasses}
      style={cardStyles}
      data-testid={testId}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={focusable ? 0 : undefined}
      aria-disabled={!onClick}
      {...(onClick && {
        'aria-pressed': undefined,
        'aria-label': 'Interactive card'
      })}
    >
      {children}
    </div>
  );
});

// Display name for debugging
Card.displayName = 'Card';

export default Card;