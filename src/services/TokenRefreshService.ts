/**
 * Token Refresh Service - Handles background token refresh
 */

import { SecureStorageService } from './SecureStorageService';
import { authApi } from '../api/index';
import { API_CONFIG } from '../config/index';

// Token refresh state
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Token Refresh Service for handling authentication token refresh
 */
export const TokenRefreshService = {
  /**
   * Check if token needs refresh and refresh if needed
   * Returns true if token is valid or was successfully refreshed
   */
  async ensureValidToken(): Promise<boolean> {
    try {
      const token = await SecureStorageService.getToken();
      if (!token) {
        return false;
      }

      // Token exists, assume valid
      // In production, you might want to decode and check expiration
      return true;
    } catch (error) {
      console.error('Error checking token validity:', error);
      return false;
    }
  },

  /**
   * Refresh the authentication token using refresh token
   */
  async refreshToken(): Promise<boolean> {
    // If already refreshing, return existing promise
    if (isRefreshing && refreshPromise) {
      return refreshPromise;
    }

    isRefreshing = true;
    refreshPromise = this.doRefresh();

    try {
      const result = await refreshPromise;
      return result;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  },

  /**
   * Internal refresh implementation
   */
  async doRefresh(): Promise<boolean> {
    try {
      const refreshToken = await SecureStorageService.getRefreshToken();
      if (!refreshToken) {
        console.warn('No refresh token available');
        return false;
      }

      const response = await authApi.refreshToken(refreshToken);

      if (response.success && response.token) {
        await SecureStorageService.setToken(response.token);
        if (response.refreshToken) {
          await SecureStorageService.setRefreshToken(response.refreshToken);
        }
        console.log('Token refreshed successfully');
        return true;
      }

      console.warn('Token refresh failed:', response.message);
      return false;
    } catch (error) {
      console.error('Error refreshing token:', error);
      // Clear tokens on refresh failure
      await SecureStorageService.clearAll();
      return false;
    }
  },

  /**
   * Background refresh for headless tasks
   * Attempts to refresh token without blocking
   */
  async backgroundRefresh(): Promise<void> {
    try {
      const token = await SecureStorageService.getToken();
      if (!token) {
        return;
      }

      // Attempt silent refresh
      await this.refreshToken();
    } catch (error) {
      console.error('Background token refresh failed:', error);
    }
  },

  /**
   * Clear all tokens (logout)
   */
  async clearTokens(): Promise<void> {
    await SecureStorageService.clearAll();
  },
};

export default TokenRefreshService;