import { useState, useEffect } from 'react'; // ^18.2.0

/**
 * A custom hook that provides debounced value updates to prevent excessive re-renders and API calls.
 * Particularly useful for search inputs, real-time filtering, and other scenarios where immediate
 * updates are not necessary.
 * 
 * @template T - The type of the value being debounced
 * @param {T} value - The value to be debounced
 * @param {number} delay - The delay in milliseconds before the value should update
 * @returns {T} The debounced value of type T
 * 
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebounce(searchTerm, 300);
 */
function useDebounce<T>(value: T, delay: number): T {
  // Initialize state with the provided value while maintaining type safety
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Create a timeout to update the debounced value after the specified delay
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup function to clear the timeout when:
    // 1. Component unmounts
    // 2. Value changes before timeout completes
    // 3. Delay duration changes
    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delay]); // Only re-run effect if value or delay changes

  return debouncedValue;
}

export default useDebounce;