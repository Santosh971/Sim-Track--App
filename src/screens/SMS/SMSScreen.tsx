/**
 * SMS Screen - View synced SMS messages
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
import { SMSService } from '../../services/SMSService';
import { DeviceSMS } from '../../models/SMS';

type SMSType = 'all' | 'sent' | 'inbox';

interface SMSCounts {
  total: number;
  inbox: number;
  sent: number;
}

const SMSScreen: React.FC = () => {
  const [messages, setMessages] = useState<DeviceSMS[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<DeviceSMS[]>([]);
  const [counts, setCounts] = useState<SMSCounts>({ total: 0, inbox: 0, sent: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<SMSType>('all');

  // Refresh data when screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadCounts();
      loadMessages();
    }, [])
  );

  useEffect(() => {
    filterMessages();
  }, [activeFilter, messages]);

  const loadCounts = async () => {
    try {
      const smsCounts = await SMSService.getSMSCounts();
      setCounts(smsCounts);
    } catch (error) {
      console.error('[SMSScreen] Error loading SMS counts:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const smsMessages = await SMSService.getSMSMessages();
      setMessages(smsMessages);
    } catch (error) {
      console.error('[SMSScreen] Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterMessages = () => {
    if (activeFilter === 'all') {
      setFilteredMessages(messages);
    } else {
      setFilteredMessages(messages.filter(msg => msg.type === activeFilter));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
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
              {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Messages List */}
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
            <Text style={styles.statLabel}>Total SMS</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: COLORS.success }]}>
              {counts.inbox}
            </Text>
            <Text style={styles.statLabel}>Inbox</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: COLORS.primary }]}>
              {counts.sent}
            </Text>
            <Text style={styles.statLabel}>Sent</Text>
          </View>
        </View>

        {/* Messages List */}
        {filteredMessages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>No messages found</Text>
            <Text style={styles.emptySubtext}>
              {activeFilter !== 'all'
                ? `No ${activeFilter} messages to display`
                : 'SMS messages will appear here after sync'}
            </Text>
          </View>
        ) : (
          filteredMessages.map((msg, index) => (
            <View key={msg._id || index} style={styles.messageItem}>
              <View style={[
                styles.messageTypeIndicator,
                { backgroundColor: msg.type === 'sent' ? COLORS.primary : COLORS.success }
              ]} />
              <View style={styles.messageContent}>
                <View style={styles.messageHeader}>
                  <Text style={styles.messageAddress}>
                    {msg.sender}
                  </Text>
                  <Text style={styles.messageTime}>
                    {formatTimestamp(msg.timestamp)}
                  </Text>
                </View>
                <Text style={styles.messageBody}>
                  {truncateText(msg.message, 80)}
                </Text>
                <View style={styles.messageFooter}>
                  <Text style={[
                    styles.messageType,
                    { color: msg.type === 'sent' ? COLORS.primary : COLORS.success }
                  ]}>
                    {msg.type}
                  </Text>
                </View>
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
});

export default SMSScreen;