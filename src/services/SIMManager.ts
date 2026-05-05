/**
 * SIM Manager Service - Handles multi-SIM detection and matching
 * Updated: Works automatically even if device doesn't return phone numbers
 */

import { Platform } from 'react-native';
import { simApi } from '../api/sim.api';
import { DeviceSIM, MatchedSIM, CompanySIM, SIMDetectionResult } from '../models/SIM';
import SIMDetection from '../native/SIMModule';
import { StorageService } from './StorageService';

const MATCHED_SIMS_KEY = 'matched_sims';
const DEVICE_ID_KEY = 'device_id';

/**
 * SIM Manager for multi-SIM support
 */
export const SIMManager = {
  /**
   * Fetch company-assigned SIMs from API
   */
  async fetchCompanySIMs(): Promise<CompanySIM[]> {
    try {
      const sims = await simApi.getMySIMs();
      return sims;
    } catch (error) {
      console.error('[SIMManager] Error fetching company SIMs:', error);
      return [];
    }
  },

  /**
   * Get device SIMs from native module
   */
  async getDeviceSIMs(): Promise<DeviceSIM[]> {
    if (Platform.OS !== 'android') {
      return [];
    }

    try {
      const sims = await SIMDetection.getDeviceSIMs();
      console.log('[SIMManager] Device SIMs:', JSON.stringify(sims, null, 2));
      return sims;
    } catch (error) {
      console.error('[SIMManager] Error getting device SIMs:', error);
      return [];
    }
  },

  /**
   * Normalize phone number for comparison
   * Removes country code, spaces, dashes, etc.
   */
  normalizePhoneNumber(phoneNumber: string | null): string {
    if (!phoneNumber) return '';

    // Remove all non-numeric characters
    let cleaned = phoneNumber.replace(/[^0-9]/g, '');

    // Remove leading country code (91 for India, 1 for US, etc.)
    if (cleaned.length > 10) {
      // Common country codes
      if (cleaned.startsWith('91') && cleaned.length === 12) {
        cleaned = cleaned.substring(2);
      } else if (cleaned.startsWith('1') && cleaned.length === 11) {
        cleaned = cleaned.substring(1);
      } else {
        // Take last 10 digits
        cleaned = cleaned.slice(-10);
      }
    }

    return cleaned;
  },

  /**
   * Match company SIMs with device SIMs by phone number
   */
  matchSIMs(companySIMs: CompanySIM[], deviceSIMs: DeviceSIM[]): MatchedSIM[] {
    const matched: MatchedSIM[] = [];

    for (const companySIM of companySIMs) {
      const companyPhone = this.normalizePhoneNumber(companySIM.phoneNumber);

      for (const deviceSIM of deviceSIMs) {
        const devicePhone = this.normalizePhoneNumber(deviceSIM.phoneNumber);

        if (companyPhone && devicePhone && companyPhone === devicePhone) {
          matched.push({
            simId: companySIM.id,
            phoneNumber: companySIM.phoneNumber,
            slotIndex: deviceSIM.slotIndex,
            carrierName: deviceSIM.carrierName,
            iccid: deviceSIM.iccid,
            isActive: companySIM.isActive && deviceSIM.isActive,
            companySIMId: companySIM.id,
            isFromDevice: true, // Matched from actual device SIM
          });
          break; // Found match, move to next company SIM
        }
      }
    }

    return matched;
  },

  /**
   * Match company SIMs with device SIMs by ICCID
   */
  matchSIMsByICCID(companySIMs: CompanySIM[], deviceSIMs: DeviceSIM[]): MatchedSIM[] {
    const matched: MatchedSIM[] = [];

    for (const companySIM of companySIMs) {
      if (!companySIM.iccid) continue;

      for (const deviceSIM of deviceSIMs) {
        if (deviceSIM.iccid && companySIM.iccid === deviceSIM.iccid) {
          matched.push({
            simId: companySIM.id,
            phoneNumber: companySIM.phoneNumber,
            slotIndex: deviceSIM.slotIndex,
            carrierName: deviceSIM.carrierName,
            iccid: deviceSIM.iccid,
            isActive: companySIM.isActive && deviceSIM.isActive,
            companySIMId: companySIM.id,
            isFromDevice: true, // Matched from actual device SIM
          });
          break;
        }
      }
    }

    return matched;
  },

  /**
   * Create virtual matched SIMs from company SIMs
   * Used when device doesn't provide phone numbers/ICCID
   * Assigns all company SIMs to slot 0 as fallback
   */
  createVirtualMatchedSIMs(companySIMs: CompanySIM[]): MatchedSIM[] {
    return companySIMs.map((companySIM, index) => ({
      simId: companySIM.id,
      phoneNumber: companySIM.phoneNumber,
      slotIndex: index, // Assign to slot based on index
      carrierName: companySIM.carrier || null,
      iccid: companySIM.iccid || null,
      isActive: companySIM.isActive,
      companySIMId: companySIM.id,
      isFromDevice: false, // Virtual/fallback, not from device
    }));
  },

  /**
   * Perform full SIM detection and matching
   * Returns matched SIMs and stores them
   * Works automatically even if device doesn't return phone numbers
   */
  async detectAndMatchSIMs(): Promise<SIMDetectionResult> {
    console.log('[SIMManager] Starting SIM detection...');

    // Get company SIMs from API
    const companySIMs = await this.fetchCompanySIMs();
    console.log('[SIMManager] Company SIMs from API:', companySIMs.length);

    if (companySIMs.length === 0) {
      console.log('[SIMManager] No company SIMs assigned to user');
      return {
        deviceSIMs: [],
        matchedSIMs: [],
        unmatchedSIMs: [],
      };
    }

    // Get device SIMs from native module
    const deviceSIMs = await this.getDeviceSIMs();
    console.log('[SIMManager] Device SIMs detected:', deviceSIMs.length);

    // Try matching by phone number first
    let matchedSIMs = this.matchSIMs(companySIMs, deviceSIMs);
    console.log('[SIMManager] Matched by phone number:', matchedSIMs.length);

    // If no matches, try ICCID matching
    if (matchedSIMs.length === 0) {
      matchedSIMs = this.matchSIMsByICCID(companySIMs, deviceSIMs);
      console.log('[SIMManager] Matched by ICCID:', matchedSIMs.length);
    }

    // If still no matches, use virtual matching (company SIMs without device matching)
    if (matchedSIMs.length === 0 && companySIMs.length > 0) {
      matchedSIMs = this.createVirtualMatchedSIMs(companySIMs);
      console.log('[SIMManager] Using virtual matched SIMs (fallback):', matchedSIMs.length);
    }

    // Find unmatched device SIMs
    const matchedSlotIndices = new Set(matchedSIMs.map(m => m.slotIndex));
    const unmatchedSIMs = deviceSIMs.filter(d => !matchedSlotIndices.has(d.slotIndex));

    // Store matched SIMs
    await this.setMatchedSIMs(matchedSIMs);

    // Generate and store device ID if not exists
    await this.ensureDeviceId();

    console.log('[SIMManager] Final matched SIMs:', matchedSIMs.length);

    return {
      deviceSIMs,
      matchedSIMs,
      unmatchedSIMs,
    };
  },

  /**
   * Get matched SIMs from storage
   */
  async getMatchedSIMs(): Promise<MatchedSIM[]> {
    try {
      const data = await StorageService.getMatchedSIMs();
      return data || [];
    } catch (error) {
      console.error('[SIMManager] Error getting matched SIMs:', error);
      return [];
    }
  },

  /**
   * Store matched SIMs
   */
  async setMatchedSIMs(sims: MatchedSIM[]): Promise<void> {
    await StorageService.setMatchedSIMs(sims);
  },

  /**
   * Get valid SIM IDs for background sync
   * Only returns IDs of active matched SIMs
   */
  async getValidSIMIds(): Promise<string[]> {
    const matched = await this.getMatchedSIMs();
    return matched.filter(m => m.isActive).map(m => m.simId);
  },

  /**
   * Get device ID (unique identifier for this device installation)
   */
  async getDeviceId(): Promise<string | null> {
    return StorageService.getDeviceId();
  },

  /**
   * Ensure device ID exists, create if not
   */
  async ensureDeviceId(): Promise<string> {
    let deviceId = await StorageService.getDeviceId();
    if (!deviceId) {
      deviceId = this.generateDeviceId();
      await StorageService.setDeviceId(deviceId);
    }
    return deviceId;
  },

  /**
   * Generate a unique device ID
   */
  generateDeviceId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `device_${timestamp}_${randomPart}`;
  },

  /**
   * Check if any company SIMs are matched
   */
  async hasMatchedSIMs(): Promise<boolean> {
    const matched = await this.getMatchedSIMs();
    return matched.length > 0;
  },

  /**
   * Clear all SIM data
   */
  async clearSIMData(): Promise<void> {
    await StorageService.removeMatchedSIMs();
  },
};

export default SIMManager;