/**
 * WiFi Speed Monitoring Service
 * UPDATED: SIM-based auto-authentication with multi-SIM support
 * Handles device auto-auth, SIM selection, token management, and metrics submission
 * Also stores WiFi config in native preferences for background speed tests
 */

import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { wifiApi } from '../api/index';
import { STORAGE_KEYS, WIFI_CONFIG, API_CONFIG } from '../config/index';
import SIMDetection from '../native/SIMModule';
import BackgroundSync from '../native/BackgroundSyncModule';
import {
  SpeedTestResult,
  AutoAuthResponse,
  SelectedSIMData,
  WiFiConfigItem,
  SubmitResult,
  CurrentWiFiInfo,
  SIMInfoForAuth,
} from '../models/index';

// Storage keys (from config)
const WIFI_DEVICE_ID_KEY = STORAGE_KEYS.WIFI_DEVICE_ID;
const WIFI_STATUS_KEY = STORAGE_KEYS.WIFI_STATUS;
const WIFI_LAST_TEST_KEY = STORAGE_KEYS.WIFI_LAST_TEST;
// NEW: SIM-based auth keys
const WIFI_SELECTED_SIM_KEY = STORAGE_KEYS.WIFI_SELECTED_SIM;
const WIFI_DEVICE_TOKEN_KEY = STORAGE_KEYS.WIFI_DEVICE_TOKEN;
const WIFI_TOKEN_EXPIRES_KEY = STORAGE_KEYS.WIFI_TOKEN_EXPIRES;
const WIFI_CONFIG_DATA_KEY = STORAGE_KEYS.WIFI_CONFIG;
const WIFI_SIM_ID_KEY = STORAGE_KEYS.WIFI_SIM_ID;
const WIFI_SELECTED_AT_KEY = STORAGE_KEYS.WIFI_SELECTED_AT;

// Token refresh threshold (7 days before expiry)
const TOKEN_REFRESH_THRESHOLD_DAYS = 7;

// Interval types
type IntervalId = number | null;

/**
 * WiFi Speed Monitoring Service
 * Supports multi-SIM devices with automatic SIM selection
 */
export const WiFiService = {
  // Track monitoring state
  monitoringInterval: null as IntervalId,
  statusPollingInterval: null as IntervalId,
  isMonitoring: false,

  /**
   * Check WiFi and network status
   * Returns detailed info about WiFi connection
   * FIXED: Better logging and error handling
   */
  async checkWiFiAndNetworkStatus(): Promise<{
    isOnWifi: boolean;
    hasValidSSID: boolean;
    ssid: string | null;
    canReachInternet: boolean;
  }> {
    console.log('[WiFiService] Checking WiFi and network status...');

    // Get WiFi info
    const wifiInfo = await this.getCurrentWiFiInfo();
    console.log('[WiFiService] WiFi info:', {
      isConnected: wifiInfo.isConnected,
      hasValidSSID: wifiInfo.hasValidSSID,
      ssid: wifiInfo.ssid,
    });

    // Test internet connectivity
    let canReachInternet = false;
    try {
      // Simple ping test with shorter timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://www.google.com', {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      canReachInternet = response.ok;
      console.log('[WiFiService] Internet test result:', canReachInternet);
    } catch (error: any) {
      console.log('[WiFiService] Internet test failed:', error.message);
    }

    const result = {
      isOnWifi: wifiInfo.isConnected,
      hasValidSSID: wifiInfo.hasValidSSID,
      ssid: wifiInfo.ssid,
      canReachInternet,
    };

    console.log('[WiFiService] WiFi status result:', result);
    return result;
  },

  // ============================================
  // DEVICE ID MANAGEMENT (UNCHANGED)
  // ============================================

  /**
   * Generate a unique device ID
   */
  generateDeviceId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `wifi_device_${timestamp}_${randomPart}`;
  },

  /**
   * Get existing device ID or create a new one
   */
  async getOrCreateDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem(WIFI_DEVICE_ID_KEY);

      if (!deviceId) {
        deviceId = this.generateDeviceId();
        await AsyncStorage.setItem(WIFI_DEVICE_ID_KEY, deviceId);
        console.log('[WiFiService] Generated new device ID:', deviceId);
      } else {
        console.log('[WiFiService] Using existing device ID:', deviceId);
      }

      return deviceId;
    } catch (error) {
      console.error('[WiFiService] Error getting device ID:', error);
      throw error;
    }
  },

  /**
   * Get device name (model)
   */
  getDeviceName(): string {
    if (Platform.OS === 'android') {
      return `${NativeModules.DeviceInfo?.brand || 'Android'} ${NativeModules.DeviceInfo?.model || 'Device'}`;
    }
    return 'iOS Device';
  },

  // ============================================
  // NEW: SIM NUMBER EXTRACTION (MULTI-SIM SUPPORT)
  // ============================================

  /**
   * Get ALL SIM numbers from device
   * Returns array of SIM info with phone numbers
   */
  async getAllSimNumbers(): Promise<SIMInfoForAuth[]> {
    console.log('[WiFiService] Getting all SIM numbers from device...');

    if (Platform.OS !== 'android') {
      console.warn('[WiFiService] SIM detection only supported on Android');
      return [];
    }

    try {
      const deviceSIMs = await SIMDetection.getDeviceSIMs();
      console.log('[WiFiService] Device SIMs:', JSON.stringify(deviceSIMs, null, 2));

      // Filter and format SIMs with phone numbers
      const simsWithNumbers: SIMInfoForAuth[] = deviceSIMs
        .filter(sim => sim.phoneNumber && sim.phoneNumber.trim() !== '')
        .map(sim => ({
          phoneNumber: this.normalizePhoneNumber(sim.phoneNumber),
          slotIndex: sim.slotIndex,
          carrierName: sim.carrierName,
        }));

      console.log('[WiFiService] SIMs with phone numbers:', simsWithNumbers.length);
      return simsWithNumbers;
    } catch (error) {
      console.error('[WiFiService] Error getting SIM numbers:', error);
      return [];
    }
  },

  /**
   * Normalize phone number (ensure consistent format)
   */
  normalizePhoneNumber(phoneNumber: string | null): string {
    if (!phoneNumber) return '';

    // Remove all non-numeric characters
    let cleaned = phoneNumber.replace(/[^0-9]/g, '');

    // If starts with 91 and length is 12, remove 91
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = cleaned.substring(2);
    } else if (cleaned.startsWith('+91')) {
      cleaned = cleaned.substring(3);
    } else if (cleaned.length > 10) {
      // Take last 10 digits
      cleaned = cleaned.slice(-10);
    }

    // Ensure it has +91 prefix for API
    if (!cleaned.startsWith('+')) {
      cleaned = `+91${cleaned}`;
    }

    return cleaned;
  },

  // ============================================
  // NEW: SIM SELECTION LOGIC (CRITICAL)
  // ============================================

  /**
   * Auto-select SIM by trying each one for authentication
   * Returns the first SIM that successfully authenticates
   * @param deviceId - Device ID for authentication
   * @param preferredSimNumber - Optional SIM number to try first (useful for reinitialization)
   */
  async autoSelectSim(deviceId: string, preferredSimNumber?: string): Promise<{
    success: boolean;
    selectedSim?: SelectedSIMData;
    error?: string;
  }> {
    console.log('[WiFiService] Starting SIM auto-selection...');
    console.log('[WiFiService] Device ID:', deviceId);
    if (preferredSimNumber) {
      console.log('[WiFiService] Preferred SIM (will try first):', preferredSimNumber);
    }

    // Get all SIM numbers from device
    const allSIMs = await this.getAllSimNumbers();

    if (allSIMs.length === 0) {
      console.error('[WiFiService] No SIM cards with phone numbers found');
      return {
        success: false,
        error: 'No SIM cards found on device. Please ensure SIM is inserted and permissions are granted.',
      };
    }

    console.log(`[WiFiService] Found ${allSIMs.length} SIM(s), attempting auto-auth for each...`);

    // Reorder SIMs: if preferredSimNumber exists, try it first
    let orderedSIMs = [...allSIMs];
    if (preferredSimNumber) {
      // Normalize the preferred number for comparison
      const normalizedPreferred = this.normalizePhoneNumber(preferredSimNumber);

      // Split into preferred (matching) and others
      const preferredSIMs = orderedSIMs.filter(sim =>
        this.normalizePhoneNumber(sim.phoneNumber) === normalizedPreferred
      );
      const otherSIMs = orderedSIMs.filter(sim =>
        this.normalizePhoneNumber(sim.phoneNumber) !== normalizedPreferred
      );

      // Preferred SIMs first, then others
      orderedSIMs = [...preferredSIMs, ...otherSIMs];

      if (preferredSIMs.length > 0) {
        console.log(`[WiFiService] Reordered SIMs: trying preferred SIM (${preferredSIMs[0].phoneNumber}) first`);
      } else {
        console.log(`[WiFiService] Preferred SIM ${preferredSimNumber} not found in device SIMs, trying all available`);
      }
    }

    // Try each SIM until one succeeds
    for (const sim of orderedSIMs) {
      console.log(`[WiFiService] Trying SIM at slot ${sim.slotIndex}: ${sim.phoneNumber}`);

      try {
        // Add more detailed logging
        console.log('[WiFiService] Calling wifiApi.autoAuth with:', {
          simNumber: sim.phoneNumber,
          deviceId: deviceId,
          baseUrl: API_CONFIG.BASE_URL
        });

        const response = await wifiApi.autoAuth(sim.phoneNumber, deviceId);
        console.log('[WiFiService] autoAuth response:', JSON.stringify(response));

        if (response.success && response.data?.allowed) {
          console.log(`[WiFiService] ✓ SIM ${sim.phoneNumber} AUTHENTICATED SUCCESSFULLY`);

          // Create selected SIM data
          const selectedSimData: SelectedSIMData = {
            simNumber: sim.phoneNumber,
            simId: response.data.simId,
            deviceToken: response.data.deviceToken,
            tokenExpires: response.data.tokenExpires,
            wifiConfig: response.data.wifiConfig || [],
            selectedAt: new Date().toISOString(),
          };

          // Store the selected SIM data
          await this.storeSelectedSimData(selectedSimData);

          return {
            success: true,
            selectedSim: selectedSimData,
          };
        } else {
          console.log(`[WiFiService] ✗ SIM ${sim.phoneNumber} not allowed: ${response.message}`);
        }
      } catch (error: any) {
        console.error(`[WiFiService] ✗ SIM ${sim.phoneNumber} auth failed:`, {
          message: error.message,
          code: error.code,
          response: error.response?.data,
          stack: error.stack?.split('\n').slice(0, 3).join('\n')
        });
        // Continue to next SIM
      }
    }

    // No SIM worked
    console.error('[WiFiService] No authorized SIM found');
    return {
      success: false,
      error: 'No authorized SIM found. Please contact administrator.',
    };
  },

  /**
   * Store selected SIM data after successful authentication
   * Also stores WiFi config in native preferences for background speed tests
   */
  async storeSelectedSimData(data: SelectedSIMData): Promise<void> {
    try {
      // Store in AsyncStorage (for JS layer)
      await AsyncStorage.multiSet([
        [WIFI_SELECTED_SIM_KEY, data.simNumber],
        [WIFI_SIM_ID_KEY, data.simId],
        [WIFI_DEVICE_TOKEN_KEY, data.deviceToken],
        [WIFI_TOKEN_EXPIRES_KEY, data.tokenExpires],
        [WIFI_CONFIG_DATA_KEY, JSON.stringify(data.wifiConfig)],
        [WIFI_SELECTED_AT_KEY, data.selectedAt],
      ]);
      console.log('[WiFiService] Selected SIM data stored in AsyncStorage');

      // Also store in native preferences for background service (Android only)
      if (Platform.OS === 'android') {
        try {
          // Get device ID for WiFi metrics submission
          const deviceId = await this.getOrCreateDeviceId();

          await BackgroundSync.setWiFiConfig(
            data.simNumber,
            deviceId,  // Pass deviceId for background WiFi metrics
            data.deviceToken,
            data.tokenExpires,
            JSON.stringify(data.wifiConfig)
          );
          console.log('[WiFiService] WiFi config stored in native preferences for background service');
        } catch (nativeError) {
          console.warn('[WiFiService] Failed to store WiFi config in native prefs:', nativeError);
          // Don't throw - AsyncStorage storage succeeded
        }
      }
    } catch (error) {
      console.error('[WiFiService] Error storing selected SIM data:', error);
      throw error;
    }
  },

  /**
   * Get stored selected SIM data
   */
  async getSelectedSimData(): Promise<SelectedSIMData | null> {
    try {
      const [
        simNumber,
        simId,
        deviceToken,
        tokenExpires,
        wifiConfigStr,
        selectedAt,
      ] = await Promise.all([
        AsyncStorage.getItem(WIFI_SELECTED_SIM_KEY),
        AsyncStorage.getItem(WIFI_SIM_ID_KEY),
        AsyncStorage.getItem(WIFI_DEVICE_TOKEN_KEY),
        AsyncStorage.getItem(WIFI_TOKEN_EXPIRES_KEY),
        AsyncStorage.getItem(WIFI_CONFIG_DATA_KEY),
        AsyncStorage.getItem(WIFI_SELECTED_AT_KEY),
      ]);

      if (!simNumber || !deviceToken) {
        return null;
      }

      let wifiConfig: WiFiConfigItem[] = [];
      if (wifiConfigStr) {
        try {
          wifiConfig = JSON.parse(wifiConfigStr);
        } catch (e) {
          console.warn('[WiFiService] Error parsing WiFi config:', e);
        }
      }

      return {
        simNumber,
        simId: simId || '',
        deviceToken,
        tokenExpires: tokenExpires || '',
        wifiConfig,
        selectedAt: selectedAt || new Date().toISOString(),
      };
    } catch (error) {
      console.error('[WiFiService] Error getting selected SIM data:', error);
      return null;
    }
  },

  /**
   * Check if SIM is already selected and locked
   */
  async hasSelectedSim(): Promise<boolean> {
    const simNumber = await AsyncStorage.getItem(WIFI_SELECTED_SIM_KEY);
    return simNumber !== null;
  },

  // ============================================
  // NEW: TOKEN MANAGEMENT
  // ============================================

  /**
   * Check if token is expiring soon (< 7 days)
   */
  checkTokenExpiry(tokenExpires: string): {
    isExpiring: boolean;
    daysUntilExpiry: number;
  } {
    const expiresAt = new Date(tokenExpires).getTime();
    const now = Date.now();
    const daysUntilExpiry = (expiresAt - now) / (1000 * 60 * 60 * 24);

    return {
      isExpiring: daysUntilExpiry < TOKEN_REFRESH_THRESHOLD_DAYS,
      daysUntilExpiry,
    };
  },

  /**
   * Refresh device token
   * FIXED: Now passes deviceToken to the API
   */
  async refreshToken(): Promise<{
    success: boolean;
    newToken?: string;
    newExpires?: string;
    error?: string;
  }> {
    console.log('[WiFiService] Refreshing device token...');

    try {
      const selectedSim = await this.getSelectedSimData();
      if (!selectedSim) {
        return { success: false, error: 'No SIM selected' };
      }

      const deviceId = await this.getOrCreateDeviceId();
      const response = await wifiApi.refreshToken(
        selectedSim.simNumber,
        deviceId,
        selectedSim.deviceToken  // FIXED: Pass the current device token
      );

      if (response.success && response.data) {
        // Update stored token
        await AsyncStorage.multiSet([
          [WIFI_DEVICE_TOKEN_KEY, response.data.deviceToken],
          [WIFI_TOKEN_EXPIRES_KEY, response.data.tokenExpires],
        ]);

        console.log('[WiFiService] Token refreshed successfully');
        return {
          success: true,
          newToken: response.data.deviceToken,
          newExpires: response.data.tokenExpires,
        };
      }

      return { success: false, error: response.message };
    } catch (error: any) {
      console.error('[WiFiService] Token refresh error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Validate device token (optional, on app resume)
   */
  async validateDevice(): Promise<{
    valid: boolean;
    error?: string;
  }> {
    console.log('[WiFiService] Validating device token...');

    try {
      const selectedSim = await this.getSelectedSimData();
      if (!selectedSim) {
        return { valid: false, error: 'No SIM selected' };
      }

      const deviceId = await this.getOrCreateDeviceId();
      const response = await wifiApi.validateDevice(
        selectedSim.simNumber,
        deviceId,
        selectedSim.deviceToken
      );

      return {
        valid: response.success && response.data?.valid === true,
      };
    } catch (error: any) {
      console.error('[WiFiService] Validation error:', error);
      return { valid: false, error: error.message };
    }
  },

  // ============================================
  // NEW: WIFI CONFIG HANDLING
  // ============================================

  /**
   * Get current WiFi connection info
   * Uses native module or system APIs
   */
  async getCurrentWiFiInfo(): Promise<CurrentWiFiInfo> {
    console.log('[WiFiService] Getting current WiFi info...');

    try {
      if (Platform.OS === 'android') {
        const { WiFiSpeedModule } = NativeModules;

        // Try to get WiFi info from native module
        if (WiFiSpeedModule && WiFiSpeedModule.getCurrentWiFiInfo) {
          const info = await WiFiSpeedModule.getCurrentWiFiInfo();
          console.log('[WiFiService] Native WiFi info result:', {
            ssid: info.ssid,
            bssid: info.bssid,
            isConnected: info.isConnected,
            hasValidSSID: info.hasValidSSID,
          });

          // Validate SSID is not in BSSID format (MAC address)
          const ssid = info.ssid;
          const bssid = info.bssid;
          const isSsidLikeBssid = ssid && /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(ssid);

          if (isSsidLikeBssid) {
            console.warn('[WiFiService] WARNING: SSID looks like BSSID (MAC address format):', ssid);
            console.warn('[WiFiService] This may indicate location permission is not granted on Android 10+');
          }

          return {
            ssid: ssid || null,
            bssid: bssid || null,
            isConnected: info.isConnected || false,
            hasValidSSID: info.hasValidSSID || false,
          };
        }
      }

      // Fallback - return null (will be handled by caller)
      return {
        ssid: null,
        bssid: null,
        isConnected: false,
        hasValidSSID: false,
      };
    } catch (error) {
      console.error('[WiFiService] Error getting WiFi info:', error);
      return {
        ssid: null,
        bssid: null,
        isConnected: false,
        hasValidSSID: false,
      };
    }
  },

  /**
   * Get WiFi info with fallback from stored config
   * NOTE: This method is for DISPLAY purposes only. For metrics submission,
   * use validateCurrentWiFi() instead which ensures the connected WiFi
   * matches the registered network.
   * If SSID is not available from device, use the first config from stored wifiConfig
   */
  async getWiFiInfoWithFallback(): Promise<{
    ssid: string;
    bssid: string;
    isFromFallback: boolean;
  }> {
    console.log('[WiFiService] Getting WiFi info with fallback...');

    // Get current WiFi info from device
    const wifiInfo = await this.getCurrentWiFiInfo();

    // If we have valid SSID, use it
    if (wifiInfo.hasValidSSID && wifiInfo.ssid) {
      console.log('[WiFiService] Using device SSID:', wifiInfo.ssid);
      return {
        ssid: wifiInfo.ssid,
        bssid: wifiInfo.bssid || '',
        isFromFallback: false,
      };
    }

    // Otherwise, use stored WiFi config as fallback
    const selectedSim = await this.getSelectedSimData();

    if (selectedSim && selectedSim.wifiConfig && selectedSim.wifiConfig.length > 0) {
      const fallbackConfig = selectedSim.wifiConfig[0];
      console.log('[WiFiService] Using fallback SSID from config:', fallbackConfig.ssid);
      return {
        ssid: fallbackConfig.ssid,
        bssid: fallbackConfig.bssid || '',
        isFromFallback: true,
      };
    }

    // No fallback available
    console.log('[WiFiService] No SSID available (device or fallback)');
    return {
      ssid: '',
      bssid: '',
      isFromFallback: true,
    };
  },

  /**
   * Match current WiFi with config from backend
   * IMPROVED: More flexible matching for dual-band routers
   */
  matchWiFiWithConfig(
    currentSSID: string | null,
    currentBSSID: string | null,
    wifiConfig: WiFiConfigItem[]
  ): WiFiConfigItem | null {
    if (!currentSSID) return null;

    // First try exact match
    for (const config of wifiConfig) {
      if (config.ssid === currentSSID) {
        // If BSSID is available, verify it too
        if (currentBSSID && config.bssid) {
          if (config.bssid.toLowerCase() === currentBSSID.toLowerCase()) {
            return config;
          }
        } else {
          // Match by SSID only
          return config;
        }
      }
    }

    // Try matching by wifiName if ssid doesn't match
    for (const config of wifiConfig) {
      if (config.wifiName === currentSSID) {
        return config;
      }
    }

    // IMPROVED: Try fuzzy matching for dual-band routers (e.g., "Network_2G" vs "Network_5G")
    // Remove common suffixes like _2G, _5G, _2.4G, _5G, -2G, -5G
    const normalizeSSID = (ssid: string) => {
      return ssid
        .replace(/[-_]?2\.?4[-_]?G$/i, '')
        .replace(/[-_]?5[-_]?G$/i, '')
        .replace(/[-_]?24[-_]?G$/i, '')
        .replace(/[-_]?50[-_]?G$/i, '')
        .toLowerCase();
    };

    const normalizedCurrentSSID = normalizeSSID(currentSSID);

    for (const config of wifiConfig) {
      const normalizedConfigSSID = normalizeSSID(config.ssid || '');
      if (normalizedConfigSSID && normalizedCurrentSSID === normalizedConfigSSID) {
        console.log('[WiFiService] Matched WiFi using fuzzy matching:', {
          current: currentSSID,
          config: config.ssid,
        });
        return config;
      }
    }

    return null;
  },

  /**
   * Validate current WiFi against registered config
   * Returns matched config if valid, error otherwise
   *
   * NOTE: On Android 10+, location permission is required to detect SSID.
   * If permission is not granted but device is connected to WiFi,
   * we attempt to match by checking if we're connected to any network
   * and use the registered config's SSID if the device reports WiFi connection.
   *
   * IMPROVED: More descriptive error messages for troubleshooting
   */
  async validateCurrentWiFi(): Promise<{
    isValid: boolean;
    matchedConfig: WiFiConfigItem | null;
    currentSSID: string | null;
    currentBSSID: string | null;
    error?: string;
  }> {
    console.log('[WiFiService] Validating current WiFi...');

    // Get selected SIM data with wifiConfig
    const selectedSim = await this.getSelectedSimData();

    if (!selectedSim || !selectedSim.wifiConfig || selectedSim.wifiConfig.length === 0) {
      return {
        isValid: false,
        matchedConfig: null,
        currentSSID: null,
        currentBSSID: null,
        error: 'No WiFi configuration found. Please re-authenticate.',
      };
    }

    // Get current WiFi info from device
    const currentWiFi = await this.getCurrentWiFiInfo();

    if (!currentWiFi.isConnected) {
      return {
        isValid: false,
        matchedConfig: null,
        currentSSID: null,
        currentBSSID: null,
        error: 'Not connected to WiFi. Please connect to a WiFi network.',
      };
    }

    // If SSID is available, validate against config
    if (currentWiFi.hasValidSSID && currentWiFi.ssid) {
      // Validate SSID is not in BSSID format (MAC address)
      const isSsidLikeBssid = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(currentWiFi.ssid);
      if (isSsidLikeBssid) {
        console.warn('[WiFiService] WARNING: Detected SSID in BSSID format:', currentWiFi.ssid);
        console.warn('[WiFiService] This usually means location permission is not granted');
        // Fall through to fallback case below
      } else {
        // Match current WiFi with registered config
        const matchedConfig = this.matchWiFiWithConfig(
          currentWiFi.ssid,
          currentWiFi.bssid,
          selectedSim.wifiConfig
        );

        if (!matchedConfig) {
          // Build list of allowed SSIDs for error message
          const allowedSSIDs = selectedSim.wifiConfig.map(c => c.ssid || c.wifiName).join(', ');

          console.warn('[WiFiService] WiFi validation failed');
          console.warn('[WiFiService] Current SSID:', currentWiFi.ssid);
          console.warn('[WiFiService] Allowed SSIDs:', allowedSSIDs);
          console.warn('[WiFiService] Please update WiFi network configuration or connect to the correct network');

          return {
            isValid: false,
            matchedConfig: null,
            currentSSID: currentWiFi.ssid,
            currentBSSID: currentWiFi.bssid,
            error: `WiFi network "${currentWiFi.ssid}" not recognized. Allowed: ${allowedSSIDs}. Please connect to the correct WiFi or update configuration.`,
          };
        }

        console.log('[WiFiService] WiFi validated successfully:', matchedConfig.ssid);

        return {
          isValid: true,
          matchedConfig,
          currentSSID: currentWiFi.ssid,
          currentBSSID: currentWiFi.bssid,
        };
      }
    }

    // SSID not available (likely location permission issue on Android 10+)
    // Log warning and allow submission using the registered config
    console.warn('[WiFiService] Cannot detect SSID - likely location permission not granted');
    console.warn('[WiFiService] Device is connected to WiFi, proceeding with registered config');

    // Use the first registered config (assuming single WiFi network setup)
    const fallbackConfig = selectedSim.wifiConfig[0];

    // Validate the config SSID is not in BSSID format
    const configSsid = fallbackConfig.ssid || fallbackConfig.wifiName;
    const isConfigSsidLikeBssid = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(configSsid);
    if (isConfigSsidLikeBssid) {
      console.error('[WiFiService] ERROR: Config SSID is in BSSID format:', configSsid);
      console.error('[WiFiService] Please update WiFi network in admin panel with correct SSID (not MAC address)');
    }

    console.log('[WiFiService] Using registered WiFi config:', {
      ssid: configSsid,
      bssid: fallbackConfig.bssid,
      wifiName: fallbackConfig.wifiName,
    });

    return {
      isValid: true,
      matchedConfig: fallbackConfig,
      currentSSID: configSsid,
      currentBSSID: fallbackConfig.bssid || null,
      // Include warning that we couldn't verify the actual network
      error: undefined,
    };
  },

  // ============================================
  // UPDATED: INITIALIZATION FLOW
  // ============================================

  /**
   * Initialize WiFi monitoring for a company
   * NEW: Uses SIM-based auto-authentication
   * @param companyId - Company ID (kept for backward compatibility, not used in new flow)
   * @param preferredSimNumber - Optional SIM number to try first during authentication
   */
  async initialize(companyId: string, preferredSimNumber?: string): Promise<{
    success: boolean;
    isActive: boolean;
    message: string;
  }> {
    console.log('[WiFiService] Initializing WiFi monitoring...');
    console.log('[WiFiService] Company ID (received but not used in new flow):', companyId);
    if (preferredSimNumber) {
      console.log('[WiFiService] Preferred SIM for auth:', preferredSimNumber);
    }

    try {
      // 1. Get or create device ID
      const deviceId = await this.getOrCreateDeviceId();
      console.log('[WiFiService] Device ID:', deviceId);

      // 2. Check if SIM already selected
      const hasSim = await this.hasSelectedSim();

      if (hasSim) {
        console.log('[WiFiService] SIM already selected, validating...');

        // Get stored SIM data
        const selectedSim = await this.getSelectedSimData();

        if (selectedSim) {
          // Check token expiry and refresh if needed
          const { isExpiring } = this.checkTokenExpiry(selectedSim.tokenExpires);

          if (isExpiring) {
            console.log('[WiFiService] Token expiring soon, refreshing...');
            await this.refreshToken();
          }

          // Validate device
          const validation = await this.validateDevice();

          if (validation.valid) {
            console.log('[WiFiService] Device validated successfully');
            return {
              success: true,
              isActive: true,
              message: 'Device active, ready to monitor',
            };
          } else {
            // Validation failed, try re-authenticating with the same SIM
            console.log('[WiFiService] Validation failed, re-authenticating...');
            // Save the current SIM number before clearing
            const savedSimNumber = selectedSim.simNumber;
            // Clear old data and re-auth with preferred SIM
            await this.clearSelectedSimData();
            // Use the saved SIM as preferred for re-auth
            const selectionResult = await this.autoSelectSim(deviceId, savedSimNumber);

            if (selectionResult.success && selectionResult.selectedSim) {
              console.log('[WiFiService] Re-authenticated with SIM:', selectionResult.selectedSim.simNumber);
              return {
                success: true,
                isActive: true,
                message: 'Device re-authenticated successfully',
              };
            }

            // If re-auth with saved SIM failed, try other SIMs
            console.log('[WiFiService] Saved SIM auth failed, trying all SIMs...');
          }
        }
      }

      // 3. Auto-select SIM (multi-SIM support)
      // Pass preferredSimNumber if provided (from reinitialize)
      const selectionResult = await this.autoSelectSim(deviceId, preferredSimNumber);

      if (selectionResult.success && selectionResult.selectedSim) {
        console.log('[WiFiService] SIM selected:', selectionResult.selectedSim.simNumber);
        return {
          success: true,
          isActive: true,
          message: 'Device authenticated successfully',
        };
      }

      // No valid SIM found
      return {
        success: false,
        isActive: false,
        message: selectionResult.error || 'No authorized SIM found',
      };
    } catch (error: any) {
      console.error('[WiFiService] Initialization error:', error);
      return {
        success: false,
        isActive: false,
        message: error.message || 'Initialization failed',
      };
    }
  },

  // ============================================
  // SPEED TEST (UNCHANGED)
  // ============================================

  /**
   * Perform a speed test (JavaScript implementation as fallback)
   * This measures download speed by timing a network request
   * FIXED: Now properly handles case when not on WiFi
   * FIXED: Removed fake simulation - now shows real speeds or proper error messages
   */
  async performSpeedTest(): Promise<SpeedTestResult> {
    console.log('[WiFiService] Starting speed test...');

    try {
      // First check WiFi status for debugging
      const wifiStatus = await this.checkWiFiAndNetworkStatus();
      console.log('[WiFiService] WiFi status before speed test:', wifiStatus);

      if (!wifiStatus.isOnWifi) {
        console.warn('[WiFiService] ⚠️ NOT ON WIFI - Speed test cannot be performed');
        throw new Error('Not connected to WiFi. Please connect to a WiFi network to run speed test.');
      }

      // Check if internet is reachable
      if (!wifiStatus.canReachInternet) {
        console.warn('[WiFiService] ⚠️ NO INTERNET - WiFi connected but no internet access');
        throw new Error('WiFi connected but no internet access. Please check your router or try again.');
      }

      // Try to use native module first (if available)
      if (Platform.OS === 'android') {
        try {
          const { WiFiSpeedModule } = NativeModules;
          if (WiFiSpeedModule && WiFiSpeedModule.runSpeedTest) {
            console.log('[WiFiService] Using native speed test module');
            const result = await WiFiSpeedModule.runSpeedTest();
            console.log('[WiFiService] Native speed test result:', result);

            // If result is all zeros, it means speed test failed
            if (result.download === 0 && result.upload === 0 && result.latency === 0) {
              console.warn('[WiFiService] Speed test returned zeros - speed test failed');
              throw new Error('Speed test returned invalid results. Your internet connection may be unstable.');
            }

            const speedResult: SpeedTestResult = {
              download: result.download || 0,
              upload: result.upload || 0,
              latency: result.latency || 0,
              timestamp: Date.now(),
            };

            // Store last test result
            await AsyncStorage.setItem(WIFI_LAST_TEST_KEY, JSON.stringify(speedResult));

            return speedResult;
          }
        } catch (nativeError: any) {
          // If it's our custom error, re-throw it
          if (nativeError.message?.includes('WiFi') ||
              nativeError.message?.includes('internet') ||
              nativeError.message?.includes('Speed test')) {
            throw nativeError;
          }
          console.warn('[WiFiService] Native speed test failed, using JS fallback:', nativeError);
        }
      }

      // JavaScript fallback - measure download speed
      const result = await this.performJSSpeedTest();

      // Store last test result
      await AsyncStorage.setItem(WIFI_LAST_TEST_KEY, JSON.stringify(result));

      return result;
    } catch (error: any) {
      console.error('[WiFiService] Speed test error:', error);
      throw error;  // Re-throw to let caller handle the error
    }
  },

  /**
   * JavaScript-based speed test (fallback)
   * Measures actual download speed from reliable CDN servers
   * Throws error if speed test cannot be performed
   */
  async performJSSpeedTest(): Promise<SpeedTestResult> {
    console.log('[WiFiService] Running JavaScript speed test...');

    // Reliable CDN endpoints for speed testing
    const testUrls = [
      'https://speed.cloudflare.com/__down?bytes=5000000', // 5MB from Cloudflare
      'https://speed.cloudflare.com/__down?bytes=1000000', // 1MB from Cloudflare
    ];

    for (const testUrl of testUrls) {
      try {
        console.log(`[WiFiService] Trying test URL: ${testUrl}`);

        const downloadStart = Date.now();
        const response = await fetch(testUrl, {
          method: 'GET',
          cache: 'no-cache',
        });

        if (!response.ok) {
          console.warn(`[WiFiService] Server returned ${response.status} for ${testUrl}`);
          continue; // Try next URL
        }

        const data = await response.blob();
        const downloadEnd = Date.now();
        const downloadTime = downloadEnd - downloadStart;

        // Calculate download speed in Mbps
        const downloadBits = data.size * 8;
        const downloadSeconds = downloadTime / 1000;
        const downloadSpeed = downloadBits / downloadSeconds / 1000000;

        console.log(`[WiFiService] Download test result:`, {
          url: testUrl,
          bytesDownloaded: data.size,
          timeMs: downloadTime,
          speedMbps: downloadSpeed.toFixed(2),
        });

        // Validate result - need at least 100KB for accurate measurement
        if (data.size >= 100000 && downloadSpeed > 0) {
          // Test latency with a small request
          const latencyStart = Date.now();
          try {
            await fetch('https://www.google.com', { method: 'HEAD', cache: 'no-cache' });
          } catch (e) {
            // Ignore latency test failure
          }
          const latencyEnd = Date.now();
          const latency = latencyEnd - latencyStart;

          return {
            download: Math.round(downloadSpeed * 100) / 100,
            upload: 0, // Upload test requires server support
            latency,
            timestamp: Date.now(),
          };
        } else {
          console.warn(`[WiFiService] Download too small (${data.size} bytes) for accurate measurement`);
        }
      } catch (error: any) {
        console.warn(`[WiFiService] Test failed for ${testUrl}:`, error.message);
        // Continue to next URL
      }
    }

    // All tests failed
    throw new Error('Speed test failed. Please check your WiFi connection and internet access.');
  },

  // ============================================
  // UPDATED: SUBMIT METRICS
  // ============================================

  /**
   * Submit speed test metrics to backend
   * UPDATED: Validates current WiFi against registered config before submitting
   * Only submits if connected to an allowed WiFi network
   */
  async submitMetrics(results: SpeedTestResult): Promise<SubmitResult> {
    console.log('[WiFiService] Submitting metrics with WiFi validation...');

    try {
      // 1. Validate current WiFi first
      const validation = await this.validateCurrentWiFi();

      if (!validation.isValid) {
        console.warn('[WiFiService] WiFi validation failed:', validation.error);
        return {
          success: false,
          message: validation.error || 'WiFi validation failed',
        };
      }

      // 2. Get selected SIM data
      const selectedSim = await this.getSelectedSimData();

      if (!selectedSim) {
        console.warn('[WiFiService] No SIM selected for metrics submission');
        return {
          success: false,
          message: 'Device not authenticated',
        };
      }

      // 3. Check token expiry and refresh if needed
      const { isExpiring } = this.checkTokenExpiry(selectedSim.tokenExpires);

      if (isExpiring) {
        console.log('[WiFiService] Token expiring, refreshing before metrics submission...');
        const refreshResult = await this.refreshToken();

        if (refreshResult.success && refreshResult.newToken) {
          // Update selectedSim with new token
          selectedSim.deviceToken = refreshResult.newToken;
          selectedSim.tokenExpires = refreshResult.newExpires || selectedSim.tokenExpires;
        }
      }

      // 4. Get device ID
      const deviceId = await this.getOrCreateDeviceId();

      // 5. Prepare metrics payload with validated WiFi info
      const metricsPayload = {
        simNumber: selectedSim.simNumber,
        deviceId: deviceId,
        deviceToken: selectedSim.deviceToken,
        ssid: validation.currentSSID!,
        bssid: validation.currentBSSID || validation.matchedConfig!.bssid || 'Unknown',
        downloadSpeed: results.download,
        uploadSpeed: results.upload,
        latency: results.latency,
      };

      console.log('[WiFiService] Submitting metrics payload:', {
        simNumber: metricsPayload.simNumber,
        ssid: metricsPayload.ssid,
        bssid: metricsPayload.bssid,
        download: metricsPayload.downloadSpeed,
        upload: metricsPayload.uploadSpeed,
        latency: metricsPayload.latency,
      });

      // 6. Submit to backend
      console.log('[WiFiService] Full metrics payload:', JSON.stringify(metricsPayload, null, 2));

      const response = await wifiApi.submitMetrics(metricsPayload);

      if (response.success) {
        console.log('[WiFiService] Metrics submitted for WiFi:', validation.currentSSID);
        return {
          success: true,
          message: response.message || 'Metrics submitted',
        };
      } else {
        console.warn('[WiFiService] Metrics submission failed:', response.message);
        return {
          success: false,
          message: response.message || 'Failed to submit metrics',
        };
      }
    } catch (error: any) {
      console.error('[WiFiService] Submit metrics error:', error);

      // Handle specific error codes
      if (error.response?.status === 401) {
        // Token invalid - try refresh
        console.log('[WiFiService] 401 error, attempting token refresh...');
        const refreshResult = await this.refreshToken();

        if (refreshResult.success) {
          // Retry submission
          return this.submitMetrics(results);
        } else {
          return {
            success: false,
            message: 'Authentication expired. Please restart the app.',
          };
        }
      }

      if (error.response?.status === 403) {
        // Forbidden - stop monitoring
        return {
          success: false,
          message: 'Device not authorized. Please contact administrator.',
        };
      }

      return {
        success: false,
        message: 'Failed to submit metrics',
        error: error.message,
      };
    }
  },

  /**
   * Run speed test and submit results
   * FIXED: Better error handling for WiFi connection issues
   * FIXED: Added config validation before submission
   */
  async runSpeedTestAndSubmit(): Promise<{
    success: boolean;
    result?: SpeedTestResult;
    error?: string;
  }> {
    try {
      console.log('[WiFiService] ========== RUN SPEED TEST AND SUBMIT ==========');

      // Check if we have config data
      const simNumber = await AsyncStorage.getItem(WIFI_SELECTED_SIM_KEY);
      const deviceId = await AsyncStorage.getItem(WIFI_DEVICE_ID_KEY);
      const deviceToken = await AsyncStorage.getItem(WIFI_DEVICE_TOKEN_KEY);

      console.log('[WiFiService] Config check:', {
        hasSimNumber: !!simNumber,
        hasDeviceId: !!deviceId,
        hasDeviceToken: !!deviceToken,
      });

      if (!simNumber || !deviceId) {
        console.error('[WiFiService] ✗ Missing required config - cannot submit metrics');
        console.error('[WiFiService] simNumber:', simNumber ? 'present' : 'missing');
        console.error('[WiFiService] deviceId:', deviceId ? 'present' : 'missing');
        return {
          success: false,
          error: 'WiFi monitoring not initialized. Please complete setup first.',
        };
      }

      // First check if on WiFi
      const wifiStatus = await this.checkWiFiAndNetworkStatus();
      console.log('[WiFiService] WiFi status:', {
        isOnWifi: wifiStatus.isOnWifi,
        hasValidSSID: wifiStatus.hasValidSSID,
        ssid: wifiStatus.ssid,
        canReachInternet: wifiStatus.canReachInternet,
      });

      if (!wifiStatus.isOnWifi) {
        console.warn('[WiFiService] ✗ Not on WiFi, skipping speed test');
        return {
          success: false,
          error: 'Not connected to WiFi. Please connect to a WiFi network.',
        };
      }

      console.log('[WiFiService] Running speed test...');
      const result = await this.performSpeedTest();
      console.log('[WiFiService] Speed test result:', {
        download: result.download.toFixed(2) + ' Mbps',
        upload: result.upload.toFixed(2) + ' Mbps',
        latency: result.latency.toFixed(0) + ' ms',
      });

      // Check if speed test returned valid results
      if (result.download === 0 && result.upload === 0 && result.latency === 0) {
        console.warn('[WiFiService] ✗ Speed test returned zeros, not submitting');
        return {
          success: false,
          error: 'Speed test returned invalid results. Please try again.',
        };
      }

      console.log('[WiFiService] Submitting metrics to backend...');
      const submitResult = await this.submitMetrics(result);

      if (submitResult.success) {
        console.log('[WiFiService] ✓ Metrics submitted successfully');
        return { success: true, result };
      } else {
        console.error('[WiFiService] ✗ Failed to submit metrics:', submitResult.message);
        return { success: false, error: submitResult.message };
      }
    } catch (error: any) {
      console.error('[WiFiService] ✗ Speed test and submit error:', error);
      return { success: false, error: error.message || 'Speed test failed' };
    }
  },

  // ============================================
  // BACKGROUND MONITORING (UPDATED FOR NATIVE WORKER)
  // ============================================

  /**
   * Start background monitoring
   * Uses BOTH approaches:
   * 1. Native WorkManager for background (minimum 15-minute intervals - Android limit)
   * 2. JavaScript setInterval for foreground (5-minute intervals - when app is open)
   *
   * This ensures speed tests run at 5-minute intervals when app is in foreground,
   * and at 15-minute intervals when app is in background.
   */
  async startBackgroundMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('[WiFiService] Already monitoring');
      return;
    }

    console.log('[WiFiService] Starting background monitoring...');

    try {
      // Set API Base URL in native SharedPreferences for workers
      await BackgroundSync.setApiBaseUrl(API_CONFIG.BASE_URL);
      console.log('[WiFiService] API URL set for native workers:', API_CONFIG.BASE_URL);

      // Get current config for the worker
      const simNumber = await AsyncStorage.getItem(WIFI_SELECTED_SIM_KEY) || '';
      const deviceId = await AsyncStorage.getItem(WIFI_DEVICE_ID_KEY) || '';
      const deviceToken = await AsyncStorage.getItem(WIFI_DEVICE_TOKEN_KEY) || '';
      const tokenExpires = await AsyncStorage.getItem(WIFI_TOKEN_EXPIRES_KEY) || '';

      if (!simNumber || !deviceId) {
        console.warn('[WiFiService] Missing config for background monitoring');
        console.warn('[WiFiService] simNumber:', simNumber ? 'present' : 'missing');
        console.warn('[WiFiService] deviceId:', deviceId ? 'present' : 'missing');
        // Don't return - still start foreground monitoring
      }

      // Create config JSON for the native worker
      const configJson = JSON.stringify({
        simNumber,
        deviceId,
        deviceToken,
        tokenExpires,
      });

      // Start the native background worker (15-minute minimum on Android)
      // This handles background execution when app is closed
      if (simNumber && deviceId) {
        try {
          await BackgroundSync.startWiFiSpeedBackground(configJson, WIFI_CONFIG.SPEED_TEST_INTERVAL);
          console.log('[WiFiService] Native WorkManager worker started (15-min intervals in background)');
        } catch (bgError) {
          console.warn('[WiFiService] Failed to start native worker:', bgError);
          // Continue with foreground monitoring
        }
      }

      // Also store config in native preferences for worker access
      try {
        await BackgroundSync.setWiFiConfig(simNumber, deviceId, deviceToken || '', tokenExpires || '', '[]');
        console.log('[WiFiService] WiFi config stored in native preferences');
      } catch (configError) {
        console.warn('[WiFiService] Failed to store WiFi config:', configError);
      }

      this.isMonitoring = true;

      // Start foreground JavaScript interval (5-minute intervals when app is open)
      this.startForegroundInterval();

      console.log('[WiFiService] Background monitoring started successfully');
      console.log('[WiFiService] - Foreground: 5-minute intervals via JS setInterval');
      console.log('[WiFiService] - Background: 15-minute intervals via WorkManager');
    } catch (error) {
      console.error('[WiFiService] Failed to start background monitoring:', error);
      // Still try to start foreground monitoring
      this.startForegroundInterval();
    }
  },

  /**
   * Start foreground JavaScript interval
   * Runs speed tests at WIFI_CONFIG.SPEED_TEST_INTERVAL (5 minutes)
   * Only works when app is in foreground
   */
  startForegroundInterval(): void {
    console.log('[WiFiService] Starting foreground interval (5-minute intervals when app is open)');

    // Clear any existing interval first
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Run immediately after a short delay to ensure config is ready
    setTimeout(() => {
      console.log('[WiFiService] Running initial speed test...');
      this.runSpeedTestAndSubmit().catch(err => {
        console.error('[WiFiService] Initial speed test failed:', err);
      });
    }, 1000);

    // Then run at configured interval (5 minutes)
    const intervalMs = WIFI_CONFIG.SPEED_TEST_INTERVAL * 60 * 1000;
    console.log('[WiFiService] Setting up foreground interval:', WIFI_CONFIG.SPEED_TEST_INTERVAL, 'minutes (' + intervalMs + 'ms)');

    this.monitoringInterval = setInterval(() => {
      console.log('[WiFiService] Running scheduled foreground speed test...');
      this.runSpeedTestAndSubmit().catch(err => {
        console.error('[WiFiService] Scheduled foreground speed test failed:', err);
      });
    }, intervalMs);

    console.log('[WiFiService] Foreground interval set, next test in:', intervalMs / 1000, 'seconds');
  },

  /**
   * Fallback monitoring using JavaScript setInterval
   * Only works when app is in foreground
   * @deprecated - Use startForegroundInterval instead
   */
  startFallbackMonitoring(): void {
    console.log('[WiFiService] Starting fallback monitoring (foreground only)');
    this.startForegroundInterval();
  },

  /**
   * Stop background monitoring
   * Stops both foreground JS interval and background WorkManager
   */
  async stopBackgroundMonitoring(): Promise<void> {
    console.log('[WiFiService] Stopping background monitoring');

    this.isMonitoring = false;

    // Stop foreground JavaScript interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[WiFiService] Stopped foreground interval');
    }

    // Stop native WorkManager worker
    try {
      await BackgroundSync.stopWiFiSpeedBackground();
      console.log('[WiFiService] Stopped native WorkManager worker');
    } catch (error) {
      console.warn('[WiFiService] Failed to stop native worker:', error);
    }

    // Disable WiFi speed in native preferences
    try {
      await BackgroundSync.setWiFiSpeedEnabled(false);
      console.log('[WiFiService] Disabled WiFi speed in native preferences');
    } catch (error) {
      console.warn('[WiFiService] Failed to disable WiFi speed:', error);
    }

    console.log('[WiFiService] Background monitoring stopped completely');
  },

  /**
   * Check if background monitoring is running
   */
  async isBackgroundMonitoringRunning(): Promise<boolean> {
    try {
      const isRunning = await BackgroundSync.isWiFiSpeedBackgroundRunning();
      return isRunning || this.isMonitoring;
    } catch {
      return this.isMonitoring;
    }
  },

  /**
   * Start polling for device status (when waiting for approval)
   * @deprecated - No longer needed with SIM-based auth
   */
  startStatusPolling(onApproved: () => void): void {
    console.log('[WiFiService] Status polling not needed in SIM-based auth');
    // In SIM-based auth, if we get here, we're already approved
    // Just call the callback immediately
    onApproved();
  },

  /**
   * Stop status polling
   */
  stopStatusPolling(): void {
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
      this.statusPollingInterval = null;
    }
  },

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get stored device info
   */
  async getDeviceInfo(): Promise<{
    deviceId: string | null;
    wifiId: string | null;
    status: string | null;
  }> {
    try {
      const [deviceId, simId, status] = await Promise.all([
        AsyncStorage.getItem(WIFI_DEVICE_ID_KEY),
        AsyncStorage.getItem(WIFI_SIM_ID_KEY),
        AsyncStorage.getItem(WIFI_STATUS_KEY),
      ]);

      return { deviceId, wifiId: simId, status };
    } catch (error) {
      console.error('[WiFiService] Error getting device info:', error);
      return { deviceId: null, wifiId: null, status: null };
    }
  },

  /**
   * Get last speed test result
   */
  async getLastSpeedTest(): Promise<SpeedTestResult | null> {
    try {
      const data = await AsyncStorage.getItem(WIFI_LAST_TEST_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[WiFiService] Error getting last speed test:', error);
      return null;
    }
  },

  /**
   * Clear selected SIM data
   * Also clears WiFi config from native preferences
   * @returns The cleared SIM number (if any) for use in reinitialization
   */
  async clearSelectedSimData(): Promise<string | null> {
    let clearedSimNumber: string | null = null;

    try {
      // Get the current SIM number before clearing
      try {
        const simNumber = await AsyncStorage.getItem(WIFI_SELECTED_SIM_KEY);
        if (simNumber) {
          clearedSimNumber = simNumber;
          console.log('[WiFiService] Saved SIM number before clearing:', clearedSimNumber);
        }
      } catch (e) {
        console.warn('[WiFiService] Could not get SIM number before clearing:', e);
      }

      await AsyncStorage.multiRemove([
        WIFI_SELECTED_SIM_KEY,
        WIFI_DEVICE_TOKEN_KEY,
        WIFI_TOKEN_EXPIRES_KEY,
        WIFI_CONFIG_DATA_KEY,
        WIFI_SIM_ID_KEY,
        WIFI_SELECTED_AT_KEY,
      ]);
      console.log('[WiFiService] Cleared selected SIM data from AsyncStorage');

      // Also clear from native preferences (Android only)
      if (Platform.OS === 'android') {
        try {
          await BackgroundSync.setWiFiSpeedEnabled(false);
          // Clear WiFi config by passing empty values (5 arguments required)
          await BackgroundSync.setWiFiConfig('', '', '', '', '[]');
          console.log('[WiFiService] Cleared WiFi config from native preferences');
        } catch (nativeError) {
          console.warn('[WiFiService] Failed to clear native WiFi config:', nativeError);
        }
      }
    } catch (error) {
      console.error('[WiFiService] Error clearing SIM data:', error);
    }

    return clearedSimNumber;
  },

  /**
   * Clear all WiFi data (for logout/reset)
   */
  async clearData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        WIFI_DEVICE_ID_KEY,
        WIFI_STATUS_KEY,
        WIFI_LAST_TEST_KEY,
        WIFI_SELECTED_SIM_KEY,
        WIFI_DEVICE_TOKEN_KEY,
        WIFI_TOKEN_EXPIRES_KEY,
        WIFI_CONFIG_DATA_KEY,
        WIFI_SIM_ID_KEY,
        WIFI_SELECTED_AT_KEY,
      ]);
      console.log('[WiFiService] Cleared all WiFi data');
    } catch (error) {
      console.error('[WiFiService] Error clearing data:', error);
    }
  },

  // ============================================
  // LEGACY METHODS (KEPT FOR BACKWARD COMPATIBILITY)
  // ============================================

  /**
   * @deprecated - Use initialize() with SIM-based auth
   * Register device with backend (OLD METHOD)
   */
  async registerDevice(companyId: string): Promise<any> {
    console.log('[WiFiService] [LEGACY] registerDevice called - redirecting to initialize');
    return this.initialize(companyId);
  },

  /**
   * @deprecated - Not needed in SIM-based auth
   * Check device status (OLD METHOD)
   */
  async checkDeviceStatus(): Promise<any> {
    console.log('[WiFiService] [LEGACY] checkDeviceStatus called');

    const selectedSim = await this.getSelectedSimData();

    if (selectedSim) {
      return {
        success: true,
        data: {
          exists: true,
          isActive: true,
          wifiId: selectedSim.simId,
          wifiName: selectedSim.wifiConfig?.[0]?.wifiName || null,
        },
      };
    }

    return {
      success: false,
      data: {
        exists: false,
        isActive: false,
        wifiId: null,
        wifiName: null,
      },
    };
  },
};

export default WiFiService;