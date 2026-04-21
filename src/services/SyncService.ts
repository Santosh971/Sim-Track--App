/**
 * Sync Service - Orchestrates call log synchronization
 */

import { callLogApi } from '../api/index';
import { StorageService } from './StorageService';
import { CallLogService } from './CallLogService';
import { OfflineQueue } from '../storage/index';
import { toAPICallLog, APICallLog } from '../models/index';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  message: string;
  error?: string;
}

/**
 * Sync Service for call log synchronization
 */
export const SyncService = {
  /**
   * Sync call logs to backend
   * Uses mobile number for identification (not JWT)
   */
  async sync(): Promise<SyncResult> {
    try {
      // Get mobile number (required for sync)
      const mobileNumber = await StorageService.getMobileNumber();
      if (!mobileNumber) {
        return {
          success: false,
          synced: 0,
          failed: 0,
          message: 'Mobile number not set. Please login first.',
        };
      }

      // Get offline queue first
      const queuedLogs = await OfflineQueue.getAPIQueue();

      // Get new call logs from device since last sync
      const lastSyncTimestamp = await StorageService.getLastSync();
      const newLogs = await CallLogService.getAPICallLogs(lastSyncTimestamp);

      // Combine queued and new logs
      const allLogsToSync = [...queuedLogs, ...newLogs];

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

      // Sync to backend
      const response = await callLogApi.deviceSync(mobileNumber, allLogsToSync);

      if (response.success) {
        // Clear offline queue on success
        await OfflineQueue.clear();

        // Update last sync timestamp
        await StorageService.setLastSync(Date.now());

        return {
          success: true,
          synced: response.data?.synced || allLogsToSync.length,
          failed: 0,
          message: response.message || 'Call logs synced successfully.',
        };
      } else {
        // Add new logs to queue on failure
        if (newLogs.length > 0) {
          await OfflineQueue.enqueue(
            newLogs.map((log) => ({
              callId: `${log.phoneNumber}_${log.timestamp}`,
              phoneNumber: log.phoneNumber,
              callType: log.callType,
              timestamp: new Date(log.timestamp).getTime(),
              duration: log.duration,
              contactName: log.contactName ?? null,
            }))
          );
        }

        return {
          success: false,
          synced: 0,
          failed: allLogsToSync.length,
          message: response.message || 'Failed to sync call logs.',
        };
      }
    } catch (error: any) {
      console.error('Sync error:', error);

      // Get pending count for error message
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