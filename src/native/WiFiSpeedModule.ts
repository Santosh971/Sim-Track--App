/**
 * Native WiFi Speed Module Interface
 * Provides native speed test functionality on Android
 */

import { NativeModules, Platform } from 'react-native';

/**
 * Speed test result from native module
 */
export interface NativeSpeedTestResult {
  download: number;  // Mbps
  upload: number;    // Mbps
  latency: number;   // ms
}

/**
 * WiFi connection info from native module
 */
export interface WiFiConnectionInfo {
  ssid: string | null;
  bssid: string | null;
  isConnected: boolean;
  hasValidSSID: boolean;
}

/**
 * WiFi connection status check
 */
export interface WiFiConnectionStatus {
  isOnWifi: boolean;
  hasLocationPermission: boolean;
  canGetSSID: boolean;
}

/**
 * WiFi Speed Module interface
 */
interface WiFiSpeedModuleInterface {
  /**
   * Run a speed test and return results
   */
  runSpeedTest(): Promise<NativeSpeedTestResult>;

  /**
   * Force run speed test (debugging - runs even if not on WiFi)
   */
  forceRunSpeedTest(): Promise<NativeSpeedTestResult>;

  /**
   * Start background speed monitoring at specified interval
   * @param intervalMinutes - Interval in minutes (default 5)
   */
  startBackgroundMonitoring(intervalMinutes: number): Promise<void>;

  /**
   * Stop background speed monitoring
   */
  stopBackgroundMonitoring(): Promise<void>;

  /**
   * Check if background monitoring is running
   */
  isMonitoring(): Promise<boolean>;

  /**
   * Get current WiFi connection info (SSID, BSSID)
   */
  getCurrentWiFiInfo(): Promise<WiFiConnectionInfo>;

  /**
   * Check WiFi connection status
   */
  checkWiFiConnection(): Promise<WiFiConnectionStatus>;
}

const LINKING_ERROR =
  `The package 'WiFiSpeedModule' doesn't seem to be linked. Make sure:\n` +
  `- You rebuilt the app after installing the package\n` +
  `- If you are using CocoaPods on iOS, run 'pod install'`;

/**
 * WiFi Speed Module implementation
 */
const WiFiSpeedModule: WiFiSpeedModuleInterface = {
  runSpeedTest: async (): Promise<NativeSpeedTestResult> => {
    if (Platform.OS !== 'android') {
      console.warn('[WiFiSpeedModule] Speed test is only available on Android');
      // Return simulated result on iOS
      return {
        download: Math.random() * 50 + 10,
        upload: Math.random() * 20 + 5,
        latency: Math.random() * 50 + 10,
      };
    }

    try {
      const { WiFiSpeedModule } = NativeModules;

      if (!WiFiSpeedModule) {
        console.warn('[WiFiSpeedModule] Native module not available');
        throw new Error(LINKING_ERROR);
      }

      const result = await WiFiSpeedModule.runSpeedTest();
      console.log('[WiFiSpeedModule] Speed test result:', result);
      return {
        download: result.download || 0,
        upload: result.upload || 0,
        latency: result.latency || 0,
      };
    } catch (error) {
      console.error('[WiFiSpeedModule] Error running speed test:', error);
      throw error;
    }
  },

  forceRunSpeedTest: async (): Promise<NativeSpeedTestResult> => {
    console.log('[WiFiSpeedModule] Force running speed test...');

    if (Platform.OS !== 'android') {
      return {
        download: Math.random() * 50 + 10,
        upload: Math.random() * 20 + 5,
        latency: Math.random() * 50 + 10,
      };
    }

    try {
      const { WiFiSpeedModule } = NativeModules;

      if (!WiFiSpeedModule) {
        throw new Error(LINKING_ERROR);
      }

      // Call force method if available
      if (WiFiSpeedModule.forceRunSpeedTest) {
        const result = await WiFiSpeedModule.forceRunSpeedTest();
        console.log('[WiFiSpeedModule] Force speed test result:', result);
        return {
          download: result.download || 0,
          upload: result.upload || 0,
          latency: result.latency || 0,
        };
      } else {
        // Fallback to regular method
        console.log('[WiFiSpeedModule] forceRunSpeedTest not available, using regular method');
        const result = await WiFiSpeedModule.runSpeedTest();
        return {
          download: result.download || 0,
          upload: result.upload || 0,
          latency: result.latency || 0,
        };
      }
    } catch (error) {
      console.error('[WiFiSpeedModule] Error force running speed test:', error);
      throw error;
    }
  },

  startBackgroundMonitoring: async (intervalMinutes: number = 5): Promise<void> => {
    if (Platform.OS !== 'android') {
      console.warn('[WiFiSpeedModule] Background monitoring is only available on Android');
      return;
    }

    try {
      const { WiFiSpeedModule } = NativeModules;

      if (!WiFiSpeedModule) {
        console.warn('[WiFiSpeedModule] Native module not available');
        return;
      }

      await WiFiSpeedModule.startBackgroundMonitoring(intervalMinutes);
      console.log('[WiFiSpeedModule] Background monitoring started');
    } catch (error) {
      console.error('[WiFiSpeedModule] Error starting background monitoring:', error);
    }
  },

  stopBackgroundMonitoring: async (): Promise<void> => {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      const { WiFiSpeedModule } = NativeModules;

      if (!WiFiSpeedModule) {
        return;
      }

      await WiFiSpeedModule.stopBackgroundMonitoring();
      console.log('[WiFiSpeedModule] Background monitoring stopped');
    } catch (error) {
      console.error('[WiFiSpeedModule] Error stopping background monitoring:', error);
    }
  },

  isMonitoring: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      const { WiFiSpeedModule } = NativeModules;

      if (!WiFiSpeedModule) {
        return false;
      }

      return await WiFiSpeedModule.isMonitoring();
    } catch (error) {
      console.error('[WiFiSpeedModule] Error checking monitoring status:', error);
      return false;
    }
  },

  getCurrentWiFiInfo: async (): Promise<WiFiConnectionInfo> => {
    if (Platform.OS !== 'android') {
      console.warn('[WiFiSpeedModule] WiFi info only available on Android');
      return {
        ssid: null,
        bssid: null,
        isConnected: false,
        hasValidSSID: false,
      };
    }

    try {
      const { WiFiSpeedModule } = NativeModules;

      if (!WiFiSpeedModule) {
        console.warn('[WiFiSpeedModule] Native module not available');
        return {
          ssid: null,
          bssid: null,
          isConnected: false,
          hasValidSSID: false,
        };
      }

      const result = await WiFiSpeedModule.getCurrentWiFiInfo();
      return {
        ssid: result.ssid || null,
        bssid: result.bssid || null,
        isConnected: result.isConnected || false,
        hasValidSSID: result.hasValidSSID || false,
      };
    } catch (error) {
      console.error('[WiFiSpeedModule] Error getting WiFi info:', error);
      return {
        ssid: null,
        bssid: null,
        isConnected: false,
        hasValidSSID: false,
      };
    }
  },

  checkWiFiConnection: async (): Promise<WiFiConnectionStatus> => {
    if (Platform.OS !== 'android') {
      return {
        isOnWifi: false,
        hasLocationPermission: false,
        canGetSSID: false,
      };
    }

    try {
      const { WiFiSpeedModule } = NativeModules;

      if (!WiFiSpeedModule) {
        return {
          isOnWifi: false,
          hasLocationPermission: false,
          canGetSSID: false,
        };
      }

      const result = await WiFiSpeedModule.checkWiFiConnection();
      return {
        isOnWifi: result.isOnWifi || false,
        hasLocationPermission: result.hasLocationPermission || false,
        canGetSSID: result.canGetSSID || false,
      };
    } catch (error) {
      console.error('[WiFiSpeedModule] Error checking WiFi connection:', error);
      return {
        isOnWifi: false,
        hasLocationPermission: false,
        canGetSSID: false,
      };
    }
  },
};

export default WiFiSpeedModule;