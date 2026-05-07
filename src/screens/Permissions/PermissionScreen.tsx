/**
 * Permission Screen - Request Android permissions
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/common';
import { CallLogService } from '../../services/CallLogService';
import { StorageService } from '../../services/StorageService';
import { PERMISSIONS as PERM_CONFIG } from '../../config/index';
import COLORS from '../../constants/colors';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/spacing';
import { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Permission'>;

interface PermissionItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  permission: string;
}

const PERMISSIONS: PermissionItem[] = [
  {
    id: 'call_log',
    title: 'Call Log Access',
    description: 'Required to read your call history and sync it to the server.',
    icon: '📞',
    permission: 'android.permission.READ_CALL_LOG',
  },
  {
    id: 'phone_state',
    title: 'Phone State',
    description: 'Required to identify your SIM card for proper synchronization.',
    icon: '📱',
    permission: 'android.permission.READ_PHONE_STATE',
  },
  {
    id: 'sms',
    title: 'SMS Access',
    description: 'Required to read your SMS messages and sync them to the server.',
    icon: '💬',
    permission: 'android.permission.READ_SMS',
  },
  {
    id: 'location',
    title: 'Location Access',
    description: 'Required to read WiFi network name for speed monitoring (Android 10+).',
    icon: '📍',
    permission: 'android.permission.ACCESS_FINE_LOCATION',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Required to show sync status and important alerts.',
    icon: '🔔',
    permission: 'android.permission.POST_NOTIFICATIONS',
  },
];

const PermissionScreen: React.FC<Props> = ({ navigation }) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const [grantedPermissions, setGrantedPermissions] = useState<string[]>([]);

  // Check if permissions are already granted on mount
  useEffect(() => {
    checkExistingPermissions();
  }, []);

  const checkExistingPermissions = async () => {
    

    if (Platform.OS !== 'android') {
      // On iOS, permissions are not required for call log access
      // (call log access is not available on iOS)
      // Navigate directly to Dashboard
      navigation.replace('Main');
      return;
    }

    try {
      // Check actual permission status from system
      const status = await CallLogService.checkPermissions();
      console.log('[PermissionScreen] System permissions:', JSON.stringify(status));

      const grantedList: string[] = [];

      if (status.readCallLog) {
        grantedList.push('call_log');
      }
      if (status.readPhoneState) {
        grantedList.push('phone_state');
      }
      if (status.readSms) {
        grantedList.push('sms');
      }

      // Check location permission separately
      const { PermissionsAndroid } = require('react-native');
      let hasLocationPermission = false;
      try {
        const locationResult = await PermissionsAndroid.check(PERM_CONFIG.ACCESS_FINE_LOCATION);
        hasLocationPermission = locationResult;
        if (hasLocationPermission) {
          grantedList.push('location');
        }
      } catch (e) {
        console.log('[PermissionScreen] Location permission check error:', e);
      }

      setGrantedPermissions(grantedList);

      // Check if all essential permissions are granted
      // NOTE: We need readCallLog, readPhoneState, AND readSms
      // Location is optional but recommended for WiFi monitoring
      const allPermissionsGranted = status.readCallLog && status.readPhoneState && status.readSms;
      console.log('[PermissionScreen] All permissions granted:', allPermissionsGranted);

      if (allPermissionsGranted) {
        await StorageService.setPermissionsGranted(true);
        navigation.replace('Main');
        return;
      }

      // Check if permissions were previously marked as granted in storage
      const hasPermissions = await StorageService.hasPermissions();
      if (hasPermissions) {
        // Permissions were granted before but now revoked - clear the flag
        await StorageService.setPermissionsGranted(false);
      }


    } catch (error) {
      console.error('[PermissionScreen] Error checking permissions:', error);
    } finally {
      setIsCheckingPermissions(false);
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS !== 'android') {
      navigation.replace('Main');
      return;
    }

    setIsRequesting(true);

    try {

      // Request essential permissions using PermissionsAndroid (properly waits for user response)
      const essentialPermissions = [
        'android.permission.READ_CALL_LOG',
        'android.permission.READ_PHONE_STATE',
        'android.permission.READ_SMS',
      ];

      // Add READ_PHONE_NUMBERS for Android 10+ (API 29)
      if (Platform.Version >= 29) {
        essentialPermissions.push('android.permission.READ_PHONE_NUMBERS');
      }

      console.log('[PermissionScreen] Requesting essential permissions:', essentialPermissions);

      const results = await PermissionsAndroid.requestMultiple(essentialPermissions);

      console.log('[PermissionScreen] Essential permission results:', JSON.stringify(results));

      // Check results for essential permissions
      const hasReadCallLog = results['android.permission.READ_CALL_LOG'] === PermissionsAndroid.RESULTS.GRANTED;
      const hasReadPhoneState = results['android.permission.READ_PHONE_STATE'] === PermissionsAndroid.RESULTS.GRANTED;
      const hasReadSms = results['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED;

      console.log('[PermissionScreen] Permission status:', {
        readCallLog: hasReadCallLog,
        readPhoneState: hasReadPhoneState,
        readSms: hasReadSms,
      });

      // Request location permission (optional)
      let hasLocationPermission = false;
      try {
        const locationResult = await PermissionsAndroid.request(
          PERM_CONFIG.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs access to your location to read WiFi network information for speed monitoring.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        hasLocationPermission = locationResult === PermissionsAndroid.RESULTS.GRANTED;
        console.log('[PermissionScreen] Location permission result:', locationResult);
      } catch (e) {
        console.log('[PermissionScreen] Location permission request error:', e);
      }

      // Request notifications permission (optional, Android 13+)
      if (Platform.Version >= 33) {
        try {
          await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');
        } catch (e) {
          console.log('[PermissionScreen] Notifications permission request error:', e);
        }
      }

      // Update granted permissions list for UI
      const grantedList: string[] = [];
      if (hasReadCallLog) grantedList.push('call_log');
      if (hasReadPhoneState) grantedList.push('phone_state');
      if (hasReadSms) grantedList.push('sms');
      if (hasLocationPermission) grantedList.push('location');
      grantedList.push('notifications'); // Optional, consider granted

      setGrantedPermissions(grantedList);

      // Check if all essential permissions are granted
      const hasEssentialPermissions = hasReadCallLog && hasReadPhoneState && hasReadSms;

      if (hasEssentialPermissions) {
        await StorageService.setPermissionsGranted(true);

        // Navigate first, then detect SIMs and start sync in background
        navigation.replace('Main');

        // Re-detect SIMs in background after navigation
        // This prevents UI blocking during SIM detection
        const { SIMManager } = require('../../services/SIMManager');
        const { SyncService } = require('../../services/SyncService');
        const { SMSService } = require('../../services/SMSService');
        const { BackgroundSync } = require('../../native/BackgroundSyncModule');

        SIMManager.detectAndMatchSIMs()
          .then(async () => {
            console.log('[PermissionScreen] SIM detection complete, starting auto sync...');

            // Start call log sync
            try {
              const syncResult = await SyncService.sync();
              console.log('[PermissionScreen] Call log sync result:', syncResult);
            } catch (syncErr) {
              console.error('[PermissionScreen] Call log sync failed:', syncErr);
            }

            // Start SMS sync
            try {
              const smsResult = await SMSService.sync();
              console.log('[PermissionScreen] SMS sync result:', smsResult);
            } catch (smsErr) {
              console.error('[PermissionScreen] SMS sync failed:', smsErr);
            }

            // Start background sync service
            try {
              const isRunning = await BackgroundSync.isRunning();
              if (!isRunning) {
                await BackgroundSync.startSync();
              }
            } catch (bgErr) {
              console.error('[PermissionScreen] Failed to start background sync:', bgErr);
            }
          })
          .catch(err => console.error('[PermissionScreen] SIM detection failed:', err));
      } else {
        // Some permissions denied
        const missing: string[] = [];
        if (!hasReadCallLog) missing.push('Call Log');
        if (!hasReadPhoneState) missing.push('Phone State');
        if (!hasReadSms) missing.push('SMS');

        console.log('[PermissionScreen] Missing permissions:', missing);

        Alert.alert(
          'Permissions Required',
          `The following permissions are required: ${missing.join(', ')}.\n\nPlease grant these permissions to use the app. Would you like to open settings?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setIsRequesting(false) },
            {
              text: 'Open Settings',
              onPress: () => {
                setIsRequesting(false);
                CallLogService.openSettings();
              }
            },
          ]
        );
      }
    } catch (error) {
      console.error('[PermissionScreen] Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to request permissions. Please try again.');
      setIsRequesting(false);
    }
  };

  const isPermissionGranted = (id: string): boolean => {
    return grantedPermissions.includes(id);
  };

  // Show loading while checking permissions
  if (isCheckingPermissions) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Checking permissions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔒</Text>
          </View>
          <Text style={styles.title}>Permissions Required</Text>
          <Text style={styles.subtitle}>
            SIM Sync needs the following permissions to manage your call logs effectively.
          </Text>
        </View>

        {/* Permission List */}
        <View style={styles.permissionList}>
          {PERMISSIONS.map((permission) => (
            <View
              key={permission.id}
              style={[
                styles.permissionItem,
                isPermissionGranted(permission.id) && styles.permissionGranted,
              ]}
            >
              <View style={styles.permissionIcon}>
                <Text style={styles.permissionIconText}>{permission.icon}</Text>
              </View>
              <View style={styles.permissionContent}>
                <Text style={styles.permissionTitle}>{permission.title}</Text>
                <Text style={styles.permissionDescription}>
                  {permission.description}
                </Text>
              </View>
              {isPermissionGranted(permission.id) && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Your call log data is synced securely to your account and is not shared with third parties.
          </Text>
        </View>

        {/* Button */}
        <View style={styles.buttonContainer}>
          <Button
            title={isRequesting ? 'Requesting...' : 'Grant Permissions'}
            onPress={requestPermissions}
            loading={isRequesting}
            disabled={isRequesting}
            size="lg"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING['2xl'],
    paddingTop: SPACING['4xl'],
    paddingBottom: SPACING['3xl'],
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING['4xl'],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    fontSize: FONT_SIZE['2xl'],
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.lg,
  },
  permissionList: {
    marginBottom: SPACING['2xl'],
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  permissionGranted: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success + '10',
  },
  permissionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  permissionIconText: {
    fontSize: 24,
  },
  permissionContent: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  permissionDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    lineHeight: 18,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  checkmarkText: {
    color: COLORS.textWhite,
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
  },
  infoContainer: {
    backgroundColor: COLORS.info + '10',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING['2xl'],
  },
  infoText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.info,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    marginTop: 'auto',
    paddingHorizontal: SPACING.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textLight,
  },
});

export default PermissionScreen;