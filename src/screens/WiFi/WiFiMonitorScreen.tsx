/**
 * WiFi Monitor Screen - WiFi speed test dashboard
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWiFi } from '../../context/WiFiContext';
import COLORS from '../../constants/colors';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/spacing';
import { SpeedTestResult } from '../../models/WiFi';

const WiFiMonitorScreen: React.FC = () => {
  const {
    isActive,
    wifiName,
    lastSpeedTest,
    status,
    error: contextError,
    runSpeedTest,
    startMonitoring,
    stopMonitoring,
    isMonitoring,
  } = useWiFi();

  const [testing, setTesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const handleSpeedTest = async () => {
    setTesting(true);
    setTestError(null);
    try {
      await runSpeedTest();
    } catch (err: any) {
      console.error('[WiFiMonitorScreen] Speed test error:', err);
      setTestError(err.message || 'Speed test failed');
      Alert.alert(
        'Speed Test Failed',
        err.message || 'Failed to run speed test. Please check your WiFi connection.',
        [{ text: 'OK' }]
      );
    } finally {
      setTesting(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setTestError(null);
    // Refresh WiFi status
    setRefreshing(false);
  };

  const formatSpeed = (speed: number): string => {
    if (speed === 0) return '0';
    return speed.toFixed(2);
  };

  const getStatusColor = (): string => {
    switch (status) {
      case 'active':
        return COLORS.success;
      case 'error':
        return COLORS.error;
      case 'waiting':
        return COLORS.warning;
      default:
        return COLORS.textLight;
    }
  };

  const getSpeedQuality = (speed: number): { label: string; color: string } => {
    if (speed === 0) return { label: 'Not Tested', color: COLORS.textLight };
    if (speed < 10) return { label: 'Poor', color: COLORS.error };
    if (speed < 30) return { label: 'Fair', color: COLORS.warning };
    if (speed < 50) return { label: 'Good', color: COLORS.info };
    return { label: 'Excellent', color: COLORS.success };
  };

  const speedQuality = lastSpeedTest ? getSpeedQuality(lastSpeedTest.download) : getSpeedQuality(0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* WiFi Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusIcon}>
              <Text style={styles.statusIconText}>📶</Text>
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.wifiName}>{wifiName || 'Not Connected'}</Text>
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                <Text style={[styles.statusText, { color: getStatusColor() }]}>
                  {isActive ? 'Connected' : 'Disconnected'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Error Display */}
        {(contextError || testError) && (
          <View style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{contextError || testError}</Text>
          </View>
        )}

        {/* Speed Test Card */}
        <View style={styles.speedCard}>
          <Text style={styles.cardTitle}>Last Speed Test</Text>

          {lastSpeedTest ? (
            <>
              {/* Download Speed */}
              <View style={styles.speedItem}>
                <Text style={styles.speedLabel}>Download</Text>
                <View style={styles.speedValueContainer}>
                  <Text style={styles.speedValue}>{formatSpeed(lastSpeedTest.download)}</Text>
                  <Text style={styles.speedUnit}>Mbps</Text>
                </View>
              </View>

              {/* Upload Speed */}
              <View style={styles.speedItem}>
                <Text style={styles.speedLabel}>Upload</Text>
                <View style={styles.speedValueContainer}>
                  <Text style={styles.speedValue}>{formatSpeed(lastSpeedTest.upload)}</Text>
                  <Text style={styles.speedUnit}>Mbps</Text>
                </View>
              </View>

              {/* Latency */}
              <View style={styles.speedItem}>
                <Text style={styles.speedLabel}>Latency</Text>
                <View style={styles.speedValueContainer}>
                  <Text style={styles.speedValue}>{lastSpeedTest.latency.toFixed(0)}</Text>
                  <Text style={styles.speedUnit}>ms</Text>
                </View>
              </View>

              {/* Quality Badge */}
              <View style={styles.qualityContainer}>
                <View style={[styles.qualityBadge, { backgroundColor: speedQuality.color + '20' }]}>
                  <Text style={[styles.qualityText, { color: speedQuality.color }]}>
                    {speedQuality.label}
                  </Text>
                </View>
              </View>

              {/* Timestamp */}
              <Text style={styles.timestamp}>
                Tested: {new Date(lastSpeedTest.timestamp).toLocaleString()}
              </Text>
            </>
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataIcon}>📊</Text>
              <Text style={styles.noDataText}>No speed test data yet</Text>
              <Text style={styles.noDataSubtext}>Run a speed test to see results</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.testButton, testing && styles.buttonDisabled]}
            onPress={handleSpeedTest}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator color={COLORS.textWhite} />
            ) : (
              <Text style={styles.testButtonText}>🚀 Run Speed Test</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.monitorButton,
              isMonitoring ? styles.monitorButtonActive : {}
            ]}
            onPress={isMonitoring ? stopMonitoring : startMonitoring}
          >
            <Text style={styles.monitorButtonText}>
              {isMonitoring ? '⏸️ Stop Monitoring' : '▶️ Start Monitoring'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Monitoring Status */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Monitoring Status</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={[styles.infoValue, { color: getStatusColor() }]}>
              {status.toUpperCase()}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Background Monitoring</Text>
            <Text style={[
              styles.infoValue,
              { color: isMonitoring ? COLORS.success : COLORS.textLight }
            ]}>
              {isMonitoring ? 'Active' : 'Inactive'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Device Authenticated</Text>
            <Text style={[
              styles.infoValue,
              { color: isActive ? COLORS.success : COLORS.warning }
            ]}>
              {isActive ? 'Yes' : 'No'}
            </Text>
          </View>
        </View>

        {/* Speed History (placeholder) */}
        <View style={styles.historyCard}>
          <Text style={styles.cardTitle}>Speed History</Text>
          <View style={styles.historyPlaceholder}>
            <Text style={styles.historyPlaceholderText}>
              📈 Speed history chart will be displayed here
            </Text>
          </View>
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
    padding: SPACING.lg,
  },
  statusCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.lg,
  },
  statusIconText: {
    fontSize: 28,
  },
  statusInfo: {
    flex: 1,
  },
  wifiName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.sm,
  },
  statusText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  speedCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  cardTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  speedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  speedLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textLight,
  },
  speedValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  speedValue: {
    fontSize: FONT_SIZE['2xl'],
    fontWeight: 'bold',
    color: COLORS.text,
  },
  speedUnit: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    marginLeft: SPACING.sm,
  },
  qualityContainer: {
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  qualityBadge: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  qualityText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: SPACING['3xl'],
  },
  noDataIcon: {
    fontSize: 48,
    marginBottom: SPACING.lg,
  },
  noDataText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  noDataSubtext: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textLight,
  },
  actionContainer: {
    marginBottom: SPACING.lg,
  },
  testButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  testButtonText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.textWhite,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  monitorButton: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  monitorButtonActive: {
    backgroundColor: COLORS.primary + '20',
  },
  monitorButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.primary,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  infoLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textLight,
  },
  infoValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  historyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  historyPlaceholder: {
    height: 120,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyPlaceholderText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: COLORS.error + '15',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.error + '30',
  },
  errorIcon: {
    fontSize: 24,
    marginRight: SPACING.md,
  },
  errorText: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.error,
  },
});

export default WiFiMonitorScreen;