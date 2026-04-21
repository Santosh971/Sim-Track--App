/**
 * Background Sync Native Module Interface
 * Controls the Android foreground service for background call log sync
 */

import { NativeModules, Platform } from 'react-native';

export interface BackgroundSyncInterface {
  isRunning(): Promise<boolean>;
  startSync(): Promise<boolean>;
  stopSync(): Promise<boolean>;
  setSyncInterval(intervalMinutes: number): Promise<number>;
  getSyncInterval(): Promise<number>;
  isAutoSyncEnabled(): Promise<boolean>;
  setMobileNumber(mobileNumber: string): Promise<boolean>;
  getMobileNumber(): Promise<string | null>;
  getLastSyncTime(): Promise<number>;
  setLastSyncTime(timestamp: number): Promise<boolean>;
}

const { BackgroundSyncModule } = NativeModules;

/**
 * Background Sync Service Controller
 */
export const BackgroundSync: BackgroundSyncInterface = {
  /**
   * Check if background sync service is running
   */
  isRunning: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return false;
    }
    return BackgroundSyncModule.isRunning();
  },

  /**
   * Start background sync service
   */
  startSync: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      console.warn('Background sync is only supported on Android');
      return false;
    }
    return BackgroundSyncModule.startSync();
  },

  /**
   * Stop background sync service
   */
  stopSync: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }
    return BackgroundSyncModule.stopSync();
  },

  /**
   * Set sync interval in minutes (5-60)
   */
  setSyncInterval: async (intervalMinutes: number): Promise<number> => {
    if (Platform.OS !== 'android') {
      return intervalMinutes;
    }
    return BackgroundSyncModule.setSyncInterval(intervalMinutes);
  },

  /**
   * Get current sync interval
   */
  getSyncInterval: async (): Promise<number> => {
    if (Platform.OS !== 'android') {
      return 15;
    }
    return BackgroundSyncModule.getSyncInterval();
  },

  /**
   * Check if auto-sync is enabled
   */
  isAutoSyncEnabled: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return false;
    }
    return BackgroundSyncModule.isAutoSyncEnabled();
  },

  /**
   * Set mobile number for sync authentication
   */
  setMobileNumber: async (mobileNumber: string): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }
    return BackgroundSyncModule.setMobileNumber(mobileNumber);
  },

  /**
   * Get stored mobile number
   */
  getMobileNumber: async (): Promise<string | null> => {
    if (Platform.OS !== 'android') {
      return null;
    }
    return BackgroundSyncModule.getMobileNumber();
  },

  /**
   * Get last sync timestamp
   */
  getLastSyncTime: async (): Promise<number> => {
    if (Platform.OS !== 'android') {
      return 0;
    }
    return BackgroundSyncModule.getLastSyncTime();
  },

  /**
   * Set last sync timestamp
   */
  setLastSyncTime: async (timestamp: number): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }
    return BackgroundSyncModule.setLastSyncTime(timestamp);
  },
};

export default BackgroundSync;