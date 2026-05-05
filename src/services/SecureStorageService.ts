/**
 * Secure Storage Service - Uses react-native-keychain for secure token storage
 */

import * as Keychain from 'react-native-keychain';

// Keychain service names for different tokens
const TOKEN_SERVICE = 'auth_token';
const REFRESH_TOKEN_SERVICE = 'refresh_token';

/**
 * Secure Storage Service for sensitive data like tokens
 * Uses iOS Keychain / Android Keystore for secure storage
 */
export const SecureStorageService = {
  /**
   * Store the authentication token securely
   */
  async setToken(token: string): Promise<boolean> {
    try {
      await Keychain.setGenericPassword('token', token, {
        service: TOKEN_SERVICE,
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
      });
      return true;
    } catch (error) {
      console.error('Error storing token:', error);
      return false;
    }
  },

  /**
   * Get the authentication token
   */
  async getToken(): Promise<string | null> {
    try {
      const result = await Keychain.getGenericPassword({ service: TOKEN_SERVICE });
      if (result) {
        return result.password;
      }
      return null;
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  },

  /**
   * Remove the authentication token
   */
  async removeToken(): Promise<boolean> {
    try {
      await Keychain.resetGenericPassword({ service: TOKEN_SERVICE });
      return true;
    } catch (error) {
      console.error('Error removing token:', error);
      return false;
    }
  },

  /**
   * Store the refresh token securely
   */
  async setRefreshToken(token: string): Promise<boolean> {
    try {
      await Keychain.setGenericPassword('refresh_token', token, {
        service: REFRESH_TOKEN_SERVICE,
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
      });
      return true;
    } catch (error) {
      console.error('Error storing refresh token:', error);
      return false;
    }
  },

  /**
   * Get the refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      const result = await Keychain.getGenericPassword({ service: REFRESH_TOKEN_SERVICE });
      if (result) {
        return result.password;
      }
      return null;
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  },

  /**
   * Remove the refresh token
   */
  async removeRefreshToken(): Promise<boolean> {
    try {
      await Keychain.resetGenericPassword({ service: REFRESH_TOKEN_SERVICE });
      return true;
    } catch (error) {
      console.error('Error removing refresh token:', error);
      return false;
    }
  },

  /**
   * Clear all secure storage (tokens)
   */
  async clearAll(): Promise<boolean> {
    try {
      await Keychain.resetGenericPassword({ service: TOKEN_SERVICE });
      await Keychain.resetGenericPassword({ service: REFRESH_TOKEN_SERVICE });
      return true;
    } catch (error) {
      console.error('Error clearing secure storage:', error);
      return false;
    }
  },
};

export default SecureStorageService;