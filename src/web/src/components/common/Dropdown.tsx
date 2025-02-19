/**
 * A highly customizable dropdown component implementing Material Design 3.0 specifications
 * with comprehensive accessibility features and mobile responsiveness
 * @version 1.0.0
 */

import React, { useCallback, useState, useRef, useEffect } from 'react'; // ^18.2.0
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material'; // ^5.14.0
import { BaseComponentProps, Size } from '../../types/common.types';

/**
 * Interface for dropdown option items with enhanced functionality
 */
interface DropdownOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  description?: string;
  icon?: React.ReactNode;
  group?: string;
}

/**
 * Enhanced props interface for the Dropdown component
 */
interface DropdownProps extends BaseComponentProps {
  label: string;
  value: string | string[];
  name: string;
  options: Array<DropdownOption>;
  multiple?: boolean;
  size?: Size;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  loading?: boolean;
  clearable?: boolean;
  maxVisibleOptions?: number;
  onChange: (value: string | string[]) => void;
  onBlur?: () => void;
  onFocus?: () => void;
}

/**
 * Material Design 3.0 compliant dropdown component with enhanced accessibility
 */
const Dropdown = React.memo(({
  label,
  value,
  name,
  options,
  multiple = false,
  size = Size.MEDIUM,
  disabled = false,
  required = false,
  error,
  loading = false,
  clearable = false,
  maxVisibleOptions = 8,
  onChange,
  onBlur,
  onFocus,
  className,
  testId = 'dropdown'
}: DropdownProps) => {
  // Internal state management
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  // Determine if running on mobile device
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Map size enum to Material UI size prop
  const getMuiSize = useCallback(() => {
    switch (size) {
      case Size.SMALL:
        return 'small';
      case Size.LARGE:
        return 'medium';
      default:
        return 'medium';
    }
  }, [size]);

  // Handle change events with proper type conversion
  const handleChange = useCallback((event: any) => {
    const newValue = event.target.value;
    onChange(newValue);
  }, [onChange]);

  // Handle focus events
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  // Handle blur events
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;
      
      switch (event.key) {
        case 'Escape':
          setIsOpen(false);
          break;
        case 'Tab':
          if (!event.shiftKey && selectRef.current) {
            event.preventDefault();
            selectRef.current.focus();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <FormControl
      className={className}
      error={!!error}
      disabled={disabled || loading}
      required={required}
      size={getMuiSize()}
      fullWidth
      data-testid={testId}
    >
      <InputLabel
        id={`${name}-label`}
        error={!!error}
        required={required}
        aria-required={required}
      >
        {label}
      </InputLabel>
      <Select
        labelId={`${name}-label`}
        id={name}
        value={value}
        multiple={multiple}
        onChange={handleChange}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        ref={selectRef}
        label={label}
        error={!!error}
        native={isMobile}
        MenuProps={{
          PaperProps: {
            style: {
              maxHeight: maxVisibleOptions * 48
            }
          },
          anchorOrigin: {
            vertical: 'bottom',
            horizontal: 'left'
          },
          transformOrigin: {
            vertical: 'top',
            horizontal: 'left'
          }
        }}
        aria-label={label}
        aria-invalid={!!error}
        aria-errormessage={error}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-disabled={disabled}
        aria-busy={loading}
      >
        {options.map((option) => (
          <MenuItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            aria-label={option.label}
            aria-description={option.description}
          >
            {option.icon && (
              <span className="dropdown-option-icon" aria-hidden="true">
                {option.icon}
              </span>
            )}
            <span className="dropdown-option-label">
              {option.label}
            </span>
            {option.description && (
              <span className="dropdown-option-description" aria-hidden="true">
                {option.description}
              </span>
            )}
          </MenuItem>
        ))}
      </Select>
      {error && (
        <div
          className="dropdown-error"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </FormControl>
  );
});

Dropdown.displayName = 'Dropdown';

export default Dropdown;