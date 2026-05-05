/**
 * WiFi Speed Monitoring API service
 * UPDATED: SIM-based auto-authentication flow
 * Handles device auto-auth, metrics submission, token refresh, and validation
 * FIXED: validateDevice now uses GET, refreshToken includes deviceToken
 */

import apiClient from './client';
import {
  AutoAuthResponse,
  MetricsSubmissionResponse,
  WiFiTokenRefreshResponse,
  DeviceValidationResponse,
} from '../models/index';

/**
 * Request payload for auto-authentication
 */
interface AutoAuthRequest {
  simNumber: string;
  deviceId: string;
}

/**
 * Request payload for metrics submission (NEW FORMAT)
 */
interface MetricsRequest {
  simNumber: string;
  deviceId: string;
  deviceToken: string;
  ssid: string;
  bssid: string;
  downloadSpeed: number;
  uploadSpeed: number;
  latency: number;
}

/**
 * Request payload for token refresh
 */
interface TokenRefreshRequest {
  simNumber: string;
  deviceId: string;
}

/**
 * Request payload for device validation
 */
interface DeviceValidationRequest {
  simNumber: string;
  deviceId: string;
  deviceToken: string;
}

export const wifiApi = {
  /**
   * Test network connectivity
   */
  testConnection: async (): Promise<boolean> => {
    console.log('[WiFiAPI] Testing network connection...');
    try {
      const response = await fetch('https://node.simtrackr.b100x.in/api/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('[WiFiAPI] Network test response:', response.status);
      return response.ok;
    } catch (error: any) {
      console.error('[WiFiAPI] Network test failed:', error.message);
      return false;
    }
  },

  /**
   * AUTO-AUTHENTICATION (NEW)
   * POST /api/device/auto-auth
   * Authenticates device using SIM number
   */
  autoAuth: async (
    simNumber: string,
    deviceId: string
  ): Promise<AutoAuthResponse> => {
    console.log('[WiFiAPI] Auto-authenticating with SIM:', { simNumber, deviceId });
    const url = 'https://node.simtrackr.b100x.in/api/device/auto-auth';

    try {
      // Try with apiClient first
      const response = await apiClient.post<AutoAuthResponse>('/device/auto-auth', {
        simNumber,
        deviceId,
      });
      console.log('[WiFiAPI] Auto-auth response:', response.data);
      return response.data;
    } catch (axiosError: any) {
      console.error('[WiFiAPI] Axios auto-auth error:', axiosError.message, axiosError.code);

      // Fallback to direct fetch
      console.log('[WiFiAPI] Trying direct fetch to:', url);
      try {
        const fetchResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ simNumber, deviceId }),
        });

        console.log('[WiFiAPI] Fetch response status:', fetchResponse.status);

        if (!fetchResponse.ok) {
          const errorData = await fetchResponse.json();
          throw new Error(errorData.message || `HTTP ${fetchResponse.status}`);
        }

        const data = await fetchResponse.json();
        console.log('[WiFiAPI] Fetch auto-auth response:', data);
        return data;
      } catch (fetchError: any) {
        console.error('[WiFiAPI] Fetch auto-auth error:', fetchError.message);
        throw fetchError;
      }
    }
  },

  /**
   * SUBMIT METRICS (UPDATED)
   * POST /api/device/metrics
   * Submits speed test metrics using SIM-based auth
   */
  submitMetrics: async (metrics: MetricsRequest): Promise<MetricsSubmissionResponse> => {
    console.log('[WiFiAPI] Submitting metrics:', {
      simNumber: metrics.simNumber,
      deviceId: metrics.deviceId,
      deviceToken: metrics.deviceToken ? '[PRESENT]' : '[MISSING]',
      ssid: metrics.ssid,
      bssid: metrics.bssid,
      download: metrics.downloadSpeed,
      upload: metrics.uploadSpeed,
      latency: metrics.latency,
    });

    try {
      const response = await apiClient.post<MetricsSubmissionResponse>('/device/metrics', metrics);
      console.log('[WiFiAPI] Metrics response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[WiFiAPI] Metrics error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
      throw error;
    }
  },

  /**
   * REFRESH TOKEN (NEW)
   * POST /api/device/refresh-token
   * Refreshes device token before expiry
   * FIXED: Now includes deviceToken as required by backend
   */
  refreshToken: async (
    simNumber: string,
    deviceId: string,
    deviceToken: string
  ): Promise<WiFiTokenRefreshResponse> => {
    console.log('[WiFiAPI] Refreshing token for SIM:', { simNumber, deviceId });

    try {
      const response = await apiClient.post<WiFiTokenRefreshResponse>('/device/refresh-token', {
        simNumber,
        deviceId,
        deviceToken,
      });
      console.log('[WiFiAPI] Token refresh response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[WiFiAPI] Token refresh error:', error.message, error.response?.data);
      throw error;
    }
  },

  /**
   * VALIDATE DEVICE (NEW)
   * GET /api/device/validate
   * Validates device token (optional, on app resume)
   * FIXED: Changed from POST to GET with query parameters to match backend
   */
  validateDevice: async (
    simNumber: string,
    deviceId: string,
    deviceToken: string
  ): Promise<DeviceValidationResponse> => {
    console.log('[WiFiAPI] Validating device:', { simNumber, deviceId });

    try {
      const response = await apiClient.get<DeviceValidationResponse>('/device/validate', {
        params: {
          simNumber,
          deviceId,
          deviceToken,
        },
      });
      console.log('[WiFiAPI] Validation response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[WiFiAPI] Validation error:', error.message, error.response?.data);
      throw error;
    }
  },

  // ============================================
  // LEGACY METHODS (KEPT FOR BACKWARD COMPATIBILITY)
  // These are no longer used in the new flow
  // ============================================

  /**
   * @deprecated Use autoAuth instead
   * Register device with backend (OLD METHOD)
   * POST /wifi/register
   */
  registerDevice: async (
    deviceId: string,
    deviceName: string,
    companyId: string
  ): Promise<any> => {
    console.log('[WiFiAPI] [LEGACY] Registering device:', { deviceId, deviceName, companyId });

    try {
      const response = await apiClient.post('/wifi/register', {
        deviceId,
        deviceName,
        companyId,
      });
      return response.data;
    } catch (error: any) {
      console.error('[WiFiAPI] [LEGACY] Register error:', error.message);
      throw error;
    }
  },

  /**
   * @deprecated Use autoAuth instead
   * Get device status (OLD METHOD)
   * GET /wifi/status/:deviceId
   */
  getDeviceStatus: async (deviceId: string): Promise<any> => {
    console.log('[WiFiAPI] [LEGACY] Getting device status for:', deviceId);

    try {
      const response = await apiClient.get(`/wifi/status/${deviceId}`);
      return response.data;
    } catch (error: any) {
      console.error('[WiFiAPI] [LEGACY] Status error:', error.message);
      throw error;
    }
  },

  /**
   * Get WiFi network info (optional)
   * GET /wifi/network/:wifiId
   */
  getNetworkInfo: async (wifiId: string): Promise<any> => {
    console.log('[WiFiAPI] Getting network info for:', wifiId);

    try {
      const response = await apiClient.get(`/wifi/network/${wifiId}`);
      return response.data;
    } catch (error: any) {
      console.error('[WiFiAPI] Network info error:', error.message);
      throw error;
    }
  },
};

export default wifiApi;