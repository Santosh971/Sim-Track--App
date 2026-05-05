/**
 * Main App Component - Navigation structure with Bottom Tab Navigation
 * Updated for Email OTP authentication with tab-based main app
 */

import React, { useState, useEffect, useRef } from 'react';
import { StatusBar, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Screens
import LoginScreen from './screens/Auth/LoginScreen';
import OTPScreen from './screens/Auth/OTPScreen';
import DashboardScreen from './screens/Dashboard/DashboardScreen';
import SettingsScreen from './screens/Settings/SettingsScreen';
import PermissionScreen from './screens/Permissions';
import ProfileScreen from './screens/Profile/ProfileScreen';
import CallLogsScreen from './screens/CallLogs/CallLogsScreen';
import SMSScreen from './screens/SMS/SMSScreen';
import WiFiMonitorScreen from './screens/WiFi/WiFiMonitorScreen';
import SyncHistoryScreen from './screens/SyncHistory/SyncHistoryScreen';
import CompanyScreen from './screens/Company/CompanyScreen';
import HelpScreen from './screens/Help/HelpScreen';

import { StorageService } from './services';
import { SyncProvider } from './context/SyncContext';
import { WiFiProvider } from './context/WiFiContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { User } from './models';
import COLORS from './constants/colors';
import { SPACING, FONT_SIZE } from './constants/spacing';
import callAutomationService from './services/CallAutomationService';

// Types
export type RootStackParamList = {
  Login: undefined;
  OTP: { email: string; otp?: string; bypassed?: boolean };
  Main: undefined;
  Permission: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  CallLogs: undefined;
  SMS: undefined;
  WiFi: undefined;
  MoreStack: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Export AuthContext for use in screens (re-export from AuthContext.tsx)
export { useAuth } from './context/AuthContext';

// Tab Bar Icon Component
const TabBarIcon: React.FC<{ icon: string; focused: boolean }> = ({ icon, focused }) => (
  <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>{icon}</Text>
);

// Main Tab Navigator
const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.textWhite,
        headerTitleStyle: { fontWeight: '600' },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.border },
        tabBarLabelStyle: { fontSize: FONT_SIZE.xs, fontWeight: '500' },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabBarIcon icon="🏠" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="CallLogs"
        component={CallLogsScreen}
        options={{
          title: 'Calls',
          tabBarIcon: ({ focused }) => <TabBarIcon icon="📞" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="SMS"
        component={SMSScreen}
        options={{
          title: 'SMS',
          tabBarIcon: ({ focused }) => <TabBarIcon icon="💬" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="WiFi"
        component={WiFiMonitorScreen}
        options={{
          title: 'WiFi',
          tabBarIcon: ({ focused }) => <TabBarIcon icon="📶" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="MoreStack"
        component={MoreStackNavigator}
        options={{
          title: 'More',
          tabBarIcon: ({ focused }) => <TabBarIcon icon="☰" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
};

// More Screen - Contains additional options
const MoreScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { logout } = useAuth();

  const menuItems = [
    { label: 'Profile', icon: '👤', screen: 'Profile' },
    { label: 'Sync History', icon: '📊', screen: 'History' },
    // { label: 'Company', icon: '🏢', screen: 'Company' },
    { label: 'Settings', icon: '⚙️', screen: 'Settings' },
    { label: 'Help & Support', icon: '❓', screen: 'Help' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>More</Text>
      </View>
      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={() => navigation.navigate(item.screen)}
          >
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.logoutItem} onPress={logout}>
          <Text style={styles.logoutIcon}>🚪</Text>
          <Text style={styles.logoutLabel}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// More Stack Navigator (for additional screens)
const MoreStackNavigator: React.FC = () => {
  const MoreStack = createNativeStackNavigator();
  return (
    <MoreStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.textWhite,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <MoreStack.Screen
        name="MoreMain"
        component={MoreScreen}
        options={{ headerShown: false }}
      />
      <MoreStack.Screen name="Profile" component={ProfileScreen} />
      <MoreStack.Screen name="History" component={SyncHistoryScreen} options={{ title: 'Sync History' }} />
      <MoreStack.Screen name="Company" component={CompanyScreen} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} />
      <MoreStack.Screen name="Help" component={HelpScreen} options={{ title: 'Help & Support' }} />
    </MoreStack.Navigator>
  );
};

// App Navigator - Uses auth context to determine which screens to show
const AppNavigator: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const [isReady, setIsReady] = React.useState(false);

  // Wait for initial auth check to complete
  React.useEffect(() => {
    // Small delay to ensure auth state is loaded
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Initialize call automation service when user is authenticated
  React.useEffect(() => {
    if (isAuthenticated && user) {
      console.log('[App] User authenticated, initializing call automation...');
      callAutomationService.initialize().catch(err => {
        console.error('[App] Failed to initialize call automation:', err);
      });
    }
  }, [isAuthenticated, user]);

  // Show nothing during initial load
  if (!isReady) {
    return null;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated || !user ? (
          // Auth screens
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen
              name="OTP"
              component={OTPScreen}
              options={{ headerShown: true, title: 'Verify OTP' }}
            />
          </>
        ) : (
          // Main app screens (after authentication)
          <>
            <Stack.Screen
              name="Permission"
              component={PermissionScreen}
              options={{ headerShown: true, title: 'Permissions' }}
            />
            <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const App: React.FC = () => {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <AuthProvider>
        <SyncProvider>
          <WiFiProvider>
            <AppNavigator />
          </WiFiProvider>
        </SyncProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  headerTitle: {
    fontSize: FONT_SIZE['2xl'],
    fontWeight: 'bold',
    color: COLORS.textWhite,
  },
  tabIcon: {
    fontSize: 24,
  },
  tabIconActive: {
    transform: [{ scale: 1.1 }],
  },
  menuContainer: {
    padding: SPACING.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  menuIcon: {
    fontSize: 24,
    marginRight: SPACING.lg,
  },
  menuLabel: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  menuArrow: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.textLight,
  },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.error + '10',
    borderRadius: 12,
    padding: SPACING.lg,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  logoutIcon: {
    fontSize: 24,
    marginRight: SPACING.lg,
  },
  logoutLabel: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.error,
  },
});

export default App;