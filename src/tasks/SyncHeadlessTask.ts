/**
 * Headless JS Task for Background Sync
 * This task runs without the React Native JS context being active
 * Used for background sync when app is minimized or screen is locked
 *
 * IMPORTANT: This function must be synchronous and not use any React Native components
 */

import { Platform } from 'react-native';
import { SyncService } from '../services/SyncService';
import { SMSService } from '../services/SMSService';

// Headless task name - must match the name used in MainApplication.kt
export const HEADLESS_TASK_NAME = 'BackgroundSyncTask';

interface SyncTriggerData {
  simIds?: string[];
  syncInterval?: number;
  mobileNumber?: string;
}

/**
 * Headless task function that runs in background
 * This is called directly from native code via Headless JS
 */
const backgroundSyncTask = async (taskData: SyncTriggerData | null) => {
  console.log('[HeadlessSync] ========== HEADLESS SYNC STARTED ==========');
  console.log('[HeadlessSync] Task data:', JSON.stringify(taskData));

  if (Platform.OS !== 'android') {
    console.log('[HeadlessSync] Not Android, skipping');
    return;
  }

  try {
    // Perform call log sync
    console.log('[HeadlessSync] Starting call log sync...');
    try {
      const callLogResult = await SyncService.sync();
      console.log('[HeadlessSync] Call log sync result:', JSON.stringify(callLogResult));
    } catch (callError) {
      console.error('[HeadlessSync] Call log sync failed:', callError);
    }

    // Perform SMS sync
    console.log('[HeadlessSync] Starting SMS sync...');
    try {
      const smsResult = await SMSService.sync();
      console.log('[HeadlessSync] SMS sync result:', JSON.stringify(smsResult));
    } catch (smsError) {
      console.error('[HeadlessSync] SMS sync failed:', smsError);
    }

    console.log('[HeadlessSync] ========== HEADLESS SYNC COMPLETED ==========');
  } catch (error) {
    console.error('[HeadlessSync] Error during headless sync:', error);
  }
};

export default backgroundSyncTask;

/**
 * Register the headless task
 * This is called from index.js
 */
export const registerBackgroundSyncTask = () => {
  if (Platform.OS !== 'android') {
    return;
  }

  const { AppRegistry } = require('react-native');
  AppRegistry.registerHeadlessTask(HEADLESS_TASK_NAME, () => backgroundSyncTask);
  console.log('[HeadlessSync] Headless task registered:', HEADLESS_TASK_NAME);
};

/**
 * Setup background sync event listener (for when app is in foreground)
 * This listens for events from the native Android foreground service
 */
export const setupBackgroundSyncListener = () => {
  if (Platform.OS !== 'android') {
    return;
  }

  const { DeviceEventEmitter } = require('react-native');

  DeviceEventEmitter.addListener('BackgroundSyncTrigger', async (data: SyncTriggerData) => {
    console.log('[BackgroundSync] ========== SYNC TRIGGERED (FOREGROUND) ==========');
    console.log('[BackgroundSync] Received sync trigger event');
    console.log('[BackgroundSync] Data:', JSON.stringify(data));

    try {
      // Perform call log sync
      console.log('[BackgroundSync] Starting call log sync...');
      try {
        const callLogResult = await SyncService.sync();
        console.log('[BackgroundSync] Call log sync result:', JSON.stringify(callLogResult));
      } catch (callError) {
        console.error('[BackgroundSync] Call log sync failed:', callError);
      }

      // Perform SMS sync
      console.log('[BackgroundSync] Starting SMS sync...');
      try {
        const smsResult = await SMSService.sync();
        console.log('[BackgroundSync] SMS sync result:', JSON.stringify(smsResult));
      } catch (smsError) {
        console.error('[BackgroundSync] SMS sync failed:', smsError);
      }

      console.log('[BackgroundSync] ========== SYNC COMPLETED ==========');
    } catch (error) {
      console.error('[BackgroundSync] Error during sync:', error);
    }
  });

  console.log('[BackgroundSync] Event listener registered');
};