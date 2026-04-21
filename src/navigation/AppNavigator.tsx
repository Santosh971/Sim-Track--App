/**
 * App Navigator - Root navigator that handles navigation flow
 */

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from './types';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import SplashScreen from '../screens/Splash/SplashScreen';
import PermissionScreen from '../screens/Permissions/PermissionScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      // Import dynamically to avoid issues on non-Android platforms
      const { CallLogService } = await import('../services/CallLogService');
      const hasAll = await CallLogService.hasAllPermissions();
      setHasPermissions(hasAll);
    } catch (error) {
      console.error('Error checking permissions:', error);
      setHasPermissions(false);
    } finally {
      setIsCheckingPermissions(false);
    }
  };

  // Loading state - show splash
  if (authLoading || isCheckingPermissions || hasPermissions === null) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Splash" component={SplashScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // No permissions - show permission screen
  if (!hasPermissions) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Permissions">
            {() => <PermissionScreen onPermissionsGranted={() => setHasPermissions(true)} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // Has permissions but not authenticated - show auth directly (not nested)
  if (!isAuthenticated) {
    return (
      <NavigationContainer>
        <AuthNavigator />
      </NavigationContainer>
    );
  }

  // Authenticated - show main app
  return (
    <NavigationContainer>
      <MainNavigator />
    </NavigationContainer>
  );
};

export default AppNavigator;