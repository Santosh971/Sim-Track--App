/**
 * Call Log API service
 * Handles syncing call logs to backend using simId
 *
 * API Documentation:
 * POST /api/call-logs/sync
 * Headers: Authorization: Bearer <JWT_TOKEN>
 * Body: { simId: "69e5dff3d62bf4c942ea733f", callLogs: [...] }
 */

import apiClient from './client';
import { SyncResponse, APICallLog } from '../models/index';

/**
 * Raw sync response from backend
 */
interface RawSyncResponse {
  success: boolean;
  message: string;
  data?: {
    synced: number;
    inserted: number;
    matched: number;
  };
}

/**
 * Normalize sync response from backend
 */
function normalizeSyncResponse(raw: RawSyncResponse): SyncResponse {
  return {
    success: raw.success,
    message: raw.message || 'Sync completed',
    data: {
      synced: raw.data?.synced ?? 0,
      duplicates: raw.data?.matched ?? 0,
    },
  };
}

export const callLogApi = {
  /**
   * Sync call logs using simId (authenticated endpoint)
   * API: POST /call-logs/sync
   *
   * @param simId - MongoDB ObjectId of the SIM (e.g., "69e5dff3d62bf4c942ea733f")
   * @param callLogs - Array of call log objects (max 500)
   * @returns Sync response with synced/inserted/matched counts
   */
  sync: async (
    simId: string,
    callLogs: APICallLog[]
  ): Promise<SyncResponse> => {
    console.log('[CallLogAPI] sync called:', { simId, callLogsCount: callLogs.length });

    try {
      const response = await apiClient.post<RawSyncResponse>('/call-logs/sync', {
        simId,
        callLogs,
      });

      console.log('[CallLogAPI] sync response:', response.data);
      return normalizeSyncResponse(response.data);
    } catch (error: any) {
      console.error('[CallLogAPI] sync error:', error.message, error.response?.data);
      throw error;
    }
  },

  /**
   * Get call logs (authenticated)
   */
  getCallLogs: async (params?: {
    page?: number;
    limit?: number;
    simId?: string;
    callType?: string;
  }): Promise<any> => {
    const response = await apiClient.get('/call-logs', { params });
    return response.data;
  },

  /**
   * Get call statistics (authenticated)
   */
  getCallStats: async (params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<any> => {
    const response = await apiClient.get('/call-logs/stats', { params });
    return response.data;
  },
};

export default callLogApi;