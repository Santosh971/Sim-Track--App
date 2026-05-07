/**
 * SMS Screen - View synced SMS messages
 * With infinite scroll for better performance
 */

import React, { useState, useEffect, useCallback } from 'react';
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
import { SMSService } from '../../services/SMSService';
import { DeviceSMS } from '../../models/SMS';

type SMSType = 'all' | 'sent' | 'inbox';

interface SMSCounts {
  total: number;
  inbox: number;
  sent: number;
}

const BATCH_SIZE = 20; // Number of items to load per batch

const SMSScreen: React.FC = () => {
  const [allMessages, setAllMessages] = useState<DeviceSMS[]>([]);
  const [displayedMessages, setDisplayedMessages] = useState<DeviceSMS[]>([]);
  const [counts, setCounts] = useState<SMSCounts>({ total: 0, inbox: 0, sent: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState<SMSType>('all');
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);

  // Calculated counts from loaded messages (what's actually displayed)
  const calculatedCounts: SMSCounts = {
    total: allMessages.length,
    inbox: allMessages.filter(msg => msg.type === 'inbox').length,
    sent: allMessages.filter(msg => msg.type === 'sent').length,
  };

  // Refresh data when screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadCounts();
      loadMessages();
    }, [])
  );

  useEffect(() => {
    filterAndPaginateMessages(activeFilter, 0, true);
  }, [activeFilter, allMessages]);

  const loadCounts = async () => {
    try {
      const smsCounts = await SMSService.getSMSCounts();
      console.log('[SMSScreen] SMS counts from device:', smsCounts);
      setCounts(smsCounts);
    } catch (error) {
      console.error('[SMSScreen] Error loading SMS counts:', error);
      setCounts({ total: 0, inbox: 0, sent: 0 });
    }
  };

  const loadMessages = async () => {
    try {
      console.log('[SMSScreen] Loading SMS messages...');
      const smsMessages = await SMSService.getSMSMessages();
      console.log('[SMSScreen] Loaded SMS messages:', smsMessages?.length || 0);
      setAllMessages(smsMessages || []);
    } catch (error) {
      console.error('[SMSScreen] Error loading messages:', error);
      setAllMessages([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter messages and paginate
  const filterAndPaginateMessages = (filter: SMSType, page: number, reset: boolean = false) => {
    const filtered = filter === 'all'
      ? allMessages
      : allMessages.filter(msg => msg.type === filter);

    const startIndex = 0;
    const endIndex = (page + 1) * BATCH_SIZE;
    const batch = filtered.slice(startIndex, endIndex);

    setDisplayedMessages(batch);
    setHasMore(endIndex < filtered.length);
    setCurrentPage(page);
  };

  // Load more messages when scrolling
  const loadMoreMessages = () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);

    // Simulate async loading for smooth UI
    setTimeout(() => {
      const nextPage = currentPage + 1;
      const filtered = activeFilter === 'all'
        ? allMessages
        : allMessages.filter(msg => msg.type === activeFilter);

      const startIndex = 0;
      const endIndex = (nextPage + 1) * BATCH_SIZE;
      const batch = filtered.slice(startIndex, endIndex);

      setDisplayedMessages(batch);
      setHasMore(endIndex < filtered.length);
      setCurrentPage(nextPage);
      setLoadingMore(false);
    }, 100);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setCurrentPage(0);
    setHasMore(true);
    await Promise.all([loadCounts(), loadMessages()]);
    setRefreshing(false);
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const filters: SMSType[] = ['all', 'inbox', 'sent'];

  const renderMessageItem = ({ item, index }: { item: DeviceSMS; index: number }) => (
    <View key={item._id || index} style={styles.messageItem}>
      <View style={[
        styles.messageTypeIndicator,
        { backgroundColor: item.type === 'sent' ? COLORS.primary : COLORS.success }
      ]} />
      <View style={styles.messageContent}>
        <View style={styles.messageHeader}>
          <Text style={styles.messageAddress}>
            {item.sender}
          </Text>
          <Text style={styles.messageTime}>
            {formatTimestamp(item.timestamp)}
          </Text>
        </View>
        <Text style={styles.messageBody}>
          {truncateText(item.message, 80)}
        </Text>
        <View style={styles.messageFooter}>
          <Text style={[
            styles.messageType,
            { color: item.type === 'sent' ? COLORS.primary : COLORS.success }
          ]}>
            {item.type}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.footerText}>Loading more messages...</Text>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>💬</Text>
      <Text style={styles.emptyText}>No messages found</Text>
      <Text style={styles.emptySubtext}>
        {activeFilter !== 'all'
          ? `No ${activeFilter} messages to display`
          : 'SMS messages will appear here after sync'}
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
            onPress={() => {
              setActiveFilter(filter);
              setCurrentPage(0);
              setHasMore(true);
            }}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === filter && styles.filterTabTextActive,
              ]}
            >
              {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats Summary */}
      {/* <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{calculatedCounts.total}</Text>
          <Text style={styles.statLabel}>Total SMS</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: COLORS.success }]}>
            {calculatedCounts.inbox}
          </Text>
          <Text style={styles.statLabel}>Inbox</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: COLORS.primary }]}>
            {calculatedCounts.sent}
          </Text>
          <Text style={styles.statLabel}>Sent</Text>
        </View>
      </View> */}

      {/* Messages List with Infinite Scroll */}
      <FlatList
        data={displayedMessages}
        renderItem={renderMessageItem}
        keyExtractor={(item, index) => item._id || `sms-${index}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMoreMessages}
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
  messageItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  messageTypeIndicator: {
    width: 4,
  },
  messageContent: {
    flex: 1,
    padding: SPACING.lg,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  messageAddress: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  messageTime: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginLeft: SPACING.sm,
  },
  messageBody: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    lineHeight: 20,
  },
  messageFooter: {
    marginTop: SPACING.sm,
  },
  messageType: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
    textTransform: 'capitalize',
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

export default SMSScreen;