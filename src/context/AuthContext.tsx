/**
 * Authentication Context - Manages auth state for the app
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '../models/index';
import { AuthService, AuthState } from '../services/AuthService';
import { StorageService } from '../services/StorageService';

interface AuthContextValue extends AuthState {
  login: (mobileNumber: string) => Promise<{ success: boolean; message: string; expiresAt?: string }>;
  verifyOTP: (otp: string) => Promise<{ success: boolean; message: string; user?: User }>;
  resendOTP: () => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mobileNumber, setMobileNumber] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from storage
  const refreshAuth = useCallback(async () => {
    try {
      const state = await AuthService.getAuthState();
      setUser(state.user);
      setToken(state.token);
      setMobileNumber(state.mobileNumber);
    } catch (error) {
      console.error('Error refreshing auth state:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  // Send OTP
  const login = useCallback(async (mobile: string) => {
    setIsLoading(true);
    try {
      const result = await AuthService.sendOTP(mobile);
      if (result.success) {
        setMobileNumber(mobile);
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Verify OTP
  const verifyOTP = useCallback(async (otp: string) => {
    setIsLoading(true);
    try {
      const result = await AuthService.verifyOTP(otp);
      if (result.success && result.user) {
        setUser(result.user);
        setToken(await StorageService.getToken());
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Resend OTP
  const resendOTP = useCallback(async () => {
    return AuthService.resendOTP();
  }, []);

  // Logout - Clear auth but keep mobile number
  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await AuthService.logout();
      setUser(null);
      setToken(null);
      // Keep mobileNumber for sync functionality
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    mobileNumber,
    login,
    verifyOTP,
    resendOTP,
    logout,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;