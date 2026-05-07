// /**
//  * WiFi Monitor Screen - WiFi speed test dashboard
//  */

// import React, { useState, useEffect } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   ScrollView,
//   ActivityIndicator,
//   TouchableOpacity,
//   RefreshControl,
//   Alert,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { useWiFi } from '../../context/WiFiContext';
// import COLORS from '../../constants/colors';
// import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/spacing';
// import { SpeedTestResult } from '../../models/WiFi';

// const WiFiMonitorScreen: React.FC = () => {
//   const {
//     isActive,
//     wifiName,
//     lastSpeedTest,
//     status,
//     error: contextError,
//     runSpeedTest,
//     startMonitoring,
//     stopMonitoring,
//     isMonitoring,
//   } = useWiFi();

//   const [testing, setTesting] = useState(false);
//   const [refreshing, setRefreshing] = useState(false);
//   const [testError, setTestError] = useState<string | null>(null);

//   const handleSpeedTest = async () => {
//     setTesting(true);
//     setTestError(null);
//     try {
//       await runSpeedTest();
//     } catch (err: any) {
//       console.error('[WiFiMonitorScreen] Speed test error:', err);
//       const errorMessage = err.message || 'Speed test failed';

//       // Check for specific error types and provide helpful messages
//       let displayMessage = errorMessage;
//       let errorTitle = 'Speed Test Failed';

//       if (errorMessage.includes('WiFi') ||
//           errorMessage.includes('wifi') ||
//           errorMessage.includes('not connected')) {
//         errorTitle = 'WiFi Not Connected';
//         displayMessage = 'Please connect to a WiFi network to run the speed test.';
//       } else if (errorMessage.includes('internet') ||
//                  errorMessage.includes('network') ||
//                  errorMessage.includes('Network')) {
//         errorTitle = 'No Internet Connection';
//         displayMessage = 'Your WiFi is connected but there is no internet. Please check your router or try again.';
//       } else if (errorMessage.includes('server') ||
//                  errorMessage.includes('Server')) {
//         errorTitle = 'Server Unavailable';
//         displayMessage = 'Speed test server is not responding. Please try again later.';
//       }

//       setTestError(displayMessage);
//       Alert.alert(errorTitle, displayMessage, [{ text: 'OK' }]);
//     } finally {
//       setTesting(false);
//     }
//   };

//   const onRefresh = async () => {
//     setRefreshing(true);
//     setTestError(null);
//     // Refresh WiFi status
//     setRefreshing(false);
//   };

//   const formatSpeed = (speed: number): string => {
//     if (speed === 0) return '0';
//     return speed.toFixed(2);
//   };

//   const getStatusColor = (): string => {
//     switch (status) {
//       case 'active':
//         return COLORS.success;
//       case 'error':
//         return COLORS.error;
//       case 'waiting':
//         return COLORS.warning;
//       default:
//         return COLORS.textLight;
//     }
//   };

//   const getSpeedQuality = (speed: number): { label: string; color: string } => {
//     if (speed === 0) return { label: 'Not Tested', color: COLORS.textLight };
//     if (speed < 10) return { label: 'Poor', color: COLORS.error };
//     if (speed < 30) return { label: 'Fair', color: COLORS.warning };
//     if (speed < 50) return { label: 'Good', color: COLORS.info };
//     return { label: 'Excellent', color: COLORS.success };
//   };

//   const speedQuality = lastSpeedTest ? getSpeedQuality(lastSpeedTest.download) : getSpeedQuality(0);

//   return (
//     <SafeAreaView style={styles.container}>
//       <ScrollView
//         contentContainerStyle={styles.scrollContent}
//         refreshControl={
//           <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
//         }
//       >
//         {/* WiFi Status Card */}
//         <View style={styles.statusCard}>
//           <View style={styles.statusHeader}>
//             <View style={styles.statusIcon}>
//               <Text style={styles.statusIconText}>📶</Text>
//             </View>
//             <View style={styles.statusInfo}>
//               <Text style={styles.wifiName}>{wifiName || 'Not Connected'}</Text>
//               <View style={styles.statusBadge}>
//                 <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
//                 <Text style={[styles.statusText, { color: getStatusColor() }]}>
//                   {isActive ? 'Connected' : 'Disconnected'}
//                 </Text>
//               </View>
//             </View>
//           </View>
//         </View>

//         {/* Error Display */}
//         {(contextError || testError) && (
//           <View style={styles.errorCard}>
//             <Text style={styles.errorIcon}>⚠️</Text>
//             <Text style={styles.errorText}>{contextError || testError}</Text>
//           </View>
//         )}

//         {/* WiFi Disconnected Warning */}
//         {!isActive && status === 'idle' && !contextError && (
//           <View style={styles.warningCard}>
//             <Text style={styles.warningIcon}>📶</Text>
//             <View style={styles.warningContent}>
//               <Text style={styles.warningTitle}>WiFi Not Connected</Text>
//               <Text style={styles.warningText}>
//                 Please connect to a WiFi network to monitor speed and submit metrics.
//               </Text>
//             </View>
//           </View>
//         )}

//         {/* Speed Test Card */}
//         <View style={styles.speedCard}>
//           <Text style={styles.cardTitle}>Last Speed Test</Text>

//           {lastSpeedTest ? (
//             <>
//               {/* Download Speed */}
//               <View style={styles.speedItem}>
//                 <Text style={styles.speedLabel}>Download</Text>
//                 <View style={styles.speedValueContainer}>
//                   <Text style={styles.speedValue}>{formatSpeed(lastSpeedTest.download)}</Text>
//                   <Text style={styles.speedUnit}>Mbps</Text>
//                 </View>
//               </View>

//               {/* Upload Speed */}
//               <View style={styles.speedItem}>
//                 <Text style={styles.speedLabel}>Upload</Text>
//                 <View style={styles.speedValueContainer}>
//                   <Text style={styles.speedValue}>{formatSpeed(lastSpeedTest.upload)}</Text>
//                   <Text style={styles.speedUnit}>Mbps</Text>
//                 </View>
//               </View>

//               {/* Latency */}
//               <View style={styles.speedItem}>
//                 <Text style={styles.speedLabel}>Latency</Text>
//                 <View style={styles.speedValueContainer}>
//                   <Text style={styles.speedValue}>{lastSpeedTest.latency.toFixed(0)}</Text>
//                   <Text style={styles.speedUnit}>ms</Text>
//                 </View>
//               </View>

//               {/* Quality Badge */}
//               <View style={styles.qualityContainer}>
//                 <View style={[styles.qualityBadge, { backgroundColor: speedQuality.color + '20' }]}>
//                   <Text style={[styles.qualityText, { color: speedQuality.color }]}>
//                     {speedQuality.label}
//                   </Text>
//                 </View>
//               </View>

//               {/* Timestamp */}
//               <Text style={styles.timestamp}>
//                 Tested: {new Date(lastSpeedTest.timestamp).toLocaleString()}
//               </Text>
//             </>
//           ) : (
//             <View style={styles.noDataContainer}>
//               <Text style={styles.noDataIcon}>📊</Text>
//               <Text style={styles.noDataText}>No speed test data yet</Text>
//               <Text style={styles.noDataSubtext}>Run a speed test to see results</Text>
//             </View>
//           )}
//         </View>

//         {/* Action Buttons */}
//         <View style={styles.actionContainer}>
//           <TouchableOpacity
//             style={[styles.testButton, testing && styles.buttonDisabled]}
//             onPress={handleSpeedTest}
//             disabled={testing}
//           >
//             {testing ? (
//               <ActivityIndicator color={COLORS.textWhite} />
//             ) : (
//               <Text style={styles.testButtonText}>🚀 Run Speed Test</Text>
//             )}
//           </TouchableOpacity>

//           <TouchableOpacity
//             style={[
//               styles.monitorButton,
//               isMonitoring ? styles.monitorButtonActive : {}
//             ]}
//             onPress={isMonitoring ? stopMonitoring : startMonitoring}
//           >
//             <Text style={styles.monitorButtonText}>
//               {isMonitoring ? '⏸️ Stop Monitoring' : '▶️ Start Monitoring'}
//             </Text>
//           </TouchableOpacity>
//         </View>

//         {/* Monitoring Status */}
//         <View style={styles.infoCard}>
//           <Text style={styles.cardTitle}>Monitoring Status</Text>
//           <View style={styles.infoRow}>
//             <Text style={styles.infoLabel}>Status</Text>
//             <Text style={[styles.infoValue, { color: getStatusColor() }]}>
//               {status.toUpperCase()}
//             </Text>
//           </View>
//           <View style={styles.infoRow}>
//             <Text style={styles.infoLabel}>Background Monitoring</Text>
//             <Text style={[
//               styles.infoValue,
//               { color: isMonitoring ? COLORS.success : COLORS.textLight }
//             ]}>
//               {isMonitoring ? 'Active' : 'Inactive'}
//             </Text>
//           </View>
//           <View style={styles.infoRow}>
//             <Text style={styles.infoLabel}>Device Authenticated</Text>
//             <Text style={[
//               styles.infoValue,
//               { color: isActive ? COLORS.success : COLORS.warning }
//             ]}>
//               {isActive ? 'Yes' : 'No'}
//             </Text>
//           </View>
//         </View>

//         {/* Speed History (placeholder) */}
//         <View style={styles.historyCard}>
//           <Text style={styles.cardTitle}>Speed History</Text>
//           <View style={styles.historyPlaceholder}>
//             <Text style={styles.historyPlaceholderText}>
//               📈 Speed history chart will be displayed here
//             </Text>
//           </View>
//         </View>
//       </ScrollView>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: COLORS.background,
//   },
//   scrollContent: {
//     padding: SPACING.lg,
//   },
//   statusCard: {
//     backgroundColor: COLORS.surface,
//     borderRadius: BORDER_RADIUS.lg,
//     padding: SPACING.lg,
//     marginBottom: SPACING.lg,
//   },
//   statusHeader: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   statusIcon: {
//     width: 56,
//     height: 56,
//     borderRadius: 28,
//     backgroundColor: COLORS.primary + '20',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginRight: SPACING.lg,
//   },
//   statusIconText: {
//     fontSize: 28,
//   },
//   statusInfo: {
//     flex: 1,
//   },
//   wifiName: {
//     fontSize: FONT_SIZE.xl,
//     fontWeight: 'bold',
//     color: COLORS.text,
//     marginBottom: SPACING.xs,
//   },
//   statusBadge: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   statusDot: {
//     width: 8,
//     height: 8,
//     borderRadius: 4,
//     marginRight: SPACING.sm,
//   },
//   statusText: {
//     fontSize: FONT_SIZE.sm,
//     fontWeight: '600',
//     textTransform: 'uppercase',
//   },
//   speedCard: {
//     backgroundColor: COLORS.surface,
//     borderRadius: BORDER_RADIUS.lg,
//     padding: SPACING.lg,
//     marginBottom: SPACING.lg,
//   },
//   cardTitle: {
//     fontSize: FONT_SIZE.lg,
//     fontWeight: '600',
//     color: COLORS.text,
//     marginBottom: SPACING.lg,
//   },
//   speedItem: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingVertical: SPACING.md,
//     borderBottomWidth: 1,
//     borderBottomColor: COLORS.border,
//   },
//   speedLabel: {
//     fontSize: FONT_SIZE.md,
//     color: COLORS.textLight,
//   },
//   speedValueContainer: {
//     flexDirection: 'row',
//     alignItems: 'baseline',
//   },
//   speedValue: {
//     fontSize: FONT_SIZE['2xl'],
//     fontWeight: 'bold',
//     color: COLORS.text,
//   },
//   speedUnit: {
//     fontSize: FONT_SIZE.sm,
//     color: COLORS.textLight,
//     marginLeft: SPACING.sm,
//   },
//   qualityContainer: {
//     alignItems: 'center',
//     marginTop: SPACING.lg,
//   },
//   qualityBadge: {
//     paddingHorizontal: SPACING.lg,
//     paddingVertical: SPACING.sm,
//     borderRadius: BORDER_RADIUS.full,
//   },
//   qualityText: {
//     fontSize: FONT_SIZE.md,
//     fontWeight: '600',
//   },
//   timestamp: {
//     fontSize: FONT_SIZE.xs,
//     color: COLORS.textLight,
//     textAlign: 'center',
//     marginTop: SPACING.lg,
//   },
//   noDataContainer: {
//     alignItems: 'center',
//     paddingVertical: SPACING['3xl'],
//   },
//   noDataIcon: {
//     fontSize: 48,
//     marginBottom: SPACING.lg,
//   },
//   noDataText: {
//     fontSize: FONT_SIZE.lg,
//     fontWeight: '600',
//     color: COLORS.text,
//     marginBottom: SPACING.sm,
//   },
//   noDataSubtext: {
//     fontSize: FONT_SIZE.md,
//     color: COLORS.textLight,
//   },
//   actionContainer: {
//     marginBottom: SPACING.lg,
//   },
//   testButton: {
//     backgroundColor: COLORS.primary,
//     borderRadius: BORDER_RADIUS.lg,
//     padding: SPACING.lg,
//     alignItems: 'center',
//     marginBottom: SPACING.md,
//   },
//   testButtonText: {
//     fontSize: FONT_SIZE.lg,
//     fontWeight: '600',
//     color: COLORS.textWhite,
//   },
//   buttonDisabled: {
//     opacity: 0.6,
//   },
//   monitorButton: {
//     backgroundColor: COLORS.surface,
//     borderRadius: BORDER_RADIUS.lg,
//     padding: SPACING.lg,
//     alignItems: 'center',
//     borderWidth: 1,
//     borderColor: COLORS.primary,
//   },
//   monitorButtonActive: {
//     backgroundColor: COLORS.primary + '20',
//   },
//   monitorButtonText: {
//     fontSize: FONT_SIZE.md,
//     fontWeight: '600',
//     color: COLORS.primary,
//   },
//   infoCard: {
//     backgroundColor: COLORS.surface,
//     borderRadius: BORDER_RADIUS.lg,
//     padding: SPACING.lg,
//     marginBottom: SPACING.lg,
//   },
//   infoRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingVertical: SPACING.sm,
//   },
//   infoLabel: {
//     fontSize: FONT_SIZE.md,
//     color: COLORS.textLight,
//   },
//   infoValue: {
//     fontSize: FONT_SIZE.md,
//     fontWeight: '600',
//   },
//   historyCard: {
//     backgroundColor: COLORS.surface,
//     borderRadius: BORDER_RADIUS.lg,
//     padding: SPACING.lg,
//     marginBottom: SPACING.lg,
//   },
//   historyPlaceholder: {
//     height: 120,
//     backgroundColor: COLORS.background,
//     borderRadius: BORDER_RADIUS.md,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   historyPlaceholderText: {
//     fontSize: FONT_SIZE.sm,
//     color: COLORS.textLight,
//     textAlign: 'center',
//   },
//   errorCard: {
//     backgroundColor: COLORS.error + '15',
//     borderRadius: BORDER_RADIUS.lg,
//     padding: SPACING.lg,
//     marginBottom: SPACING.lg,
//     flexDirection: 'row',
//     alignItems: 'center',
//     borderWidth: 1,
//     borderColor: COLORS.error + '30',
//   },
//   errorIcon: {
//     fontSize: 24,
//     marginRight: SPACING.md,
//   },
//   errorText: {
//     flex: 1,
//     fontSize: FONT_SIZE.md,
//     color: COLORS.error,
//   },
//   warningCard: {
//     backgroundColor: COLORS.warning + '15',
//     borderRadius: BORDER_RADIUS.lg,
//     padding: SPACING.lg,
//     marginBottom: SPACING.lg,
//     flexDirection: 'row',
//     alignItems: 'center',
//     borderWidth: 1,
//     borderColor: COLORS.warning + '30',
//   },
//   warningIcon: {
//     fontSize: 24,
//     marginRight: SPACING.md,
//   },
//   warningContent: {
//     flex: 1,
//   },
//   warningTitle: {
//     fontSize: FONT_SIZE.md,
//     fontWeight: '600',
//     color: COLORS.warning,
//     marginBottom: SPACING.xs,
//   },
//   warningText: {
//     fontSize: FONT_SIZE.sm,
//     color: COLORS.textLight,
//   },
// });

// export default WiFiMonitorScreen;



/**
 * WiFi Monitor Screen - WiFi speed test dashboard
 * Fully responsive for all mobile screen sizes
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
  PixelRatio,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWiFi } from '../../context/WiFiContext';
import COLORS from '../../constants/colors';
import { SpeedTestResult } from '../../models/WiFi';

// ─── Responsive helpers ───────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');

const scale = (size: number) => Math.round((SCREEN_W / 375) * size);
const fontScale = PixelRatio.getFontScale();
const fs = (size: number) => Math.min(scale(size) / fontScale, size * 1.4);
const sp = (size: number) => Math.round(scale(size));

const isSmall  = SCREEN_W < 360;
const isTablet = SCREEN_W >= 600;
// ─────────────────────────────────────────────────────────────────────────────

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

  const [testing, setTesting]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [testError, setTestError]   = useState<string | null>(null);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleSpeedTest = async () => {
    setTesting(true);
    setTestError(null);
    try {
      await runSpeedTest();
    } catch (err: any) {
      const errorMessage = err.message || 'Speed test failed';
      let displayMessage = errorMessage;
      let errorTitle = 'Speed Test Failed';

      if (errorMessage.includes('WiFi') || errorMessage.includes('wifi') || errorMessage.includes('not connected')) {
        errorTitle = 'WiFi Not Connected';
        displayMessage = 'Please connect to a WiFi network to run the speed test.';
      } else if (errorMessage.includes('internet') || errorMessage.includes('network') || errorMessage.includes('Network')) {
        errorTitle = 'No Internet Connection';
        displayMessage = 'Your WiFi is connected but there is no internet. Please check your router or try again.';
      } else if (errorMessage.includes('server') || errorMessage.includes('Server')) {
        errorTitle = 'Server Unavailable';
        displayMessage = 'Speed test server is not responding. Please try again later.';
      }

      setTestError(displayMessage);
      Alert.alert(errorTitle, displayMessage, [{ text: 'OK' }]);
    } finally {
      setTesting(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setTestError(null);
    setRefreshing(false);
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const formatSpeed = (speed: number) => (speed === 0 ? '0' : speed.toFixed(2));

  const getStatusColor = (): string => {
    switch (status) {
      case 'active':  return COLORS.success;
      case 'error':   return COLORS.error;
      case 'waiting': return COLORS.warning;
      default:        return COLORS.textLight;
    }
  };

  const getSpeedQuality = (speed: number): { label: string; color: string } => {
    if (speed === 0) return { label: 'Not Tested', color: COLORS.textLight };
    if (speed < 10)  return { label: 'Poor',       color: COLORS.error };
    if (speed < 30)  return { label: 'Fair',       color: COLORS.warning };
    if (speed < 50)  return { label: 'Good',       color: COLORS.info };
    return                  { label: 'Excellent',  color: COLORS.success };
  };

  const speedQuality = lastSpeedTest
    ? getSpeedQuality(lastSpeedTest.download)
    : getSpeedQuality(0);

  // ─── Reusable sub-components ───────────────────────────────────────────────

  /** Card wrapper with consistent shadow */
  const Card = ({ children, style }: { children: React.ReactNode; style?: object }) => (
    <View style={[styles.card, style]}>{children}</View>
  );

  /** Card section heading */
  const CardTitle = ({ title }: { title: string }) => (
    <Text style={styles.cardTitle}>{title}</Text>
  );

  /** Label / value row inside a card */
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
      <Text style={styles.infoLabel} numberOfLines={2}>{label}</Text>
      <Text
        style={[styles.infoValue, valueColor ? { color: valueColor } : undefined]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );

  /** A single speed metric row (Download / Upload / Latency) */
  const SpeedRow = ({
    label,
    value,
    unit,
  }: {
    label: string;
    value: string;
    unit: string;
  }) => (
    <View style={styles.speedItem}>
      <Text style={styles.speedLabel}>{label}</Text>
      <View style={styles.speedValueContainer}>
        <Text style={styles.speedValue}>{value}</Text>
        <Text style={styles.speedUnit}>{unit}</Text>
      </View>
    </View>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3B82F6']}
            tintColor="#3B82F6"
          />
        }
      >

        {/* ── WiFi Status Card ──────────────────────────────────────────── */}
        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            {/* Icon bubble */}
            <View style={styles.statusIconBubble}>
              <Text style={styles.statusIconText}>📶</Text>
            </View>

            {/* Name + badge */}
            <View style={styles.statusInfo}>
              <Text
                style={styles.wifiName}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {wifiName || 'Not Connected'}
              </Text>
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                <Text style={[styles.statusText, { color: getStatusColor() }]}>
                  {isActive ? 'Connected' : 'Disconnected'}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* ── Error Banner ──────────────────────────────────────────────── */}
        {(contextError || testError) && (
          <View style={styles.errorCard}>
            <Text style={styles.alertIcon}>⚠️</Text>
            <Text style={styles.errorText} numberOfLines={4}>
              {contextError || testError}
            </Text>
          </View>
        )}

        {/* ── WiFi Disconnected Warning ─────────────────────────────────── */}
        {!isActive && status === 'idle' && !contextError && (
          <View style={styles.warningCard}>
            <Text style={styles.alertIcon}>📶</Text>
            <View style={styles.alertContent}>
              <Text style={styles.warningTitle}>WiFi Not Connected</Text>
              <Text style={styles.warningText} numberOfLines={3}>
                Please connect to a WiFi network to monitor speed and submit metrics.
              </Text>
            </View>
          </View>
        )}

        {/* ── Speed Test Results Card ───────────────────────────────────── */}
        <Card>
          <CardTitle title="Last Speed Test" />

          {lastSpeedTest ? (
            <>
              <SpeedRow
                label="Download"
                value={formatSpeed(lastSpeedTest.download)}
                unit="Mbps"
              />
              <SpeedRow
                label="Upload"
                value={formatSpeed(lastSpeedTest.upload)}
                unit="Mbps"
              />
              <SpeedRow
                label="Latency"
                value={lastSpeedTest.latency.toFixed(0)}
                unit="ms"
              />

              {/* Quality badge */}
              <View style={styles.qualityContainer}>
                <View style={[
                  styles.qualityBadge,
                  { backgroundColor: speedQuality.color + '20' },
                ]}>
                  <Text style={[styles.qualityText, { color: speedQuality.color }]}>
                    {speedQuality.label}
                  </Text>
                </View>
              </View>

              {/* Timestamp */}
              <Text style={styles.timestamp} numberOfLines={1} adjustsFontSizeToFit>
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
        </Card>

        {/* ── Action Buttons ────────────────────────────────────────────── */}
        <View style={styles.actionContainer}>
          {/* Run Speed Test */}
          <TouchableOpacity
            style={[styles.testButton, testing && styles.buttonDisabled]}
            onPress={handleSpeedTest}
            disabled={testing}
            activeOpacity={0.8}
          >
            {testing ? (
              <ActivityIndicator color={COLORS.textWhite} />
            ) : (
              <Text style={styles.testButtonText}>🚀 Run Speed Test</Text>
            )}
          </TouchableOpacity>

          {/* Start / Stop Monitoring */}
          <TouchableOpacity
            style={[
              styles.monitorButton,
              isMonitoring && styles.monitorButtonActive,
            ]}
            onPress={isMonitoring ? stopMonitoring : startMonitoring}
            activeOpacity={0.8}
          >
            <Text style={styles.monitorButtonText}>
              {isMonitoring ? '⏸️ Stop Monitoring' : '▶️ Start Monitoring'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Monitoring Status Card ────────────────────────────────────── */}
        <Card>
          <CardTitle title="Monitoring Status" />
          <InfoRow
            label="Status"
            value={status.toUpperCase()}
            valueColor={getStatusColor()}
          />
          <View style={styles.divider} />
          <InfoRow
            label="Background Monitoring"
            value={isMonitoring ? 'Active' : 'Inactive'}
            valueColor={isMonitoring ? COLORS.success : COLORS.textLight}
          />
          <View style={styles.divider} />
          <InfoRow
            label="Device Authenticated"
            value={isActive ? 'Yes' : 'No'}
            valueColor={isActive ? COLORS.success : COLORS.warning}
          />
        </Card>

        {/* ── Speed History (placeholder) ───────────────────────────────── */}
        <Card style={styles.historyCard}>
          <CardTitle title="Speed History" />
          <View style={styles.historyPlaceholder}>
            <Text style={styles.historyPlaceholderText}>
              📈 Speed history chart will be displayed here
            </Text>
          </View>
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const cardShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
  },
  android: { elevation: 2 },
});

const styles = StyleSheet.create({
  // ─ Layout ────────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: sp(16),
    paddingBottom: sp(40),
    gap: sp(14),          // uniform gap between cards; RN 0.71+ supports gap
  },

  // ─ Generic card ──────────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: sp(14),
    padding: sp(16),
    ...cardShadow,
  },

  // ─ Card title ────────────────────────────────────────────────────────────
  cardTitle: {
    fontSize: fs(15),
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: sp(12),
  },

  // ─ WiFi status card ───────────────────────────────────────────────────────
  statusCard: {
    // no extra overrides needed — uses generic card style
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIconBubble: {
    width: sp(isSmall ? 44 : 52),
    height: sp(isSmall ? 44 : 52),
    borderRadius: sp(isSmall ? 22 : 26),
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: sp(14),
    flexShrink: 0,
  },
  statusIconText: {
    fontSize: fs(isSmall ? 20 : 24),
  },
  statusInfo: {
    flex: 1,
    minWidth: 0,           // required for text truncation inside flex child
  },
  wifiName: {
    fontSize: fs(isSmall ? 16 : 18),
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: sp(4),
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: sp(8),
    height: sp(8),
    borderRadius: sp(4),
    marginRight: sp(6),
  },
  statusText: {
    fontSize: fs(12),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ─ Error / warning banners ────────────────────────────────────────────────
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.error + '15',
    borderRadius: sp(12),
    padding: sp(14),
    borderWidth: 1,
    borderColor: COLORS.error + '30',
    gap: sp(10),
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.warning + '15',
    borderRadius: sp(12),
    padding: sp(14),
    borderWidth: 1,
    borderColor: COLORS.warning + '30',
    gap: sp(10),
  },
  alertIcon: {
    fontSize: fs(isSmall ? 18 : 22),
    lineHeight: fs(28),
    flexShrink: 0,
  },
  alertContent: {
    flex: 1,
    minWidth: 0,
  },
  errorText: {
    flex: 1,
    fontSize: fs(13),
    color: COLORS.error,
    lineHeight: fs(19),
  },
  warningTitle: {
    fontSize: fs(14),
    fontWeight: '600',
    color: COLORS.warning,
    marginBottom: sp(3),
  },
  warningText: {
    fontSize: fs(13),
    color: COLORS.textLight,
    lineHeight: fs(18),
  },

  // ─ Speed rows ─────────────────────────────────────────────────────────────
  speedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sp(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  speedLabel: {
    fontSize: fs(14),
    color: COLORS.textLight,
    flexShrink: 0,
  },
  speedValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: sp(4),
  },
  speedValue: {
    fontSize: fs(isSmall ? 20 : 24),
    fontWeight: '700',
    color: COLORS.text,
  },
  speedUnit: {
    fontSize: fs(12),
    color: COLORS.textLight,
    fontWeight: '500',
  },

  // ─ Quality badge ──────────────────────────────────────────────────────────
  qualityContainer: {
    alignItems: 'center',
    marginTop: sp(14),
  },
  qualityBadge: {
    paddingHorizontal: sp(20),
    paddingVertical: sp(7),
    borderRadius: sp(20),
  },
  qualityText: {
    fontSize: fs(14),
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ─ Timestamp ──────────────────────────────────────────────────────────────
  timestamp: {
    fontSize: fs(11),
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: sp(10),
  },

  // ─ No data placeholder ───────────────────────────────────────────────────
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: sp(isSmall ? 24 : 32),
  },
  noDataIcon: {
    fontSize: fs(isSmall ? 36 : 44),
    marginBottom: sp(12),
  },
  noDataText: {
    fontSize: fs(15),
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: sp(4),
    textAlign: 'center',
  },
  noDataSubtext: {
    fontSize: fs(13),
    color: COLORS.textLight,
    textAlign: 'center',
  },

  // ─ Action buttons ─────────────────────────────────────────────────────────
  actionContainer: {
    gap: sp(10),
  },
  testButton: {
    backgroundColor: COLORS.primary,
    borderRadius: sp(12),
    paddingVertical: sp(isSmall ? 13 : 15),
    alignItems: 'center',
    minHeight: sp(50),
    justifyContent: 'center',
    ...cardShadow,
  },
  testButtonText: {
    fontSize: fs(isSmall ? 14 : 15),
    fontWeight: '700',
    color: COLORS.textWhite,
    letterSpacing: 0.2,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  monitorButton: {
    backgroundColor: COLORS.surface,
    borderRadius: sp(12),
    paddingVertical: sp(isSmall ? 13 : 15),
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    minHeight: sp(50),
    justifyContent: 'center',
  },
  monitorButtonActive: {
    backgroundColor: COLORS.primary + '18',
  },
  monitorButtonText: {
    fontSize: fs(isSmall ? 13 : 14),
    fontWeight: '600',
    color: COLORS.primary,
  },

  // ─ Info rows (Monitoring Status card) ────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sp(10),
    gap: sp(12),
  },
  infoLabel: {
    fontSize: fs(13),
    color: COLORS.textLight,
    flexShrink: 1,           // shrink label on narrow screens before value
    flex: 1,
  },
  infoValue: {
    fontSize: fs(13),
    fontWeight: '600',
    color: COLORS.text,
    flexShrink: 0,
    textAlign: 'right',
    maxWidth: isTablet ? 220 : isSmall ? 100 : 140,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
  },

  // ─ History placeholder ────────────────────────────────────────────────────
  historyCard: {
    // uses generic card style
  },
  historyPlaceholder: {
    height: sp(isSmall ? 90 : 110),
    backgroundColor: COLORS.background,
    borderRadius: sp(10),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: sp(16),
  },
  historyPlaceholderText: {
    fontSize: fs(12),
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: fs(18),
  },
});

export default WiFiMonitorScreen;