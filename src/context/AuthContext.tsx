/**
 * Authentication Context - Manages auth state for the app
 * Updated for Email OTP authentication
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '../models/index';
import { AuthService, AuthState } from '../services/AuthService';
import { StorageService } from '../services/StorageService';
import { SecureStorageService } from '../services/SecureStorageService';
import { SIMManager } from '../services/SIMManager';
import BackgroundSync from '../native/BackgroundSyncModule';

interface AuthContextValue extends AuthState {
  login: (email: string) => Promise<{ success: boolean; message: string; expiresAt?: string }>;
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
  const [email, setEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from storage
  const refreshAuth = useCallback(async () => {
    try {
      const state = await AuthService.getAuthState();
      setUser(state.user);
      setToken(state.token);
      setEmail(state.email);
    } catch (error) {
      console.error('Error refreshing auth state:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  // Send OTP to email
  const login = useCallback(async (emailAddress: string) => {
    try {
      const result = await AuthService.sendOTP(emailAddress);
      if (result.success) {
        setEmail(emailAddress);
      }
      return result;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }, []);

  // Verify OTP
  const verifyOTP = useCallback(async (otp: string) => {
    try {
      const result = await AuthService.verifyOTP(otp);
      if (result.success && result.user) {
        setUser(result.user);
        setToken(await SecureStorageService.getToken());

        // Store mobile number from user profile for legacy sync fallback
        if (result.user.mobileNumber) {
          await StorageService.setMobileNumber(result.user.mobileNumber);
        }

        // Initialize SIM detection in background (non-blocking)
        // This prevents UI freeze after login
        console.log('[AuthContext] Starting background SIM initialization...');
        AuthService.initializeSIMs()
          .then(() => {
            console.log('[AuthContext] SIM detection complete');
            // Set up background sync with SIM IDs after detection
            SIMManager.getValidSIMIds()
              .then(validSIMIds => {
                if (validSIMIds.length > 0) {
                  BackgroundSync.setValidSIMIds(validSIMIds);
                  console.log('[AuthContext] Set', validSIMIds.length, 'SIM IDs for background sync');
                }
              })
              .catch(err => console.error('[AuthContext] Error setting SIM IDs:', err));
          })
          .catch(error => console.error('[AuthContext] Error initializing SIM sync:', error));

        // Set email and mobile for native module (quick operations)
        StorageService.getEmail()
          .then(email => {
            if (email) BackgroundSync.setUserEmail(email);
          })
          .catch(() => {});

        StorageService.getMobileNumber()
          .then(mobile => {
            if (mobile) BackgroundSync.setMobileNumber(mobile);
          })
          .catch(() => {});
      }
      return result;
    } catch (error) {
      console.error('Verify OTP error:', error);
      throw error;
    }
  }, []);

  // Resend OTP
  const resendOTP = useCallback(async () => {
    return AuthService.resendOTP();
  }, []);

  // Logout - Clear auth data but keep SIM data for background sync
  const logout = useCallback(async () => {
    try {
      await AuthService.logout();
      setUser(null);
      setToken(null);
      // Keep email for background sync functionality
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if API fails
      setUser(null);
      setToken(null);
    }
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    email,
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