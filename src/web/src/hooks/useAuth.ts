import { useState, useCallback } from 'react'; // ^18.2.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.5
import { 
  login, 
  logout, 
  verifyMFA, 
  selectAuth 
} from '../store/auth/authSlice';
import { 
  LoginCredentials, 
  MFAVerificationData, 
  User 
} from '../types/auth.types';

/**
 * Advanced authentication hook providing comprehensive security features
 * including OAuth 2.0 + OIDC, MFA support, and role-based access control
 * @returns Authentication state and methods
 */
export const useAuth = () => {
  // Redux state management
  const dispatch = useDispatch();
  const authState = useSelector(selectAuth);

  // Local state for enhanced security tracking
  const [isInitializing, setIsInitializing] = useState(true);
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const [loginAttempts, setLoginAttempts] = useState<number>(0);
  const [isLocked, setIsLocked] = useState(false);

  // Constants for security measures
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  /**
   * Enhanced login handler with rate limiting and security checks
   * @param credentials - User login credentials
   */
  const handleLogin = useCallback(async (credentials: LoginCredentials) => {
    try {
      if (isLocked) {
        throw new Error('Account is temporarily locked. Please try again later.');
      }

      if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        setIsLocked(true);
        setTimeout(() => {
          setIsLocked(false);
          setLoginAttempts(0);
        }, LOCKOUT_DURATION);
        throw new Error('Too many login attempts. Account locked temporarily.');
      }

      const result = await dispatch(login(credentials)).unwrap();
      if (result.success) {
        setLoginAttempts(0);
        setLastActivity(new Date());
      } else {
        setLoginAttempts(prev => prev + 1);
      }
      return result;
    } catch (error) {
      setLoginAttempts(prev => prev + 1);
      throw error;
    }
  }, [dispatch, isLocked, loginAttempts]);

  /**
   * MFA verification handler with device remember support
   * @param verificationData - MFA verification data
   */
  const handleVerifyMFA = useCallback(async (verificationData: MFAVerificationData) => {
    try {
      const result = await dispatch(verifyMFA(verificationData)).unwrap();
      if (result.success) {
        setLastActivity(new Date());
      }
      return result;
    } catch (error) {
      throw error;
    }
  }, [dispatch]);

  /**
   * Secure logout handler with session cleanup
   */
  const handleLogout = useCallback(async () => {
    try {
      await dispatch(logout()).unwrap();
      setLoginAttempts(0);
      setIsLocked(false);
    } catch (error) {
      throw error;
    }
  }, [dispatch]);

  /**
   * Role-based permission checker
   * @param requiredPermission - Permission to check
   * @returns Boolean indicating if user has permission
   */
  const hasPermission = useCallback((requiredPermission: string): boolean => {
    if (!authState.user?.permissions) return false;
    return authState.user.permissions.includes(requiredPermission);
  }, [authState.user]);

  /**
   * Session activity tracker
   * Automatically logs out user after inactivity
   */
  const checkSessionActivity = useCallback(() => {
    if (!authState.isAuthenticated) return;

    const currentTime = new Date();
    const timeSinceLastActivity = currentTime.getTime() - lastActivity.getTime();

    if (timeSinceLastActivity > SESSION_TIMEOUT) {
      handleLogout();
    }
  }, [authState.isAuthenticated, lastActivity, handleLogout]);

  /**
   * Updates last activity timestamp
   * Called on user interactions
   */
  const updateActivity = useCallback(() => {
    setLastActivity(new Date());
  }, []);

  // Effect to initialize session monitoring
  useEffect(() => {
    const activityInterval = setInterval(checkSessionActivity, 60000); // Check every minute
    setIsInitializing(false);

    // Activity listeners
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    return () => {
      clearInterval(activityInterval);
      activityEvents.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [checkSessionActivity, updateActivity]);

  return {
    // Authentication state
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading || isInitializing,
    user: authState.user as User | null,
    error: authState.error,
    isLocked,
    loginAttempts,

    // Authentication methods
    login: handleLogin,
    logout: handleLogout,
    verifyMFA: handleVerifyMFA,
    hasPermission,
    updateActivity,

    // Session information
    lastActivity,
    sessionTimeoutDuration: SESSION_TIMEOUT,
    lockoutDuration: LOCKOUT_DURATION,
    maxLoginAttempts: MAX_LOGIN_ATTEMPTS
  };
};

export type UseAuthReturn = ReturnType<typeof useAuth>;