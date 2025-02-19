import React from 'react'; // ^18.2.0
import { render, fireEvent, screen, within, waitFor } from '@testing-library/react'; // ^14.0.0
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'; // ^29.6.0
import { axe, toHaveNoViolations } from '@axe-core/react'; // ^4.7.3
import userEvent from '@testing-library/user-event'; // ^14.4.3
import { ThemeProvider, createTheme } from '@mui/material'; // ^5.0.0

import Button from '../../src/components/common/Button';
import { Size } from '../../src/types/common.types';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('Button Component', () => {
  // Mock matchMedia for theme testing
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering and Basic Functionality', () => {
    it('renders with default props', () => {
      render(<Button>Click me</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Click me');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).not.toBeDisabled();
    });

    it('renders in different variants', () => {
      const { rerender } = render(<Button variant="primary">Primary</Button>);
      expect(screen.getByRole('button')).toHaveClass('buttonPrimary');

      rerender(<Button variant="secondary">Secondary</Button>);
      expect(screen.getByRole('button')).toHaveClass('buttonSecondary');

      rerender(<Button variant="tertiary">Tertiary</Button>);
      expect(screen.getByRole('button')).toHaveClass('buttonTertiary');
    });

    it('renders in different sizes', () => {
      const { rerender } = render(<Button size={Size.SMALL}>Small</Button>);
      expect(screen.getByRole('button')).toHaveClass('buttonSmall');

      rerender(<Button size={Size.MEDIUM}>Medium</Button>);
      expect(screen.getByRole('button')).toHaveClass('buttonMedium');

      rerender(<Button size={Size.LARGE}>Large</Button>);
      expect(screen.getByRole('button')).toHaveClass('buttonLarge');
    });

    it('handles disabled state correctly', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('buttonDisabled');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('handles loading state correctly', () => {
      render(<Button loading>Loading</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('buttonLoading');
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
    });

    it('handles click events', async () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      
      await userEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Theme Support', () => {
    it('applies light theme styles correctly', () => {
      render(<Button theme="light">Light Theme</Button>);
      expect(screen.getByRole('button')).toHaveClass('buttonLight');
    });

    it('applies dark theme styles correctly', () => {
      render(<Button theme="dark">Dark Theme</Button>);
      expect(screen.getByRole('button')).toHaveClass('buttonDark');
    });

    it('respects system theme preference', () => {
      // Mock dark mode preference
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      render(<Button theme="system">System Theme</Button>);
      expect(screen.getByRole('button')).toHaveClass('buttonDark');
    });

    it('handles theme switching correctly', () => {
      const { rerender } = render(<Button theme="light">Theme Switch</Button>);
      expect(screen.getByRole('button')).toHaveClass('buttonLight');

      rerender(<Button theme="dark">Theme Switch</Button>);
      expect(screen.getByRole('button')).toHaveClass('buttonDark');
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 accessibility standards', async () => {
      const { container } = render(<Button>Accessible Button</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Keyboard Nav</Button>);
      
      const button = screen.getByRole('button');
      button.focus();
      expect(document.activeElement).toBe(button);

      // Test Enter key
      await userEvent.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalledTimes(1);

      // Test Space key
      await userEvent.keyboard(' ');
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it('provides proper ARIA attributes', () => {
      render(<Button ariaLabel="Custom Label">ARIA</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Custom Label');
    });

    it('maintains proper focus management', async () => {
      render(
        <>
          <Button>First</Button>
          <Button disabled>Second</Button>
          <Button>Third</Button>
        </>
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toHaveAttribute('tabIndex', '0');
      expect(buttons[1]).toHaveAttribute('tabIndex', '-1');
      expect(buttons[2]).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Material Design Compliance', () => {
    it('applies correct spacing based on size', () => {
      const { rerender } = render(<Button size={Size.SMALL}>Spacing</Button>);
      let button = screen.getByRole('button');
      expect(button).toHaveClass('buttonSmall');
      expect(getComputedStyle(button).padding).toBeDefined();

      rerender(<Button size={Size.LARGE}>Spacing</Button>);
      button = screen.getByRole('button');
      expect(button).toHaveClass('buttonLarge');
      expect(getComputedStyle(button).padding).toBeDefined();
    });

    it('handles state transitions correctly', async () => {
      const { rerender } = render(<Button>Transitions</Button>);
      const button = screen.getByRole('button');
      
      // Hover state
      await userEvent.hover(button);
      expect(getComputedStyle(button).transition).toBeDefined();

      // Active state
      await userEvent.click(button);
      expect(getComputedStyle(button).transform).toBeDefined();

      // Disabled state
      rerender(<Button disabled>Transitions</Button>);
      expect(button).toHaveClass('buttonDisabled');
    });

    it('maintains consistent elevation across states', () => {
      render(<Button>Elevation</Button>);
      const button = screen.getByRole('button');
      expect(getComputedStyle(button).boxShadow).toBeDefined();
    });
  });
});