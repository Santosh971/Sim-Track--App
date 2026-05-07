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
  setValidSIMIds(simIds: string[]): Promise<boolean>;
  getValidSIMIds(): Promise<string[]>;
  setDeviceId(deviceId: string): Promise<boolean>;
  getDeviceId(): Promise<string | null>;
  setMobileNumber(mobileNumber: string): Promise<boolean>;
  getMobileNumber(): Promise<string | null>;
  setUserEmail(email: string): Promise<boolean>;
  getUserEmail(): Promise<string | null>;
  getLastSyncTime(): Promise<number>;
  setLastSyncTime(timestamp: number): Promise<boolean>;
  // API Base URL for native modules
  setApiBaseUrl(url: string): Promise<boolean>;
  getApiBaseUrl(): Promise<string | null>;
  // WiFi Speed Test methods
  setWiFiConfig(simNumber: string, deviceId: string, deviceToken: string, tokenExpires: string, wifiConfigJson: string): Promise<boolean>;
  getWiFiConfig(): Promise<{
    simNumber: string | null;
    deviceId: string | null;
    deviceToken: string | null;
    tokenExpires: string | null;
    wifiConfigJson: string | null;
    enabled: boolean;
  }>;
  setWiFiSpeedEnabled(enabled: boolean): Promise<boolean>;
  isWiFiSpeedEnabled(): Promise<boolean>;
  getLastWiFiSpeedTest(): Promise<number>;
  // WiFi Speed Background Worker methods
  startWiFiSpeedBackground(configJson: string, intervalMinutes: number): Promise<boolean>;
  stopWiFiSpeedBackground(): Promise<boolean>;
  isWiFiSpeedBackgroundRunning(): Promise<boolean>;
  // Battery optimization methods
  isIgnoringBatteryOptimizations(): Promise<boolean>;
  requestIgnoreBatteryOptimizations(): Promise<boolean>;
  openBatterySettings(): Promise<boolean>;
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
   * Set valid SIM IDs for sync authentication
   */
  setValidSIMIds: async (simIds: string[]): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }
    return BackgroundSyncModule.setValidSIMIds(simIds);
  },

  /**
   * Get valid SIM IDs
   */
  getValidSIMIds: async (): Promise<string[]> => {
    if (Platform.OS !== 'android') {
      return [];
    }
    return BackgroundSyncModule.getValidSIMIds();
  },

  /**
   * Set device ID
   */
  setDeviceId: async (deviceId: string): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }
    return BackgroundSyncModule.setDeviceId(deviceId);
  },

  /**
   * Get device ID
   */
  getDeviceId: async (): Promise<string | null> => {
    if (Platform.OS !== 'android') {
      return null;
    }
    return BackgroundSyncModule.getDeviceId();
  },

  /**
   * Set mobile number for sync authentication (legacy)
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
   * Set user email
   */
  setUserEmail: async (email: string): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }
    return BackgroundSyncModule.setUserEmail(email);
  },

  /**
   * Get user email
   */
  getUserEmail: async (): Promise<string | null> => {
    if (Platform.OS !== 'android') {
      return null;
    }
    return BackgroundSyncModule.getUserEmail();
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

  /**
   * Set API Base URL for native modules
   * This allows native code to use the same URL as JS
   */
  setApiBaseUrl: async (url: string): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }
    return BackgroundSyncModule.setApiBaseUrl(url);
  },

  /**
   * Get stored API Base URL
   */
  getApiBaseUrl: async (): Promise<string | null> => {
    if (Platform.OS !== 'android') {
      return null;
    }
    return BackgroundSyncModule.getApiBaseUrl();
  },

  /**
   * Set WiFi speed test configuration
   * Stores WiFi auth data for background speed tests
   * UPDATED: Now includes deviceId parameter
   */
  setWiFiConfig: async (
    simNumber: string,
    deviceId: string,
    deviceToken: string,
    tokenExpires: string,
    wifiConfigJson: string
  ): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }
    return BackgroundSyncModule.setWiFiConfig(simNumber, deviceId, deviceToken, tokenExpires, wifiConfigJson);
  },

  /**
   * Get WiFi config
   */
  getWiFiConfig: async (): Promise<{
    simNumber: string | null;
    deviceId: string | null;
    deviceToken: string | null;
    tokenExpires: string | null;
    wifiConfigJson: string | null;
    enabled: boolean;
  }> => {
    if (Platform.OS !== 'android') {
      return { simNumber: null, deviceId: null, deviceToken: null, tokenExpires: null, wifiConfigJson: null, enabled: false };
    }
    return BackgroundSyncModule.getWiFiConfig();
  },

  /**
   * Enable/disable WiFi speed test in background
   */
  setWiFiSpeedEnabled: async (enabled: boolean): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }
    return BackgroundSyncModule.setWiFiSpeedEnabled(enabled);
  },

  /**
   * Check if WiFi speed test is enabled
   */
  isWiFiSpeedEnabled: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return false;
    }
    return BackgroundSyncModule.isWiFiSpeedEnabled();
  },

  /**
   * Get last WiFi speed test timestamp
   */
  getLastWiFiSpeedTest: async (): Promise<number> => {
    if (Platform.OS !== 'android') {
      return 0;
    }
    return BackgroundSyncModule.getLastWiFiSpeedTest();
  },

  // ============================================
  // WiFi Speed Background Worker Methods
  // ============================================

  /**
   * Start WiFi speed background monitoring using WorkManager
   * This will run periodically even when app is in background
   */
  startWiFiSpeedBackground: async (configJson: string, intervalMinutes: number): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      console.log('[BackgroundSync] WiFi speed background not supported on iOS');
      return false;
    }
    return BackgroundSyncModule.startWiFiSpeedBackground(configJson, intervalMinutes);
  },

  /**
   * Stop WiFi speed background monitoring
   */
  stopWiFiSpeedBackground: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }
    return BackgroundSyncModule.stopWiFiSpeedBackground();
  },

  /**
   * Check if WiFi speed background monitoring is running
   */
  isWiFiSpeedBackgroundRunning: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return false;
    }
    return BackgroundSyncModule.isWiFiSpeedBackgroundRunning();
  },

  // ============================================
  // Battery Optimization Methods
  // ============================================

  /**
   * Check if app is ignoring battery optimizations
   * Returns true if the app is whitelisted (not affected by battery optimizations)
   */
  isIgnoringBatteryOptimizations: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true; // iOS doesn't have this restriction
    }
    return BackgroundSyncModule.isIgnoringBatteryOptimizations();
  },

  /**
   * Request to ignore battery optimizations
   * Opens system dialog to request exemption from battery optimizations
   */
  requestIgnoreBatteryOptimizations: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }
    return BackgroundSyncModule.requestIgnoreBatteryOptimizations();
  },

  /**
   * Open battery optimization settings
   * Opens the battery optimization settings screen
   */
  openBatterySettings: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }
    return BackgroundSyncModule.openBatterySettings();
  },
};

export default BackgroundSync;