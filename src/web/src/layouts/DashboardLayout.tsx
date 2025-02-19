import React, { useCallback, useState, useEffect, useRef } from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { useMediaQuery } from '@mui/material'; // ^5.14.0
import { useResizeObserver } from '@react-hook/resize-observer'; // ^1.2.6

import Header from '../components/layout/Header';
import Sidebar from '../components/common/Sidebar';
import MainContent from '../components/layout/MainContent';
import ErrorBoundary from '../components/common/ErrorBoundary';

// Constants for layout dimensions and animations
const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 64;
const HEADER_HEIGHT = 64;
const TRANSITION_DURATION = 300;
const RESIZE_OBSERVER_THROTTLE = 100;

// Props interface with enhanced type safety
interface DashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
  dir?: 'ltr' | 'rtl';
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * Core layout component that implements the main dashboard structure
 * following Material Design 3.0 specifications
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = React.memo(({
  children,
  className,
  dir = 'ltr',
  onError
}) => {
  // State for responsive layout management
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);

  // Media queries for responsive behavior
  const isMobile = useMediaQuery('(max-width: 768px)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  // Handle sidebar toggle with animation
  const handleSidebarToggle = useCallback(() => {
    if (isTransitioning) return;

    setIsTransitioning(true);
    setIsSidebarCollapsed(prev => !prev);

    // Reset transition state after animation
    const delay = prefersReducedMotion ? 0 : TRANSITION_DURATION;
    setTimeout(() => setIsTransitioning(false), delay);
  }, [isTransitioning, prefersReducedMotion]);

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    setIsSidebarCollapsed(isMobile);
  }, [isMobile]);

  // Resize observer for dynamic layout adjustments
  useResizeObserver(
    layoutRef,
    useCallback(() => {
      // Throttle resize calculations
      const throttled = setTimeout(() => {
        if (layoutRef.current) {
          const { width } = layoutRef.current.getBoundingClientRect();
          if (width < 768 && !isSidebarCollapsed) {
            setIsSidebarCollapsed(true);
          }
        }
      }, RESIZE_OBSERVER_THROTTLE);

      return () => clearTimeout(throttled);
    }, [isSidebarCollapsed])
  );

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && !isSidebarCollapsed) {
      handleSidebarToggle();
    }
  }, [handleSidebarToggle, isSidebarCollapsed]);

  // Set up keyboard listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Dynamic grid template calculation
  const gridTemplateColumns = isSidebarCollapsed
    ? `${SIDEBAR_COLLAPSED_WIDTH}px 1fr`
    : `${SIDEBAR_WIDTH}px 1fr`;

  // Compose layout classes
  const layoutClasses = classNames(
    'dashboard-layout',
    {
      'dashboard-layout--collapsed': isSidebarCollapsed,
      'dashboard-layout--transitioning': isTransitioning,
      'dashboard-layout--rtl': dir === 'rtl'
    },
    className
  );

  // Calculate layout styles
  const layoutStyles = {
    display: 'grid',
    gridTemplateColumns,
    gridTemplateRows: `${HEADER_HEIGHT}px 1fr`,
    minHeight: '100vh',
    transition: prefersReducedMotion ? 'none' : `all ${TRANSITION_DURATION}ms ease-in-out`,
    direction: dir
  };

  return (
    <ErrorBoundary onError={onError}>
      <div
        ref={layoutRef}
        className={layoutClasses}
        style={layoutStyles}
        data-testid="dashboard-layout"
      >
        <Header
          className="dashboard-layout__header"
          showMobileMenu={isMobile}
          testId="dashboard-header"
        />
        
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={handleSidebarToggle}
          className="dashboard-layout__sidebar"
          testId="dashboard-sidebar"
        />
        
        <MainContent
          className="dashboard-layout__content"
          dir={dir}
          testId="dashboard-content"
        >
          {children}
        </MainContent>
      </div>
    </ErrorBoundary>
  );
});

// Display name for React DevTools
DashboardLayout.displayName = 'DashboardLayout';

export default DashboardLayout;