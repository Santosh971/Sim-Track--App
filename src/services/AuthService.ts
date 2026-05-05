/**
 * Authentication Service - Handles Email OTP-based authentication
 */

import { authApi } from '../api/index';
import { StorageService } from './StorageService';
import { SecureStorageService } from './SecureStorageService';
import { SIMManager } from './SIMManager';
import { User, OTPCredentials, AuthResponse } from '../models/index';

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  email: string | null;
}

/**
 * Authentication service
 */
export const AuthService = {
  /**
   * Send OTP to email address
   * OTP is sent via email and NOT returned in response
   */
  async sendOTP(email: string): Promise<{ success: boolean; message: string; expiresAt?: string }> {
    try {
      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email address.');
      }

      const response = await authApi.sendOTP(email);

      // Store email for later use
      await StorageService.setEmail(email);

      return {
        success: response.success,
        message: response.message,
        expiresAt: response.expiresAt,
      };
    } catch (error: any) {
      console.error('Send OTP error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        config: {
          url: error.config?.url,
          baseURL: error.config?.baseURL,
        },
      });
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to send OTP',
      };
    }
  },

  /**
   * Verify OTP and authenticate user
   */
  async verifyOTP(otp: string): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      // Get stored email
      const email = await StorageService.getEmail();
      if (!email) {
        throw new Error('Email not found. Please request OTP again.');
      }

      // Validate OTP
      if (!/^\d{6}$/.test(otp)) {
        throw new Error('Invalid OTP. Must be 6 digits.');
      }

      const credentials: OTPCredentials = { email, otp };
      const response = await authApi.verifyOTP(credentials);

      if (response.success && response.token) {
        // Store auth tokens securely in keychain
        await SecureStorageService.setToken(response.token);
        if (response.refreshToken) {
          await SecureStorageService.setRefreshToken(response.refreshToken);
        }
        if (response.user) {
          await StorageService.setUser(response.user);
        }

        return {
          success: true,
          message: response.message,
          user: response.user,
        };
      }

      return {
        success: false,
        message: response.message || 'OTP verification failed',
      };
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'OTP verification failed',
      };
    }
  },

  /**
   * Resend OTP
   */
  async resendOTP(): Promise<{ success: boolean; message: string }> {
    try {
      const email = await StorageService.getEmail();
      if (!email) {
        throw new Error('Email not found. Please start login again.');
      }

      const response = await authApi.resendOTP(email);

      return {
        success: response.success,
        message: response.message,
      };
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to resend OTP',
      };
    }
  },

  /**
   * Validate current session
   */
  async validateSession(): Promise<{ valid: boolean; user?: User }> {
    try {
      const token = await SecureStorageService.getToken();
      if (!token) {
        return { valid: false };
      }

      const response = await authApi.getProfile();
      if (response.success && response.data?.user) {
        await StorageService.setUser(response.data.user);
        return { valid: true, user: response.data.user };
      }

      return { valid: false };
    } catch (error) {
      console.error('Session validation error:', error);
      return { valid: false };
    }
  },

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<{ success: boolean; message: string }> {
    try {
      const refreshToken = await SecureStorageService.getRefreshToken();
      if (!refreshToken) {
        return { success: false, message: 'No refresh token available' };
      }

      const response = await authApi.refreshToken(refreshToken);

      if (response.success && response.token) {
        await SecureStorageService.setToken(response.token);
        if (response.refreshToken) {
          await SecureStorageService.setRefreshToken(response.refreshToken);
        }
        return { success: true, message: 'Token refreshed successfully' };
      }

      return { success: false, message: response.message || 'Token refresh failed' };
    } catch (error: any) {
      console.error('Token refresh error:', error);
      return { success: false, message: error.message || 'Token refresh failed' };
    }
  },

  /**
   * Logout - Clear auth data and invalidate token on server
   */
  async logout(): Promise<void> {
    try {
      // Call logout API to invalidate token on server
      await authApi.logout();
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with local logout even if API fails
    }

    // Clear secure storage (tokens)
    await SecureStorageService.clearAll();

    // Clear local auth data (but keep SIM data for background sync)
    await StorageService.clearAuthData();
  },

  /**
   * Get current auth state
   */
  async getAuthState(): Promise<AuthState> {
    const [token, user, email] = await Promise.all([
      SecureStorageService.getToken(),
      StorageService.getUser(),
      StorageService.getEmail(),
    ]);

    return {
      token,
      user,
      isAuthenticated: !!token && !!user,
      isLoading: false,
      email,
    };
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await SecureStorageService.getToken();
    const user = await StorageService.getUser();
    return !!token && !!user;
  },

  /**
   * Get stored email
   */
  async getEmail(): Promise<string | null> {
    return StorageService.getEmail();
  },

  /**
   * Initialize SIM detection after successful login
   */
  async initializeSIMs(): Promise<void> {
    try {
      await SIMManager.detectAndMatchSIMs();
    } catch (error) {
      console.error('Error initializing SIMs:', error);
    }
  },
};

export default AuthService;