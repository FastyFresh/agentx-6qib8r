/**
 * Enhanced Theme Management Hook
 * Provides theme switching, system preference detection, and accessibility features
 * Based on Material Design 3.0 specifications
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from 'react';
import { ThemeMode } from '../constants/theme';
import { createAppTheme } from '../config/theme.config';
import { setLocalStorage, getLocalStorage } from '../utils/storageUtils';

// Constants for theme management
const THEME_STORAGE_KEY = 'agent_platform_theme_v2';
const SYSTEM_DARK_THEME_MEDIA = '(prefers-color-scheme: dark)';
const REDUCED_MOTION_MEDIA = '(prefers-reduced-motion: reduce)';
const RTL_LANGUAGES = ['ar', 'he', 'fa'];

/**
 * Interface for theme management hook return values
 */
interface ThemeHookReturn {
  theme: ReturnType<typeof createAppTheme>;
  toggleTheme: () => void;
  isDarkMode: boolean;
  prefersReducedMotion: boolean;
  isRTL: boolean;
}

/**
 * Enhanced theme management hook with accessibility and internationalization support
 * @returns Theme management object containing current theme and control functions
 */
export const useTheme = (): ThemeHookReturn => {
  // Initialize theme state from storage or system preference
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const savedTheme = getLocalStorage<ThemeMode>(THEME_STORAGE_KEY);
    return savedTheme || (window.matchMedia(SYSTEM_DARK_THEME_MEDIA).matches ? ThemeMode.DARK : ThemeMode.LIGHT);
  });

  // Track system preferences
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(
    () => window.matchMedia(SYSTEM_DARK_THEME_MEDIA).matches
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(
    () => window.matchMedia(REDUCED_MOTION_MEDIA).matches
  );

  // Track RTL layout preference based on document language
  const [isRTL, setIsRTL] = useState<boolean>(
    () => RTL_LANGUAGES.includes(document.documentElement.lang)
  );

  // Create theme instance with current preferences
  const theme = createAppTheme(
    themeMode,
    systemPrefersDark,
    prefersReducedMotion
  );

  // Memoized theme toggle function
  const toggleTheme = useCallback(() => {
    const newTheme = themeMode === ThemeMode.LIGHT ? ThemeMode.DARK : ThemeMode.LIGHT;
    setThemeMode(newTheme);
    setLocalStorage(THEME_STORAGE_KEY, newTheme);
  }, [themeMode]);

  // Effect for system dark mode preference
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia(SYSTEM_DARK_THEME_MEDIA);
    
    const handleDarkModeChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
      // Only update theme if no user preference is stored
      if (!getLocalStorage(THEME_STORAGE_KEY)) {
        setThemeMode(event.matches ? ThemeMode.DARK : ThemeMode.LIGHT);
      }
    };

    try {
      // Modern browsers
      darkModeMediaQuery.addEventListener('change', handleDarkModeChange);
    } catch (e) {
      // Fallback for older browsers
      darkModeMediaQuery.addListener(handleDarkModeChange);
    }

    return () => {
      try {
        darkModeMediaQuery.removeEventListener('change', handleDarkModeChange);
      } catch (e) {
        darkModeMediaQuery.removeListener(handleDarkModeChange);
      }
    };
  }, []);

  // Effect for reduced motion preference
  useEffect(() => {
    const motionMediaQuery = window.matchMedia(REDUCED_MOTION_MEDIA);
    
    const handleMotionPreferenceChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    try {
      motionMediaQuery.addEventListener('change', handleMotionPreferenceChange);
    } catch (e) {
      motionMediaQuery.addListener(handleMotionPreferenceChange);
    }

    return () => {
      try {
        motionMediaQuery.removeEventListener('change', handleMotionPreferenceChange);
      } catch (e) {
        motionMediaQuery.removeListener(handleMotionPreferenceChange);
      }
    };
  }, []);

  // Effect for RTL layout changes
  useEffect(() => {
    const handleLanguageChange = () => {
      setIsRTL(RTL_LANGUAGES.includes(document.documentElement.lang));
    };

    // MutationObserver to watch for language attribute changes
    const observer = new MutationObserver(handleLanguageChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang']
    });

    return () => observer.disconnect();
  }, []);

  return {
    theme,
    toggleTheme,
    isDarkMode: themeMode === ThemeMode.DARK,
    prefersReducedMotion,
    isRTL
  };
};