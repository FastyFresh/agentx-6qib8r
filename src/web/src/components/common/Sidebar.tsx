import React, { useCallback, useEffect, useRef, useState } from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { useNavigate, useLocation } from 'react-router-dom'; // ^6.11.0
import { PROTECTED_ROUTES, ROUTE_PERMISSIONS } from '../../constants/routes';
import { useAuth } from '../../hooks/useAuth';
import IconButton from './IconButton';
import styles from './Sidebar.module.css';

// Interface for sidebar component props
interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
  ariaLabel?: string;
  testId?: string;
}

// Interface for navigation items
interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
  ariaLabel: string;
  analyticsId: string;
}

/**
 * Checks if user has access to a specific route based on their role
 * @param requiredRoles - Array of roles that can access the route
 * @param userRole - Current user's role
 */
const hasAccess = (requiredRoles: string[], userRole: string | null): boolean => {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  if (!userRole) return false;
  return requiredRoles.includes(userRole);
};

/**
 * Sidebar component implementing Material Design 3.0 specifications
 * Features role-based access control, keyboard navigation, and accessibility
 */
const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggle,
  className,
  ariaLabel = 'Main navigation',
  testId = 'sidebar'
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading, error } = useAuth();
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const navRef = useRef<HTMLElement>(null);

  // Navigation items with role-based access control
  const navItems: NavItem[] = [
    {
      path: PROTECTED_ROUTES.DASHBOARD,
      label: 'Dashboard',
      icon: <span className="material-icons">dashboard</span>,
      roles: [],
      ariaLabel: 'Navigate to dashboard',
      analyticsId: 'nav_dashboard'
    },
    {
      path: PROTECTED_ROUTES.AGENTS,
      label: 'Agents',
      icon: <span className="material-icons">smart_toy</span>,
      roles: [],
      ariaLabel: 'Navigate to agents',
      analyticsId: 'nav_agents'
    },
    {
      path: PROTECTED_ROUTES.ANALYTICS,
      label: 'Analytics',
      icon: <span className="material-icons">insights</span>,
      roles: ROUTE_PERMISSIONS.ANALYTICS,
      ariaLabel: 'Navigate to analytics',
      analyticsId: 'nav_analytics'
    },
    {
      path: PROTECTED_ROUTES.INTEGRATIONS,
      label: 'Integrations',
      icon: <span className="material-icons">integration_instructions</span>,
      roles: ROUTE_PERMISSIONS.INTEGRATIONS,
      ariaLabel: 'Navigate to integrations',
      analyticsId: 'nav_integrations'
    },
    {
      path: PROTECTED_ROUTES.SETTINGS,
      label: 'Settings',
      icon: <span className="material-icons">settings</span>,
      roles: ROUTE_PERMISSIONS.SETTINGS,
      ariaLabel: 'Navigate to settings',
      analyticsId: 'nav_settings'
    }
  ];

  /**
   * Handles keyboard navigation through menu items
   */
  const handleKeyboardNavigation = useCallback((event: KeyboardEvent) => {
    if (!navRef.current) return;

    const items = navRef.current.querySelectorAll('a[role="menuitem"]');
    const itemCount = items.length;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex(prev => (prev + 1) % itemCount);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex(prev => (prev - 1 + itemCount) % itemCount);
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(itemCount - 1);
        break;
    }
  }, []);

  // Set up keyboard navigation
  useEffect(() => {
    const nav = navRef.current;
    if (nav) {
      nav.addEventListener('keydown', handleKeyboardNavigation);
      return () => nav.removeEventListener('keydown', handleKeyboardNavigation);
    }
  }, [handleKeyboardNavigation]);

  // Focus active item when changed
  useEffect(() => {
    if (activeIndex >= 0 && navRef.current) {
      const items = navRef.current.querySelectorAll('a[role="menuitem"]');
      (items[activeIndex] as HTMLElement)?.focus();
    }
  }, [activeIndex]);

  /**
   * Renders navigation items with accessibility and animation features
   */
  const renderNavItems = () => {
    if (isLoading) {
      return <div className={styles.loading} aria-busy="true">Loading navigation...</div>;
    }

    if (error) {
      return <div className={styles.error} role="alert">{error.message}</div>;
    }

    return navItems.map((item, index) => {
      if (!hasAccess(item.roles, user?.role)) return null;

      const isActive = location.pathname === item.path;
      const itemClasses = classNames(styles.navItem, {
        [styles.active]: isActive,
        [styles.collapsed]: isCollapsed
      });

      return (
        <a
          key={item.path}
          href={item.path}
          onClick={(e) => {
            e.preventDefault();
            navigate(item.path);
          }}
          className={itemClasses}
          role="menuitem"
          aria-current={isActive ? 'page' : undefined}
          aria-label={item.ariaLabel}
          tabIndex={index === activeIndex ? 0 : -1}
          data-analytics-id={item.analyticsId}
        >
          <span className={styles.icon} aria-hidden="true">{item.icon}</span>
          {!isCollapsed && (
            <span className={styles.label}>{item.label}</span>
          )}
        </a>
      );
    });
  };

  return (
    <nav
      ref={navRef}
      className={classNames(styles.sidebar, { [styles.collapsed]: isCollapsed }, className)}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      <IconButton
        icon={<span className="material-icons">
          {isCollapsed ? 'menu_open' : 'menu'}
        </span>}
        onClick={onToggle}
        ariaLabel={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={styles.toggleButton}
      />
      <div
        className={styles.navItems}
        role="menu"
        aria-orientation="vertical"
      >
        {renderNavItems()}
      </div>
    </nav>
  );
};

export default React.memo(Sidebar);