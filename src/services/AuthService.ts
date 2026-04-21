/**
 * Authentication Service - Handles OTP-based authentication
 */

import { authApi } from '../api/index';
import { StorageService } from './StorageService';
import { LoginCredentials, OTPCredentials, User, AuthResponse } from '../models/index';

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mobileNumber: string | null;
}

/**
 * Authentication service
 */
export const AuthService = {
  /**
   * Send OTP to mobile number
   */
  async sendOTP(mobileNumber: string): Promise<{ success: boolean; message: string; expiresAt?: string }> {
    try {
      // Validate mobile number
      if (!/^\d{10}$/.test(mobileNumber)) {
        throw new Error('Invalid mobile number. Must be 10 digits.');
      }

      const response = await authApi.sendOTP(mobileNumber);

      // Store mobile number for later use
      await StorageService.setMobileNumber(mobileNumber);

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
      // Get stored mobile number
      const mobileNumber = await StorageService.getMobileNumber();
      if (!mobileNumber) {
        throw new Error('Mobile number not found. Please request OTP again.');
      }

      // Validate OTP
      if (!/^\d{6}$/.test(otp)) {
        throw new Error('Invalid OTP. Must be 6 digits.');
      }

      const credentials: OTPCredentials = { mobileNumber, otp };
      const response = await authApi.verifyOTP(credentials);

      if (response.success && response.token) {
        // Store auth data
        await StorageService.setToken(response.token);
        if (response.refreshToken) {
          await StorageService.setRefreshToken(response.refreshToken);
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
      const mobileNumber = await StorageService.getMobileNumber();
      if (!mobileNumber) {
        throw new Error('Mobile number not found. Please start login again.');
      }

      const response = await authApi.resendOTP(mobileNumber);

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

    // Clear local auth data
    await StorageService.clearAuthData();
  },

  /**
   * Get current auth state
   */
  async getAuthState(): Promise<AuthState> {
    const [token, user, mobileNumber] = await Promise.all([
      StorageService.getToken(),
      StorageService.getUser(),
      StorageService.getMobileNumber(),
    ]);

    return {
      token,
      user,
      isAuthenticated: !!token && !!user,
      isLoading: false,
      mobileNumber,
    };
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await StorageService.getToken();
    const user = await StorageService.getUser();
    return !!token && !!user;
  },

  /**
   * Get stored mobile number
   */
  async getMobileNumber(): Promise<string | null> {
    return StorageService.getMobileNumber();
  },
};

export default AuthService;