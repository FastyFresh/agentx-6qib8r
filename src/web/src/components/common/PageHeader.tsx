import React from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { BaseComponentProps, Size } from '../../types/common.types';
import { Breadcrumbs } from './Breadcrumbs';
import { Button } from './Button';
import { useTheme } from '../../hooks/useTheme';
import styles from './PageHeader.module.css';

/**
 * Props interface for the PageHeader component
 */
interface PageHeaderProps extends BaseComponentProps {
  title: string;
  subtitle?: string;
  showBreadcrumbs?: boolean;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'tertiary';
    size?: Size;
  }>;
  theme?: 'light' | 'dark' | 'system';
}

/**
 * Generates theme-aware class names for the header component
 */
const getHeaderClasses = (
  className: string = '',
  showBreadcrumbs: boolean,
  isDarkMode: boolean
): string => {
  return classNames(
    styles.header,
    {
      [styles.headerWithBreadcrumbs]: showBreadcrumbs,
      [styles.headerDark]: isDarkMode,
      [styles.headerLight]: !isDarkMode
    },
    className
  );
};

/**
 * PageHeader component implementing Material Design 3.0 specifications
 * Provides consistent header styling with theme support and accessibility features
 */
const PageHeader: React.FC<PageHeaderProps> = React.memo(({
  title,
  subtitle,
  showBreadcrumbs = true,
  actions = [],
  className,
  children,
  testId = 'page-header'
}) => {
  const { isDarkMode, theme } = useTheme();
  const headerClasses = getHeaderClasses(className, showBreadcrumbs, isDarkMode);

  return (
    <header
      className={headerClasses}
      data-testid={testId}
      role="banner"
    >
      <div className={styles.headerContent}>
        {showBreadcrumbs && (
          <Breadcrumbs
            className={styles.breadcrumbs}
            theme={isDarkMode ? 'dark' : 'light'}
          />
        )}

        <div className={styles.titleContainer}>
          <h1 className={styles.title}>
            {title}
          </h1>
          {subtitle && (
            <p className={styles.subtitle}>
              {subtitle}
            </p>
          )}
        </div>

        {actions.length > 0 && (
          <div 
            className={styles.actions}
            role="toolbar"
            aria-label="Page actions"
          >
            {actions.map((action, index) => (
              <Button
                key={`${action.label}-${index}`}
                onClick={action.onClick}
                variant={action.variant || 'primary'}
                size={action.size || Size.MEDIUM}
                className={styles.actionButton}
                theme={isDarkMode ? 'dark' : 'light'}
                ariaLabel={action.label}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}

        {children && (
          <div className={styles.children}>
            {children}
          </div>
        )}
      </div>

      <style jsx>{`
        .header {
          padding: ${theme.spacing.md} ${theme.spacing.lg};
          background: ${isDarkMode ? theme.colors.dark.surface.primary : theme.colors.light.surface.primary};
          border-bottom: 1px solid ${isDarkMode ? theme.colors.dark.outline : theme.colors.light.outline};
          transition: background-color ${theme.animation.duration.normal} ${theme.animation.easing.easeInOut};
        }

        .headerContent {
          max-width: ${theme.breakpoints.maxWidths.xl};
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: ${theme.spacing.md};
        }

        .titleContainer {
          display: flex;
          flex-direction: column;
          gap: ${theme.spacing.xs};
        }

        .title {
          color: ${isDarkMode ? theme.colors.dark.text : theme.colors.light.text};
          font-size: ${theme.typography.scale.h4};
          font-weight: ${theme.typography.fontWeights.medium};
          line-height: ${theme.typography.lineHeight.heading};
          margin: 0;
        }

        .subtitle {
          color: ${isDarkMode ? theme.colors.dark.secondary : theme.colors.light.secondary};
          font-size: ${theme.typography.scale.body1};
          line-height: ${theme.typography.lineHeight.body};
          margin: 0;
        }

        .actions {
          display: flex;
          gap: ${theme.spacing.sm};
          align-items: center;
          justify-content: flex-start;
          flex-wrap: wrap;
        }

        .actionButton {
          min-width: 100px;
        }

        .children {
          margin-top: ${theme.spacing.md};
        }

        @media (max-width: ${theme.breakpoints.md}px) {
          .header {
            padding: ${theme.spacing.sm} ${theme.spacing.md};
          }

          .title {
            font-size: ${theme.typography.scale.h5};
          }

          .subtitle {
            font-size: ${theme.typography.scale.body2};
          }

          .actions {
            width: 100%;
            justify-content: stretch;
          }

          .actionButton {
            flex: 1;
          }
        }
      `}</style>
    </header>
  );
});

PageHeader.displayName = 'PageHeader';

export default PageHeader;