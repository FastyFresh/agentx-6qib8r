import React, { useState, useEffect, useCallback, useRef } from 'react';
import clsx from 'clsx'; // ^2.0.0
import { BaseComponentProps, Size } from '../../types/common.types';
import { validateRequired } from '../../utils/validationUtils';

/**
 * Props interface for TextArea component
 */
interface TextAreaProps extends BaseComponentProps {
  name: string;
  value: string;
  placeholder?: string;
  size?: Size;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  rows?: number;
  maxLength?: number;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

/**
 * Material Design 3.0 compliant TextArea component with comprehensive validation and accessibility features
 */
export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      name,
      value,
      placeholder,
      size = Size.MEDIUM,
      disabled = false,
      required = false,
      error,
      rows = 3,
      maxLength,
      ariaLabel,
      ariaDescribedBy,
      className,
      testId = 'textarea',
      onChange,
      onBlur,
      onFocus,
      onKeyDown,
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [internalError, setInternalError] = useState<string | undefined>(error);
    const [charCount, setCharCount] = useState(value.length);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Generate unique IDs for accessibility
    const uniqueId = `textarea-${name}-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = `${uniqueId}-error`;
    const counterId = `${uniqueId}-counter`;

    // Update character count when value changes
    useEffect(() => {
      setCharCount(value.length);
    }, [value]);

    // Update internal error state when prop changes
    useEffect(() => {
      setInternalError(error);
    }, [error]);

    // Handle validation on blur
    const handleBlur = useCallback(
      (event: React.FocusEvent<HTMLTextAreaElement>) => {
        setIsFocused(false);

        if (required && !validateRequired(event.target.value)) {
          setInternalError('This field is required');
        }

        onBlur?.(event);
      },
      [required, onBlur]
    );

    // Handle focus events
    const handleFocus = useCallback(
      (event: React.FocusEvent<HTMLTextAreaElement>) => {
        setIsFocused(true);
        setInternalError(undefined);
        onFocus?.(event);
      },
      [onFocus]
    );

    // Compose CSS classes
    const textareaClasses = clsx(
      'md3-textarea',
      `md3-textarea--${size.toLowerCase()}`,
      {
        'md3-textarea--disabled': disabled,
        'md3-textarea--error': internalError,
        'md3-textarea--focused': isFocused,
        'md3-textarea--filled': value.length > 0,
      },
      className
    );

    // Handle auto-resize
    const handleInput = useCallback(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }, []);

    return (
      <div className="md3-textarea-container" data-testid={testId}>
        <textarea
          ref={ref || textareaRef}
          id={uniqueId}
          name={name}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          rows={rows}
          maxLength={maxLength}
          className={textareaClasses}
          aria-label={ariaLabel}
          aria-describedby={clsx(
            ariaDescribedBy,
            internalError && errorId,
            maxLength && counterId
          )}
          aria-invalid={!!internalError}
          aria-required={required}
          onChange={(e) => {
            handleInput();
            onChange?.(e);
          }}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onKeyDown={onKeyDown}
          dir="auto"
        />

        {/* Error message with ARIA live region */}
        {internalError && (
          <div
            id={errorId}
            className="md3-textarea-error"
            role="alert"
            aria-live="polite"
          >
            {internalError}
          </div>
        )}

        {/* Character counter */}
        {maxLength && (
          <div
            id={counterId}
            className="md3-textarea-counter"
            aria-live="polite"
          >
            {charCount}/{maxLength}
          </div>
        )}
      </div>
    );
  }
);

// Display name for debugging
TextArea.displayName = 'TextArea';

export default TextArea;