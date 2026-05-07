/**
 * Axios HTTP client for API requests with token refresh support
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { SecureStorageService } from '../services/SecureStorageService';
import { API_CONFIG } from '../config/index';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.HEADERS,
});

// Token refresh state
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

/**
 * Process failed request queue after token refresh
 */
const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor - add auth token if available
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await SecureStorageService.getToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url} - No token available`);
      }
    } catch (error) {
      console.error('[API] Error getting token:', error);
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle token refresh on 401
apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API] Response from ${response.config.url}:`, response.status);
    console.log(`[API] Response data:`, JSON.stringify(response.data, null, 2));
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Check if error is 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      console.log('[API] Got 401, attempting token refresh...');

      // If refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Get refresh token
        const refreshToken = await SecureStorageService.getRefreshToken();

        if (!refreshToken) {
          // No refresh token, clear everything
          console.log('[API] No refresh token, clearing auth data');
          await SecureStorageService.clearAll();
          processQueue(new Error('No refresh token available'), null);
          return Promise.reject(error);
        }

        // Attempt to refresh token
        const response = await axios.post(
          `${API_CONFIG.BASE_URL}/auth/refresh-token`,
          { refreshToken },
          { headers: API_CONFIG.HEADERS }
        );

        const { token, refreshToken: newRefreshToken } = response.data;

        // Store new tokens
        await SecureStorageService.setToken(token);
        if (newRefreshToken) {
          await SecureStorageService.setRefreshToken(newRefreshToken);
        }

        console.log('[API] Token refreshed successfully');

        // Process queued requests
        processQueue(null, token);

        // Retry original request
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }

        return apiClient(originalRequest);
      } catch (refreshError) {
        console.error('[API] Token refresh failed:', refreshError);
        // Refresh failed, clear tokens
        await SecureStorageService.clearAll();
        processQueue(refreshError as Error, null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Log error details
    console.error('[API] Error:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url,
    });

    return Promise.reject(error);
  }
);

export default apiClient;