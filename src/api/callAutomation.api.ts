/**
 * Call Automation API Service
 *
 * Handles API calls for fetching call automation configuration from backend.
 */

import apiClient from './client';

// Types
export interface TargetInfo {
  mobileNumber: string;
  callDuration: number;
}

export interface CallConfigResponse {
  role: 'CALLER' | 'RECEIVER' | 'NONE';
  targets: TargetInfo[];  // Array of objects with mobileNumber and callDuration
  callDuration: number;
  frequency: 'hourly' | 'daily' | 'weekly';
  scheduledTime: string; // HH:MM format (e.g., "09:00")
  scheduledDay: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
  isActive: boolean;
  simId?: string;
  mobileNumber?: string;
  configId?: string;
}

export interface CallCompleteResponse {
  success: boolean;
}

/**
 * Call Automation API
 */
export const callAutomationApi = {
  /**
   * Get call automation configuration for a SIM
   * @param simNumber - The SIM phone number
   * @returns Call configuration with role and targets
   */
  getConfig: async (simNumber: string): Promise<{ success: boolean; data: CallConfigResponse }> => {
    
    try {
      const response = await apiClient.get<{ success: boolean; data: CallConfigResponse }>(
        '/device/call-config',
        {
          params: { simNumber }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('[CallAutomationAPI] Error fetching config:', error.message);
      throw error;
    }
  },

  /**
   * Notify backend that a call was completed
   * @param configId - The configuration ID
   * @param simNumber - The SIM number that made the calls
   * @param successCount - Number of successful calls
   * @param failCount - Number of failed calls
   * @returns Success response
   */
  callComplete: async (
    configId: string,
    simNumber?: string,
    successCount?: number,
    failCount?: number
  ): Promise<{ success: boolean; data: CallCompleteResponse }> => {

    try {
      const response = await apiClient.post<{ success: boolean; data: CallCompleteResponse }>(
        '/device/call-complete',
        {
          configId,
          simNumber,
          successCount: successCount || 0,
          failCount: failCount || 0
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('[CallAutomationAPI] Error notifying call complete:', error.message);
      throw error;
    }
  },
};

export default callAutomationApi;