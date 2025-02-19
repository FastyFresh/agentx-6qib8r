import React from 'react'; // ^18.2.0
import { Link, useLocation } from 'react-router-dom'; // ^6.14.0
import { BaseComponentProps } from '../../types/common.types';
import { PROTECTED_ROUTES } from '../../constants/routes';
import { COLORS } from '../../constants/theme';

/**
 * Interface for breadcrumb navigation items with accessibility support
 */
interface BreadcrumbItem {
  label: string;
  path: string;
  isActive: boolean;
  ariaLabel: string;
}

/**
 * Props interface for Breadcrumbs component configuration
 */
export interface BreadcrumbsProps extends BaseComponentProps {
  separator?: string;
  showHome?: boolean;
}

/**
 * A reusable breadcrumb navigation component that displays the current page location
 * within the application's hierarchy. Implements Material Design 3.0 specifications
 * with comprehensive accessibility support.
 */
export const Breadcrumbs: React.FC<BreadcrumbsProps> = React.memo(({
  className = '',
  testId = 'breadcrumbs',
  separator = '/',
  showHome = true
}) => {
  const location = useLocation();

  // Memoized function to generate breadcrumb items
  const breadcrumbItems = React.useMemo((): BreadcrumbItem[] => {
    const pathSegments = location.pathname
      .split('/')
      .filter(segment => segment !== '');

    const items: BreadcrumbItem[] = [];
    let currentPath = '';

    // Add home item if enabled
    if (showHome) {
      items.push({
        label: 'Home',
        path: PROTECTED_ROUTES.DASHBOARD,
        isActive: location.pathname === PROTECTED_ROUTES.DASHBOARD,
        ariaLabel: 'Navigate to home dashboard'
      });
    }

    // Generate items for each path segment
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // Handle dynamic route parameters
      const isParam = segment.startsWith(':') || /^\d+$/.test(segment);
      const label = isParam 
        ? 'Details'
        : segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');

      items.push({
        label,
        path: currentPath,
        isActive: index === pathSegments.length - 1,
        ariaLabel: `Navigate to ${label.toLowerCase()}`
      });
    });

    return items;
  }, [location.pathname, showHome]);

  return (
    <nav
      aria-label="Breadcrumb navigation"
      className={`breadcrumbs ${className}`}
      data-testid={testId}
    >
      <ol
        className="breadcrumbs-list"
        role="list"
      >
        {breadcrumbItems.map((item, index) => (
          <li
            key={item.path}
            className="breadcrumbs-item"
            aria-current={item.isActive ? 'page' : undefined}
          >
            {item.isActive ? (
              <span
                className="breadcrumbs-text active"
                aria-label={item.ariaLabel}
              >
                {item.label}
              </span>
            ) : (
              <>
                <Link
                  to={item.path}
                  className="breadcrumbs-link"
                  aria-label={item.ariaLabel}
                >
                  {item.label}
                </Link>
                {index < breadcrumbItems.length - 1 && (
                  <span 
                    className="breadcrumbs-separator"
                    aria-hidden="true"
                  >
                    {separator}
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ol>

      <style jsx>{`
        .breadcrumbs {
          padding: 0.5rem 0;
          font-size: 0.875rem;
          line-height: 1.5;
        }

        .breadcrumbs-list {
          display: flex;
          flex-wrap: wrap;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .breadcrumbs-item {
          display: flex;
          align-items: center;
        }

        .breadcrumbs-link {
          color: ${COLORS.light.primary};
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .breadcrumbs-link:hover {
          text-decoration: underline;
        }

        .breadcrumbs-link:focus {
          outline: 2px solid ${COLORS.light.primary};
          outline-offset: 2px;
        }

        .breadcrumbs-text.active {
          color: ${COLORS.light.secondary};
          font-weight: 500;
        }

        .breadcrumbs-separator {
          margin: 0 0.5rem;
          color: ${COLORS.light.secondary};
        }

        @media (prefers-color-scheme: dark) {
          .breadcrumbs-link {
            color: ${COLORS.dark.primary};
          }

          .breadcrumbs-text.active {
            color: ${COLORS.dark.secondary};
          }

          .breadcrumbs-separator {
            color: ${COLORS.dark.secondary};
          }
        }

        @media (max-width: 768px) {
          .breadcrumbs {
            font-size: 0.75rem;
          }
        }
      `}</style>
    </nav>
  );
});

Breadcrumbs.displayName = 'Breadcrumbs';