import { 
  format, 
  parse, 
  isValid, 
  parseISO, 
  formatDistance, 
  formatRelative, 
  differenceInDays, 
  isBefore, 
  isAfter,
  formatInTimeZone
} from 'date-fns';
import { enUS } from 'date-fns/locale';
import { memoize } from 'lodash';

// Global constants
const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const DEFAULT_LOCALE = enUS;
const MEMOIZE_MAX_CACHE = 100;

// Types
type DateInput = Date | string | number;
type FormatOptions = {
  addSuffix?: boolean;
  unit?: 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';
  roundingMethod?: 'floor' | 'ceil' | 'round';
};

/**
 * Formats a date into a specified format string with timezone and locale support
 * @version date-fns: ^2.30.0
 * @param date - The date to format
 * @param formatString - The format string (e.g., 'yyyy-MM-dd')
 * @param timezone - Target timezone (defaults to system timezone)
 * @param locale - Locale for formatting (defaults to enUS)
 * @returns Formatted date string
 * @throws {Error} If date is invalid or formatting fails
 */
export const formatDate = memoize((
  date: DateInput,
  formatString: string,
  timezone: string = DEFAULT_TIMEZONE,
  locale: Locale = DEFAULT_LOCALE
): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    
    if (!isValid(dateObj)) {
      throw new Error('Invalid date input');
    }

    return formatInTimeZone(dateObj, timezone, formatString, { locale });
  } catch (error) {
    throw new Error(`Date formatting failed: ${(error as Error).message}`);
  }
}, { maxCache: MEMOIZE_MAX_CACHE });

/**
 * Parses a date string into a Date object using specified format with timezone consideration
 * @version date-fns: ^2.30.0
 * @param dateString - The date string to parse
 * @param formatString - The format string matching the date string format
 * @param timezone - Source timezone of the date string
 * @returns Parsed Date object or null if invalid
 */
export const parseDate = (
  dateString: string,
  formatString: string,
  timezone: string = DEFAULT_TIMEZONE
): Date | null => {
  try {
    // Sanitize input
    const sanitizedDateString = dateString.replace(/[^\w\s\-:/]/gi, '');
    
    const parsedDate = parse(sanitizedDateString, formatString, new Date(), {
      locale: DEFAULT_LOCALE,
      useAdditionalWeekYearTokens: true,
      useAdditionalDayOfYearTokens: true
    });

    if (!isValid(parsedDate)) {
      return null;
    }

    // Adjust for timezone
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    return new Date(parsedDate.getTime() + tzOffset);
  } catch (error) {
    throw new Error(`Date parsing failed: ${(error as Error).message}`);
  }
};

/**
 * Validates a date against format, range constraints, and timezone
 * @version date-fns: ^2.30.0
 * @param date - Date to validate
 * @param format - Expected format string (optional)
 * @param minDate - Minimum allowed date (optional)
 * @param maxDate - Maximum allowed date (optional)
 * @param timezone - Timezone for validation
 * @returns Boolean indicating validity
 */
export const isValidDate = memoize((
  date: DateInput,
  format?: string,
  minDate?: Date,
  maxDate?: Date,
  timezone: string = DEFAULT_TIMEZONE
): boolean => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);

    if (!isValid(dateObj)) {
      return false;
    }

    if (format) {
      const formattedDate = formatDate(dateObj, format, timezone);
      const reparsedDate = parseDate(formattedDate, format, timezone);
      if (!reparsedDate || !isValid(reparsedDate)) {
        return false;
      }
    }

    if (minDate && isBefore(dateObj, minDate)) {
      return false;
    }

    if (maxDate && isAfter(dateObj, maxDate)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}, { maxCache: MEMOIZE_MAX_CACHE });

/**
 * Formats a date relative to current time with locale and timezone support
 * @version date-fns: ^2.30.0
 * @param date - Date to format
 * @param options - Formatting options
 * @param timezone - Target timezone
 * @param locale - Locale for formatting
 * @returns Localized relative time string
 */
export const formatRelativeTime = (
  date: DateInput,
  options: FormatOptions = {},
  timezone: string = DEFAULT_TIMEZONE,
  locale: Locale = DEFAULT_LOCALE
): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    
    if (!isValid(dateObj)) {
      throw new Error('Invalid date input');
    }

    const now = new Date();
    return formatDistance(dateObj, now, {
      addSuffix: options.addSuffix ?? true,
      locale,
      ...options
    });
  } catch (error) {
    throw new Error(`Relative time formatting failed: ${(error as Error).message}`);
  }
};

/**
 * Calculates the number of days between two dates with working days option
 * @version date-fns: ^2.30.0
 * @param startDate - Start date
 * @param endDate - End date
 * @param workingDaysOnly - Whether to count only working days (Mon-Fri)
 * @param timezone - Timezone for calculations
 * @returns Number of days between dates
 */
export const getDaysDifference = (
  startDate: DateInput,
  endDate: DateInput,
  workingDaysOnly: boolean = false,
  timezone: string = DEFAULT_TIMEZONE
): number => {
  try {
    const start = typeof startDate === 'string' ? parseISO(startDate) : new Date(startDate);
    const end = typeof endDate === 'string' ? parseISO(endDate) : new Date(endDate);

    if (!isValid(start) || !isValid(end)) {
      throw new Error('Invalid date input');
    }

    let difference = differenceInDays(end, start);

    if (workingDaysOnly) {
      // Adjust for weekends
      const weeks = Math.floor(Math.abs(difference) / 7);
      let remainingDays = Math.abs(difference) % 7;
      let weekendDays = weeks * 2;

      const startDay = start.getDay();
      const endDay = end.getDay();

      if (remainingDays > 0) {
        for (let i = startDay; i !== endDay; i = (i + 1) % 7) {
          if (i === 0 || i === 6) weekendDays++;
        }
      }

      difference = difference < 0 
        ? -(Math.abs(difference) - weekendDays)
        : difference - weekendDays;
    }

    return Math.abs(difference);
  } catch (error) {
    throw new Error(`Days difference calculation failed: ${(error as Error).message}`);
  }
};