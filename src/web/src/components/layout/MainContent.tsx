import React from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import ErrorBoundary from '../common/ErrorBoundary';

/**
 * Props interface for MainContent component
 * Provides comprehensive type safety for component configuration
 */
interface MainContentProps {
  children: React.ReactNode;
  className?: string;
  testId?: string;
  role?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
}

/**
 * Core layout component that renders the main content area following Material Design 3.0 guidelines
 * Implements F-pattern layout, responsive behavior, and accessibility features
 */
const MainContent = React.memo<MainContentProps>(({
  children,
  className,
  testId = 'main-content',
  role = 'main',
  dir = 'ltr'
}) => {
  // CSS classes for responsive layout and spacing
  const mainClasses = classNames(
    'main-content',
    'grid-area-main',
    // Responsive padding based on breakpoints
    {
      'p-4': true, // Default padding (16px) for xs screens
      'sm:p-6': true, // 24px padding for sm screens
      'md:p-8': true, // 32px padding for md screens
      'lg:p-12': true, // 48px padding for lg screens
    },
    // F-pattern layout classes
    'grid',
    'grid-cols-1',
    'md:grid-cols-12',
    'gap-4',
    'md:gap-6',
    'lg:gap-8',
    // Material Design elevation and surface treatment
    'bg-surface-primary',
    'dark:bg-surface-primary-dark',
    'rounded-lg',
    // Ensure proper content flow
    'min-h-[calc(100vh-64px)]', // Subtract header height
    'w-full',
    'max-w-[1440px]', // Maximum content width
    'mx-auto', // Center horizontally
    // Animation for content transitions
    'transition-all',
    'duration-300',
    'ease-in-out',
    className
  );

  return (
    <ErrorBoundary>
      <main
        className={mainClasses}
        data-testid={testId}
        role={role}
        dir={dir}
        // ARIA attributes for accessibility
        aria-label="Main content"
        tabIndex={-1}
      >
        {/* Content wrapper for proper spacing and hierarchy */}
        <div className="col-span-full md:col-span-12 flex flex-col gap-4">
          {children}
        </div>
      </main>
    </ErrorBoundary>
  );
});

// Display name for debugging
MainContent.displayName = 'MainContent';

export default MainContent;