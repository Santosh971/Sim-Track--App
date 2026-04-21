/**
 * Call Log API service
 */

import apiClient from './client';
import { SyncRequest, SyncResponse, APICallLog } from '../models/index';

export const callLogApi = {
  /**
   * Sync call logs using mobile number (public endpoint - no JWT required)
   * This is the main sync endpoint for the mobile app
   */
  deviceSync: async (
    mobileNumber: string,
    callLogs: APICallLog[]
  ): Promise<SyncResponse> => {
    const response = await apiClient.post<SyncResponse>('/call-logs/device-sync', {
      mobileNumber,
      callLogs,
    });
    return response.data;
  },

  /**
   * Sync call logs using simId (authenticated endpoint - requires JWT)
   * This is an alternative sync endpoint for dashboard users
   */
  sync: async (
    simId: string,
    callLogs: APICallLog[]
  ): Promise<SyncResponse> => {
    const response = await apiClient.post<SyncResponse>('/call-logs/sync', {
      simId,
      callLogs,
    });
    return response.data;
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