/**
 * WiFi Speed Monitoring Models
 * UPDATED: Added SIM-based auto-auth interfaces
 */

/**
 * Device registration request
 * @deprecated - Use SIM-based auto-auth instead
 */
export interface DeviceRegistration {
  deviceId: string;
  deviceName: string;
  companyId: string;
}

/**
 * Device registration response
 * @deprecated - Use AutoAuthResponse instead
 */
export interface RegisterResponse {
  success: boolean;
  message: string;
  data?: {
    deviceId: string;
    registered: boolean;
  };
}

/**
 * Device status response
 * @deprecated - No longer needed with SIM-based auth
 */
export interface DeviceStatusResponse {
  success: boolean;
  data: {
    exists: boolean;
    isActive: boolean;
    wifiId: string | null;
    wifiName: string | null;
  };
}

// ============================================
// NEW SIM-BASED AUTH INTERFACES
// ============================================

/**
 * WiFi configuration from auto-auth response
 */
export interface WiFiConfigItem {
  ssid: string;
  bssid: string;
  wifiName: string;
  expectedSpeed?: number;
}

/**
 * Auto-authentication response
 * POST /api/device/auto-auth
 */
export interface AutoAuthResponse {
  success: boolean;
  message: string;
  data?: {
    allowed: boolean;
    simId: string;
    mobileNumber: string;  // FIXED: Backend returns mobileNumber, not simNumber
    deviceToken: string;
    tokenExpires: string;      // ISO date string
    wifiConfig: WiFiConfigItem[];
  };
}

/**
 * Metrics submission response
 * POST /api/device/metrics
 */
export interface MetricsSubmissionResponse {
  success: boolean;
  message: string;
  data?: {
    recorded: boolean;
    metricId: string;
    timestamp: string;
  };
}

/**
 * WiFi Token refresh response
 * POST /api/device/refresh-token
 * Named differently to avoid conflict with User.TokenRefreshResponse
 */
export interface WiFiTokenRefreshResponse {
  success: boolean;
  message: string;
  data?: {
    deviceToken: string;
    tokenExpires: string;
  };
}

/**
 * Device validation response
 * POST /api/device/validate
 */
export interface DeviceValidationResponse {
  success: boolean;
  message: string;
  data?: {
    valid: boolean;
    simId: string;
    simNumber: string;
  };
}

/**
 * Selected SIM data (stored after auto-auth)
 */
export interface SelectedSIMData {
  simNumber: string;
  simId: string;
  deviceToken: string;
  tokenExpires: string;
  wifiConfig: WiFiConfigItem[];
  selectedAt: string;
}

// ============================================
// EXISTING INTERFACES (UNCHANGED)
// ============================================

/**
 * Speed test result from native module
 */
export interface SpeedTestResult {
  download: number;  // Mbps
  upload: number;    // Mbps
  latency: number;   // ms
  timestamp: number; // Unix timestamp
}

/**
 * Speed metrics to send to backend
 * @deprecated - Use MetricsRequest in wifi.api.ts instead
 */
export interface SpeedMetrics {
  deviceId: string;
  wifiId: string;
  downloadSpeed: number;  // Mbps
  uploadSpeed: number;    // Mbps
  latency: number;        // ms
  timestamp: string;      // ISO string
}

/**
 * Metrics submission response (OLD)
 * @deprecated - Use MetricsSubmissionResponse instead
 */
export interface MetricsResponse {
  success: boolean;
  message: string;
  data?: {
    recorded: boolean;
    metricId: string;
  };
}

/**
 * WiFi device status for UI
 */
export type WiFiStatus = 'idle' | 'waiting' | 'active' | 'error';

/**
 * WiFi context value (UNCHANGED - backward compatible)
 */
export interface WiFiContextValue {
  deviceId: string | null;
  isActive: boolean;
  wifiId: string | null;
  wifiName: string | null;
  isMonitoring: boolean;
  lastSpeedTest: SpeedTestResult | null;
  status: WiFiStatus;
  error: string | null;
  isCurrentWifiRegistered: boolean | null;
  currentWifiSSID: string | null;
  initialize: (companyId: string) => Promise<void>;
  reinitialize: (companyId: string) => Promise<void>;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  runSpeedTest: () => Promise<SpeedTestResult>;
  refreshStatus: () => Promise<void>;
  validateCurrentWifi: () => Promise<{
    isRegistered: boolean;
    ssid: string | null;
    matchedConfig: any | null;
  }>;
}

/**
 * Result of device registration
 * @deprecated
 */
export interface RegisterResult {
  success: boolean;
  deviceId: string;
  message: string;
  error?: string;
}

/**
 * Result of metrics submission
 */
export interface SubmitResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Current WiFi connection info
 */
export interface CurrentWiFiInfo {
  ssid: string | null;
  bssid: string | null;
  isConnected: boolean;
  hasValidSSID: boolean;
}

/**
 * SIM info for auto-auth
 */
export interface SIMInfoForAuth {
  phoneNumber: string;
  slotIndex: number;
  carrierName: string | null;
}