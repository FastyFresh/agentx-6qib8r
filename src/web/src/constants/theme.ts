/**
 * Theme Configuration Constants
 * Defines comprehensive theme system based on Material Design 3.0 specifications
 * Includes color palettes, typography scales, breakpoints, and accessibility considerations
 * @version 1.0.0
 */

import { Theme } from '../types/common.types';

/**
 * Color system configuration including light/dark themes, states, and surfaces
 * Based on Material Design 3.0 color system specifications
 */
export const COLORS = {
  light: {
    primary: '#2196F3',
    secondary: '#666666',
    background: '#FFFFFF',
    text: '#333333',
    error: '#D32F2F',
    warning: '#FFA000',
    success: '#388E3C',
    surface: {
      primary: '#FFFFFF',
      secondary: '#F5F5F5',
      tertiary: '#EEEEEE'
    },
    outline: '#E0E0E0',
    overlay: 'rgba(0, 0, 0, 0.5)'
  },
  dark: {
    primary: '#64B5F6',
    secondary: '#CCCCCC',
    background: '#1E1E1E',
    text: '#FFFFFF',
    error: '#EF5350',
    warning: '#FFB74D',
    success: '#66BB6A',
    surface: {
      primary: '#1E1E1E',
      secondary: '#2D2D2D',
      tertiary: '#3D3D3D'
    },
    outline: '#404040',
    overlay: 'rgba(0, 0, 0, 0.7)'
  },
  states: {
    hover: '0.08',
    pressed: '0.12',
    disabled: '0.38',
    focus: '0.12',
    selected: '0.16',
    dragged: '0.16'
  }
} as const;

/**
 * Typography system configuration
 * Implements Material Design type scale with responsive adjustments
 */
export const TYPOGRAPHY = {
  fontFamily: 'Roboto, system-ui, sans-serif',
  scale: {
    h1: '2.5rem',    // 40px
    h2: '2rem',      // 32px
    h3: '1.75rem',   // 28px
    h4: '1.5rem',    // 24px
    h5: '1.25rem',   // 20px
    h6: '1rem',      // 16px
    body1: '1rem',   // 16px
    body2: '0.875rem', // 14px
    caption: '0.75rem', // 12px
    overline: '0.625rem' // 10px
  },
  lineHeight: {
    heading: 1.2,
    body: 1.5,
    caption: 1.4,
    tight: 1.1,
    relaxed: 1.6
  },
  letterSpacing: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em'
  },
  fontWeights: {
    regular: 400,
    medium: 500,
    bold: 700
  }
} as const;

/**
 * Breakpoint system configuration
 * Defines responsive breakpoints and maximum content widths
 */
export const BREAKPOINTS = {
  xs: 320,  // Mobile devices
  sm: 768,  // Tablets
  md: 1024, // Small laptops
  lg: 1200, // Desktops
  xl: 1440, // Large displays
  maxWidths: {
    sm: '540px',
    md: '720px',
    lg: '960px',
    xl: '1140px',
    xxl: '1320px'
  }
} as const;

/**
 * Z-index stack configuration
 * Manages layering hierarchy across the application
 */
export const Z_INDEX = {
  modal: 1000,
  overlay: 900,
  drawer: 800,
  dropdown: 700,
  header: 600,
  tooltip: 500,
  base: 1
} as const;

/**
 * Spacing system configuration
 * Implements consistent spacing scale across components
 */
export const SPACING = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  xxl: '3rem'      // 48px
} as const;

/**
 * Animation configuration
 * Defines standard animation timings and easing functions
 */
export const ANIMATION = {
  duration: {
    fast: '150ms',
    normal: '250ms',
    slow: '350ms'
  },
  easing: {
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)'
  }
} as const;

/**
 * Shadow configuration
 * Implements elevation system through box shadows
 */
export const SHADOWS = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'
} as const;

// Freeze all theme objects to prevent runtime modifications
Object.freeze(COLORS);
Object.freeze(TYPOGRAPHY);
Object.freeze(BREAKPOINTS);
Object.freeze(Z_INDEX);
Object.freeze(SPACING);
Object.freeze(ANIMATION);
Object.freeze(SHADOWS);