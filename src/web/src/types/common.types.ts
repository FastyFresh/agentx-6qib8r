/**
 * Core TypeScript type definitions for common interfaces, types, and utilities
 * Used throughout the frontend application to ensure type safety and standardization
 * @version 1.0.0
 */

import { ReactNode } from 'react'; // ^18.2.0
import { ApiError } from './api.types';

/**
 * Enum representing different loading states for components
 */
export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

/**
 * Enum for application theme modes
 */
export enum Theme {
  LIGHT = 'LIGHT',
  DARK = 'DARK'
}

/**
 * Enum for component size variations
 */
export enum Size {
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE'
}

/**
 * Enum for message and alert severities
 */
export enum Severity {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR'
}

/**
 * Base interface for common component props
 * Provides consistent prop structure across components
 */
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
  testId?: string;
}

/**
 * Interface for managing error states
 * Used for consistent error handling across components
 */
export interface ErrorState {
  hasError: boolean;
  error: ApiError | null;
}

/**
 * Interface for pagination state management
 * Provides standardized pagination structure
 */
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Enum for sort directions in data grids and tables
 */
export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC'
}

/**
 * Interface for sort state management
 * Used for consistent sorting behavior across data displays
 */
export interface SortState {
  field: string;
  direction: SortDirection;
}

/**
 * Type guard to check if a value is a valid Theme
 * @param value - The value to check
 */
export function isTheme(value: unknown): value is Theme {
  return Object.values(Theme).includes(value as Theme);
}

/**
 * Type guard to check if a value is a valid Size
 * @param value - The value to check
 */
export function isSize(value: unknown): value is Size {
  return Object.values(Size).includes(value as Size);
}

/**
 * Type guard to check if a value is a valid Severity
 * @param value - The value to check
 */
export function isSeverity(value: unknown): value is Severity {
  return Object.values(Severity).includes(value as Severity);
}

/**
 * Type for component event handlers with generic payload
 */
export type EventHandler<T = void> = (event: T) => void;

/**
 * Interface for component ref forwarding
 */
export interface RefForwardingComponentProps<T> extends BaseComponentProps {
  ref?: React.Ref<T>;
}

/**
 * Type for style objects with strict typing
 */
export type StyleObject = {
  [key: string]: string | number | StyleObject;
};

/**
 * Type for component class name generators
 */
export type ClassNameGenerator = (...args: unknown[]) => string;

/**
 * Utility type to make specific properties required
 */
export type RequiredProperties<T, K extends keyof T> = T & {
  [P in K]-?: T[P];
};

/**
 * Utility type to make all nested properties readonly
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

/**
 * Type for component display names
 */
export type DisplayName = string & { readonly __brand: unique symbol };

/**
 * Type for component test IDs
 */
export type TestId = string & { readonly __brand: unique symbol };

// Freeze enums to prevent modification
Object.freeze(LoadingState);
Object.freeze(Theme);
Object.freeze(Size);
Object.freeze(Severity);
Object.freeze(SortDirection);