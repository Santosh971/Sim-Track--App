/**
 * Battery Optimization Utility
 * Helps manage battery optimization settings for reliable background execution
 */

import { Platform } from 'react-native';
import BackgroundSync from '../native/BackgroundSyncModule';

/**
 * Check if the app is ignoring battery optimizations
 * Returns true if whitelisted (not affected by Doze mode)
 */
export async function isIgnoringBatteryOptimizations(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true; // iOS doesn't have this restriction
  }

  try {
    const isIgnoring = await BackgroundSync.isIgnoringBatteryOptimizations();
    console.log('[BatteryOptimization] Is ignoring battery optimizations:', isIgnoring);
    return isIgnoring;
  } catch (error) {
    console.error('[BatteryOptimization] Error checking battery optimization status:', error);
    return false;
  }
}

/**
 * Request to ignore battery optimizations
 * Opens system dialog asking user to whitelist the app
 */
export async function requestIgnoreBatteryOptimizations(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const result = await BackgroundSync.requestIgnoreBatteryOptimizations();
    console.log('[BatteryOptimization] Request result:', result);
    return result;
  } catch (error) {
    console.error('[BatteryOptimization] Error requesting battery optimization exemption:', error);
    return false;
  }
}

/**
 * Open battery optimization settings
 * Opens the battery optimization settings screen where user can manually whitelist
 */
export async function openBatterySettings(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const result = await BackgroundSync.openBatterySettings();
    console.log('[BatteryOptimization] Opened battery settings');
    return result;
  } catch (error) {
    console.error('[BatteryOptimization] Error opening battery settings:', error);
    return false;
  }
}

/**
 * Check battery optimization and prompt user if needed
 * Returns true if already whitelisted, false otherwise
 */
export async function checkAndPromptBatteryOptimization(): Promise<{
  isIgnoring: boolean;
  prompted: boolean;
}> {
  if (Platform.OS !== 'android') {
    return { isIgnoring: true, prompted: false };
  }

  try {
    const isIgnoring = await isIgnoringBatteryOptimizations();

    if (isIgnoring) {
      console.log('[BatteryOptimization] App is already whitelisted');
      return { isIgnoring: true, prompted: false };
    }

    // Not whitelisted - request exemption
    console.log('[BatteryOptimization] Requesting battery optimization exemption...');
    const prompted = await requestIgnoreBatteryOptimizations();

    return { isIgnoring: false, prompted };
  } catch (error) {
    console.error('[BatteryOptimization] Error in checkAndPrompt:', error);
    return { isIgnoring: false, prompted: false };
  }
}

/**
 * Get battery optimization status message for UI
 */
export function getBatteryOptimizationMessage(isIgnoring: boolean): {
  title: string;
  message: string;
  action: string;
} {
  if (isIgnoring) {
    return {
      title: 'Battery Optimization Enabled',
      message: 'Background sync is working properly.',
      action: '',
    };
  }

  return {
    title: 'Battery Optimization Detected',
    message: 'For reliable background WiFi speed monitoring, please disable battery optimization for this app. This allows the app to sync data even when the screen is off.',
    action: 'Disable Battery Optimization',
  };
}

export default {
  isIgnoringBatteryOptimizations,
  requestIgnoreBatteryOptimizations,
  openBatterySettings,
  checkAndPromptBatteryOptimization,
  getBatteryOptimizationMessage,
};