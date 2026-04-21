/**
 * Settings Screen - App settings
 */

import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthContext, RootStackParamList } from '../../App';
import { useSync } from '../../context/SyncContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { user, mobileNumber, logout } = useContext(AuthContext);
  const {
    autoSyncEnabled,
    syncInterval,
    lastSyncTime,
    pendingLogs,
    setAutoSyncEnabled,
    setSyncInterval,
    sync,
    isSyncing,
  } = useSync();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const handleAutoSyncToggle = async (enabled: boolean) => {
    await setAutoSyncEnabled(enabled);
  };

  const handleIntervalChange = async (interval: number) => {
    await setSyncInterval(interval);
  };

  const handleManualSync = async () => {
    if (!isSyncing) {
      await sync();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Sync Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync Settings</Text>

          <View style={styles.card}>
            {/* Auto Sync */}
            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Auto Sync</Text>
                <Text style={styles.settingDescription}>
                  Automatically sync call logs
                </Text>
              </View>
              <Switch
                value={autoSyncEnabled}
                onValueChange={handleAutoSyncToggle}
                trackColor={{ false: '#E2E8F0', true: '#3B82F6' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            {/* Sync Interval */}
            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Sync Interval</Text>
                <Text style={styles.settingDescription}>
                  How often to sync (when auto-sync is enabled)
                </Text>
              </View>
              <Text style={styles.settingValue}>{syncInterval} min</Text>
            </View>

            {/* Interval Options */}
            <View style={styles.intervalOptions}>
              {[5, 10, 15, 30, 60].map((interval) => (
                <TouchableOpacity
                  key={interval}
                  style={[
                    styles.intervalButton,
                    syncInterval === interval && styles.intervalButtonActive,
                  ]}
                  onPress={() => handleIntervalChange(interval)}
                >
                  <Text
                    style={[
                      styles.intervalButtonText,
                      syncInterval === interval && styles.intervalButtonTextActive,
                    ]}
                  >
                    {interval}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.divider} />

            {/* Manual Sync */}
            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Manual Sync</Text>
                <Text style={styles.settingDescription}>
                  Sync call logs now
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
                onPress={handleManualSync}
                disabled={isSyncing}
              >
                <Text style={styles.syncButtonText}>
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Sync Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync Status</Text>

          <View style={styles.card}>
            <View style={styles.settingItem}>
              <Text style={styles.settingTitle}>Last Sync</Text>
              <Text style={styles.settingValue}>{lastSyncTime || 'Never'}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.settingItem}>
              <Text style={styles.settingTitle}>Pending Logs</Text>
              <Text style={styles.settingValue}>{pendingLogs}</Text>
            </View>
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <View style={styles.card}>
            <View style={styles.settingItem}>
              <Text style={styles.settingTitle}>Mobile Number</Text>
              <Text style={styles.settingValue}>+91 {mobileNumber}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.settingItem}>
              <Text style={styles.settingTitle}>Name</Text>
              <Text style={styles.settingValue}>{user?.name || 'N/A'}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.settingItem}>
              <Text style={styles.settingTitle}>Role</Text>
              <Text style={styles.settingValue}>{user?.role || 'user'}</Text>
            </View>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          <View style={styles.card}>
            <View style={styles.settingItem}>
              <Text style={styles.settingTitle}>App Version</Text>
              <Text style={styles.settingValue}>1.0.0</Text>
            </View>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1E293B',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: '#64748B',
  },
  settingValue: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 16,
  },
  intervalOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
  },
  intervalButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  intervalButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  intervalButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  intervalButtonTextActive: {
    color: '#FFFFFF',
  },
  syncButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  syncButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SettingsScreen;