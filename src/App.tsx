/**
 * Main App Component - Simple navigation structure
 */

import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screens
import LoginScreen from './screens/Auth/LoginScreen';
import OTPScreen from './screens/Auth/OTPScreen';
import DashboardScreen from './screens/Dashboard/DashboardScreen';
import SettingsScreen from './screens/Settings/SettingsScreen';
import { AuthService, StorageService } from './services';
import PermissionScreen from './screens/Permissions';
import { SyncProvider } from './context/SyncContext';
import { User } from './models';

// Types
export type RootStackParamList = {
  Login: undefined;
  OTP: { mobileNumber: string };
  Dashboard: undefined;
  Settings: undefined;
  Permission: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Auth Context
export const AuthContext = React.createContext<{
  user: User | null;
  mobileNumber: string | null;
  isAuthenticated: boolean;
  login: (mobile: string) => Promise<{ success: boolean; message: string }>;
  verifyOTP: (otp: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
}>({
  user: null,
  mobileNumber: null,
  isAuthenticated: false,
  login: async () => ({ success: false, message: '' }),
  verifyOTP: async () => ({ success: false, message: '' }),
  logout: async () => {},
});

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [mobileNumber, setMobileNumber] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  // Check if user is logged in on app start
  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const [storedUser, storedMobile] = await Promise.all([
        StorageService.getUser(),
        StorageService.getMobileNumber(),
      ]);
      if (storedUser) {
        setUser(storedUser);
      }
      if (storedMobile) {
        setMobileNumber(storedMobile);
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Login function - sends OTP
  const login = async (
    mobile: string,
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const result = await AuthService.sendOTP(mobile);
      if (result.success) {
        setMobileNumber(mobile);
      }
      return result;
    } catch (error: any) {
      console.error('Login error:', error);
      return {
        success: false,
        message: error.message || 'Failed to send OTP',
      };
    }
  };

  // Verify OTP function
  const verifyOTP = async (
    otp: string,
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const result = await AuthService.verifyOTP(otp);
      if (result.success && result.user) {
        setUser(result.user);
      }
      return result;
    } catch (error: any) {
      console.error('OTP verification error:', error);
      return {
        success: false,
        message: error.message || 'OTP verification failed',
      };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await AuthService.logout();
      // Clear permissions flag so user sees permission screen on next login
      await StorageService.setPermissionsGranted(false);
      setUser(null);

      // Reset navigation to Login screen
      navigationRef.current?.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Show loading screen
  if (isLoading) {
    return null; // Or you can show a splash screen here
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <AuthContext.Provider
        value={{
          user,
          mobileNumber,
          isAuthenticated: !!user,
          login,
          verifyOTP,
          logout,
        }}
      >
        <SyncProvider>
          <NavigationContainer ref={navigationRef}>
            <Stack.Navigator
              screenOptions={{
                headerStyle: { backgroundColor: '#3B82F6' },
                headerTintColor: '#FFFFFF',
                headerTitleStyle: { fontWeight: '600' },
              }}
            >
              {!user ? (
                // Auth screens
                <>
                  <Stack.Screen
                    name="Login"
                    component={LoginScreen}
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="OTP"
                    component={OTPScreen}
                    options={{ title: 'Verify OTP' }}
                  />
                </>
              ) : (
                // Main app screens (after authentication)
                <>
                  <Stack.Screen
                    name="Permission"
                    component={PermissionScreen}
                    options={{ title: 'Permissions' }}
                  />
                  <Stack.Screen
                    name="Dashboard"
                    component={DashboardScreen}
                    options={{ title: 'SIM Sync', headerBackVisible: false }}
                  />
                  <Stack.Screen
                    name="Settings"
                    component={SettingsScreen}
                    options={{ title: 'Settings' }}
                  />
                </>
              )}
            </Stack.Navigator>
          </NavigationContainer>
        </SyncProvider>
      </AuthContext.Provider>
    </SafeAreaProvider>
  );
};

export default App;
