/**
 * Storage Utility Functions
 * Provides secure and type-safe local storage operations for the AGENT AI Platform
 * @version 1.0.0
 */

import { Theme } from '../types/common.types';
import CryptoJS from 'crypto-js'; // ^4.1.1

// Storage key prefix to namespace application storage
const STORAGE_PREFIX = 'AGENT_AI_';

// Encryption key from environment variable
const ENCRYPTION_KEY = process.env.REACT_APP_STORAGE_ENCRYPTION_KEY || 'default-key';

// Sensitive keys that require encryption
const SENSITIVE_KEYS = new Set([
  'auth_token',
  'refresh_token',
  'user_data'
]);

/**
 * Type guard to validate storage key format
 * @param key - Storage key to validate
 */
const isValidKey = (key: string): boolean => {
  return typeof key === 'string' && 
         key.length > 0 && 
         /^[a-zA-Z0-9_]+$/.test(key);
};

/**
 * Checks if localStorage is available
 * @returns boolean indicating localStorage availability
 */
const isStorageAvailable = (): boolean => {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Encrypts sensitive data before storage
 * @param value - Value to encrypt
 * @returns Encrypted string
 */
const encryptData = (value: string): string => {
  return CryptoJS.AES.encrypt(value, ENCRYPTION_KEY).toString();
};

/**
 * Decrypts sensitive data after retrieval
 * @param value - Encrypted value to decrypt
 * @returns Decrypted string
 */
const decryptData = (value: string): string => {
  const bytes = CryptoJS.AES.decrypt(value, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

/**
 * Securely stores data in localStorage with type checking and encryption
 * @param key - Storage key
 * @param value - Value to store
 * @returns boolean indicating success
 */
export const setLocalStorage = <T>(key: string, value: T): boolean => {
  try {
    if (!isValidKey(key)) {
      console.error('Invalid storage key format');
      return false;
    }

    if (!isStorageAvailable()) {
      console.error('localStorage is not available');
      return false;
    }

    const storageKey = `${STORAGE_PREFIX}${key}`;
    const valueString = JSON.stringify(value);

    // Encrypt sensitive data
    const finalValue = SENSITIVE_KEYS.has(key) 
      ? encryptData(valueString)
      : valueString;

    localStorage.setItem(storageKey, finalValue);
    return true;
  } catch (error) {
    console.error('Error setting localStorage:', error);
    return false;
  }
};

/**
 * Retrieves and deserializes data from localStorage with type safety
 * @param key - Storage key
 * @returns Retrieved value of type T or null
 */
export const getLocalStorage = <T>(key: string): T | null => {
  try {
    if (!isValidKey(key)) {
      console.error('Invalid storage key format');
      return null;
    }

    if (!isStorageAvailable()) {
      console.error('localStorage is not available');
      return null;
    }

    const storageKey = `${STORAGE_PREFIX}${key}`;
    const value = localStorage.getItem(storageKey);

    if (!value) {
      return null;
    }

    // Decrypt sensitive data
    const decryptedValue = SENSITIVE_KEYS.has(key)
      ? decryptData(value)
      : value;

    return JSON.parse(decryptedValue) as T;
  } catch (error) {
    console.error('Error getting localStorage:', error);
    return null;
  }
};

/**
 * Securely removes an item from localStorage
 * @param key - Storage key to remove
 * @returns boolean indicating success
 */
export const removeLocalStorage = (key: string): boolean => {
  try {
    if (!isValidKey(key)) {
      console.error('Invalid storage key format');
      return false;
    }

    if (!isStorageAvailable()) {
      console.error('localStorage is not available');
      return false;
    }

    const storageKey = `${STORAGE_PREFIX}${key}`;
    localStorage.removeItem(storageKey);
    return true;
  } catch (error) {
    console.error('Error removing localStorage item:', error);
    return false;
  }
};

/**
 * Securely clears all application data from localStorage
 * @returns boolean indicating success
 */
export const clearLocalStorage = (): boolean => {
  try {
    if (!isStorageAvailable()) {
      console.error('localStorage is not available');
      return false;
    }

    // Only clear keys with application prefix
    Object.keys(localStorage)
      .filter(key => key.startsWith(STORAGE_PREFIX))
      .forEach(key => localStorage.removeItem(key));

    return true;
  } catch (error) {
    console.error('Error clearing localStorage:', error);
    return false;
  }
};

/**
 * Gets user's theme preference with system default fallback
 * @returns Theme preference
 */
export const getThemePreference = (): Theme => {
  const savedTheme = getLocalStorage<Theme>('theme');
  if (savedTheme && (savedTheme === Theme.LIGHT || savedTheme === Theme.DARK)) {
    return savedTheme;
  }
  
  // Check system preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? Theme.DARK
    : Theme.LIGHT;
};

// Type definitions for stored data
export type StorageKey = keyof typeof SENSITIVE_KEYS | 'theme' | string;