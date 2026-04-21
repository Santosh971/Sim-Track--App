/**
 * Background Sync Event Handler
 * Listens for sync trigger events from the native foreground service
 */

import { DeviceEventEmitter, Platform } from 'react-native';
import { SyncService } from '../services/SyncService';
import { StorageService } from '../services/StorageService';

interface SyncTriggerData {
  mobileNumber: string;
  syncInterval: number;
}

/**
 * Setup background sync event listener
 * This listens for events from the native Android foreground service
 */
export const setupBackgroundSyncListener = () => {
  if (Platform.OS !== 'android') {
    return;
  }

  DeviceEventEmitter.addListener('BackgroundSyncTrigger', async (data: SyncTriggerData) => {
    console.log('[BackgroundSync] Received sync trigger event');

    try {
      // Get mobile number from storage if not provided
      const mobileNumber = data?.mobileNumber || await StorageService.getMobileNumber();

      if (!mobileNumber) {
        console.log('[BackgroundSync] No mobile number found, skipping sync');
        return;
      }

      // Perform the sync
      const result = await SyncService.sync();

      console.log('[BackgroundSync] Sync result:', result);
    } catch (error) {
      console.error('[BackgroundSync] Error during sync:', error);
    }
  });

  console.log('[BackgroundSync] Event listener registered');
};

export default setupBackgroundSyncListener;