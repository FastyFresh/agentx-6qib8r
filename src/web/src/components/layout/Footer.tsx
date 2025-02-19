import { memo } from 'react';
import { Box, Typography, IconButton, Link, useMediaQuery } from '@mui/material';
import { Brightness4, Brightness7 } from '@mui/icons-material';
import { useTheme } from '../../hooks/useTheme';
import { PUBLIC_ROUTES } from '../../constants/routes';
import { BREAKPOINTS } from '../../constants/theme';

// Footer constants with proper semantic versioning
const FOOTER_CONSTANTS = {
  COPYRIGHT: '© 2024 AGENT AI Platform. All rights reserved.',
  ARIA_LABELS: {
    FOOTER: 'Site footer',
    THEME_TOGGLE: 'Toggle dark mode',
    PRIVACY_LINK: 'View privacy policy',
    TERMS_LINK: 'View terms of service'
  },
  LINKS: {
    PRIVACY: '/privacy',
    TERMS: '/terms',
    CONTACT: '/contact'
  },
  RESPONSIVE_PADDING: {
    xs: 2, // 16px
    sm: 3, // 24px
    md: 4  // 32px
  },
  HEIGHT: {
    xs: 56,
    sm: 64
  }
} as const;

/**
 * Footer component implementing Material Design 3.0 specifications
 * with responsive design and accessibility features
 * @version 1.0.0
 */
const Footer = memo(() => {
  // Theme management with system preference detection
  const { theme, toggleTheme, isDarkMode } = useTheme();
  
  // Responsive breakpoint detection
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  // Dynamic styles based on screen size and theme
  const footerStyles = {
    width: '100%',
    height: isMobile ? FOOTER_CONSTANTS.HEIGHT.xs : FOOTER_CONSTANTS.HEIGHT.sm,
    bgcolor: theme.palette.background.paper,
    borderTop: `1px solid ${theme.palette.divider}`,
    px: FOOTER_CONSTANTS.RESPONSIVE_PADDING,
    transition: theme.transitions.create(['background-color', 'border-color'], {
      duration: theme.transitions.duration.standard
    })
  };

  // Link styles with proper contrast ratio
  const linkStyles = {
    color: theme.palette.text.secondary,
    mx: { xs: 1, sm: 2 },
    '&:hover': {
      color: theme.palette.primary.main
    },
    transition: theme.transitions.create('color', {
      duration: theme.transitions.duration.shorter
    })
  };

  return (
    <Box
      component="footer"
      role="contentinfo"
      aria-label={FOOTER_CONSTANTS.ARIA_LABELS.FOOTER}
      sx={footerStyles}
    >
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', sm: 'row' },
          py: { xs: 1, sm: 0 }
        }}
      >
        {/* Copyright section */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            fontSize: {
              xs: '0.75rem',
              sm: '0.875rem'
            }
          }}
        >
          {FOOTER_CONSTANTS.COPYRIGHT}
        </Typography>

        {/* Navigation and theme toggle */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1, sm: 2 }
          }}
        >
          {/* Navigation links */}
          {!isMobile && (
            <>
              <Link
                href={FOOTER_CONSTANTS.LINKS.PRIVACY}
                aria-label={FOOTER_CONSTANTS.ARIA_LABELS.PRIVACY_LINK}
                underline="hover"
                sx={linkStyles}
              >
                Privacy Policy
              </Link>
              <Link
                href={FOOTER_CONSTANTS.LINKS.TERMS}
                aria-label={FOOTER_CONSTANTS.ARIA_LABELS.TERMS_LINK}
                underline="hover"
                sx={linkStyles}
              >
                Terms of Service
              </Link>
            </>
          )}

          {/* Theme toggle button */}
          <IconButton
            onClick={toggleTheme}
            color="inherit"
            aria-label={FOOTER_CONSTANTS.ARIA_LABELS.THEME_TOGGLE}
            size={isMobile ? 'small' : 'medium'}
            sx={{
              ml: { xs: 0, sm: 1 },
              color: theme.palette.text.secondary,
              '&:hover': {
                color: theme.palette.primary.main,
                bgcolor: theme.palette.action.hover
              }
            }}
          >
            {isDarkMode ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
});

// Display name for debugging and dev tools
Footer.displayName = 'Footer';

export default Footer;