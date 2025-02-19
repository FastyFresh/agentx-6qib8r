/**
 * Comprehensive utility module for standardized, locale-aware, and accessible data formatting
 * Provides formatting functions for numbers, percentages, file sizes, and metric values
 * @version 1.0.0
 */

import { format } from 'date-fns'; // ^2.30.0
import { MetricValue, MetricType } from '../types/metrics.types';

// Cache for formatted values to improve performance
const formatCache = new Map<string, string>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Formats a number with locale-aware thousands separators and configurable decimal places
 * @param value - The number to format
 * @param decimals - Number of decimal places (0-20)
 * @param locale - The locale to use for formatting (defaults to user's locale)
 * @returns Formatted number string with ARIA attributes
 */
export const formatNumber = (
  value: number,
  decimals: number = 2,
  locale?: string
): string => {
  if (!Number.isFinite(value)) {
    return 'N/A';
  }

  const cacheKey = `num_${value}_${decimals}_${locale}`;
  const cached = formatCache.get(cacheKey);
  if (cached) return cached;

  const clampedDecimals = Math.max(0, Math.min(20, decimals));
  
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: clampedDecimals,
    maximumFractionDigits: clampedDecimals
  });

  const formatted = formatter.format(value);
  const result = `<span aria-label="${value.toString()}" role="text">${formatted}</span>`;
  
  formatCache.set(cacheKey, result);
  setTimeout(() => formatCache.delete(cacheKey), CACHE_TTL);
  
  return result;
};

/**
 * Formats a decimal number as a percentage with locale-aware formatting
 * @param value - The decimal value to format as percentage (0-1)
 * @param decimals - Number of decimal places (0-20)
 * @param locale - The locale to use for formatting
 * @returns Formatted percentage string with ARIA attributes
 */
export const formatPercentage = (
  value: number,
  decimals: number = 1,
  locale?: string
): string => {
  if (!Number.isFinite(value)) {
    return 'N/A';
  }

  const cacheKey = `pct_${value}_${decimals}_${locale}`;
  const cached = formatCache.get(cacheKey);
  if (cached) return cached;

  const percentage = value * 100;
  const formatter = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  const formatted = formatter.format(value);
  const result = `<span aria-label="${percentage}%" role="percentage">${formatted}</span>`;
  
  formatCache.set(cacheKey, result);
  setTimeout(() => formatCache.delete(cacheKey), CACHE_TTL);
  
  return result;
};

/**
 * File size units in binary and decimal formats
 */
const FILE_SIZE_UNITS = {
  binary: ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'],
  decimal: ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
};

/**
 * Formats a number of bytes into human-readable file size
 * @param bytes - The number of bytes to format
 * @param useBinaryUnits - Whether to use binary (1024) or decimal (1000) units
 * @param precision - Number of decimal places for the formatted value
 * @returns Human-readable file size with ARIA attributes
 */
export const formatFileSize = (
  bytes: number,
  useBinaryUnits: boolean = true,
  precision: number = 2
): string => {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return 'N/A';
  }

  const cacheKey = `size_${bytes}_${useBinaryUnits}_${precision}`;
  const cached = formatCache.get(cacheKey);
  if (cached) return cached;

  const units = useBinaryUnits ? FILE_SIZE_UNITS.binary : FILE_SIZE_UNITS.decimal;
  const base = useBinaryUnits ? 1024 : 1000;
  
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= base && unitIndex < units.length - 1) {
    size /= base;
    unitIndex++;
  }

  const formatted = size.toFixed(precision);
  const unit = units[unitIndex];
  const fullUnitName = unit.replace('i', 'ibi');
  
  const result = `<span aria-label="${formatted} ${fullUnitName}bytes" role="text">${formatted} ${unit}</span>`;
  
  formatCache.set(cacheKey, result);
  setTimeout(() => formatCache.delete(cacheKey), CACHE_TTL);
  
  return result;
};

/**
 * Metric type specific formatting configurations
 */
const METRIC_FORMATS = {
  [MetricType.SYSTEM_HEALTH]: {
    decimals: 1,
    suffix: '%',
    role: 'percentage'
  },
  [MetricType.AGENT_PERFORMANCE]: {
    decimals: 2,
    suffix: 'ms',
    role: 'timer'
  },
  [MetricType.API_RESPONSE_TIME]: {
    decimals: 0,
    suffix: 'ms',
    role: 'timer'
  },
  [MetricType.INTEGRATION_STATUS]: {
    decimals: 2,
    suffix: '',
    role: 'status'
  }
};

/**
 * Formats a metric value with appropriate unit and precision based on metric type
 * @param metric - The metric value object to format
 * @param locale - The locale to use for formatting
 * @returns Formatted metric value with appropriate unit and ARIA attributes
 */
export const formatMetricValue = (
  metric: MetricValue,
  locale?: string
): string => {
  const { value, type, timestamp } = metric;
  
  const cacheKey = `metric_${value}_${type}_${timestamp}_${locale}`;
  const cached = formatCache.get(cacheKey);
  if (cached) return cached;

  const config = METRIC_FORMATS[type];
  const formattedValue = formatNumber(value, config.decimals, locale);
  const formattedTime = format(timestamp, 'yyyy-MM-dd HH:mm:ss');
  
  const result = `<span aria-label="${formattedValue}${config.suffix} at ${formattedTime}" role="${config.role}">${formattedValue}${config.suffix}</span>`;
  
  formatCache.set(cacheKey, result);
  setTimeout(() => formatCache.delete(cacheKey), CACHE_TTL);
  
  return result;
};

/**
 * Truncates text to specified length with ellipsis
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation
 * @param locale - The locale to use for text direction
 * @returns Truncated text with ellipsis and ARIA attributes
 */
export const truncateText = (
  text: string,
  maxLength: number,
  locale?: string
): string => {
  if (text.length <= maxLength) {
    return text;
  }

  const cacheKey = `trunc_${text}_${maxLength}_${locale}`;
  const cached = formatCache.get(cacheKey);
  if (cached) return cached;

  const isRTL = new Intl.Locale(locale || 'en').textInfo?.direction === 'rtl';
  const ellipsis = '…';
  const truncated = text.slice(0, maxLength - 1) + ellipsis;
  
  const result = `<span aria-label="${text}" role="text" title="${text}">${truncated}</span>`;
  
  formatCache.set(cacheKey, result);
  setTimeout(() => formatCache.delete(cacheKey), CACHE_TTL);
  
  return result;
};