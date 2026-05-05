/**
 * SIM Models for Multi-SIM Support
 */

/**
 * Company SIM - Assigned to user by company (from API)
 */
export interface CompanySIM {
  id: string;
  phoneNumber: string;
  iccid?: string;
  carrier?: string;
  alias?: string;
  isActive: boolean;
  assignedAt: string;
  companyId: string;
  companyName?: string;
}

/**
 * Device SIM - Detected from device (from native module)
 */
export interface DeviceSIM {
  slotIndex: number;
  phoneNumber: string | null;
  carrierName: string | null;
  iccid: string | null;
  subscriptionId: number;
  isActive: boolean;
}

/**
 * Matched SIM - Result of matching company SIMs with device SIMs
 */
export interface MatchedSIM {
  simId: string;
  phoneNumber: string;
  slotIndex: number;
  carrierName: string | null;
  iccid: string | null;
  isActive: boolean;
  companySIMId: string;
  isFromDevice: boolean; // true if detected from actual device SIM, false if virtual/fallback
}

/**
 * SIM Detection Result
 */
export interface SIMDetectionResult {
  deviceSIMs: DeviceSIM[];
  matchedSIMs: MatchedSIM[];
  unmatchedSIMs: DeviceSIM[];
}

/**
 * API response for user's SIMs
 */
export interface MySIMsResponse {
  success: boolean;
  data: {
    sims: CompanySIM[];
  };
}

/**
 * Sync request payload by SIM ID
 */
export interface SIMSyncRequest {
  simId: string;
  callLogs: SIMCallLog[];
}

/**
 * Call Log with SIM slot information
 */
export interface SIMCallLog {
  phoneNumber: string;
  callType: 'incoming' | 'outgoing' | 'missed';
  duration: number;
  timestamp: string;
  contactName?: string | null;
  simSlotIndex?: number;
}

/**
 * Valid SIM IDs for background sync (stored in native preferences)
 */
export interface ValidSIMIds {
  simIds: string[];
  deviceId: string;
  updatedAt: number;
}