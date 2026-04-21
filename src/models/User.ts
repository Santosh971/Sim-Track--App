/**
 * User model
 */
export interface User {
  id: string;
  name: string;
  mobileNumber: string;
  email: string;
  role: 'super_admin' | 'admin' | 'user';
  companyId: string | null;
  mobileVerified: boolean;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Auth response after OTP verification
 */
export interface AuthResponse {
  success: boolean;
  message: string;
  token: string;
  refreshToken: string;
  user: User;
}

/**
 * OTP response
 */
export interface OTPResponse {
  success: boolean;
  message: string;
  expiresAt?: string;
  otp?: string; // Only in development mode
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  mobileNumber: string;
}

/**
 * OTP verification credentials
 */
export interface OTPCredentials {
  mobileNumber: string;
  otp: string;
}