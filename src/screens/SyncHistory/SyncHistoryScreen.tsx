/**
 * Sync History Screen - View synchronization history
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import COLORS from '../../constants/colors';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/spacing';
import { StorageService } from '../../services/StorageService';
import BackgroundSync from '../../native/BackgroundSyncModule';

interface SyncEvent {
  id: string;
  type: 'call_log' | 'sms' | 'wifi_speed';
  timestamp: number;
  status: 'success' | 'failed' | 'partial';
  recordsSynced?: number;
  message?: string;
}

const SyncHistoryScreen: React.FC = () => {
  const [history, setHistory] = useState<SyncEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      // Get last sync time from native module
      const lastSync = await BackgroundSync.getLastSyncTime();
      setLastSyncTime(lastSync);

      // Get last WiFi speed test time
      const lastWiFiTest = await BackgroundSync.getLastWiFiSpeedTest();

      // Build mock history for now (would come from API in production)
      const events: SyncEvent[] = [];

      if (lastSync > 0) {
        events.push({
          id: '1',
          type: 'call_log',
          timestamp: lastSync,
          status: 'success',
          recordsSynced: 10,
        });
      }

      if (lastWiFiTest > 0) {
        events.push({
          id: '2',
          type: 'wifi_speed',
          timestamp: lastWiFiTest,
          status: 'success',
        });
      }

      // Sort by timestamp descending
      events.sort((a, b) => b.timestamp - a.timestamp);
      setHistory(events);
    } catch (error) {
      console.error('[SyncHistoryScreen] Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'call_log': return '📞';
      case 'sms': return '💬';
      case 'wifi_speed': return '📶';
      default: return '📊';
    }
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'call_log': return 'Call Log Sync';
      case 'sms': return 'SMS Sync';
      case 'wifi_speed': return 'WiFi Speed Test';
      default: return 'Unknown';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'success': return COLORS.success;
      case 'failed': return COLORS.error;
      case 'partial': return COLORS.warning;
      default: return COLORS.textLight;
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'success': return '✓';
      case 'failed': return '✗';
      case 'partial': return '⚠';
      default: return '○';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Sync Summary</Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>
                {history.filter(h => h.status === 'success').length}
              </Text>
              <Text style={styles.summaryLabel}>Successful</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNumber, { color: COLORS.error }]}>
                {history.filter(h => h.status === 'failed').length}
              </Text>
              <Text style={styles.summaryLabel}>Failed</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNumber, { color: COLORS.warning }]}>
                {history.filter(h => h.status === 'partial').length}
              </Text>
              <Text style={styles.summaryLabel}>Partial</Text>
            </View>
          </View>
        </View>

        {/* Timeline */}
        <Text style={styles.sectionTitle}>Sync Timeline</Text>

        {history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No sync history yet</Text>
            <Text style={styles.emptySubtext}>
              Sync events will appear here
            </Text>
          </View>
        ) : (
          history.map((event, index) => (
            <View key={event.id} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View style={[
                  styles.timelineIcon,
                  { backgroundColor: getStatusColor(event.status) + '20' }
                ]}>
                  <Text style={styles.timelineIconText}>{getTypeIcon(event.type)}</Text>
                </View>
                {index < history.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <View style={styles.timelineContent}>
                <View style={styles.timelineHeader}>
                  <Text style={styles.timelineTitle}>{getTypeLabel(event.type)}</Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(event.status) + '20' }
                  ]}>
                    <Text style={[
                      styles.statusBadgeText,
                      { color: getStatusColor(event.status) }
                    ]}>
                      {getStatusIcon(event.status)} {event.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.timelineTime}>{formatTimestamp(event.timestamp)}</Text>
                {event.recordsSynced !== undefined && (
                  <Text style={styles.timelineDetails}>
                    {event.recordsSynced} records synced
                  </Text>
                )}
              </View>
            </View>
          ))
        )}

        {/* Last Sync Info */}
        {lastSyncTime > 0 && (
          <View style={styles.lastSyncCard}>
            <Text style={styles.lastSyncLabel}>Last Full Sync</Text>
            <Text style={styles.lastSyncTime}>
              {formatTimestamp(lastSyncTime)}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  summaryTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: FONT_SIZE['3xl'],
    fontWeight: 'bold',
    color: COLORS.success,
  },
  summaryLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineIconText: {
    fontSize: FONT_SIZE.lg,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    marginTop: SPACING.sm,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  timelineTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  timelineTime: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
  },
  timelineDetails: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING['5xl'],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.lg,
  },
  emptyText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textLight,
  },
  lastSyncCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  lastSyncLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    marginBottom: SPACING.xs,
  },
  lastSyncTime: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
});

export default SyncHistoryScreen;