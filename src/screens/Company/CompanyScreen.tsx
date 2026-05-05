/**
 * Company Screen - Company information for the user
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
import { companyApi } from '../../api/index';
import COLORS from '../../constants/colors';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/spacing';
import { Company } from '../../models/Company';

const CompanyScreen: React.FC = () => {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCompany();
  }, []);

  const loadCompany = async () => {
    setError(null);
    try {
      const companyData = await companyApi.getMyCompany();
      setCompany(companyData);
    } catch (err: any) {
      console.error('[CompanyScreen] Error loading company:', err);
      setError('Failed to load company information');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCompany();
    setRefreshing(false);
  };

  const getPlanColor = (plan: string): string => {
    switch (plan) {
      case 'free': return COLORS.textLight;
      case 'basic': return COLORS.primary;
      case 'premium': return COLORS.warning;
      case 'enterprise': return COLORS.success;
      default: return COLORS.textLight;
    }
  };

  const getPlanLabel = (plan: string): string => {
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getDaysRemaining = (endDate: string): number => {
    if (!endDate) return 0;
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getSubscriptionStatus = (): { text: string; color: string } => {
    if (!company) return { text: 'Unknown', color: COLORS.textLight };

    if (company.subscriptionStatus === 'active') {
      const daysRemaining = getDaysRemaining(company.subscriptionEndDate);
      if (daysRemaining < 0) {
        return { text: 'Expired', color: COLORS.error };
      } else if (daysRemaining <= 7) {
        return { text: `Expires in ${daysRemaining} days`, color: COLORS.warning };
      }
      return { text: 'Active', color: COLORS.success };
    }
    return { text: company.subscriptionStatus, color: COLORS.textLight };
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

  const subscriptionStatus = getSubscriptionStatus();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Company Header */}
        <View style={styles.headerCard}>
          <View style={styles.logoContainer}>
            {company?.logo ? (
              <Text style={styles.logoPlaceholder}>🏢</Text>
            ) : (
              <Text style={styles.logoPlaceholder}>🏢</Text>
            )}
          </View>
          <Text style={styles.companyName}>{company?.name || 'No Company'}</Text>
          <View style={[styles.planBadge, { backgroundColor: getPlanColor(company?.plan || 'free') }]}>
            <Text style={styles.planBadgeText}>
              {getPlanLabel(company?.plan || 'free')} Plan
            </Text>
          </View>
        </View>

        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {company && (
          <>
            {/* Subscription Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Subscription</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status</Text>
                <Text style={[styles.infoValue, { color: subscriptionStatus.color }]}>
                  {subscriptionStatus.text}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Plan</Text>
                <Text style={styles.infoValue}>{getPlanLabel(company.plan)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Start Date</Text>
                <Text style={styles.infoValue}>{formatDate(company.subscriptionStartDate)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>End Date</Text>
                <Text style={styles.infoValue}>{formatDate(company.subscriptionEndDate)}</Text>
              </View>
            </View>

            {/* Limits Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Plan Limits</Text>
              <View style={styles.limitsContainer}>
                <View style={styles.limitItem}>
                  <Text style={styles.limitValue}>{company.maxSIMs}</Text>
                  <Text style={styles.limitLabel}>Max SIMs</Text>
                </View>
                <View style={styles.limitDivider} />
                <View style={styles.limitItem}>
                  <Text style={styles.limitValue}>{company.maxUsers}</Text>
                  <Text style={styles.limitLabel}>Max Users</Text>
                </View>
              </View>
            </View>

            {/* Contact Info Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Contact Information</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{company.email || 'Not set'}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{company.phone || 'Not set'}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Website</Text>
                <Text style={styles.infoValue}>{company.website || 'Not set'}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>{company.address || 'Not set'}</Text>
              </View>
            </View>

            {/* Account Info */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Account</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status</Text>
                <Text style={[
                  styles.infoValue,
                  { color: company.status === 'active' ? COLORS.success : COLORS.error }
                ]}>
                  {company.status.toUpperCase()}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Created</Text>
                <Text style={styles.infoValue}>{formatDate(company.createdAt)}</Text>
              </View>
            </View>
          </>
        )}

        {/* No Company Message */}
        {!company && !error && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏢</Text>
            <Text style={styles.emptyText}>No Company Assigned</Text>
            <Text style={styles.emptySubtext}>
              You are not associated with any company
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
  headerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING['2xl'],
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoPlaceholder: {
    fontSize: 40,
  },
  companyName: {
    fontSize: FONT_SIZE['2xl'],
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  planBadge: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  planBadgeText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textWhite,
  },
  card: {
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
    flex: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xs,
  },
  limitsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SPACING.md,
  },
  limitItem: {
    alignItems: 'center',
    flex: 1,
  },
  limitValue: {
    fontSize: FONT_SIZE['3xl'],
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  limitLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
  limitDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  errorCard: {
    backgroundColor: COLORS.error + '10',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  errorText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.error,
    textAlign: 'center',
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
});

export default CompanyScreen;