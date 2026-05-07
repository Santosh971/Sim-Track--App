/**
 * WiFi Speed Monitoring API service
 * UPDATED: SIM-based auto-authentication flow
 * Handles device auto-auth, metrics submission, token refresh, and validation
 * FIXED: validateDevice now uses GET, refreshToken includes deviceToken
 */

import apiClient from './client';
import { API_CONFIG } from '../config/index';
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
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
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
    const url = `${API_CONFIG.BASE_URL}/device/auto-auth`;

    try {
      // Try with apiClient first
      const response = await apiClient.post<AutoAuthResponse>('/device/auto-auth', {
        simNumber,
        deviceId,
      });
      return response.data;
    } catch (axiosError: any) {
      console.error('[WiFiAPI] Axios auto-auth error:', axiosError.message, axiosError.code);

      // Fallback to direct fetch
      try {
        const fetchResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ simNumber, deviceId }),
        });


        if (!fetchResponse.ok) {
          const errorData = await fetchResponse.json();
          throw new Error(errorData.message || `HTTP ${fetchResponse.status}`);
        }

        const data = await fetchResponse.json();
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

    try {
      const response = await apiClient.post<WiFiTokenRefreshResponse>('/device/refresh-token', {
        simNumber,
        deviceId,
        deviceToken,
      });
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

    try {
      const response = await apiClient.get<DeviceValidationResponse>('/device/validate', {
        params: {
          simNumber,
          deviceId,
          deviceToken,
        },
      });
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