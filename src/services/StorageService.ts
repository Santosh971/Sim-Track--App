/**
 * Storage Service - Wrapper around AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config/index';
import { User } from '../models/index';

/**
 * Storage service for managing app data
 */
export const StorageService = {
  // Mobile Number (persistent - used for sync)
  async getMobileNumber(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.MOBILE_NUMBER);
  },

  async setMobileNumber(mobileNumber: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.MOBILE_NUMBER, mobileNumber);
  },

  async removeMobileNumber(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.MOBILE_NUMBER);
  },

  // JWT Token (cleared on logout)
  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.JWT_TOKEN);
  },

  async setToken(token: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.JWT_TOKEN, token);
  },

  async removeToken(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.JWT_TOKEN);
  },

  // Refresh Token
  async getRefreshToken(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  },

  async setRefreshToken(token: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
  },

  async removeRefreshToken(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  },

  // User Data
  async getUser(): Promise<User | null> {
    const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    return userData ? JSON.parse(userData) : null;
  },

  async setUser(user: User): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
  },

  async removeUser(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
  },

  // Last Sync Timestamp
  async getLastSync(): Promise<number | null> {
    const timestamp = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return timestamp ? parseInt(timestamp, 10) : null;
  },

  async setLastSync(timestamp: number): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp.toString());
  },

  async removeLastSync(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
  },

  // Sync Interval
  async getSyncInterval(): Promise<number> {
    const interval = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_INTERVAL);
    return interval ? parseInt(interval, 10) : 5; // Default 5 minutes
  },

  async setSyncInterval(interval: number): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.SYNC_INTERVAL, interval.toString());
  },

  // Auto Sync Enabled
  async isAutoSyncEnabled(): Promise<boolean> {
    const enabled = await AsyncStorage.getItem(STORAGE_KEYS.AUTO_SYNC_ENABLED);
    return enabled !== 'false'; // Default true
  },

  async setAutoSyncEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.AUTO_SYNC_ENABLED, enabled.toString());
  },

  // Permissions Granted
  async hasPermissions(): Promise<boolean> {
    const granted = await AsyncStorage.getItem(STORAGE_KEYS.PERMISSIONS_GRANTED);
    return granted === 'true';
  },

  async setPermissionsGranted(granted: boolean): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.PERMISSIONS_GRANTED, granted.toString());
  },

  // Clear all auth data (logout)
  async clearAuthData(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.JWT_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.USER_DATA,
    ]);
    // Note: We keep MOBILE_NUMBER for sync functionality
  },

  // Clear all data (full reset)
  async clearAll(): Promise<void> {
    await AsyncStorage.clear();
  },
};

export default StorageService;