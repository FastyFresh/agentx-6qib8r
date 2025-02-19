import React, { useCallback, useEffect, useMemo } from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import Header from './Header';
import Footer from './Footer';
import Navigation from './Navigation';
import MainContent from './MainContent';
import { useTheme } from '../../hooks/useTheme';
import styles from './Layout.module.css';

/**
 * Props interface for the Layout component
 */
interface LayoutProps {
  children: React.ReactNode;
  className?: string;
  dir?: 'ltr' | 'rtl';
  role?: string;
  'aria-label'?: string;
  'data-testid'?: string;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * Custom hook to manage layout-related side effects
 */
const useLayoutEffects = () => {
  const { theme, isDarkMode, prefersReducedMotion, isRTL } = useTheme();

  // Apply theme-based classes to root element
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark-theme', isDarkMode);
    root.classList.toggle('light-theme', !isDarkMode);
    root.classList.toggle('reduced-motion', prefersReducedMotion);
    root.setAttribute('dir', isRTL ? 'rtl' : 'ltr');

    return () => {
      root.classList.remove('dark-theme', 'light-theme', 'reduced-motion');
      root.removeAttribute('dir');
    };
  }, [isDarkMode, prefersReducedMotion, isRTL]);

  return { theme, isDarkMode, prefersReducedMotion, isRTL };
};

/**
 * Memoized hook for computing layout styles
 */
const useStyles = (theme: any, className: string, dir: string) => {
  return useMemo(() => {
    return classNames(
      styles.layout,
      styles[`layout--${dir}`],
      {
        [styles.reducedMotion]: theme.prefersReducedMotion,
        [styles.darkTheme]: theme.isDarkMode,
      },
      className
    );
  }, [theme, className, dir]);
};

/**
 * Main layout component that implements Material Design 3.0 specifications
 * Provides the primary application structure with responsive behavior and theme support
 */
const Layout: React.FC<LayoutProps> = ({
  children,
  className = '',
  dir = 'ltr',
  role = 'application',
  'aria-label': ariaLabel = 'Application layout',
  'data-testid': testId = 'layout',
  onError
}) => {
  const layoutEffects = useLayoutEffects();
  const computedStyles = useStyles(layoutEffects.theme, className, dir);

  // Handle layout errors
  const handleError = useCallback((error: Error, errorInfo: React.ErrorInfo) => {
    console.error('Layout error:', error, errorInfo);
    onError?.(error, errorInfo);
  }, [onError]);

  return (
    <ErrorBoundary
      onError={handleError}
      FallbackComponent={({ error }) => (
        <div role="alert" className={styles.errorContainer}>
          <h1>Application Error</h1>
          <p>{error.message}</p>
          <button onClick={() => window.location.reload()}>
            Reload Application
          </button>
        </div>
      )}
    >
      <div
        className={computedStyles}
        role={role}
        aria-label={ariaLabel}
        data-testid={testId}
        dir={dir}
      >
        <Header
          className={styles.header}
          testId="layout-header"
          showMobileMenu={false}
        />
        
        <Navigation
          className={styles.navigation}
          ariaLabel="Main navigation"
          onError={handleError}
        />
        
        <MainContent
          className={styles.mainContent}
          testId="layout-main"
          role="main"
          dir={dir}
        >
          {children}
        </MainContent>
        
        <Footer
          className={styles.footer}
          testId="layout-footer"
        />
      </div>
    </ErrorBoundary>
  );
};

// Display name for React DevTools
Layout.displayName = 'Layout';

export default Layout;