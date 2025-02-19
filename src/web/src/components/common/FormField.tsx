import React from 'react'; // ^18.2.0
import clsx from 'clsx'; // ^2.0.0
import { BaseComponentProps, Size } from '../../types/common.types';

/**
 * Props interface for FormField component extending BaseComponentProps
 * Provides comprehensive form field configuration options
 */
interface FormFieldProps extends BaseComponentProps {
  /** Label text for the form field */
  label: string;
  /** Optional helper text displayed below the field */
  helperText?: string;
  /** Error message to display when field is in error state */
  error?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Size variant following Material Design 3.0 specs */
  size?: Size;
  /** Form field content */
  children: React.ReactNode;
  /** Optional ID for the form field. Auto-generated if not provided */
  id?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
}

/**
 * A comprehensive form field wrapper component following Material Design 3.0 guidelines
 * Provides consistent layout, styling, and error handling with enhanced accessibility
 *
 * @version 1.0.0
 */
const FormField: React.FC<FormFieldProps> = ({
  label,
  helperText,
  error,
  required = false,
  size = Size.MEDIUM,
  children,
  className,
  testId,
  id: providedId,
  disabled = false,
}) => {
  // Generate unique ID if not provided
  const uniqueId = React.useId();
  const id = providedId || uniqueId;
  const helperId = `${id}-helper`;
  
  // Compose CSS classes based on state and props
  const fieldClasses = clsx(
    'form-field',
    `form-field--${size.toLowerCase()}`,
    {
      'form-field--error': !!error,
      'form-field--disabled': disabled,
      'form-field--required': required,
    },
    className
  );

  // Compose label classes
  const labelClasses = clsx(
    'form-field__label',
    `form-field__label--${size.toLowerCase()}`,
    {
      'form-field__label--error': !!error,
      'form-field__label--disabled': disabled,
    }
  );

  // Compose helper text classes
  const helperClasses = clsx(
    'form-field__helper',
    {
      'form-field__helper--error': !!error,
      'form-field__helper--disabled': disabled,
    }
  );

  return (
    <div
      className={fieldClasses}
      data-testid={testId}
      data-size={size}
      data-error={!!error}
    >
      {/* Label with required indicator */}
      <label
        htmlFor={id}
        className={labelClasses}
        data-required={required}
      >
        <span className="form-field__label-text">
          {label}
          {required && (
            <span className="form-field__required" aria-hidden="true">
              *
            </span>
          )}
        </span>
      </label>

      {/* Field content wrapper */}
      <div 
        className="form-field__content"
        aria-disabled={disabled}
      >
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              id,
              'aria-describedby': helperText || error ? helperId : undefined,
              'aria-invalid': !!error,
              'aria-required': required,
              disabled,
              ...child.props,
            });
          }
          return child;
        })}
      </div>

      {/* Helper text or error message */}
      {(helperText || error) && (
        <div
          id={helperId}
          className={helperClasses}
          role={error ? 'alert' : 'status'}
          aria-live={error ? 'assertive' : 'polite'}
        >
          {error ? (
            <span className="form-field__error-icon" aria-hidden="true">
              ⚠
            </span>
          ) : null}
          <span className="form-field__helper-text">
            {error || helperText}
          </span>
        </div>
      )}
    </div>
  );
};

// Display name for debugging
FormField.displayName = 'FormField';

export default FormField;