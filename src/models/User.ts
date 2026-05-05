/**
 * User model
 */
export interface User {
  id: string;
  name: string;
  email: string;
  mobileNumber?: string;
  role: 'super_admin' | 'admin' | 'user';
  companyId: string | null;
  emailVerified: boolean;
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
 * Login credentials (Email-based)
 */
export interface LoginCredentials {
  email: string;
}

/**
 * OTP verification credentials (Email-based)
 */
export interface OTPCredentials {
  email: string;
  otp: string;
}

/**
 * Token refresh response
 */
export interface TokenRefreshResponse {
  success: boolean;
  message: string;
  token: string;
  refreshToken?: string;
}

/**
 * User profile response
 */
export interface ProfileResponse {
  success: boolean;
  data: {
    user: User;
  };
}