/**
 * SMS Service - Handles reading and syncing SMS messages
 * Uses simNumber (phone number) for API calls
 *
 * API: POST /sms/sync
 * Body: { simNumber: "+919175745760", messages: [...] }
 */

import { Platform } from 'react-native';
import { smsApi } from '../api/index';
import { DeviceSMS, APISMS, toAPISMS, SMSSyncResult } from '../models/index';
import { StorageService } from './StorageService';
import { SIMManager } from './SIMManager';
import SMSModule from '../native/SMSModule';

// Storage key for last SMS sync
const LAST_SMS_SYNC_KEY = 'last_sms_sync_timestamp';

// Maximum messages per API request (reduced to prevent timeouts)
const MAX_MESSAGES_PER_REQUEST = 50;

// Sync lock to prevent multiple simultaneous syncs
let isSyncInProgress = false;
let syncLockTime = 0;
const SYNC_LOCK_TIMEOUT = 2 * 60 * 1000; // 2 minutes timeout for sync lock (reduced from 5)

/**
 * Reset the sync lock (for recovery from stuck state)
 * Can be called manually if sync appears stuck
 */
export const resetSyncLock = () => {
  console.log('[SMSService] Resetting sync lock');
  isSyncInProgress = false;
  syncLockTime = 0;
};

/**
 * Check if sync is currently in progress
 */
export const isSyncing = () => isSyncInProgress;

/**
 * SMS Service for reading and syncing SMS messages
 */
export const SMSService = {
  /**
   * Check if SMS permissions are granted
   */
  async checkPermissions(): Promise<{ readSms: boolean; readPhoneState: boolean }> {
    if (Platform.OS !== 'android') {
      return { readSms: false, readPhoneState: false };
    }
    return await SMSModule.checkPermissions();
  },

  /**
   * Request SMS permissions
   */
  async requestPermissions(): Promise<{ readSms: boolean; readPhoneState: boolean }> {
    if (Platform.OS !== 'android') {
      return { readSms: false, readPhoneState: false };
    }
    return await SMSModule.requestPermissions();
  },

  /**
   * Get SMS messages from device
   * @param lastSyncTimestamp - Optional timestamp to filter messages after this time
   */
  async getSMSMessages(lastSyncTimestamp?: number): Promise<DeviceSMS[]> {
    if (Platform.OS !== 'android') {
      console.warn('[SMSService] SMS reading is only available on Android');
      return [];
    }

    try {
      // Check permissions first
      const permissions = await this.checkPermissions();
      if (!permissions.readSms) {
        console.warn('[SMSService] READ_SMS permission not granted. Please grant SMS permission in app settings.');
        console.warn('[SMSService] To grant: Go to Settings > Apps > SIM Management > Permissions > SMS');
        return [];
      }

      // First check total SMS count on device
      const totalCount = await SMSModule.getSMSCount();
      console.log('[SMSService] Total SMS count on device:', totalCount);

      if (totalCount === 0) {
        console.log('[SMSService] No SMS messages found on device');
        return [];
      }

      // Fetch ALL SMS messages (no timestamp filter)
      // Let backend handle deduplication
      console.log('[SMSService] READ_SMS permission granted, fetching ALL messages...');
      const messages = await SMSModule.getSMSMessages(); // No timestamp = fetch all
      console.log('[SMSService] Fetched', messages.length, 'SMS messages from device');

      // Log sample messages for debugging
      if (messages.length > 0) {
        console.log('[SMSService] Sample messages (first 5):');
        messages.slice(0, 5).forEach((msg, idx) => {
          console.log(`[SMSService] Message ${idx + 1}:`, {
            id: msg._id,
            sender: msg.sender,
            message: msg.message?.substring(0, 50) + '...', // First 50 chars
            timestamp: new Date(msg.timestamp).toISOString(),
            type: msg.type,
            simSlotIndex: msg.simSlotIndex,
          });
        });
      } else {
        console.warn('[SMSService] No SMS messages returned from native module!');
      }

      // Convert native timestamp (number in ms) to ISO string for DeviceSMS
      return messages.map(msg => ({
        _id: msg._id,
        sender: msg.sender,
        message: msg.message,
        timestamp: new Date(msg.timestamp).toISOString(),
        type: msg.type,
        simSlotIndex: msg.simSlotIndex,
      }));
    } catch (error: any) {
      console.error('[SMSService] Error getting SMS messages:', error);
      return [];
    }
  },

  /**
   * Get total SMS count on device
   */
  async getSMSCount(): Promise<number> {
    if (Platform.OS !== 'android') {
      return 0;
    }
    return await SMSModule.getSMSCount();
  },

  /**
   * Get SMS counts by type (total, inbox, sent)
   * Efficient method that doesn't require fetching all messages
   */
  async getSMSCounts(): Promise<{ total: number; inbox: number; sent: number }> {
    if (Platform.OS !== 'android') {
      return { total: 0, inbox: 0, sent: 0 };
    }

    try {
      const counts = await SMSModule.getSMSCounts();
      return counts;
    } catch (error) {
      console.error('[SMSService] Error getting SMS counts:', error);
      return { total: 0, inbox: 0, sent: 0 };
    }
  },

  /**
   * Sync SMS messages to backend for all active SIMs
   * API: POST /sms/sync
   *
   * Syncs for all active matched SIMs (both physical and virtual).
   * Uses phone number from company SIM data as identifier.
   */
  async sync(): Promise<SMSSyncResult> {
    console.log('[SMSService] ========== SMS SYNC STARTED ==========');
    console.log('[SMSService] Platform:', Platform.OS);
    console.log('[SMSService] Sync lock state:', { isSyncInProgress, syncLockTime: syncLockTime ? new Date(syncLockTime).toISOString() : 'never' });

    // Check if sync lock is stale (stuck for more than timeout)
    const now = Date.now();
    if (isSyncInProgress && syncLockTime > 0) {
      const lockAge = now - syncLockTime;
      console.log('[SMSService] Lock age:', Math.floor(lockAge / 1000), 'seconds');

      if (lockAge > SYNC_LOCK_TIMEOUT) {
        console.log('[SMSService] Sync lock is stale (older than', Math.floor(SYNC_LOCK_TIMEOUT / 60000), 'minutes), releasing it');
        isSyncInProgress = false;
        syncLockTime = 0;
      }
    }

    // Prevent multiple simultaneous syncs
    if (isSyncInProgress) {
      console.log('[SMSService] Sync already in progress, skipping');
      console.log('[SMSService] If sync appears stuck, call SMSService.resetSyncLock() to reset');
      return {
        success: false,
        synced: 0,
        failed: 0,
        message: 'SMS sync already in progress. Please wait.',
      };
    }

    // Acquire sync lock
    isSyncInProgress = true;
    syncLockTime = Date.now();
    console.log('[SMSService] Sync lock acquired at:', new Date(syncLockTime).toISOString());

    if (Platform.OS !== 'android') {
      console.log('[SMSService] Not Android, skipping');
      isSyncInProgress = false;
      syncLockTime = 0;
      return {
        success: false,
        synced: 0,
        failed: 0,
        message: 'SMS sync only available on Android',
      };
    }

    try {
      // Check permissions FIRST
      console.log('[SMSService] Checking permissions...');
      const permissions = await this.checkPermissions();
      console.log('[SMSService] Permissions:', JSON.stringify(permissions));

      if (!permissions.readSms) {
        console.error('[SMSService] READ_SMS permission NOT granted');
        return {
          success: false,
          synced: 0,
          failed: 0,
          message: 'READ_SMS permission not granted. Grant SMS permission in app settings.',
        };
      }

      console.log('[SMSService] READ_SMS permission GRANTED');

      // Get matched SIMs
      const matchedSIMs = await SIMManager.getMatchedSIMs();
      console.log('[SMSService] Matched SIMs:', matchedSIMs.length);

      if (matchedSIMs.length === 0) {
        return {
          success: false,
          synced: 0,
          failed: 0,
          message: 'No SIMs available for SMS sync.',
        };
      }

      // Sync for ALL active matched SIMs (both physical and virtual)
      // For physical SIMs (isFromDevice: true): We have actual device detection
      // For virtual SIMs (isFromDevice: false): We use company SIM data for identification
      // Both cases can sync SMS using the phone number as identifier
      const activeSIMs = matchedSIMs.filter(sim => sim.isActive);

      console.log('[SMSService] Active SIMs for SMS sync:', activeSIMs.length);
      console.log('[SMSService] Active SIMs:', activeSIMs.map(s => ({
        phone: s.phoneNumber,
        isFromDevice: s.isFromDevice,
        slot: s.slotIndex
      })));

      if (activeSIMs.length === 0) {
        // No active SIMs available
        return {
          success: false,
          synced: 0,
          failed: 0,
          message: 'No active SIMs available for SMS sync. Please ensure SIMs are registered.',
        };
      }

      // Sync for each active SIM
      let totalSynced = 0;
      let totalFailed = 0;
      let hasErrors = false;

      for (const sim of activeSIMs) {
        console.log(`[SMSService] Syncing SMS for SIM: ${sim.phoneNumber} (slot ${sim.slotIndex}, isFromDevice: ${sim.isFromDevice})`);
        const result = await this.syncBySimNumber(sim.phoneNumber);
        if (result.success) {
          totalSynced += result.synced;
        } else {
          totalFailed += result.failed;
          hasErrors = true;
        }
      }

      console.log('[SMSService] ========== SMS SYNC COMPLETE ==========');
      console.log('[SMSService] Total synced:', totalSynced, ', Total failed:', totalFailed);

      return {
        success: !hasErrors,
        synced: totalSynced,
        failed: totalFailed,
        message: hasErrors
          ? `Synced ${totalSynced} SMS, ${totalFailed} failed`
          : `Successfully synced ${totalSynced} SMS messages`,
      };
    } catch (error: any) {
      console.error('[SMSService] ========== SMS SYNC ERROR ==========');
      console.error('[SMSService] Error:', error?.message || error);
      console.error('[SMSService] Stack:', error?.stack);

      return {
        success: false,
        synced: 0,
        failed: 0,
        message: 'Failed to sync SMS: ' + (error?.message || 'Unknown error'),
        error: error?.message,
      };
    } finally {
      // Always release sync lock
      console.log('[SMSService] Releasing sync lock');
      isSyncInProgress = false;
      syncLockTime = 0;
    }
  },

  /**
   * Sync SMS messages for a specific SIM using simNumber
   * API: POST /sms/sync
   */
  async syncBySimNumber(simNumber: string): Promise<SMSSyncResult> {
    try {
      console.log(`[SMSService] ========== SYNC BY SIM NUMBER ==========`);
      console.log(`[SMSService] Sync SMS for SIM: ${simNumber}`);

      // Get SMS messages from device
      let deviceMessages: DeviceSMS[] = [];
      try {
        deviceMessages = await this.getSMSMessages();
        console.log(`[SMSService] Found ${deviceMessages.length} SMS messages`);
      } catch (fetchError: any) {
        console.error(`[SMSService] Error fetching SMS:`, fetchError.message);
        return {
          success: false,
          synced: 0,
          failed: 0,
          message: 'Failed to read SMS from device: ' + fetchError.message,
        };
      }

      if (deviceMessages.length === 0) {
        console.log(`[SMSService] No SMS messages to sync`);
        return {
          success: true,
          synced: 0,
          failed: 0,
          message: 'No new SMS messages to sync.',
        };
      }

      // Limit to 50 messages to prevent crashes
      const messagesToSync = deviceMessages.slice(0, 50);
      console.log(`[SMSService] Syncing ${messagesToSync.length} messages (limited to prevent crash)`);

      // Convert to API format
      const messages: APISMS[] = messagesToSync.map(toAPISMS);

      // Sync with timeout
      let totalSynced = 0;
      let hasError = false;
      let errorMessage = '';

      try {
        // Add timeout wrapper
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('SMS sync timeout')), 60000);
        });

        const response = await Promise.race([
          smsApi.sync(simNumber, messages),
          timeoutPromise
        ]) as any;

        console.log(`[SMSService] API Response:`, JSON.stringify(response));

        if (response && response.success) {
          totalSynced = response.data?.synced || response.data?.inserted || messages.length;
          console.log(`[SMSService] Synced: ${totalSynced} messages`);
        } else {
          hasError = true;
          errorMessage = response?.message || 'API returned error';
          console.error(`[SMSService] Sync failed:`, errorMessage);
        }
      } catch (syncError: any) {
        console.error(`[SMSService] Sync error:`, syncError.message);
        hasError = true;
        errorMessage = syncError.message || 'Sync failed';
      }

      console.log(`[SMSService] ========== SYNC COMPLETE ==========`);

      return {
        success: !hasError,
        synced: totalSynced,
        failed: hasError ? messages.length - totalSynced : 0,
        message: hasError
          ? `Sync failed: ${errorMessage}`
          : `Successfully synced ${totalSynced} SMS messages`,
      };
    } catch (error: any) {
      console.error(`[SMSService] ========== SYNC ERROR ==========`);
      console.error(`[SMSService] Error:`, error.message);
      return {
        success: false,
        synced: 0,
        failed: 0,
        message: 'SMS sync failed: ' + (error.message || 'Unknown error'),
        error: error.message,
      };
    }
  },

  /**
   * Sync provided SMS messages (for manual/testing purposes)
   * Use this when you have SMS data from another source
   */
  async syncMessages(simNumber: string, messages: DeviceSMS[]): Promise<SMSSyncResult> {
    console.log(`[SMSService] Syncing ${messages.length} messages for ${simNumber}`);

    try {
      if (messages.length === 0) {
        return {
          success: true,
          synced: 0,
          failed: 0,
          message: 'No SMS messages to sync.',
        };
      }

      // Convert to API format
      const apiMessages = messages.map(toAPISMS);

      // Batch messages if needed
      const batches = this.batchMessages(apiMessages, MAX_MESSAGES_PER_REQUEST);
      let totalSynced = 0;
      let totalFailed = 0;
      let hasError = false;

      for (const batch of batches) {
        const response = await smsApi.sync(simNumber, batch);

        if (response.success) {
          totalSynced += response.data?.synced || batch.length;
        } else {
          totalFailed += batch.length;
          hasError = true;
        }
      }

      return {
        success: !hasError,
        synced: totalSynced,
        failed: totalFailed,
        message: hasError
          ? `Partially synced: ${totalSynced} success, ${totalFailed} failed`
          : `Successfully synced ${totalSynced} SMS messages`,
      };
    } catch (error: any) {
      console.error(`[SMSService] Sync messages error:`, error);
      return {
        success: false,
        synced: 0,
        failed: messages.length,
        message: error.message || 'SMS sync failed',
        error: error.message,
      };
    }
  },

  /**
   * Batch messages into groups of specified size
   */
  batchMessages(messages: APISMS[], batchSize: number): APISMS[][] {
    const batches: APISMS[][] = [];
    for (let i = 0; i < messages.length; i += batchSize) {
      batches.push(messages.slice(i, i + batchSize));
    }
    return batches;
  },

  /**
   * Get last SMS sync timestamp
   */
  async getLastSync(): Promise<number | null> {
    const timestamp = await StorageService.getItem(LAST_SMS_SYNC_KEY);
    return timestamp ? parseInt(timestamp, 10) : null;
  },

  /**
   * Clear last SMS sync timestamp (useful for testing or if corrupted)
   */
  async clearLastSync(): Promise<void> {
    await StorageService.removeItem(LAST_SMS_SYNC_KEY);
    // console.log('[SMSService] Cleared last SMS sync timestamp');
  },

  /**
   * Format last sync time for display
   */
  formatLastSync(timestamp: number | null): string {
    if (!timestamp) return 'Never';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
  },

  /**
   * Reset the sync lock (for recovery from stuck state)
   * Call this if SMS sync appears stuck
   */
  resetSyncLock,

  /**
   * Check if sync is currently in progress
   */
  isSyncing,
};

export default SMSService;