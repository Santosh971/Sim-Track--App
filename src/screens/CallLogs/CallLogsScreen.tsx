/**
 * Call Logs Screen - View synced call history
 * With infinite scroll for better performance
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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

const BATCH_SIZE = 20; // Number of items to load per batch

const CallLogsScreen: React.FC = () => {
  const [allCallLogs, setAllCallLogs] = useState<DeviceCallLog[]>([]);
  const [displayedLogs, setDisplayedLogs] = useState<DeviceCallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState<CallType>('all');
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [nativeCounts, setNativeCounts] = useState<CallLogCounts>({ total: 0, incoming: 0, outgoing: 0, missed: 0 });

  // Use native counts directly from database (more accurate, no 500 limit)
  const calculatedCounts: CallLogCounts = nativeCounts;

  // Filter logs based on active filter
  const filteredLogs = useMemo(() => {
    if (activeFilter === 'all') {
      return allCallLogs;
    }
    return allCallLogs.filter(log => log.callType === activeFilter);
  }, [allCallLogs, activeFilter]);

  // Load call logs function
  const loadCallLogs = useCallback(async () => {
    try {

      // Load both logs and counts in parallel
      const [logs, counts] = await Promise.all([
        CallLogService.getCallLogs(),
        CallLogService.getCallLogCounts(),
      ]);


      // Log each log's callType for debugging
      if (logs && logs.length > 0) {
        const typeBreakdown = {
          incoming: logs.filter(l => l.callType === 'incoming').length,
          outgoing: logs.filter(l => l.callType === 'outgoing').length,
          missed: logs.filter(l => l.callType === 'missed').length,
          unknown: logs.filter(l => !['incoming', 'outgoing', 'missed'].includes(l.callType)).length,
        };
        console.log('[CallLogsScreen] Call type breakdown from loaded logs:', typeBreakdown);
      }

      setAllCallLogs(logs || []);
      setNativeCounts(counts);
    } catch (error) {
      console.error('[CallLogsScreen] Error loading call logs:', error);
      setAllCallLogs([]);
      setNativeCounts({ total: 0, incoming: 0, outgoing: 0, missed: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh data when screen gains focus
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadCallLogs();
    }, [loadCallLogs])
  );

  // Update displayed logs when filteredLogs changes
  useEffect(() => {
    const endIndex = (currentPage + 1) * BATCH_SIZE;
    const batch = filteredLogs.slice(0, endIndex);
    setDisplayedLogs(batch);
    setHasMore(endIndex < filteredLogs.length);
  }, [filteredLogs, currentPage]);

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(0);
  }, [activeFilter]);

  // Load more logs when scrolling
  const loadMoreLogs = useCallback(() => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);

    setTimeout(() => {
      setCurrentPage(prev => prev + 1);
      setLoadingMore(false);
    }, 100);
  }, [loadingMore, hasMore]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCurrentPage(0);
    setHasMore(true);
    await loadCallLogs();
    setRefreshing(false);
  }, [loadCallLogs]);

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

  const renderCallItem = ({ item, index }: { item: DeviceCallLog; index: number }) => (
    <View key={item.callId || index} style={styles.callItem}>
      <View style={styles.callIconContainer}>
        <Text style={styles.callIcon}>{getCallTypeIcon(item.callType)}</Text>
      </View>
      <View style={styles.callInfo}>
        <Text style={styles.callNumber}>
          {item.contactName || item.phoneNumber}
        </Text>
        <Text style={styles.callTime}>{formatTimestamp(new Date(item.timestamp).toISOString())}</Text>
      </View>
      <View style={styles.callDetails}>
        <Text style={[styles.callType, { color: getCallTypeColor(item.callType) }]}>
          {item.callType}
        </Text>
        {item.duration > 0 && (
          <Text style={styles.callDuration}>{formatDuration(item.duration)}</Text>
        )}
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.footerText}>Loading more calls...</Text>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📞</Text>
      <Text style={styles.emptyText}>No call logs found</Text>
      <Text style={styles.emptySubtext}>
        {activeFilter !== 'all'
          ? `No ${activeFilter} calls to display`
          : 'Call logs will appear here after sync'}
      </Text>
    </View>
  );

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

      {/* Stats Summary */}
      {/* <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{calculatedCounts.total}</Text>
          <Text style={styles.statLabel}>Total Calls</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {calculatedCounts.incoming}
          </Text>
          <Text style={styles.statLabel}>Incoming</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {calculatedCounts.outgoing}
          </Text>
          <Text style={styles.statLabel}>Outgoing</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: COLORS.error }]}>
            {calculatedCounts.missed}
          </Text>
          <Text style={styles.statLabel}>Missed</Text>
        </View>
      </View> */}

      {/* Call Logs List with Infinite Scroll */}
      <FlatList
        data={displayedLogs}
        renderItem={renderCallItem}
        keyExtractor={(item, index) => item.callId || `call-${index}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMoreLogs}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={true}
      />
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
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    margin: SPACING.lg,
    marginBottom: SPACING.sm,
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
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  footerText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    marginLeft: SPACING.sm,
  },
});

export default CallLogsScreen;