/**
 * Call Logs Screen - View synced call history
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import COLORS from '../../constants/colors';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/spacing';
import { CallLogService } from '../../services/CallLogService';
import { DeviceCallLog } from '../../models/CallLog';

type CallType = 'all' | 'incoming' | 'outgoing' | 'missed';

interface CallLogCounts {
  total: number;
  incoming: number;
  outgoing: number;
  missed: number;
}

const CallLogsScreen: React.FC = () => {
  const [callLogs, setCallLogs] = useState<DeviceCallLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<DeviceCallLog[]>([]);
  const [counts, setCounts] = useState<CallLogCounts>({ total: 0, incoming: 0, outgoing: 0, missed: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<CallType>('all');

  // Refresh data when screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadCounts();
      loadCallLogs();
    }, [])
  );

  useEffect(() => {
    filterLogs();
  }, [activeFilter, callLogs]);

  const loadCounts = async () => {
    try {
      const callCounts = await CallLogService.getCallLogCounts();
      setCounts(callCounts);
    } catch (error) {
      console.error('[CallLogsScreen] Error loading call log counts:', error);
    }
  };

  const loadCallLogs = async () => {
    try {
      const logs = await CallLogService.getCallLogs();
      setCallLogs(logs);
    } catch (error) {
      console.error('[CallLogsScreen] Error loading call logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    if (activeFilter === 'all') {
      setFilteredLogs(callLogs);
    } else {
      setFilteredLogs(callLogs.filter(log => log.callType === activeFilter));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadCounts(), loadCallLogs()]);
    setRefreshing(false);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (isYesterday) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString() + ', ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getCallTypeIcon = (type: string): string => {
    switch (type) {
      case 'incoming': return '📞';
      case 'outgoing': return '📱';
      case 'missed': return '📵';
      default: return '📞';
    }
  };

  const getCallTypeColor = (type: string): string => {
    switch (type) {
      case 'incoming': return COLORS.success;
      case 'outgoing': return COLORS.primary;
      case 'missed': return COLORS.error;
      default: return COLORS.textLight;
    }
  };

  const filters: CallType[] = ['all', 'incoming', 'outgoing', 'missed'];

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
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {filters.map(filter => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterTab,
              activeFilter === filter && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === filter && styles.filterTabTextActive,
              ]}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Call Logs List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats Summary */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{counts.total}</Text>
            <Text style={styles.statLabel}>Total Calls</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {counts.incoming}
            </Text>
            <Text style={styles.statLabel}>Incoming</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {counts.outgoing}
            </Text>
            <Text style={styles.statLabel}>Outgoing</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: COLORS.error }]}>
              {counts.missed}
            </Text>
            <Text style={styles.statLabel}>Missed</Text>
          </View>
        </View>

        {/* Call List */}
        {filteredLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📞</Text>
            <Text style={styles.emptyText}>No call logs found</Text>
            <Text style={styles.emptySubtext}>
              {activeFilter !== 'all'
                ? `No ${activeFilter} calls to display`
                : 'Call logs will appear here after sync'}
            </Text>
          </View>
        ) : (
          filteredLogs.map((log, index) => (
            <View key={log.callId || index} style={styles.callItem}>
              <View style={styles.callIconContainer}>
                <Text style={styles.callIcon}>{getCallTypeIcon(log.callType)}</Text>
              </View>
              <View style={styles.callInfo}>
                <Text style={styles.callNumber}>
                  {log.contactName || log.phoneNumber}
                </Text>
                <Text style={styles.callTime}>{formatTimestamp(new Date(log.timestamp).toISOString())}</Text>
              </View>
              <View style={styles.callDetails}>
                <Text style={[styles.callType, { color: getCallTypeColor(log.callType) }]}>
                  {log.callType}
                </Text>
                {log.duration > 0 && (
                  <Text style={styles.callDuration}>{formatDuration(log.duration)}</Text>
                )}
              </View>
            </View>
          ))
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterTab: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: COLORS.textWhite,
    fontWeight: '600',
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: FONT_SIZE['2xl'],
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  callIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  callIcon: {
    fontSize: FONT_SIZE.xl,
  },
  callInfo: {
    flex: 1,
  },
  callNumber: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  callTime: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
  callDetails: {
    alignItems: 'flex-end',
  },
  callType: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  callDuration: {
    fontSize: FONT_SIZE.xs,
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
    textAlign: 'center',
  },
});

export default CallLogsScreen;