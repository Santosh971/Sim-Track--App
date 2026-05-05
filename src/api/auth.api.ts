/**
 * Authentication API service
 */

import apiClient from './client';
import { OTPResponse, AuthResponse, OTPCredentials, ProfileResponse, TokenRefreshResponse, User } from '../models/index';

/**
 * Transform user data from API format (snake_case) to app format (camelCase)
 */
const transformUser = (apiUser: any): User => {
  return {
    id: apiUser._id || apiUser.id,
    name: apiUser.name || '',
    email: apiUser.email || '',
    mobileNumber: apiUser.mobileNumber || apiUser.mobile_number || undefined,
    role: apiUser.role || 'user',
    companyId: apiUser.companyId || apiUser.company_id || null,
    emailVerified: apiUser.emailVerified ?? apiUser.email_verified ?? false,
    isActive: apiUser.isActive ?? apiUser.is_active ?? true, // Default to true if not provided
    lastLogin: apiUser.lastLogin || apiUser.last_login || null,
    createdAt: apiUser.createdAt || apiUser.created_at || '',
    updatedAt: apiUser.updatedAt || apiUser.updated_at || '',
  };
};

export const authApi = {
  /**
   * Send OTP to email address
   */
  sendOTP: async (email: string): Promise<OTPResponse> => {
    const response = await apiClient.post<OTPResponse>('/auth/send-otp', {
      email,
    });
    return response.data;
  },

  /**
   * Verify OTP and get auth token (email-based)
   */
  verifyOTP: async (credentials: OTPCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/verify-otp', {
      email: credentials.email,
      otp: credentials.otp,
    });

    // Transform user data if present
    if (response.data.user) {
      response.data.user = transformUser(response.data.user);
    }

    return response.data;
  },

  /**
   * Resend OTP to email
   */
  resendOTP: async (email: string): Promise<OTPResponse> => {
    const response = await apiClient.post<OTPResponse>('/auth/send-otp', {
      email,
    });
    return response.data;
  },

  /**
   * Get current user profile
   */
  getProfile: async (): Promise<ProfileResponse> => {
    const response = await apiClient.get<ProfileResponse>('/auth/profile');

    // Transform user data if present
    if (response.data.data?.user) {
      response.data.data.user = transformUser(response.data.data.user);
    }

    return response.data;
  },

  /**
   * Refresh authentication token
   */
  refreshToken: async (refreshToken: string): Promise<TokenRefreshResponse> => {
    const response = await apiClient.post<TokenRefreshResponse>('/auth/refresh-token', {
      refreshToken,
    });
    return response.data;
  },

  /**
   * Logout - invalidate token on server
   */
  logout: async (): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{ success: boolean; message: string }>('/auth/logout', {});
    return response.data;
  },
};