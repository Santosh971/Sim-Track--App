/**
 * SIM Management API Service
 * Handles fetching assigned SIMs from backend and matching with device SIMs
 */

import apiClient from './client';
import { CompanySIM } from '../models/SIM';

/**
 * Raw API response format from backend
 * Backend returns: { success, message, data: [{ _id, mobileNumber, operator, ... }] }
 */
interface RawSIMResponse {
  _id: string;
  id?: string;
  mobileNumber: string;
  operator?: string;
  circle?: string;
  status?: string;
  fullInfo?: string;
  iccid?: string;
  assignedAt?: string;
  companyId?: string;
  companyName?: string;
}

/**
 * Full API response structure
 */
interface SIMsApiResponse {
  success: boolean;
  message: string;
  data: RawSIMResponse[];
  timestamp?: string;
}

/**
 * Map raw API response to CompanySIM model
 */
function mapSIMResponse(raw: RawSIMResponse): CompanySIM {
  return {
    id: raw._id || raw.id || '',
    phoneNumber: raw.mobileNumber,
    carrier: raw.operator || undefined,
    iccid: raw.iccid,
    isActive: raw.status === 'active',
    assignedAt: raw.assignedAt || new Date().toISOString(),
    companyId: raw.companyId || '',
    companyName: raw.companyName,
  };
}

export const simApi = {
  /**
   * Get all SIMs assigned to the current user
   * API: GET /sims/my
   * Response: { success: true, data: [{ _id, mobileNumber, operator, ... }] }
   */
  getMySIMs: async (): Promise<CompanySIM[]> => {
    try {
      const response = await apiClient.get<SIMsApiResponse>('/sims/my');


      // Extract SIMs array from response.data.data
      const rawSIMs = response.data?.data || [];

      if (!Array.isArray(rawSIMs)) {
        console.warn('[SimAPI] Expected array but got:', typeof rawSIMs);
        return [];
      }

      const sims = rawSIMs.map(mapSIMResponse);
      return sims;
    } catch (error: any) {
      console.error('[SimAPI] Error fetching SIMs:', error.message);
      console.error('[SimAPI] Error details:', {
        status: error.response?.status,
        data: error.response?.data,
      });
      return [];
    }
  },

  /**
   * Get a specific SIM by ID
   */
  getSIMById: async (simId: string): Promise<CompanySIM | null> => {
    try {
      const response = await apiClient.get<{ success: boolean; data: RawSIMResponse }>(`/sims/${simId}`);
      if (response.data?.data) {
        return mapSIMResponse(response.data.data);
      }
      return null;
    } catch (error: any) {
      console.error('[SimAPI] Error fetching SIM by ID:', error.message);
      return null;
    }
  },

  /**
   * Verify a SIM is assigned to current user
   */
  verifySIMAssignment: async (phoneNumber: string): Promise<{ valid: boolean; simId?: string }> => {
    try {
      const response = await apiClient.post<{ valid: boolean; simId?: string }>('/sims/verify', { phoneNumber });
      return response.data;
    } catch (error: any) {
      console.error('[SimAPI] Error verifying SIM:', error.message);
      return { valid: false };
    }
  },
};

export default simApi;