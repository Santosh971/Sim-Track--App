/**
 * Settings Screen - App settings
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../App';
import { useSync } from '../../context/SyncContext';
import { useWiFi } from '../../context/WiFiContext';
import callAutomationService from '../../services/CallAutomationService';
import { CallConfigResponse } from '../../api/callAutomation.api';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const SettingsScreen: React.FC<Props> = () => {
  const { user, email, logout } = useAuth();
  const {
    autoSyncEnabled,
    syncInterval,
    lastSyncTime,
    pendingLogs,
    matchedSIMs,
    setAutoSyncEnabled,
    setSyncInterval,
    sync,
    isSyncing,
    // SMS sync state
    isSmsSyncing,
    smsLastSyncTime,
    syncSMS,
    refreshSyncState,
  } = useSync();

  // WiFi Speed Monitoring
  const {
    deviceId,
    wifiName,
    isMonitoring: isWiFiMonitoring,
    lastSpeedTest,
    status: wifiStatus,
    error: wifiError,
    initialize: initializeWiFi,
    startMonitoring: startWiFiMonitoring,
    stopMonitoring: stopWiFiMonitoring,
    runSpeedTest,
  } = useWiFi();

  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [smsSyncMessage, setSmsSyncMessage] = useState<string | null>(null);
  const [permissionsStatus, setPermissionsStatus] = useState<{
    readCallLog: boolean;
    readPhoneState: boolean;
    readSms: boolean;
  }>({ readCallLog: false, readPhoneState: false, readSms: false });

  // WiFi state
  const [isSpeedTesting, setIsSpeedTesting] = useState(false);
  const [wifiCompanyId] = useState('default_company');

  // Call Automation state
  const [callAutomationStatus, setCallAutomationStatus] = useState<{
    isRunning: boolean;
    config: CallConfigResponse | null;
    simPhoneNumber: string;
    simSlotIndex: number;
  } | null>(null);
  const [isRefreshingCallAutomation, setIsRefreshingCallAutomation] = useState(false);
  const [callAutomationMessage, setCallAutomationMessage] = useState<string | null>(null);

  // Refresh control
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
    loadCallAutomationStatus();
  }, []);

  // Load call automation status periodically (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      loadCallAutomationStatus();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, []);

  const checkPermissions = async () => {
    try {
      const { CallLogService } = require('../../services/CallLogService');
      const status = await CallLogService.checkPermissions();
      setPermissionsStatus({
        readCallLog: status.readCallLog ?? false,
        readPhoneState: status.readPhoneState ?? false,
        readSms: status.readSms ?? false,
      });
      console.log('[Settings] Permissions status:', status);
    } catch (error) {
      console.error('[Settings] Error checking permissions:', error);
    }
  };

  const loadCallAutomationStatus = async () => {
    try {
      const status = await callAutomationService.getStatus();
      setCallAutomationStatus(status);
      console.log('[Settings] Call automation status loaded:', status);
    } catch (error) {
      console.error('[Settings] Error loading call automation status:', error);
    }
  };

  const handleRefreshCallAutomation = async () => {
    setIsRefreshingCallAutomation(true);
    setCallAutomationMessage(null);

    try {
      const result = await callAutomationService.refreshConfig();
      setCallAutomationMessage(result.message);

      // Reload status after refresh
      await loadCallAutomationStatus();

      if (result.success) {
        Alert.alert('Success', result.message);
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error: any) {
      console.error('[Settings] Error refreshing call automation:', error);
      setCallAutomationMessage(`Error: ${error.message}`);
      Alert.alert('Error', error.message || 'Failed to refresh call automation config');
    } finally {
      setIsRefreshingCallAutomation(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadCallAutomationStatus(),
        refreshSyncState(),
      ]);
    } catch (error) {
      console.error('[Settings] Error during refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const requestPermissions = async () => {
    try {
      const { CallLogService } = require('../../services/CallLogService');
      const result = await CallLogService.requestPermissions();
      setPermissionsStatus({
        readCallLog: result.readCallLog ?? false,
        readPhoneState: result.readPhoneState ?? false,
        readSms: result.readSms ?? false,
      });
      console.log('[Settings] Request permissions result:', result);

      // Re-check permissions after a short delay
      await new Promise<void>(resolve => setTimeout(resolve, 500));
      const status = await CallLogService.checkPermissions();
      setPermissionsStatus({
        readCallLog: status.readCallLog ?? false,
        readPhoneState: status.readPhoneState ?? false,
        readSms: status.readSms ?? false,
      });
      console.log('[Settings] Re-checked permissions:', status);

      // If all permissions granted, re-detect SIMs
      if (status.readCallLog && status.readPhoneState && status.readSms) {
        console.log('[Settings] All permissions granted, re-detecting SIMs...');
        const { SIMManager } = require('../../services/SIMManager');
        await SIMManager.detectAndMatchSIMs();
        console.log('[Settings] SIM detection complete');

        // Refresh sync context to update matched SIMs
        await refreshSyncState();

        Alert.alert(
          'Permissions Granted',
          'All permissions have been granted. SIM detection has been updated.',
          [{ text: 'OK' }]
        );
      } else {
        // Show alert if permissions still not granted
        const missing: string[] = [];
        if (!status.readCallLog) missing.push('Call Log');
        if (!status.readPhoneState) missing.push('Phone State');
        if (!status.readSms) missing.push('SMS');

        Alert.alert(
          'Permissions Required',
          `The following permissions are missing: ${missing.join(', ')}.\n\nPlease grant these permissions in Settings > Apps > SIM Management > Permissions`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[Settings] Error requesting permissions:', error);
    }
  };

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
    if (isSyncing) return;

    setSyncMessage(null);
    console.log('[Settings] Starting manual sync...');

    try {
      const result = await sync();
      console.log('[Settings] Sync result:', result);

      if (result.success) {
        setSyncMessage(`✓ ${result.message}`);
      } else {
        setSyncMessage(`✗ ${result.message || result.error || 'Sync failed'}`);
      }
    } catch (error: any) {
      console.error('[Settings] Sync error:', error);
      setSyncMessage(`✗ Error: ${error.message || 'Unknown error'}`);
    }
  };

  const handleManualSmsSync = async () => {
    if (isSmsSyncing) return;

    setSmsSyncMessage(null);
    console.log('[Settings] Starting SMS sync...');

    try {
      const result = await syncSMS();
      console.log('[Settings] SMS sync result:', result);

      if (result.success) {
        setSmsSyncMessage(`✓ ${result.message}`);
      } else {
        setSmsSyncMessage(`✗ ${result.message || 'SMS sync failed'}`);
      }
    } catch (error: any) {
      console.error('[Settings] SMS sync error:', error);
      setSmsSyncMessage(`✗ Error: ${error.message || 'Unknown error'}`);
    }
  };

  // WiFi handlers
  const handleWiFiInitialize = async () => {
    console.log('[Settings] Initializing WiFi monitoring...');
    await initializeWiFi(wifiCompanyId);
  };

  const handleWiFiToggle = async (enabled: boolean) => {
    if (enabled) {
      startWiFiMonitoring();
    } else {
      stopWiFiMonitoring();
    }
  };

  const handleSpeedTest = async () => {
    if (isSpeedTesting) return;

    setIsSpeedTesting(true);
    console.log('[Settings] Running speed test...');

    try {
      const result = await runSpeedTest();
      console.log('[Settings] Speed test result:', result);
    } catch (error: any) {
      console.error('[Settings] Speed test error:', error);
      Alert.alert('Speed Test Error', error.message || 'Failed to run speed test');
    } finally {
      setIsSpeedTesting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleManualRefresh}
            colors={['#3B82F6']}
            tintColor="#3B82F6"
          />
        }
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
            {/* <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Sync Interval</Text>
                <Text style={styles.settingDescription}>
                  How often to sync (when auto-sync is enabled)
                </Text>
              </View>
              <Text style={styles.settingValue}>{syncInterval} min</Text>
            </View> */}

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
              <Text style={styles.settingTitle}>Matched SIMs</Text>
              <Text style={styles.settingValue}>{matchedSIMs}</Text>
            </View>

            <View style={styles.divider} />

            {/* <View style={styles.settingItem}>
              <Text style={styles.settingTitle}>Pending Logs</Text>
              <Text style={styles.settingValue}>{pendingLogs}</Text>
            </View> */}
          </View>
        </View>

        {/* SMS Sync */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SMS Sync</Text>

          <View style={styles.card}>
            {/* <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Last SMS Sync</Text>
                <Text style={styles.settingDescription}>
                  {smsLastSyncTime || 'Never'}
                </Text>
              </View>
            </View> */}

            <View style={styles.divider} />

            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Manual SMS Sync</Text>
                <Text style={styles.settingDescription}>
                  Sync SMS messages now
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.syncButton, isSmsSyncing && styles.syncButtonDisabled]}
                onPress={handleManualSmsSync}
                disabled={isSmsSyncing}
              >
                <Text style={styles.syncButtonText}>
                  {isSmsSyncing ? 'Syncing...' : 'Sync SMS'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* SMS Sync Result Message */}
        {smsSyncMessage && (
          <View style={styles.section}>
            <View style={[styles.card, smsSyncMessage.startsWith('✓') ? styles.successCard : styles.errorCard]}>
              <Text style={[styles.messageText, smsSyncMessage.startsWith('✓') ? styles.successText : styles.errorText]}>
                {smsSyncMessage}
              </Text>
            </View>
          </View>
        )}

        {/* Sync Result Message */}
        {syncMessage && (
          <View style={styles.section}>
            <View style={[styles.card, syncMessage.startsWith('✓') ? styles.successCard : styles.errorCard]}>
              <Text style={[styles.messageText, syncMessage.startsWith('✓') ? styles.successText : styles.errorText]}>
                {syncMessage}
              </Text>
            </View>
          </View>
        )}

        {/* Call Automation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Call Automation</Text>

          <View style={styles.card}>
            {/* Status */}
            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Status</Text>
                <Text style={styles.settingDescription}>
                  {callAutomationStatus?.isRunning ? 'Active' : 'Inactive'}
                  {callAutomationStatus?.config?.role === 'CALLER' ? ' (Caller)' :
                   callAutomationStatus?.config?.role === 'RECEIVER' ? ' (Receiver)' : ''}
                </Text>
              </View>
              <View style={[
                styles.statusBadge,
                callAutomationStatus?.isRunning && styles.statusBadgeActive,
              ]}>
                <Text style={[
                  styles.statusBadgeText,
                  callAutomationStatus?.isRunning && styles.statusBadgeTextActive,
                ]}>
                  {callAutomationStatus?.isRunning ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Caller SIM */}
            {callAutomationStatus?.simPhoneNumber && (
              <>
                <View style={styles.settingItem}>
                  <Text style={styles.settingTitle}>Caller SIM</Text>
                  <Text style={styles.settingValue}>{callAutomationStatus.simPhoneNumber}</Text>
                </View>
                <View style={styles.divider} />
              </>
            )}

            {/* Config Details */}
            {callAutomationStatus?.config && (
              <>
                <View style={styles.settingItem}>
                  <Text style={styles.settingTitle}>Call Duration</Text>
                  <Text style={styles.settingValue}>{callAutomationStatus.config.callDuration} seconds</Text>
                </View>
                <View style={styles.divider} />

                <View style={styles.settingItem}>
                  <Text style={styles.settingTitle}>Frequency</Text>
                  <Text style={styles.settingValue}>
                    {callAutomationStatus.config.frequency === 'hourly' ? 'Every Hour' :
                     callAutomationStatus.config.frequency === 'daily' ? `Daily at ${callAutomationStatus.config.scheduledTime}` :
                     `Weekly (${callAutomationStatus.config.scheduledDay}) at ${callAutomationStatus.config.scheduledTime}`}
                  </Text>
                </View>
                <View style={styles.divider} />

                <View style={styles.settingItem}>
                  <Text style={styles.settingTitle}>Target SIMs</Text>
                  <Text style={styles.settingValue}>
                    {callAutomationStatus.config.targets?.length || 0} SIMs
                  </Text>
                </View>
                <View style={styles.divider} />
              </>
            )}

            {/* Auto Refresh Info */}
            {/* <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Auto Refresh</Text>
                <Text style={styles.settingDescription}>
                  Config refreshes automatically every 5 minutes
                </Text>
              </View>
            </View> */}

            <View style={styles.divider} />

            {/* Manual Refresh */}
            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Refresh Config</Text>
                <Text style={styles.settingDescription}>
                  Fetch latest settings from server
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.syncButton, isRefreshingCallAutomation && styles.syncButtonDisabled]}
                onPress={handleRefreshCallAutomation}
                disabled={isRefreshingCallAutomation}
              >
                <Text style={styles.syncButtonText}>
                  {isRefreshingCallAutomation ? 'Refreshing...' : 'Refresh'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Status Message */}
            {callAutomationMessage && (
              <View style={[styles.settingItem, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <Text style={[
                  styles.settingDescription,
                  callAutomationMessage.includes('Error') ? styles.permDenied : styles.permGranted
                ]}>
                  {callAutomationMessage}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* WiFi Speed Monitoring */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WiFi Speed Monitoring</Text>

          <View style={styles.card}>
            {/* Status */}
            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Status</Text>
                <Text style={styles.settingDescription}>
                  {wifiStatus === 'idle' && 'Not initialized'}
                  {wifiStatus === 'waiting' && 'Waiting for approval...'}
                  {wifiStatus === 'active' && 'Active'}
                  {wifiStatus === 'error' && (wifiError || 'Error')}
                </Text>
              </View>
              <View style={[
                styles.statusBadge,
                wifiStatus === 'active' && styles.statusBadgeActive,
                wifiStatus === 'waiting' && styles.statusBadgeWaiting,
                wifiStatus === 'error' && styles.statusBadgeError,
              ]}>
                <Text style={[
                  styles.statusBadgeText,
                  wifiStatus === 'active' && styles.statusBadgeTextActive,
                  wifiStatus === 'waiting' && styles.statusBadgeTextWaiting,
                  wifiStatus === 'error' && styles.statusBadgeTextError,
                ]}>
                  {wifiStatus === 'idle' && 'Idle'}
                  {wifiStatus === 'waiting' && 'Pending'}
                  {wifiStatus === 'active' && 'Active'}
                  {wifiStatus === 'error' && 'Error'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Device ID */}
            {deviceId && (
              <>
                <View style={styles.settingItem}>
                  <Text style={styles.settingTitle}>Device ID</Text>
                  <Text style={styles.settingValueSmall}>{deviceId.substring(0, 20)}...</Text>
                </View>
                <View style={styles.divider} />
              </>
            )}

            {/* WiFi Network */}
            {wifiName && (
              <>
                <View style={styles.settingItem}>
                  <Text style={styles.settingTitle}>WiFi Network</Text>
                  <Text style={styles.settingValue}>{wifiName}</Text>
                </View>
                <View style={styles.divider} />
              </>
            )}

            {/* Background Monitoring */}
            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Background Monitoring</Text>
                <Text style={styles.settingDescription}>
                  Run speed tests every 5 minutes
                </Text>
              </View>
              <Switch
                value={isWiFiMonitoring}
                onValueChange={handleWiFiToggle}
                trackColor={{ false: '#E2E8F0', true: '#3B82F6' }}
                thumbColor="#FFFFFF"
                disabled={wifiStatus !== 'active'}
              />
            </View>

            <View style={styles.divider} />

            {/* Last Speed Test */}
            {lastSpeedTest && (
              <>
                <View style={styles.settingItem}>
                  <Text style={styles.settingTitle}>Last Speed Test</Text>
                  <Text style={styles.settingValue}>
                    ↓{lastSpeedTest.download.toFixed(1)} Mbps / ↑{lastSpeedTest.upload.toFixed(1)} Mbps
                  </Text>
                </View>
                <View style={styles.divider} />
              </>
            )}

            {/* Manual Speed Test */}
            <View style={styles.settingItem}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Run Speed Test</Text>
                <Text style={styles.settingDescription}>
                  Test your connection speed now
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.syncButton, isSpeedTesting && styles.syncButtonDisabled]}
                onPress={handleSpeedTest}
                disabled={isSpeedTesting}
              >
                <Text style={styles.syncButtonText}>
                  {isSpeedTesting ? 'Testing...' : 'Test Now'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Initialize Button (if not initialized) */}
            {wifiStatus === 'idle' && (
              <>
                <View style={styles.divider} />
                <View style={styles.settingItem}>
                  <View style={styles.settingContent}>
                    <Text style={styles.settingTitle}>Initialize WiFi Monitoring</Text>
                    <Text style={styles.settingDescription}>
                      Register device for speed monitoring
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.syncButton}
                    onPress={handleWiFiInitialize}
                  >
                    <Text style={styles.syncButtonText}>Initialize</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <View style={styles.card}>
            <View style={styles.settingItem}>
              <Text style={styles.settingTitle}>Email</Text>
              <Text style={styles.settingValue}>{user?.email || email || 'N/A'}</Text>
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

        {/* Permissions Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permissions</Text>

          <View style={styles.card}>
            <View style={styles.settingItem}>
              <Text style={styles.settingTitle}>Call Log Access</Text>
              <Text style={[styles.settingValue, permissionsStatus.readCallLog ? styles.permGranted : styles.permDenied]}>
                {permissionsStatus.readCallLog ? '✓ Granted' : '✗ Not Granted'}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.settingItem}>
              <Text style={styles.settingTitle}>Phone State</Text>
              <Text style={[styles.settingValue, permissionsStatus.readPhoneState ? styles.permGranted : styles.permDenied]}>
                {permissionsStatus.readPhoneState ? '✓ Granted' : '✗ Not Granted'}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.settingItem}>
              <Text style={styles.settingTitle}>SMS Access</Text>
              <Text style={[styles.settingValue, permissionsStatus.readSms ? styles.permGranted : styles.permDenied]}>
                {permissionsStatus.readSms ? '✓ Granted' : '✗ Not Granted'}
              </Text>
            </View>

            {(!permissionsStatus.readCallLog || !permissionsStatus.readPhoneState || !permissionsStatus.readSms) && (
              <View style={styles.permWarningContainer}>
                <Text style={styles.permWarningText}>
                  Some permissions are missing. Call log and SMS sync will not work properly.
                </Text>
                <TouchableOpacity style={styles.permButton} onPress={requestPermissions}>
                  <Text style={styles.permButtonText}>Grant Permissions</Text>
                </TouchableOpacity>
              </View>
            )}
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
  successCard: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
    borderWidth: 1,
  },
  errorCard: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
    borderWidth: 1,
  },
  messageText: {
    fontSize: 14,
    textAlign: 'center',
    padding: 12,
  },
  successText: {
    color: '#065F46',
  },
  errorText: {
    color: '#991B1B',
  },
  permGranted: {
    color: '#10B981',
  },
  permDenied: {
    color: '#EF4444',
  },
  permWarningContainer: {
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  permWarningText: {
    fontSize: 14,
    color: '#92400E',
    marginBottom: 12,
  },
  permButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  permButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // WiFi Speed Monitoring styles
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  statusBadgeActive: {
    backgroundColor: '#D1FAE5',
  },
  statusBadgeWaiting: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeError: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  statusBadgeTextActive: {
    color: '#065F46',
  },
  statusBadgeTextWaiting: {
    color: '#92400E',
  },
  statusBadgeTextError: {
    color: '#991B1B',
  },
  settingValueSmall: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '400',
    maxWidth: 150,
  },
});

export default SettingsScreen;