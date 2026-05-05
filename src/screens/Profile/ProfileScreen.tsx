/**
 * Profile Screen - User account information
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
import { useAuth } from '../../context/AuthContext';
import { authApi, simApi } from '../../api/index';
import COLORS from '../../constants/colors';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/spacing';

interface UserSIM {
  id: string;
  phoneNumber: string;
  carrier?: string;
  isActive: boolean;
}

const ProfileScreen: React.FC = () => {
  const { user } = useAuth();
  const [simCards, setSimCards] = useState<UserSIM[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      // Fetch user's SIMs
      const sims = await simApi.getMySIMs();
      setSimCards(sims.map(sim => ({
        id: sim.id,
        phoneNumber: sim.phoneNumber,
        carrier: sim.carrier,
        isActive: sim.isActive,
      })));
    } catch (error) {
      console.error('[ProfileScreen] Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfileData();
    setRefreshing(false);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return { text: 'Super Admin', color: COLORS.error };
      case 'admin':
        return { text: 'Admin', color: COLORS.primary };
      default:
        return { text: 'User', color: COLORS.success };
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

  const roleBadge = user ? getRoleBadge(user.role) : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          {roleBadge && (
            <View style={[styles.roleBadge, { backgroundColor: roleBadge.color }]}>
              <Text style={styles.roleBadgeText}>{roleBadge.text}</Text>
            </View>
          )}
        </View>

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Mobile</Text>
              <Text style={styles.infoValue}>{user?.mobileNumber || 'Not set'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email Verified</Text>
              <Text style={[
                styles.infoValue,
                { color: user?.emailVerified ? COLORS.success : COLORS.warning }
              ]}>
                {user?.emailVerified ? 'Yes' : 'No'}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Account Status</Text>
              <Text style={[
                styles.infoValue,
                { color: user?.isActive ? COLORS.success : COLORS.error }
              ]}>
                {user?.isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Registered SIMs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registered SIM Cards ({simCards.length})</Text>
          {simCards.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyText}>No SIM cards registered</Text>
            </View>
          ) : (
            simCards.map((sim, index) => (
              <View key={sim.id} style={styles.card}>
                <View style={styles.simRow}>
                  <View style={styles.simIcon}>
                    <Text style={styles.simIconText}>📱</Text>
                  </View>
                  <View style={styles.simInfo}>
                    <Text style={styles.simNumber}>{sim.phoneNumber}</Text>
                    <Text style={styles.simCarrier}>{sim.carrier || 'Unknown Carrier'}</Text>
                  </View>
                  <View style={[
                    styles.simStatus,
                    { backgroundColor: sim.isActive ? COLORS.successLight : COLORS.errorLight }
                  ]}>
                    <Text style={[
                      styles.simStatusText,
                      { color: sim.isActive ? COLORS.success : COLORS.error }
                    ]}>
                      {sim.isActive ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
                {index < simCards.length - 1 && <View style={styles.divider} />}
              </View>
            ))
          )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: SPACING['3xl'],
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  avatarText: {
    fontSize: FONT_SIZE['4xl'],
    fontWeight: 'bold',
    color: COLORS.textWhite,
  },
  userName: {
    fontSize: FONT_SIZE['2xl'],
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  userEmail: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textLight,
    marginBottom: SPACING.md,
  },
  roleBadge: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  roleBadgeText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textWhite,
  },
  section: {
    marginBottom: SPACING['2xl'],
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
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
    color: COLORS.text,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xs,
  },
  simRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  simIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  simIconText: {
    fontSize: FONT_SIZE.xl,
  },
  simInfo: {
    flex: 1,
  },
  simNumber: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  simCarrier: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
  },
  simStatus: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  simStatusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textLight,
    textAlign: 'center',
  },
});

export default ProfileScreen;