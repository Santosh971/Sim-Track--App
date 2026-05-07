/**
 * SMS API Service
 * Handles syncing SMS messages to backend
 */

import apiClient from './client';

export interface SMSMessage {
  sender: string;
  message: string;
  timestamp: string;
  type?: 'inbox' | 'sent';
}

export interface SMSSyncResponse {
  success: boolean;
  message: string;
  data?: {
    synced: number;
    inserted: number;
    matched: number;
  };
  timestamp?: string;
}

export const smsApi = {
  /**
   * Sync SMS messages using simNumber
   */
  sync: async (
    simNumber: string,
    messages: SMSMessage[]
  ): Promise<SMSSyncResponse> => {

    try {
      const response = await apiClient.post<SMSSyncResponse>('/sms/sync', {
        simNumber,
        messages,
      }, {
        timeout: 60000, // 1 minute timeout
      });

      return response.data;
    } catch (error: any) {
      console.error('[SMSAPI] Error:', error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'SMS sync failed',
      };
    }
  },
};

export default smsApi;