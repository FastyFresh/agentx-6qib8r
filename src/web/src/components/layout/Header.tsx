import React, { useCallback, useState, useEffect } from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { 
  MoonIcon, 
  SunIcon, 
  UserIcon, 
  Bars3Icon, 
  XMarkIcon 
} from '@heroicons/react/24/outline'; // ^2.0.18
import IconButton from '../common/IconButton';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import styles from './Header.module.css';

interface HeaderProps {
  className?: string;
  testId?: string;
  ariaLabel?: string;
  showMobileMenu?: boolean;
}

const Header: React.FC<HeaderProps> = React.memo(({
  className = '',
  testId = 'header',
  ariaLabel = 'Main navigation',
  showMobileMenu = false
}) => {
  // Authentication state
  const { 
    isAuthenticated, 
    user, 
    logout, 
    isLoading: authLoading 
  } = useAuth();

  // Theme state
  const { 
    isDarkMode, 
    toggleTheme, 
    isRTL, 
    prefersReducedMotion 
  } = useTheme();

  // Local state
  const [isMenuOpen, setIsMenuOpen] = useState(showMobileMenu);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Handle theme toggle with transition
  const handleThemeToggle = useCallback(() => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    toggleTheme();
    
    // Reset transition state after animation
    const delay = prefersReducedMotion ? 0 : 300;
    setTimeout(() => setIsTransitioning(false), delay);
  }, [toggleTheme, isTransitioning, prefersReducedMotion]);

  // Handle mobile menu toggle
  const handleMenuToggle = useCallback(() => {
    setIsMenuOpen(prev => !prev);
  }, []);

  // Handle user menu toggle
  const handleUserMenuToggle = useCallback(() => {
    if (authLoading) return;
    setIsUserMenuOpen(prev => !prev);
  }, [authLoading]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      setIsUserMenuOpen(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [logout]);

  // Close menus on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <header
      className={classNames(styles.header, className, {
        [styles.rtl]: isRTL,
        [styles.transitioning]: isTransitioning
      })}
      data-testid={testId}
      aria-label={ariaLabel}
      role="banner"
    >
      <div className={styles.container}>
        {/* Logo and Brand */}
        <div className={styles.brand}>
          <a 
            href="/"
            className={styles.logo}
            aria-label="AGENT AI Platform Home"
          >
            AGENT AI
          </a>
        </div>

        {/* Mobile Menu Toggle */}
        <IconButton
          className={styles.menuButton}
          icon={isMenuOpen ? <XMarkIcon /> : <Bars3Icon />}
          onClick={handleMenuToggle}
          ariaLabel={isMenuOpen ? 'Close menu' : 'Open menu'}
          variant="secondary"
          testId="mobile-menu-toggle"
        />

        {/* Main Navigation */}
        <nav
          className={classNames(styles.nav, {
            [styles.navOpen]: isMenuOpen
          })}
          aria-label="Main navigation"
          aria-expanded={isMenuOpen}
        >
          <ul className={styles.navList}>
            <li>
              <a href="/dashboard" className={styles.navLink}>
                Dashboard
              </a>
            </li>
            <li>
              <a href="/agents" className={styles.navLink}>
                Agents
              </a>
            </li>
            <li>
              <a href="/integrations" className={styles.navLink}>
                Integrations
              </a>
            </li>
            <li>
              <a href="/analytics" className={styles.navLink}>
                Analytics
              </a>
            </li>
          </ul>
        </nav>

        {/* Actions */}
        <div className={styles.actions}>
          {/* Theme Toggle */}
          <IconButton
            icon={isDarkMode ? <SunIcon /> : <MoonIcon />}
            onClick={handleThemeToggle}
            ariaLabel={`Switch to ${isDarkMode ? 'light' : 'dark'} theme`}
            disabled={isTransitioning}
            testId="theme-toggle"
            className={styles.themeToggle}
          />

          {/* User Menu */}
          {isAuthenticated && (
            <div className={styles.userMenu}>
              <IconButton
                icon={<UserIcon />}
                onClick={handleUserMenuToggle}
                ariaLabel="Open user menu"
                disabled={authLoading}
                testId="user-menu-toggle"
                className={styles.userMenuToggle}
              />
              
              {isUserMenuOpen && (
                <div 
                  className={styles.userMenuContent}
                  role="menu"
                  aria-label="User menu"
                >
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>
                      {user?.name}
                    </span>
                    <span className={styles.userEmail}>
                      {user?.email}
                    </span>
                  </div>
                  <ul>
                    <li>
                      <button
                        onClick={() => window.location.href = '/profile'}
                        className={styles.menuItem}
                        role="menuitem"
                      >
                        Profile Settings
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={handleLogout}
                        className={classNames(styles.menuItem, styles.logout)}
                        role="menuitem"
                      >
                        Sign Out
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
});

// Display name for React DevTools
Header.displayName = 'Header';

export default Header;