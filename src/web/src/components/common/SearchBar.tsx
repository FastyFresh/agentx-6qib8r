import React, { useState, useEffect } from 'react'; // ^18.2.0
import { Search, X, SpinnerGap } from '@phosphor-icons/react'; // ^2.0.10
import TextField from './TextField';
import IconButton from './IconButton';
import useDebounce from '../../hooks/useDebounce';
import { Size } from '../../types/common.types';

interface SearchBarProps {
  placeholder?: string;
  value: string;
  size?: Size;
  onChange: (value: string) => void;
  debounceMs?: number;
  disabled?: boolean;
  isLoading?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  className?: string;
  testId?: string;
  isRTL?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onClear?: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search...',
  value,
  size = Size.MEDIUM,
  onChange,
  debounceMs = 300,
  disabled = false,
  isLoading = false,
  hasError = false,
  errorMessage,
  className = '',
  testId = 'search-bar',
  isRTL = false,
  onFocus,
  onBlur,
  onKeyDown,
  onClear,
}) => {
  // Internal state for immediate input value changes
  const [searchValue, setSearchValue] = useState(value);
  
  // Debounced value for triggering actual search
  const debouncedValue = useDebounce(searchValue, debounceMs);

  // Sync internal state with external value
  useEffect(() => {
    setSearchValue(value);
  }, [value]);

  // Trigger onChange when debounced value changes
  useEffect(() => {
    if (debouncedValue !== value) {
      onChange(debouncedValue);
    }
  }, [debouncedValue, onChange, value]);

  // Handle immediate input changes
  const handleInputChange = (newValue: string) => {
    setSearchValue(newValue);
  };

  // Handle clear button click
  const handleClear = () => {
    setSearchValue('');
    onClear?.();
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Clear on Escape
    if (event.key === 'Escape' && searchValue) {
      handleClear();
    }
    onKeyDown?.(event);
  };

  return (
    <div
      className={`md3-search-bar ${className}`}
      data-testid={testId}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <TextField
        name="search"
        value={searchValue}
        type="search"
        placeholder={placeholder}
        size={size}
        disabled={disabled}
        error={hasError ? errorMessage : undefined}
        onChange={handleInputChange}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        inputMode="search"
        fullWidth
        textDirection={isRTL ? 'rtl' : 'ltr'}
        className="md3-search-bar__input"
      />

      <div className="md3-search-bar__icons">
        {isLoading ? (
          <IconButton
            icon={<SpinnerGap />}
            variant="tertiary"
            size={size}
            disabled
            ariaLabel="Loading search results"
            className="md3-search-bar__loading-icon"
          />
        ) : (
          <IconButton
            icon={<Search />}
            variant="tertiary"
            size={size}
            disabled={disabled}
            ariaLabel="Search"
            className="md3-search-bar__search-icon"
          />
        )}

        {searchValue && !disabled && (
          <IconButton
            icon={<X />}
            variant="tertiary"
            size={size}
            onClick={handleClear}
            ariaLabel="Clear search"
            className="md3-search-bar__clear-icon"
          />
        )}
      </div>
    </div>
  );
};

export default SearchBar;