import React from 'react'; // ^18.2.0
import clsx from 'clsx'; // ^2.0.0
import { BaseComponentProps, Size } from '../../types/common.types';
import FormField from './FormField';
import { formatDate, parseDate, isValidDate } from '../../utils/dateUtils';

/**
 * Props interface for DatePicker component with comprehensive configuration options
 */
interface DatePickerProps extends BaseComponentProps {
  /** Current date value */
  value: Date | null;
  /** Callback for date changes */
  onChange: (date: Date | null) => void;
  /** Field label */
  label: string;
  /** Helper text displayed below the field */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Size variant following Material Design 3.0 */
  size?: Size;
  /** Date format string (e.g., 'yyyy-MM-dd') */
  format?: string;
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Locale for date formatting */
  locale?: string;
  /** Timezone for date handling */
  timezone?: string;
  /** Whether the field can be cleared */
  clearable?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Custom date validation function */
  shouldDisableDate?: (date: Date) => boolean;
}

/**
 * A comprehensive date picker component following Material Design 3.0 guidelines
 * Provides full keyboard navigation, screen reader support, and internationalization
 * 
 * @version 1.0.0
 */
const DatePicker: React.FC<DatePickerProps> = React.memo(({
  value,
  onChange,
  label,
  helperText,
  error,
  required = false,
  size = Size.MEDIUM,
  format = 'yyyy-MM-dd',
  minDate,
  maxDate,
  disabled = false,
  locale = 'en-US',
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  clearable = true,
  placeholder = 'Select date',
  shouldDisableDate,
  className,
  testId,
}) => {
  // Internal state for input value
  const [inputValue, setInputValue] = React.useState<string>('');
  const [isFocused, setIsFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Update input value when external value changes
  React.useEffect(() => {
    if (value) {
      setInputValue(formatDate(value, format, timezone, { locale }));
    } else {
      setInputValue('');
    }
  }, [value, format, timezone, locale]);

  /**
   * Handles date input changes with validation
   */
  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const newValue = event.target.value;
    setInputValue(newValue);

    if (!newValue && clearable) {
      onChange(null);
      return;
    }

    const parsedDate = parseDate(newValue, format, timezone);
    
    if (parsedDate && isValidDate(parsedDate, format, minDate, maxDate, timezone)) {
      if (shouldDisableDate && shouldDisableDate(parsedDate)) {
        return;
      }
      onChange(parsedDate);
    }
  };

  /**
   * Handles keyboard navigation and accessibility
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      inputRef.current?.blur();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const parsedDate = parseDate(inputValue, format, timezone);
      if (parsedDate && isValidDate(parsedDate, format, minDate, maxDate, timezone)) {
        onChange(parsedDate);
        inputRef.current?.blur();
      }
    }
  };

  /**
   * Handles focus events for keyboard interaction
   */
  const handleFocus = (): void => {
    setIsFocused(true);
  };

  const handleBlur = (): void => {
    setIsFocused(false);
    if (value && inputValue) {
      setInputValue(formatDate(value, format, timezone, { locale }));
    }
  };

  // Compose CSS classes
  const datePickerClasses = clsx(
    'date-picker',
    `date-picker--${size.toLowerCase()}`,
    {
      'date-picker--focused': isFocused,
      'date-picker--error': !!error,
      'date-picker--disabled': disabled,
      'date-picker--clearable': clearable,
    },
    className
  );

  return (
    <FormField
      label={label}
      helperText={helperText}
      error={error}
      required={required}
      size={size}
      disabled={disabled}
      testId={testId}
    >
      <div className={datePickerClasses}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleDateChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className="date-picker__input"
          dir={locale.startsWith('ar') || locale.startsWith('he') ? 'rtl' : 'ltr'}
          aria-label={label}
          aria-invalid={!!error}
          aria-required={required}
          data-testid={`${testId}-input`}
        />
        {clearable && value && !disabled && (
          <button
            type="button"
            className="date-picker__clear"
            onClick={() => onChange(null)}
            aria-label="Clear date"
            tabIndex={-1}
          >
            ×
          </button>
        )}
        <div 
          className="date-picker__calendar-icon" 
          aria-hidden="true"
        >
          📅
        </div>
      </div>
    </FormField>
  );
});

// Display name for debugging
DatePicker.displayName = 'DatePicker';

export default DatePicker;