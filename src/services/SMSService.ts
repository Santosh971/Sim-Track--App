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

      if (totalCount === 0) {
        return [];
      }

      // Fetch ALL SMS messages (no timestamp filter)
      // Let backend handle deduplication
      const messages = await SMSModule.getSMSMessages(); // No timestamp = fetch all

      // Log sample messages for debugging
      if (messages.length > 0) {
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
 
    // Check if sync lock is stale (stuck for more than timeout)
    const now = Date.now();
    if (isSyncInProgress && syncLockTime > 0) {
      const lockAge = now - syncLockTime;

      if (lockAge > SYNC_LOCK_TIMEOUT) {
        isSyncInProgress = false;
        syncLockTime = 0;
      }
    }

    // Prevent multiple simultaneous syncs
    if (isSyncInProgress) {
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

    if (Platform.OS !== 'android') {
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
      const permissions = await this.checkPermissions();

      if (!permissions.readSms) {
        console.error('[SMSService] READ_SMS permission NOT granted');
        return {
          success: false,
          synced: 0,
          failed: 0,
          message: 'READ_SMS permission not granted. Grant SMS permission in app settings.',
        };
      }


      // Get matched SIMs
      const matchedSIMs = await SIMManager.getMatchedSIMs();

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
        const result = await this.syncBySimNumber(sim.phoneNumber);
        if (result.success) {
          totalSynced += result.synced;
        } else {
          totalFailed += result.failed;
          hasErrors = true;
        }
      }


      return {
        success: !hasErrors,
        synced: totalSynced,
        failed: totalFailed,
        message: hasErrors
          ? `Synced ${totalSynced} SMS, ${totalFailed} failed`
          : `Successfully synced  SMS messages`,
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

      // Get SMS messages from device
      let deviceMessages: DeviceSMS[] = [];
      try {
        deviceMessages = await this.getSMSMessages();
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
        return {
          success: true,
          synced: 0,
          failed: 0,
          message: 'No new SMS messages to sync.',
        };
      }

      // Limit to 50 messages to prevent crashes
      const messagesToSync = deviceMessages.slice(0, 50);

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


        if (response && response.success) {
          totalSynced = response.data?.synced || response.data?.inserted || messages.length;
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


      return {
        success: !hasError,
        synced: totalSynced,
        failed: hasError ? messages.length - totalSynced : 0,
        message: hasError
          ? `Sync failed: ${errorMessage}`
          : `Successfully synced  SMS messages`,
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
          : `Successfully synced SMS messages`,
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
   * NEW: Sync SMS only for the registered/authenticated SIM
   * This function gets the registered SIM number from WiFi or Call Automation
   * and syncs SMS only for that specific SIM, not all SIMs.
   *
   * @returns Promise<SMSSyncResult> - Result of the sync operation
   */
  async syncForRegisteredSimOnly(): Promise<SMSSyncResult> {
    console.log('[SMSService] ========== SYNC FOR REGISTERED SIM ONLY ==========');

    // Check if sync is already in progress
    const now = Date.now();
    if (isSyncInProgress) {
      const lockAge = now - syncLockTime;
      if (lockAge < 60000) {
        console.log('[SMSService] Sync already in progress, skipping...');
        return {
          success: false,
          synced: 0,
          failed: 0,
          message: 'SMS sync already in progress. Please wait.',
        };
      } else {
        // Lock is stale, reset it
        isSyncInProgress = false;
        syncLockTime = 0;
      }
    }

    try {
      // Acquire sync lock
      isSyncInProgress = true;
      syncLockTime = Date.now();

      // Check permissions
      const permissions = await this.checkPermissions();
      if (!permissions.readSms) {
        console.error('[SMSService] READ_SMS permission NOT granted');
        isSyncInProgress = false;
        syncLockTime = 0;
        return {
          success: false,
          synced: 0,
          failed: 0,
          message: 'READ_SMS permission not granted. Grant SMS permission in app settings.',
        };
      }

      // Step 1: Get the registered SIM number
      const registeredSimNumber = await this.getRegisteredSimNumber();

      if (!registeredSimNumber) {
        console.log('[SMSService] No registered SIM found, falling back to sync all SIMs');
        isSyncInProgress = false;
        syncLockTime = 0;
        // Fallback to regular sync if no registered SIM
        return this.sync();
      }

      console.log('[SMSService] Registered SIM number:', registeredSimNumber);

      // Step 2: Verify this SIM is in matched SIMs
      const matchedSIMs = await SIMManager.getMatchedSIMs();
      const registeredSIM = matchedSIMs.find(
        sim => this.normalizePhoneNumber(sim.phoneNumber) === this.normalizePhoneNumber(registeredSimNumber)
      );

      if (!registeredSIM) {
        console.warn('[SMSService] Registered SIM not found in matched SIMs');
        console.log('[SMSService] Available matched SIMs:', matchedSIMs.map(s => s.phoneNumber));
        isSyncInProgress = false;
        syncLockTime = 0;
        return {
          success: false,
          synced: 0,
          failed: 0,
          message: 'Registered SIM not found in device. Please re-authenticate.',
        };
      }

      if (!registeredSIM.isActive) {
        console.warn('[SMSService] Registered SIM is not active');
        isSyncInProgress = false;
        syncLockTime = 0;
        return {
          success: false,
          synced: 0,
          failed: 0,
          message: 'Registered SIM is not active.',
        };
      }

      console.log('[SMSService] Syncing SMS for registered SIM only:', registeredSIM.phoneNumber);

      // Step 3: Sync only for the registered SIM
      const result = await this.syncBySimNumber(registeredSIM.phoneNumber);

      // Release sync lock
      isSyncInProgress = false;
      syncLockTime = 0;

      return result;

    } catch (error: any) {
      console.error('[SMSService] Sync for registered SIM error:', error);
      isSyncInProgress = false;
      syncLockTime = 0;

      return {
        success: false,
        synced: 0,
        failed: 0,
        message: 'Failed to sync SMS: ' + (error?.message || 'Unknown error'),
        error: error?.message,
      };
    }
  },

  /**
   * Get the registered/authenticated SIM number
   * Checks WiFi authentication first, then Call Automation
   *
   * @returns Promise<string | null> - The registered SIM number or null if not found
   */
  async getRegisteredSimNumber(): Promise<string | null> {
    try {
      // First, try to get from WiFi authentication
      const wifiSimNumber = await this.getWifiRegisteredSim();
      if (wifiSimNumber) {
        console.log('[SMSService] Found registered SIM from WiFi:', wifiSimNumber);
        return wifiSimNumber;
      }

      // Second, try to get from Call Automation
      const callAutoSimNumber = await this.getCallAutomationSim();
      if (callAutoSimNumber) {
        console.log('[SMSService] Found registered SIM from Call Automation:', callAutoSimNumber);
        return callAutoSimNumber;
      }

      console.log('[SMSService] No registered SIM found from WiFi or Call Automation');
      return null;

    } catch (error: any) {
      console.error('[SMSService] Error getting registered SIM:', error);
      return null;
    }
  },

  /**
   * Get registered SIM from WiFi authentication
   */
  async getWifiRegisteredSim(): Promise<string | null> {
    try {
      // Import WiFiService dynamically to avoid circular dependency
      const { WiFiService } = require('./WiFiService');
      const selectedSim = await WiFiService.getSelectedSimData();

      if (selectedSim && selectedSim.simNumber) {
        console.log('[SMSService] WiFi registered SIM:', selectedSim.simNumber);
        return selectedSim.simNumber;
      }

      return null;
    } catch (error: any) {
      console.log('[SMSService] No WiFi registered SIM:', error.message);
      return null;
    }
  },

  /**
   * Get registered SIM from Call Automation
   */
  async getCallAutomationSim(): Promise<string | null> {
    try {
      // Import CallAutomationService dynamically to avoid circular dependency
      const CallAutomationService = require('./CallAutomationService').default;
      const status = await CallAutomationService.getStatus();

      if (status && status.simPhoneNumber) {
        console.log('[SMSService] Call Automation SIM:', status.simPhoneNumber);
        return status.simPhoneNumber;
      }

      return null;
    } catch (error: any) {
      console.log('[SMSService] No Call Automation SIM:', error.message);
      return null;
    }
  },

  /**
   * Normalize phone number for comparison
   */
  normalizePhoneNumber(phoneNumber: string | null): string {
    if (!phoneNumber) return '';

    // Remove all non-numeric characters
    let cleaned = phoneNumber.replace(/[^0-9]/g, '');

    // Remove leading country code
    if (cleaned.length > 10) {
      if (cleaned.startsWith('91') && cleaned.length === 12) {
        cleaned = cleaned.substring(2);
      } else if (cleaned.startsWith('1') && cleaned.length === 11) {
        cleaned = cleaned.substring(1);
      } else {
        cleaned = cleaned.slice(-10);
      }
    }

    return cleaned;
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