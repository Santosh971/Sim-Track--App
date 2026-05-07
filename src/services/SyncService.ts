/**
 * Sync Service - Orchestrates call log synchronization by SIM
 * Uses simId (MongoDB ObjectId) for API calls
 *
 * API: POST /call-logs/sync
 * Body: { simId: "69e5dff3d62bf4c942ea733f", callLogs: [...] }
 * Max call logs per request: 500
 */

import { callLogApi } from '../api/index';
import { StorageService } from './StorageService';
import { CallLogService } from './CallLogService';
import { SIMManager } from './SIMManager';
import { OfflineQueue } from '../storage/index';
import { toAPICallLog, APICallLog, DeviceCallLog, MatchedSIM } from '../models/index';
import BackgroundSync from '../native/BackgroundSyncModule';

// Maximum call logs per API request (backend limit)
const MAX_LOGS_PER_REQUEST = 500;

// Sync lock to prevent multiple simultaneous syncs
let isSyncInProgress = false;
let syncLockTime = 0;
const SYNC_LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout for sync lock

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  message: string;
  error?: string;
  simResults?: Record<string, SyncResult>;
}

/**
 * Sync Service for call log synchronization by SIM
 */
export const SyncService = {
  /**
   * Sync call logs to backend by SIM
   * Syncs call logs for each matched SIM separately using simId
   */
  async sync(): Promise<SyncResult> {

    // Check if sync lock is stale (stuck for more than 5 minutes)
    const now = Date.now();
    if (isSyncInProgress && (now - syncLockTime) > SYNC_LOCK_TIMEOUT) {
      isSyncInProgress = false;
    }

    // Prevent multiple simultaneous syncs
    if (isSyncInProgress) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        message: 'Sync already in progress. Please wait.',
      };
    }

    // Acquire sync lock
    isSyncInProgress = true;
    syncLockTime = Date.now();

    try {
      // Get matched SIMs
      const matchedSIMs = await SIMManager.getMatchedSIMs();
    

      if (matchedSIMs.length === 0) {
        // Fall back to legacy sync if no matched SIMs
        return this.legacySync();
      }

      // Sync each SIM using simId
      return this.syncAllSIMs(matchedSIMs);
    } catch (error: any) {
      console.error('[SyncService] Sync error:', error);

      const pendingCount = await OfflineQueue.getPendingCount();

      return {
        success: false,
        synced: 0,
        failed: pendingCount,
        message: 'Failed to sync call logs.',
        error: error.message || 'Unknown error',
      };
    } finally {
      // Release sync lock
      isSyncInProgress = false;
    }
  },

  /**
   * Sync call logs for all matched SIMs individually
   * Uses simId (MongoDB ObjectId) for API calls
   *
   * Syncs for all active matched SIMs (both physical and virtual).
   * Uses simId from company SIM data for API calls.
   */
  async syncAllSIMs(matchedSIMs: MatchedSIM[]): Promise<SyncResult> {
    const simResults: Record<string, SyncResult> = {};
    let totalSynced = 0;
    let totalFailed = 0;
    let hasErrors = false;

    // Sync for ALL active SIMs (both physical and virtual)
    // Physical SIMs (isFromDevice: true): Detected from device
    // Virtual SIMs (isFromDevice: false): Matched from company data
    const activeSIMs = matchedSIMs.filter(sim => sim.isActive);

  

    if (activeSIMs.length === 0) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        message: 'No active SIMs available for call log sync. Please ensure SIMs are registered.',
      };
    }

    // Sync for each active SIM
    for (const sim of activeSIMs) {
      const result = await this.syncBySIM(sim);
      simResults[sim.simId] = result;

      if (result.success) {
        totalSynced += result.synced;
      } else {
        totalFailed += result.failed;
        hasErrors = true;
      }
    }

    // Update last sync timestamp
    await StorageService.setLastSync(Date.now());

    return {
      success: !hasErrors,
      synced: totalSynced,
      failed: totalFailed,
      message: hasErrors
        ? `Synced ${totalSynced} logs, ${totalFailed} failed`
        : `Successfully synced ${totalSynced} call logs`,
      simResults,
    };
  },

  /**
   * Sync call logs for a specific SIM using simId
   * API: POST /call-logs/sync
   * Batches logs into groups of 500 to avoid network errors
   */
  async syncBySIM(sim: MatchedSIM): Promise<SyncResult> {
    try {
      // Get last sync timestamp for this SIM
      const lastSyncTimestamp = await StorageService.getLastSync(sim.simId);

      // Get offline queue first
      const queuedLogs = await OfflineQueue.getAPIQueue();

      // Get new call logs from device
      const newLogs = await CallLogService.getCallLogs(lastSyncTimestamp);

      // Convert to API format
      const allLogs: APICallLog[] = [
        ...queuedLogs,
        ...newLogs.map(log => toAPICallLog(log)),
      ];

      if (allLogs.length === 0) {
        // Update last sync time even if no logs
        await StorageService.setLastSync(Date.now(), sim.simId);
        return {
          success: true,
          synced: 0,
          failed: 0,
          message: 'No new call logs to sync.',
        };
      }

      // Use simId (MongoDB ObjectId) for API call
      const simId = sim.simId;

      // Batch logs to avoid network errors (max 500 per request)
      const batches = this.batchLogs(allLogs, MAX_LOGS_PER_REQUEST);

      let totalSynced = 0;
      let totalFailed = 0;
      let hasError = false;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`[SyncService] Processing batch ${i + 1}/${batches.length} with ${batch.length} logs`);

        try {
          // Call API with simId (MongoDB ObjectId)
          const response = await callLogApi.sync(simId, batch);

          if (response.success) {
            totalSynced += response.data?.synced || batch.length;
            console.log(`[SyncService] Batch ${i + 1} synced: ${response.data?.synced || batch.length} logs`);
          } else {
            totalFailed += batch.length;
            hasError = true;
            console.error(`[SyncService] Batch ${i + 1} failed:`, response.message);
          }
        } catch (error: any) {
          totalFailed += batch.length;
          hasError = true;
          console.error(`[SyncService] Batch ${i + 1} error:`, error.message);
        }
      }

      // Clear offline queue on success
      if (totalSynced > 0) {
        await OfflineQueue.clear();
      }

      // Update last sync timestamp for this SIM
      await StorageService.setLastSync(Date.now(), sim.simId);

      return {
        success: !hasError,
        synced: totalSynced,
        failed: totalFailed,
        message: hasError
          ? `Partially synced: ${totalSynced} success, ${totalFailed} failed`
          : `Successfully synced ${totalSynced} call logs`,
      };
    } catch (error: any) {
      console.error(`[SyncService] Sync error for SIM ${sim.simId}:`, error);
      return {
        success: false,
        synced: 0,
        failed: 0,
        message: error.message || 'Sync failed',
        error: error.message,
      };
    }
  },

  /**
   * Batch logs into groups of specified size
   */
  batchLogs(logs: APICallLog[], batchSize: number): APICallLog[][] {
    const batches: APICallLog[][] = [];
    for (let i = 0; i < logs.length; i += batchSize) {
      batches.push(logs.slice(i, i + batchSize));
    }
    return batches;
  },

  /**
   * Legacy sync for backwards compatibility
   * Uses simId from first available SIM
   */
  async legacySync(): Promise<SyncResult> {
    console.log('[SyncService] Using legacy sync...');
    try {
      // Try to get simId from stored matched SIMs
      const matchedSIMs = await SIMManager.getMatchedSIMs();
      let simId: string | null = null;

      if (matchedSIMs.length > 0) {
        simId = matchedSIMs[0].simId;
      }

      if (!simId) {
        console.log('[SyncService] No simId available for sync');
        return {
          success: false,
          synced: 0,
          failed: 0,
          message: 'No SIM ID available. Cannot sync. Please login again to detect SIMs.',
        };
      }

      // Get offline queue first
      const queuedLogs = await OfflineQueue.getAPIQueue();

      // Get new call logs from device since last sync
      const lastSyncTimestamp = await StorageService.getLastSync();
      const newLogs = await CallLogService.getCallLogs(lastSyncTimestamp);

      // Combine queued and new logs
      const allLogsToSync: APICallLog[] = [...queuedLogs, ...newLogs.map(toAPICallLog)];

      if (allLogsToSync.length === 0) {
        // Update last sync time even if no logs
        await StorageService.setLastSync(Date.now());
        return {
          success: true,
          synced: 0,
          failed: 0,
          message: 'No new call logs to sync.',
        };
      }

      console.log(`[SyncService] Legacy syncing ${allLogsToSync.length} logs for SIM ${simId}`);

      // Batch logs
      const batches = this.batchLogs(allLogsToSync, MAX_LOGS_PER_REQUEST);
      let totalSynced = 0;
      let totalFailed = 0;
      let hasError = false;

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`[SyncService] Legacy batch ${i + 1}/${batches.length}`);

        try {
          const response = await callLogApi.sync(simId, batch);

          if (response.success) {
            totalSynced += response.data?.synced || batch.length;
          } else {
            totalFailed += batch.length;
            hasError = true;
          }
        } catch (error: any) {
          totalFailed += batch.length;
          hasError = true;
          console.error(`[SyncService] Legacy batch error:`, error.message);
        }
      }

      // Clear offline queue on success
      if (totalSynced > 0) {
        await OfflineQueue.clear();
      }

      // Update last sync timestamp
      await StorageService.setLastSync(Date.now());

      return {
        success: !hasError,
        synced: totalSynced,
        failed: totalFailed,
        message: hasError
          ? `Partially synced: ${totalSynced} success, ${totalFailed} failed`
          : `Successfully synced ${totalSynced} call logs`,
      };
    } catch (error: any) {
      console.error('[SyncService] Legacy sync error:', error);

      const pendingCount = await OfflineQueue.getPendingCount();

      return {
        success: false,
        synced: 0,
        failed: pendingCount,
        message: 'Failed to sync call logs.',
        error: error.message || 'Unknown error',
      };
    }
  },

  /**
   * Initialize SIM-based sync
   * Should be called after login to set up SIM IDs for background sync
   */
  async initializeSIMSync(): Promise<void> {
    try {
      console.log('[SyncService] Initializing SIM sync...');

      // Detect and match SIMs
      const result = await SIMManager.detectAndMatchSIMs();

      // Store SIM IDs for background sync
      const simIds = result.matchedSIMs
        .filter(m => m.isActive)
        .map(m => m.simId);

      // Store in native preferences for background sync
      if (simIds.length > 0) {
        await BackgroundSync.setValidSIMIds(simIds);
        console.log('[SyncService] Set', simIds.length, 'SIM IDs for background sync:', simIds);
      }
    } catch (error) {
      console.error('[SyncService] Error initializing SIM sync:', error);
    }
  },

  /**
   * Get pending logs count
   */
  async getPendingCount(): Promise<number> {
    return OfflineQueue.getPendingCount();
  },

  /**
   * Get last sync timestamp
   */
  async getLastSync(): Promise<number | null> {
    return StorageService.getLastSync();
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
   * Clear sync data (for debugging)
   */
  async clearSyncData(): Promise<void> {
    await StorageService.removeLastSync();
    await OfflineQueue.clear();
  },
};

export default SyncService;