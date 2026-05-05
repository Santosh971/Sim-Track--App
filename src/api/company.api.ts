/**
 * Company API Service
 * Handles fetching company details for the authenticated user
 */

import apiClient from './client';
import { Company, CompanyResponse, RawCompanyResponse, mapCompanyResponse } from '../models/Company';

export const companyApi = {
  /**
   * Get current user's company details
   * API: GET /company/my
   */
  getMyCompany: async (): Promise<Company | null> => {
    console.log('[CompanyAPI] Fetching user\'s company...');
    try {
      const response = await apiClient.get<CompanyResponse>('/company/my');
      console.log('[CompanyAPI] Response:', response.data);

      if (response.data?.success && response.data?.data) {
        // Handle if data is the raw object or already mapped
        const rawData = response.data.data as RawCompanyResponse | Company;

        // Check if it's raw format (has _id) or already mapped (has id)
        if ('_id' in rawData) {
          return mapCompanyResponse(rawData);
        }
        return rawData as Company;
      }
      return null;
    } catch (error: any) {
      console.error('[CompanyAPI] Error fetching company:', error.message);
      if (error.response?.status === 404) {
        console.warn('[CompanyAPI] Company not found for user');
      }
      return null;
    }
  },

  /**
   * Get company by ID
   * API: GET /company/details/:id
   */
  getCompanyById: async (companyId: string): Promise<Company | null> => {
    console.log('[CompanyAPI] Fetching company by ID:', companyId);
    try {
      const response = await apiClient.get<CompanyResponse>(`/company/details/${companyId}`);
      console.log('[CompanyAPI] Response:', response.data);

      if (response.data?.success && response.data?.data) {
        const rawData = response.data.data as RawCompanyResponse | Company;

        if ('_id' in rawData) {
          return mapCompanyResponse(rawData);
        }
        return rawData as Company;
      }
      return null;
    } catch (error: any) {
      console.error('[CompanyAPI] Error fetching company by ID:', error.message);
      return null;
    }
  },
};

export default companyApi;