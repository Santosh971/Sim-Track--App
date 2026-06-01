


/**
 * Settings Screen - App settings (Fully Responsive for all screen sizes)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
  PixelRatio,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Feather';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../App';
import { useSync } from '../../context/SyncContext';
import { useWiFi } from '../../context/WiFiContext';
import callAutomationService from '../../services/CallAutomationService';
import { CallConfigResponse } from '../../api/callAutomation.api';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

// ─── Responsive helpers ───────────────────────────────────────────────────────
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Font scale: clamp between small and large phones
const fontScale = PixelRatio.getFontScale();

// Scale a size relative to a 375px baseline (iPhone SE / standard width)
const scale = (size: number) => Math.round((SCREEN_W / 375) * size);

// Scale font but clamp so it never gets too huge on tablets
const fs = (size: number) => {
  const scaled = scale(size) / fontScale;
  return Math.min(scaled, size * 1.4); // never more than 1.4× the design size
};

// Responsive spacing: slightly more room on wider screens
const sp = (size: number) => Math.round(scale(size));

// Is this a small phone? (width < 360, e.g. Galaxy A series, older iPhones)
const isSmall = SCREEN_W < 360;
// Is this a tablet? (width ≥ 600)
const isTablet = SCREEN_W >= 600;
// ─────────────────────────────────────────────────────────────────────────────

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
    isSmsSyncing,
    smsLastSyncTime,
    syncSMS,
    refreshSyncState,
  } = useSync();

  const {
    deviceId,
    wifiName,
    isMonitoring: isWiFiMonitoring,
    lastSpeedTest,
    status: wifiStatus,
    error: wifiError,
    isCurrentWifiRegistered,
    currentWifiSSID,
    initialize: initializeWiFi,
    reinitialize: reinitializeWiFi,
    startMonitoring: startWiFiMonitoring,
    stopMonitoring: stopWiFiMonitoring,
    runSpeedTest,
    validateCurrentWifi,
  } = useWiFi();

  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [smsSyncMessage, setSmsSyncMessage] = useState<string | null>(null);
  const [permissionsStatus, setPermissionsStatus] = useState<{
    readCallLog: boolean;
    readPhoneState: boolean;
    readSms: boolean;
  }>({ readCallLog: false, readPhoneState: false, readSms: false });

  const [isSpeedTesting, setIsSpeedTesting] = useState(false);
  const [wifiCompanyId] = useState('default_company');

  const [callAutomationStatus, setCallAutomationStatus] = useState<{
    isRunning: boolean;
    config: CallConfigResponse | null;
    simPhoneNumber: string;
    simSlotIndex: number;
  } | null>(null);
  const [isRefreshingCallAutomation, setIsRefreshingCallAutomation] = useState(false);
  const [callAutomationMessage, setCallAutomationMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs for timeout IDs to properly clean up
  const syncMessageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const smsSyncMessageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callAutomationMessageTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-dismiss syncMessage after 5 seconds
  useEffect(() => {
    if (syncMessage) {
      // Clear any existing timeout
      if (syncMessageTimeoutRef.current) {
        clearTimeout(syncMessageTimeoutRef.current);
      }
      // Set new timeout
      syncMessageTimeoutRef.current = setTimeout(() => {
        setSyncMessage(null);
      }, 5000);
    }
    return () => {
      if (syncMessageTimeoutRef.current) {
        clearTimeout(syncMessageTimeoutRef.current);
      }
    };
  }, [syncMessage]);

  // Auto-dismiss smsSyncMessage after 5 seconds
  useEffect(() => {
    if (smsSyncMessage) {
      // Clear any existing timeout
      if (smsSyncMessageTimeoutRef.current) {
        clearTimeout(smsSyncMessageTimeoutRef.current);
      }
      // Set new timeout
      smsSyncMessageTimeoutRef.current = setTimeout(() => {
        setSmsSyncMessage(null);
      }, 5000);
    }
    return () => {
      if (smsSyncMessageTimeoutRef.current) {
        clearTimeout(smsSyncMessageTimeoutRef.current);
      }
    };
  }, [smsSyncMessage]);

  // Auto-dismiss callAutomationMessage after 5 seconds
  useEffect(() => {
    if (callAutomationMessage) {
      // Clear any existing timeout
      if (callAutomationMessageTimeoutRef.current) {
        clearTimeout(callAutomationMessageTimeoutRef.current);
      }
      // Set new timeout
      callAutomationMessageTimeoutRef.current = setTimeout(() => {
        setCallAutomationMessage(null);
      }, 5000);
    }
    return () => {
      if (callAutomationMessageTimeoutRef.current) {
        clearTimeout(callAutomationMessageTimeoutRef.current);
      }
    };
  }, [callAutomationMessage]);

  useEffect(() => {
    checkPermissions();
    loadCallAutomationStatus();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadCallAutomationStatus();
    }, 5 * 60 * 1000);
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
    } catch (error) {
      console.error('[Settings] Error checking permissions:', error);
    }
  };

  const loadCallAutomationStatus = async () => {
    try {
      const status = await callAutomationService.getStatus();
      setCallAutomationStatus(status);
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
      await Promise.all([loadCallAutomationStatus(), refreshSyncState()]);
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
      await new Promise<void>(resolve => setTimeout(resolve, 500));
      const status = await CallLogService.checkPermissions();
      setPermissionsStatus({
        readCallLog: status.readCallLog ?? false,
        readPhoneState: status.readPhoneState ?? false,
        readSms: status.readSms ?? false,
      });
      if (status.readCallLog && status.readPhoneState && status.readSms) {
        const { SIMManager } = require('../../services/SIMManager');
        await SIMManager.detectAndMatchSIMs();
        await refreshSyncState();
        Alert.alert('Permissions Granted', 'All permissions have been granted. SIM detection has been updated.', [{ text: 'OK' }]);
      } else {
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
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
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
    try {
      const result = await sync();
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
    try {
      const result = await syncSMS();
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

  const handleWiFiInitialize = async () => {
    await initializeWiFi(wifiCompanyId);
  };

  const handleWiFiReinitialize = async () => {
    Alert.alert(
      'Reinitialize WiFi Monitoring',
      'This will clear the current WiFi configuration and re-register with the server. Use this when you have switched to a new WiFi network. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reinitialize', onPress: async () => { await reinitializeWiFi(wifiCompanyId); } },
      ]
    );
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

  // ─── Section header ─────────────────────────────────────────────────────────
  const SectionTitle = ({ title }: { title: string }) => (
    <Text style={styles.sectionTitle}>{title}</Text>
  );

  // ─── Row: label + optional description on left, control on right ─────────────
  // On very small screens the "control" wraps below the label when content is long
  const SettingRow = ({
    title,
    description,
    right,
    wrap = false,
  }: {
    title: string;
    description?: string;
    right?: React.ReactNode;
    wrap?: boolean;
  }) => (
    <View style={[styles.settingItem, wrap && styles.settingItemWrap]}>
      <View style={[styles.settingContent, wrap && styles.settingContentFull]}>
        <Text style={styles.settingTitle} numberOfLines={2}>{title}</Text>
        {description ? (
          <Text style={styles.settingDescription} numberOfLines={3}>{description}</Text>
        ) : null}
      </View>
      {right ? (
        <View style={wrap ? styles.controlWrap : styles.controlInline}>
          {right}
        </View>
      ) : null}
    </View>
  );

  // ─── Value display on the right ──────────────────────────────────────────────
  const ValueText = ({ text, small = false }: { text: string; small?: boolean }) => (
    <Text
      style={[styles.settingValue, small && styles.settingValueSmall]}
      numberOfLines={2}
      adjustsFontSizeToFit={small}
    >
      {text}
    </Text>
  );

  // ─── Action button (Sync Now / Test Now etc.) ────────────────────────────────
  const ActionButton = ({
    label,
    onPress,
    disabled = false,
    variant = 'primary',
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    variant?: 'primary' | 'amber';
  }) => (
    <TouchableOpacity
      style={[
        styles.actionButton,
        variant === 'amber' && styles.actionButtonAmber,
        disabled && styles.actionButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <Text style={styles.actionButtonText} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );

  // ─── Status badge ─────────────────────────────────────────────────────────────
  const StatusBadge = ({
    label,
    variant = 'default',
  }: {
    label: string;
    variant?: 'default' | 'active' | 'waiting' | 'error';
  }) => (
    <View style={[styles.statusBadge, styles[`statusBadge_${variant}` as keyof typeof styles]]}>
      <Text
        style={[styles.statusBadgeText, styles[`statusBadgeText_${variant}` as keyof typeof styles]]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );

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

        {/* ── Sync Settings ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionTitle title="Sync Settings" />
          <View style={styles.card}>
            <SettingRow
              title="Auto Sync"
              description="Automatically sync call logs"
              right={
                <Switch
                  value={autoSyncEnabled}
                  onValueChange={handleAutoSyncToggle}
                  trackColor={{ false: '#E2E8F0', true: '#3B82F6' }}
                  thumbColor="#FFFFFF"
                />
              }
            />
            <View style={styles.divider} />
            <SettingRow
              title="Manual Sync"
              description="Sync call logs now"
              wrap={isSmall}
              right={
                <ActionButton
                  label={isSyncing ? 'Syncing...' : 'Sync Now'}
                  onPress={handleManualSync}
                  disabled={isSyncing}
                />
              }
            />
          </View>
        </View>

        {/* ── Sync Result ───────────────────────────────────────────────────── */}
        {syncMessage && (
          <View style={styles.section}>
            <View style={[
              styles.card,
              syncMessage.startsWith('✓') ? styles.successCard : styles.errorCard,
              styles.messageCard,
            ]}>
              <Text style={[
                styles.messageText,
                syncMessage.startsWith('✓') ? styles.successText : styles.errorText,
                styles.messageTextWithClose,
              ]}>
                {syncMessage}
              </Text>
              <TouchableOpacity
                onPress={() => setSyncMessage(null)}
                style={styles.closeButton}
              >
                <Icon name="x" size={18} color={syncMessage.startsWith('✓') ? '#16a34a' : '#dc2626'} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Sync Status ───────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionTitle title="Sync Status" />
          <View style={styles.card}>
            <SettingRow
              title="Last Sync"
              right={<ValueText text={lastSyncTime || 'Never'} />}
            />
            <View style={styles.divider} />
            <SettingRow
              title="Matched SIMs"
              right={<ValueText text={String(matchedSIMs)} />}
            />
          </View>
        </View>

        {/* ── SMS Sync ──────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionTitle title="SMS Sync" />
          <View style={styles.card}>
            <SettingRow
              title="Manual SMS Sync"
              description="Sync SMS messages now"
              wrap={isSmall}
              right={
                <ActionButton
                  label={isSmsSyncing ? 'Syncing...' : 'Sync SMS'}
                  onPress={handleManualSmsSync}
                  disabled={isSmsSyncing}
                />
              }
            />
          </View>
        </View>

        {/* ── SMS Sync Result ───────────────────────────────────────────────── */}
        {smsSyncMessage && (
          <View style={styles.section}>
            <View style={[
              styles.card,
              smsSyncMessage.startsWith('✓') ? styles.successCard : styles.errorCard,
              styles.messageCard,
            ]}>
              <Text style={[
                styles.messageText,
                smsSyncMessage.startsWith('✓') ? styles.successText : styles.errorText,
                styles.messageTextWithClose,
              ]}>
                {smsSyncMessage}
              </Text>
              <TouchableOpacity
                onPress={() => setSmsSyncMessage(null)}
                style={styles.closeButton}
              >
                <Icon name="x" size={18} color={smsSyncMessage.startsWith('✓') ? '#16a34a' : '#dc2626'} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Call Automation ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionTitle title="Call Automation" />
          <View style={styles.card}>
            {/* Status row */}
            <SettingRow
              title="Status"
              description={
                (callAutomationStatus?.isRunning ? 'Active' : 'Inactive') +
                (callAutomationStatus?.config?.role === 'CALLER' ? ' (Caller)' :
                 callAutomationStatus?.config?.role === 'RECEIVER' ? ' (Receiver)' : '')
              }
              right={
                <StatusBadge
                  label={callAutomationStatus?.isRunning ? 'Active' : 'Inactive'}
                  variant={callAutomationStatus?.isRunning ? 'active' : 'default'}
                />
              }
            />

            <View style={styles.divider} />

            {/* Caller SIM */}
            {callAutomationStatus?.simPhoneNumber && (
              <>
                <SettingRow
                  title="Caller SIM"
                  right={<ValueText text={callAutomationStatus.simPhoneNumber} />}
                />
                <View style={styles.divider} />
              </>
            )}

            {/* Config details */}
            {callAutomationStatus?.config && (
              <>
                <SettingRow
                  title="Call Duration"
                  right={<ValueText text={`${callAutomationStatus.config.callDuration} seconds`} />}
                />
                <View style={styles.divider} />

                <SettingRow
                  title="Frequency"
                  right={
                    <ValueText
                      text={
                        callAutomationStatus.config.frequency === 'hourly'
                          ? 'Every Hour'
                          : callAutomationStatus.config.frequency === 'daily'
                          ? `Daily at ${callAutomationStatus.config.scheduledTime}`
                          : `Weekly (${callAutomationStatus.config.scheduledDay}) at ${callAutomationStatus.config.scheduledTime}`
                      }
                      small
                    />
                  }
                />
                <View style={styles.divider} />

                <SettingRow
                  title="Target SIMs"
                  right={<ValueText text={`${callAutomationStatus.config.targets?.length || 0} SIMs`} />}
                />
                <View style={styles.divider} />
              </>
            )}

            {/* Refresh config */}
            <SettingRow
              title="Refresh Config"
              description="Fetch latest settings from server"
              wrap={isSmall}
              right={
                <ActionButton
                  label={isRefreshingCallAutomation ? 'Refreshing...' : 'Refresh'}
                  onPress={handleRefreshCallAutomation}
                  disabled={isRefreshingCallAutomation}
                />
              }
            />

            {/* Status message */}
            {callAutomationMessage && (
              <View style={[styles.statusMessageContainer, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                <Text style={[
                  styles.settingDescription,
                  callAutomationMessage.includes('Error') ? styles.permDenied : styles.permGranted,
                  { flex: 1 },
                ]}>
                  {callAutomationMessage}
                </Text>
                <TouchableOpacity
                  onPress={() => setCallAutomationMessage(null)}
                  style={styles.closeButton}
                >
                  <Icon name="x" size={16} color={callAutomationMessage.includes('Error') ? '#EF4444' : '#10B981'} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* ── WiFi Speed Monitoring ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionTitle title="WiFi Speed Monitoring" />
          <View style={styles.card}>
            {/* Status */}
            {/* <SettingRow
              title="Status"
              description={
                wifiStatus === 'idle' ? 'Not initialized' :
                wifiStatus === 'waiting' ? 'Waiting for approval...' :
                wifiStatus === 'active' ? 'Active' :
                wifiError || 'Error'
              }
              right={
                <StatusBadge
                  label={
                    wifiStatus === 'idle' ? 'Idle' :
                    wifiStatus === 'waiting' ? 'Pending' :
                    wifiStatus === 'active' ? 'Active' : 'Error'
                  }
                  variant={
                    wifiStatus === 'active' ? 'active' :
                    wifiStatus === 'waiting' ? 'waiting' :
                    wifiStatus === 'error' ? 'error' : 'default'
                  }
                />
              }
            /> */}

            <View style={styles.divider} />

            {/* Device ID */}
            {/* {deviceId && (
              <>
                <SettingRow
                  title="Device ID"
                  right={<ValueText text={`${deviceId.substring(0, isSmall ? 12 : 20)}...`} small />}
                />
                <View style={styles.divider} />
              </>
            )} */}

            {/* WiFi Network */}
            {/* {wifiName && (
              <>
                <SettingRow
                  title="Registered Network"
                  right={<ValueText text={wifiName} />}
                />
                <View style={styles.divider} />
              </>
            )} */}

            {/* Current WiFi */}
            {wifiStatus === 'active' && (
              <>
                <SettingRow
                  title="Current WiFi"
                  description={currentWifiSSID || 'Not connected'}
                  right={
                    <StatusBadge
                      label={
                        isCurrentWifiRegistered === true ? 'Active' :
                        isCurrentWifiRegistered === false ? 'Not Registered' : 'Unknown'
                      }
                      variant={
                        isCurrentWifiRegistered === true ? 'active' :
                        isCurrentWifiRegistered === false ? 'waiting' : 'default'
                      }
                    />
                  }
                />
                <View style={styles.divider} />
                {/* Show warning if current WiFi is not registered */}
                {isCurrentWifiRegistered === false && currentWifiSSID && (
                  <>
                    <View style={styles.warningCard}>
                      <Text style={styles.warningText}>
                        ⚠️ "{currentWifiSSID}" is not in your registered WiFi list.
                        Speed tests will only work on registered networks.
                        Contact your admin to add this WiFi.
                      </Text>
                    </View>
                    <View style={styles.divider} />
                  </>
                )}
              </>
            )}

            {/* Background Monitoring toggle */}
            <SettingRow
              title="Background Monitoring"
              right={
                <Switch
                  value={isWiFiMonitoring}
                  onValueChange={handleWiFiToggle}
                  trackColor={{ false: '#E2E8F0', true: '#3B82F6' }}
                  thumbColor="#FFFFFF"
                  disabled={wifiStatus !== 'active'}
                />
              }
            />

            <View style={styles.divider} />

            {/* Last Speed Test */}
            {lastSpeedTest && (
              <>
                <SettingRow
                  title="Last Speed Test"
                  right={
                    <ValueText
                      text={`↓${lastSpeedTest.download.toFixed(1)} / ↑${lastSpeedTest.upload.toFixed(1)} Mbps`}
                      small
                    />
                  }
                />
                <View style={styles.divider} />
              </>
            )}

            {/* Manual Speed Test */}
            <SettingRow
              title="Run Speed Test"
              description="Test your connection speed now"
              wrap={isSmall}
              right={
                <ActionButton
                  label={isSpeedTesting ? 'Testing...' : 'Test Now'}
                  onPress={handleSpeedTest}
                  disabled={isSpeedTesting}
                />
              }
            />

            {/* Initialize */}
            {wifiStatus === 'idle' && (
              <>
                <View style={styles.divider} />
                <SettingRow
                  title="Initialize WiFi Monitoring"
                  description="Register device for speed monitoring"
                  wrap={isSmall}
                  right={
                    <ActionButton
                      label="Initialize"
                      onPress={handleWiFiInitialize}
                    />
                  }
                />
              </>
            )}

            {/* Reinitialize */}
            {wifiStatus !== 'idle' && (
              <>
                <View style={styles.divider} />
                <SettingRow
                  title="Reinitialize WiFi"
                  description="Re-register device for speed monitoring"
                  wrap={isSmall}
                  right={
                    <ActionButton
                      label="Reinitialize"
                      onPress={handleWiFiReinitialize}
                      variant="amber"
                    />
                  }
                />
              </>
            )}
          </View>
        </View>

        {/* ── Account ───────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionTitle title="Account" />
          <View style={styles.card}>
            <SettingRow
              title="Email ID"
              right={<ValueText text={user?.email || email || 'N/A'} small />}
            />
            <View style={styles.divider} />
            <SettingRow
              title="Name"
              right={<ValueText text={user?.name || 'N/A'} />}
            />
            <View style={styles.divider} />
            <SettingRow
              title="Contact Number"
              right={<ValueText text={user?.mobileNumber || 'N/A'} />}
            />
            <View style={styles.divider} />
            <SettingRow
              title="Role"
              right={<ValueText text={user?.role || 'user'} />}
            />
          </View>
        </View>

        {/* ── About ─────────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionTitle title="About" />
          <View style={styles.card}>
            <SettingRow
              title="App Version"
              right={<ValueText text="1.0.0" />}
            />
          </View>
        </View>

        {/* ── Permissions ───────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionTitle title="Permissions" />
          <View style={styles.card}>
            <SettingRow
              title="Call Log Access"
              right={
                <Text style={[
                  styles.settingValue,
                  permissionsStatus.readCallLog ? styles.permGranted : styles.permDenied,
                ]}>
                  {permissionsStatus.readCallLog ? '✓ Granted' : '✗ Denied'}
                </Text>
              }
            />
            <View style={styles.divider} />
            <SettingRow
              title="Phone State"
              right={
                <Text style={[
                  styles.settingValue,
                  permissionsStatus.readPhoneState ? styles.permGranted : styles.permDenied,
                ]}>
                  {permissionsStatus.readPhoneState ? '✓ Granted' : '✗ Denied'}
                </Text>
              }
            />
            <View style={styles.divider} />
            <SettingRow
              title="SMS Access"
              right={
                <Text style={[
                  styles.settingValue,
                  permissionsStatus.readSms ? styles.permGranted : styles.permDenied,
                ]}>
                  {permissionsStatus.readSms ? '✓ Granted' : '✗ Denied'}
                </Text>
              }
            />

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

        {/* ── Logout ────────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles (all sizes derived from responsive helpers) ──────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: sp(16),
    paddingBottom: sp(40),
  },

  // ─ Section ────────────────────────────────────────────────────────────────
  section: {
    marginBottom: sp(20),
  },
  sectionTitle: {
    fontSize: fs(13),
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: sp(8),
    marginLeft: sp(4),
  },

  // ─ Card ───────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: sp(12),
    overflow: 'hidden',
    // Shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  // ─ Setting row ────────────────────────────────────────────────────────────
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp(16),
    paddingVertical: sp(13),
    minHeight: sp(52),
  },
  // Wrap variant: stack vertically on very small screens
  settingItemWrap: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  settingContent: {
    flex: 1,
    marginRight: sp(12),
  },
  settingContentFull: {
    flex: 0,
    marginRight: 0,
    width: '100%',
    marginBottom: sp(10),
  },
  settingTitle: {
    fontSize: fs(15),
    fontWeight: '500',
    color: '#1E293B',
    lineHeight: fs(21),
  },
  settingDescription: {
    fontSize: fs(13),
    color: '#64748B',
    marginTop: sp(2),
    lineHeight: fs(18),
  },
  settingValue: {
    fontSize: fs(14),
    color: '#64748B',
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
    maxWidth: isTablet ? 280 : isSmall ? 130 : 180,
  },
  settingValueSmall: {
    fontSize: fs(12),
    maxWidth: isTablet ? 260 : isSmall ? 110 : 160,
  },

  // control wrappers
  controlInline: {
    flexShrink: 0,
  },
  controlWrap: {
    width: '100%',
    alignItems: 'flex-start',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginHorizontal: sp(16),
  },

  // ─ Action button ──────────────────────────────────────────────────────────
  actionButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: sp(isSmall ? 10 : 14),
    paddingVertical: sp(8),
    borderRadius: sp(8),
    minWidth: sp(isSmall ? 80 : 90),
    alignItems: 'center',
  },
  actionButtonAmber: {
    backgroundColor: '#F59E0B',
  },
  actionButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: fs(13),
    fontWeight: '600',
  },

  // ─ Status badge ───────────────────────────────────────────────────────────
  statusBadge: {
    paddingHorizontal: sp(10),
    paddingVertical: sp(4),
    borderRadius: sp(20),
    backgroundColor: '#E2E8F0',
  },
  // variant overrides via dynamic key lookup
  statusBadge_default: {
    backgroundColor: '#E2E8F0',
  },
  statusBadge_active: {
    backgroundColor: '#D1FAE5',
  },
  statusBadge_waiting: {
    backgroundColor: '#FEF3C7',
  },
  statusBadge_error: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: fs(12),
    fontWeight: '600',
    color: '#64748B',
  },
  statusBadgeText_default: {
    color: '#64748B',
  },
  statusBadgeText_active: {
    color: '#065F46',
  },
  statusBadgeText_waiting: {
    color: '#92400E',
  },
  statusBadgeText_error: {
    color: '#991B1B',
  },

  // ─ Message cards ──────────────────────────────────────────────────────────
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
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messageText: {
    fontSize: fs(14),
    textAlign: 'left',
    lineHeight: fs(20),
    flex: 1,
  },
  messageTextWithClose: {
    paddingRight: sp(8),
  },
  successText: {
    color: '#065F46',
  },
  errorText: {
    color: '#991B1B',
  },
  closeButton: {
    padding: sp(8),
    marginLeft: sp(8),
  },

  // ─ Automation status message ──────────────────────────────────────────────
  statusMessageContainer: {
    paddingHorizontal: sp(16),
    paddingBottom: sp(14),
  },

  // ─ Warning Card (for unregistered WiFi) ─────────────────────────────────────
  warningCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: sp(8),
    padding: sp(12),
    marginHorizontal: sp(0),
  },
  warningText: {
    fontSize: fs(12),
    color: '#92400E',
    lineHeight: fs(18),
  },

  // ─ Permissions ────────────────────────────────────────────────────────────
  permGranted: {
    color: '#10B981',
  },
  permDenied: {
    color: '#EF4444',
  },
  permWarningContainer: {
    padding: sp(16),
    backgroundColor: '#FEF3C7',
  },
  permWarningText: {
    fontSize: fs(13),
    color: '#92400E',
    marginBottom: sp(12),
    lineHeight: fs(19),
  },
  permButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: sp(10),
    paddingHorizontal: sp(16),
    borderRadius: sp(8),
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  permButtonText: {
    color: '#FFFFFF',
    fontSize: fs(14),
    fontWeight: '600',
  },

  // ─ Logout ─────────────────────────────────────────────────────────────────
  logoutButton: {
    backgroundColor: '#EF4444',
    borderRadius: sp(12),
    paddingVertical: sp(15),
    alignItems: 'center',
    marginTop: sp(8),
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: fs(16),
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // interval styles (kept for any future use)
  intervalOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: sp(12),
    gap: sp(8),
  },
  intervalButton: {
    paddingHorizontal: sp(14),
    paddingVertical: sp(8),
    borderRadius: sp(8),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  intervalButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  intervalButtonText: {
    fontSize: fs(13),
    color: '#64748B',
    fontWeight: '500',
  },
  intervalButtonTextActive: {
    color: '#FFFFFF',
  },
});

export default SettingsScreen;