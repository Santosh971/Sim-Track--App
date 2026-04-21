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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/common';
import { CallLogService } from '../../services/CallLogService';
import { StorageService } from '../../services/StorageService';
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
      navigation.navigate('Dashboard');
      return;
    }

    try {
      // Check if permissions were previously granted (from storage)
      const hasPermissions = await StorageService.hasPermissions();
      if (hasPermissions) {
        // Verify permissions are still granted
        const hasAll = await CallLogService.hasAllPermissions();
        if (hasAll) {
          // Permissions are already granted, navigate to Dashboard
          navigation.navigate('Dashboard');
          return;
        }
      }

      // Check current permission status and update UI
      const status = await CallLogService.checkPermissions();
      const grantedList: string[] = [];
      if (status.readCallLog) {
        grantedList.push('call_log');
      }
      if (status.readPhoneState) {
        grantedList.push('phone_state');
      }
      setGrantedPermissions(grantedList);
    } catch (error) {
      console.error('Error checking permissions:', error);
    } finally {
      setIsCheckingPermissions(false);
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS !== 'android') {
      navigation.navigate('Dashboard');
      return;
    }

    setIsRequesting(true);

    try {
      const result = await CallLogService.requestPermissions();

      const grantedList: string[] = [];

      if (result.readCallLog) {
        grantedList.push('call_log');
      }
      if (result.readPhoneState) {
        grantedList.push('phone_state');
      }
      // Notifications permission is optional, so we consider it granted if either granted or undefined
      grantedList.push('notifications');

      setGrantedPermissions(grantedList);

      if (result.readCallLog && result.readPhoneState) {
        await StorageService.setPermissionsGranted(true);
        navigation.navigate('Dashboard');
      } else {
        // Some permissions denied
        Alert.alert(
          'Permissions Required',
          'Some essential permissions were denied. The app needs these permissions to function properly. Would you like to open settings to grant them?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => CallLogService.openSettings() },
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to request permissions. Please try again.');
    } finally {
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