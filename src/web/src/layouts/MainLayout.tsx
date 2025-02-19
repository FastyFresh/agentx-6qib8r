import React, { useCallback, useEffect, useState } from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { useResizeObserver } from '@react-hook/resize-observer'; // ^1.2.6

import Header from '../components/layout/Header';
import Navigation from '../components/layout/Navigation';
import MainContent from '../components/layout/MainContent';
import ErrorBoundary from '../components/common/ErrorBoundary';

// Breakpoint constants based on Material Design 3.0
const BREAKPOINTS = {
  mobile: 320,
  tablet: 768,
  desktop: 1024,
  wide: 1440
};

// Layout class names
const LAYOUT_CLASS = 'main-layout';
const LAYOUT_GRID_CLASS = 'main-layout__grid';
const LAYOUT_RTL_CLASS = 'main-layout--rtl';

interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
  dir?: 'ltr' | 'rtl';
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * Enhanced custom hook to manage layout state and responsive behavior
 */
const useLayoutState = () => {
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth < BREAKPOINTS.tablet);
  const [error, setError] = useState<Error | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  // Handle responsive layout changes with resize observer
  useResizeObserver(target, (entry) => {
    const width = entry.contentRect.width;
    setIsCollapsed(width < BREAKPOINTS.tablet);
  });

  // Handle layout errors
  const handleError = useCallback((error: Error, errorInfo: React.ErrorInfo) => {
    setError(error);
    console.error('Layout Error:', error, errorInfo);
  }, []);

  // Toggle navigation collapse state
  const toggleNavigation = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCollapsed(true);
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, []);

  return {
    isCollapsed,
    error,
    setTarget,
    toggleNavigation,
    handleError
  };
};

/**
 * Main layout component implementing Material Design 3.0 specifications
 * Features responsive grid layout, RTL support, and error boundaries
 */
const MainLayout: React.FC<MainLayoutProps> = React.memo(({
  children,
  className,
  dir = 'ltr',
  onError
}) => {
  const {
    isCollapsed,
    error,
    setTarget,
    toggleNavigation,
    handleError
  } = useLayoutState();

  // Handle error boundary events
  const handleErrorBoundary = useCallback((error: Error, errorInfo: React.ErrorInfo) => {
    handleError(error, errorInfo);
    onError?.(error, errorInfo);
  }, [handleError, onError]);

  // Compose layout classes
  const layoutClasses = classNames(
    LAYOUT_CLASS,
    {
      [LAYOUT_RTL_CLASS]: dir === 'rtl',
      [`${LAYOUT_CLASS}--collapsed`]: isCollapsed
    },
    className
  );

  // Compose grid classes for responsive layout
  const gridClasses = classNames(
    LAYOUT_GRID_CLASS,
    {
      [`${LAYOUT_GRID_CLASS}--rtl`]: dir === 'rtl',
      [`${LAYOUT_GRID_CLASS}--collapsed`]: isCollapsed
    }
  );

  return (
    <div 
      className={layoutClasses}
      ref={setTarget}
      dir={dir}
      data-testid="main-layout"
    >
      <div className={gridClasses}>
        {/* Header Section */}
        <ErrorBoundary onError={handleErrorBoundary}>
          <Header
            className={`${LAYOUT_CLASS}__header`}
            showMobileMenu={!isCollapsed}
            testId="layout-header"
          />
        </ErrorBoundary>

        {/* Navigation Section */}
        <ErrorBoundary onError={handleErrorBoundary}>
          <Navigation
            className={`${LAYOUT_CLASS}__navigation`}
            ariaLabel="Main navigation"
            onError={handleError}
          />
        </ErrorBoundary>

        {/* Main Content Section */}
        <ErrorBoundary onError={handleErrorBoundary}>
          <MainContent
            className={`${LAYOUT_CLASS}__content`}
            testId="layout-content"
            dir={dir}
            role="main"
          >
            {children}
          </MainContent>
        </ErrorBoundary>
      </div>
    </div>
  );
});

// Display name for React DevTools
MainLayout.displayName = 'MainLayout';

export default MainLayout;