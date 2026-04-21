/**
 * Authentication API service
 */

import apiClient from './client';
import { OTPResponse, AuthResponse, OTPCredentials } from '../models/index';

export const authApi = {
  /**
   * Send OTP to mobile number
   */
  sendOTP: async (mobileNumber: string): Promise<OTPResponse> => {
    const response = await apiClient.post<OTPResponse>('/auth/send-otp', {
      mobileNumber,
    });
    return response.data;
  },

  /**
   * Verify OTP and get auth token
   */
  verifyOTP: async (credentials: OTPCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/verify-otp', {
      mobileNumber: credentials.mobileNumber,
      otp: credentials.otp,
    });
    return response.data;
  },

  /**
   * Resend OTP
   */
  resendOTP: async (mobileNumber: string): Promise<OTPResponse> => {
    const response = await apiClient.post<OTPResponse>('/auth/send-otp', {
      mobileNumber,
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