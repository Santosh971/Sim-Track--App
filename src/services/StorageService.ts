/**
 * Storage Service - Wrapper around AsyncStorage
 * Handles non-sensitive data storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config/index';
import { User, MatchedSIM } from '../models/index';

/**
 * Storage service for managing app data
 * Note: Sensitive data like tokens should use SecureStorageService
 */
export const StorageService = {
  // Email (non-sensitive, used for display)
  async getEmail(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.EMAIL);
  },

  async setEmail(email: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.EMAIL, email);
  },

  async removeEmail(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.EMAIL);
  },

  // Legacy mobile number (kept for backwards compatibility)
  async getMobileNumber(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.MOBILE_NUMBER);
  },

  async setMobileNumber(mobileNumber: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.MOBILE_NUMBER, mobileNumber);
  },

  async removeMobileNumber(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.MOBILE_NUMBER);
  },

  // User Data (non-sensitive profile data)
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

  // Matched SIMs
  async getMatchedSIMs(): Promise<MatchedSIM[] | null> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.MATCHED_SIMS);
    return data ? JSON.parse(data) : null;
  },

  async setMatchedSIMs(sims: MatchedSIM[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.MATCHED_SIMS, JSON.stringify(sims));
  },

  async removeMatchedSIMs(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.MATCHED_SIMS);
  },

  // Device ID
  async getDeviceId(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  },

  async setDeviceId(deviceId: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
  },

  async removeDeviceId(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.DEVICE_ID);
  },

  // Valid SIM IDs (for background sync)
  async getValidSIMIds(): Promise<string[] | null> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.VALID_SIM_IDS);
    return data ? JSON.parse(data) : null;
  },

  async setValidSIMIds(simIds: string[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.VALID_SIM_IDS, JSON.stringify(simIds));
  },

  async removeValidSIMIds(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.VALID_SIM_IDS);
  },

  // Last Sync Timestamp (per SIM)
  async getLastSync(simId?: string): Promise<number | null> {
    const key = simId ? `${STORAGE_KEYS.LAST_SYNC}_${simId}` : STORAGE_KEYS.LAST_SYNC;
    const timestamp = await AsyncStorage.getItem(key);
    return timestamp ? parseInt(timestamp, 10) : null;
  },

  async setLastSync(timestamp: number, simId?: string): Promise<void> {
    const key = simId ? `${STORAGE_KEYS.LAST_SYNC}_${simId}` : STORAGE_KEYS.LAST_SYNC;
    await AsyncStorage.setItem(key, timestamp.toString());
  },

  async removeLastSync(simId?: string): Promise<void> {
    const key = simId ? `${STORAGE_KEYS.LAST_SYNC}_${simId}` : STORAGE_KEYS.LAST_SYNC;
    await AsyncStorage.removeItem(key);
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

  // Clear auth data (logout) - keeps SIM data for background sync
  async clearAuthData(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.USER_DATA,
      STORAGE_KEYS.EMAIL,
    ]);
    // Note: We keep MOBILE_NUMBER, MATCHED_SIMS, VALID_SIM_IDS for background sync
  },

  // Clear all data (full reset)
  async clearAll(): Promise<void> {
    await AsyncStorage.clear();
  },

  // Generic methods for custom keys
  async getItem(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};

export default StorageService;