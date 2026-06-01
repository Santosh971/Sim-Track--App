


/**
 * Dashboard Screen - Main screen after login
 * Fully responsive for all mobile screen sizes
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  PixelRatio,
  Platform,
  StyleSheet as RNStyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import COLORS from '../../constants/colors';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/spacing';
import { NativeModules } from 'react-native';

const { CallAutomationModule } = NativeModules;

// ─── Responsive helpers ───────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');

// Scale relative to 375px baseline (iPhone SE / standard)
const scale = (size: number) => Math.round((SCREEN_W / 375) * size);

// Font scale — clamp so it never blows up on large phones/tablets
const fontScale = PixelRatio.getFontScale();
const fs = (size: number) => Math.min(scale(size) / fontScale, size * 1.4);

// Spacing scale
const sp = (size: number) => Math.round(scale(size));

const isSmall  = SCREEN_W < 360;   // Galaxy A-series, old iPhones
const isTablet = SCREEN_W >= 600;  // Tablets
// ─────────────────────────────────────────────────────────────────────────────

const DashboardScreen: React.FC = () => {
  const { user, email, logout } = useAuth();
  const navigation = useNavigation();
  const [simSlots, setSimSlots] = useState<any[]>([]);
  const [isServiceRunning, setIsServiceRunning] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);

  useEffect(() => {
    checkCallStatus();
  }, []);

  const checkCallStatus = async () => {
    try {
      const [slots, running, permissions] = await Promise.all([
        CallAutomationModule?.getSimSlots() || [],
        CallAutomationModule?.isServiceRunning() || false,
        CallAutomationModule?.hasCallPermissions() || false,
      ]);
      setSimSlots(slots || []);
      setIsServiceRunning(running);
      setHasPermissions(permissions);
    } catch (e) {
      console.log('Error checking call status:', e);
    }
  };

  const requestPermissions = async () => {
    try {
      await CallAutomationModule?.requestCallPermissions();
      setTimeout(checkCallStatus, 1000);
    } catch (e) {
      console.log('Error requesting permissions:', e);
    }
  };

  const testCall = async () => {
    Alert.alert(
      'Test Call',
      'Enter phone number to test call:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Test Number',
          onPress: async () => {
            try {
              const result = await CallAutomationModule?.makeCall(
                '+919876543210',
                0,
                5
              );
              Alert.alert('Call Result', JSON.stringify(result, null, 2));
            } catch (e) {
              Alert.alert('Error', String(e));
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    await logout();
  };

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const getRoleBadge = (role: string): { text: string; color: string } => {
    switch (role) {
      case 'super_admin': return { text: 'Super Admin', color: COLORS.error };
      case 'admin':       return { text: 'Admin',       color: COLORS.primary };
      default:            return { text: 'User',         color: COLORS.success };
    }
  };

  const roleBadge = user?.role
    ? getRoleBadge(user.role)
    : { text: 'User', color: COLORS.success };

  // ─── Reusable sub-components ────────────────────────────────────────────────

  /** Section label */
  const SectionTitle = ({ title }: { title: string }) => (
    <Text style={styles.sectionTitle}>{title}</Text>
  );

  /** Single info row inside a card */
  const InfoRow = ({
    label,
    value,
    valueColor,
  }: {
    label: string;
    value: string;
    valueColor?: string;
  }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel} numberOfLines={1}>{label}</Text>
      <Text
        style={[styles.infoValue, valueColor ? { color: valueColor } : undefined]}
        numberOfLines={2}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Welcome Card ───────────────────────────────────────────────── */}
        <View style={styles.welcomeCard}>
          {/* Avatar */}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>

          {/* Content */}
          <View style={styles.welcomeContent}>
            <Text style={styles.welcomeTitle} numberOfLines={1}>
              Welcome back!
            </Text>
            <Text style={styles.userName} numberOfLines={1} adjustsFontSizeToFit>
              {user?.name || 'User'}
            </Text>
            <View style={[styles.roleBadge, { backgroundColor: roleBadge.color }]}>
              <Text style={styles.roleBadgeText} numberOfLines={1}>
                {roleBadge.text}
              </Text>
            </View>
          </View>
        </View>

        {/* ── How It Works ───────────────────────────────────────────────── */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How it works</Text>

          {[
            { icon: '📱', text: 'Your SIM is automatically detected' },
            { icon: '📞', text: 'Call logs sync in the background' },
            { icon: '📶', text: 'WiFi speed is monitored periodically' },
            { icon: '☁️', text: 'All data is securely synced to server' },
          ].map((item, i) => (
            <View key={i} style={styles.infoItem}>
              <Text style={styles.infoIcon}>{item.icon}</Text>
              <Text style={styles.infoText} numberOfLines={2}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* ── Account Info ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionTitle title="Account Info" />
          <View style={styles.card}>
            <InfoRow
              label="Email"
              value={user?.email || email || 'N/A'}
            />
            <View style={styles.divider} />
            <InfoRow
              label="Status"
              value={user?.isActive !== false ? 'Active' : 'Inactive'}
              valueColor={user?.isActive !== false ? COLORS.success : COLORS.error}
            />
          </View>
        </View>

        {/* ── Call Automation Test ───────────────────────────────────────── */}
      

        {/* ── Logout ─────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutText}>🚪 Logout</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // ─ Layout ──────────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: sp(16),
    paddingBottom: sp(40),
  },

  // ─ Welcome card ────────────────────────────────────────────────────────────
  welcomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: sp(14),
    padding: sp(16),
    marginBottom: sp(16),
    // Shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  avatar: {
    width: sp(isSmall ? 44 : 52),
    height: sp(isSmall ? 44 : 52),
    borderRadius: sp(isSmall ? 22 : 26),
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: sp(14),
    flexShrink: 0,
  },
  avatarText: {
    color: COLORS.textWhite,
    fontSize: fs(isSmall ? 18 : 22),
    fontWeight: '700',
  },
  welcomeContent: {
    flex: 1,
    minWidth: 0, // allows text truncation inside flex child
  },
  welcomeTitle: {
    fontSize: fs(13),
    color: COLORS.textLight,
    marginBottom: sp(2),
  },
  userName: {
    fontSize: fs(isSmall ? 16 : 18),
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: sp(6),
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: sp(10),
    paddingVertical: sp(3),
    borderRadius: sp(20),
  },
  roleBadgeText: {
    color: COLORS.textWhite,
    fontSize: fs(12),
    fontWeight: '600',
  },

  // ─ Info card (How it works) ────────────────────────────────────────────────
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: sp(14),
    padding: sp(16),
    marginBottom: sp(16),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  infoTitle: {
    fontSize: fs(15),
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: sp(14),
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start', // 'flex-start' so long text wraps without clipping
    marginBottom: sp(10),
  },
  infoIcon: {
    fontSize: fs(16),
    marginRight: sp(10),
    width: sp(24),
    textAlign: 'center',
    lineHeight: fs(22),
  },
  infoText: {
    fontSize: fs(14),
    color: COLORS.textLight,
    flex: 1,
    lineHeight: fs(20),
  },

  // ─ Generic section ─────────────────────────────────────────────────────────
  section: {
    marginBottom: sp(16),
  },
  sectionTitle: {
    fontSize: fs(14),
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: sp(10),
    letterSpacing: 0.2,
  },

  // ─ Generic card ────────────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: sp(14),
    paddingHorizontal: sp(16),
    paddingVertical: sp(4),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },

  // ─ Info rows inside card ───────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sp(12),
    gap: sp(12),
  },
  infoLabel: {
    fontSize: fs(14),
    color: COLORS.textLight,
    flexShrink: 0,
    maxWidth: '45%',
  },
  infoValue: {
    fontSize: fs(14),
    color: COLORS.text,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
    maxWidth: '55%',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
  },

  // ─ Button stack ────────────────────────────────────────────────────────────
  buttonStack: {
    marginTop: sp(10),
    gap: sp(8),
  },
  testButton: {
    backgroundColor: COLORS.primary,
    borderRadius: sp(12),
    paddingVertical: sp(isSmall ? 12 : 14),
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: { elevation: 1 },
    }),
  },
  testButtonText: {
    color: COLORS.textWhite,
    fontSize: fs(isSmall ? 13 : 14),
    fontWeight: '600',
  },

  // ─ Logout ──────────────────────────────────────────────────────────────────
  logoutButton: {
    backgroundColor: COLORS.error,
    borderRadius: sp(12),
    paddingVertical: sp(isSmall ? 13 : 15),
    alignItems: 'center',
    marginTop: sp(8),
  },
  logoutText: {
    color: COLORS.textWhite,
    fontSize: fs(15),
    fontWeight: '600',
  },

  // ─ Kept for potential future use ───────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    gap: sp(12),
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: sp(14),
    padding: sp(16),
    alignItems: 'center',
  },
  statIcon: {
    fontSize: fs(28),
    marginBottom: sp(6),
  },
  statNumber: {
    fontSize: fs(22),
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: fs(12),
    color: COLORS.textLight,
    marginTop: sp(4),
    textAlign: 'center',
  },
  actionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: sp(14),
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sp(16),
  },
  actionIconContainer: {
    width: sp(40),
    height: sp(40),
    borderRadius: sp(20),
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: sp(12),
    flexShrink: 0,
  },
  actionIcon: {
    fontSize: fs(18),
  },
  actionDetails: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    fontSize: fs(14),
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: sp(2),
  },
  actionDescription: {
    fontSize: fs(12),
    color: COLORS.textLight,
  },
  actionArrow: {
    fontSize: fs(16),
    color: COLORS.textLight,
    marginLeft: sp(8),
  },
});

export default DashboardScreen;