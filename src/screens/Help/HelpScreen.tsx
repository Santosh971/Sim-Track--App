/**
 * Help & Support Screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import COLORS from '../../constants/colors';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/spacing';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: 'What is SIM Sync?',
    answer: 'SIM Sync is an app that automatically synchronizes your call logs and SMS messages to a secure cloud server for backup and monitoring purposes.',
  },
  {
    question: 'How does auto-authentication work?',
    answer: 'The app detects your SIM card phone number and automatically authenticates with the server. If your SIM is registered with a company, you\'ll be approved automatically.',
  },
  {
    question: 'Why do I need location permission?',
    answer: 'On Android 10+, location permission is required to read WiFi network information (SSID) for speed monitoring. This is a system requirement.',
  },
  {
    question: 'How often does the app sync?',
    answer: 'By default, the app syncs every 5 minutes when connected to WiFi. You can adjust this interval in Settings.',
  },
  {
    question: 'What is WiFi speed monitoring?',
    answer: 'The app can measure your WiFi connection speed (download, upload, latency) and report it to the server. This helps monitor network quality.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes, all data is transmitted over HTTPS with JWT authentication. Your call logs and SMS are encrypted during transmission.',
  },
  {
    question: 'Can I use the app offline?',
    answer: 'The app can collect data offline, but requires an internet connection to sync with the server.',
  },
  {
    question: 'How do I logout?',
    answer: 'Go to Settings and tap the "Logout" button at the bottom. This will clear all your data and stop syncing.',
  },
];

const HelpScreen: React.FC = () => {
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  const handleContactSupport = () => {
    // Open email client
    Linking.openURL('mailto:support@sim-sync.com?subject=Support Request');
  };

  const handleOpenPrivacy = () => {
    Linking.openURL('https://sim-sync.com/privacy');
  };

  const handleOpenTerms = () => {
    Linking.openURL('https://sim-sync.com/terms');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerIcon}>❓</Text>
          <Text style={styles.headerTitle}>Help & Support</Text>
          <Text style={styles.headerSubtitle}>
            Find answers to common questions
          </Text>
        </View>

        {/* FAQ Section */}
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        <View style={styles.faqContainer}>
          {faqs.map((faq, index) => (
            <TouchableOpacity
              key={index}
              style={styles.faqItem}
              onPress={() => toggleFAQ(index)}
              activeOpacity={0.7}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQuestion}>{faq.question}</Text>
                <Text style={styles.faqIcon}>
                  {expandedFAQ === index ? '−' : '+'}
                </Text>
              </View>
              {expandedFAQ === index && (
                <Text style={styles.faqAnswer}>{faq.answer}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Contact Section */}
        <Text style={styles.sectionTitle}>Need More Help?</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.contactItem}
            onPress={handleContactSupport}
          >
            <View style={styles.contactIcon}>
              <Text style={styles.contactIconText}>✉️</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Email Support</Text>
              <Text style={styles.contactSubtitle}>
                support@sim-sync.com
              </Text>
            </View>
            <Text style={styles.contactArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Legal Links */}
        {/* <Text style={styles.sectionTitle}>Legal</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.legalItem}
            onPress={handleOpenPrivacy}
          >
            <Text style={styles.legalTitle}>Privacy Policy</Text>
            <Text style={styles.legalArrow}>→</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.legalItem}
            onPress={handleOpenTerms}
          >
            <Text style={styles.legalTitle}>Terms of Service</Text>
            <Text style={styles.legalArrow}>→</Text>
          </TouchableOpacity>
        </View> */}

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>SIM Sync</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
          <Text style={styles.appCopyright}>
            © 2024 SIM Sync. All rights reserved.
          </Text>
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
  header: {
    alignItems: 'center',
    marginBottom: SPACING['2xl'],
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZE['2xl'],
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
  },
  faqContainer: {
    marginBottom: SPACING.lg,
  },
  faqItem: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    paddingRight: SPACING.md,
  },
  faqIcon: {
    fontSize: FONT_SIZE.xl,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  faqAnswer: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textLight,
    lineHeight: 22,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  contactIconText: {
    fontSize: FONT_SIZE.xl,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  contactSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    marginTop: SPACING.xs,
  },
  contactArrow: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.textLight,
  },
  legalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  legalTitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  legalArrow: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.textLight,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: SPACING['2xl'],
  },
  appName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  appVersion: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    marginBottom: SPACING.xs,
  },
  appCopyright: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
  },
});

export default HelpScreen;