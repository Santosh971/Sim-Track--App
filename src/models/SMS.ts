/**
 * SMS Model - SMS message types and sync interfaces
 */

/**
 * Device SMS - Read from native SMS content provider
 */
export interface DeviceSMS {
  _id: string;              // Message ID from device
  sender: string;           // Sender phone number or ID
  message: string;          // SMS content
  timestamp: string;        // ISO timestamp
  type: 'inbox' | 'sent';   // Message type
  simSlotIndex?: number;    // SIM slot (for dual SIM)
}

/**
 * API SMS - Format for backend sync
 */
export interface APISMS {
  sender: string;           // Sender ID or phone number
  message: string;          // SMS content (max 5000 chars)
  timestamp: string;        // ISO 8601 timestamp
  type?: 'inbox' | 'sent';  // Default: "inbox"
}

/**
 * Convert DeviceSMS to APISMS format
 */
export function toAPISMS(sms: DeviceSMS): APISMS {
  return {
    sender: sms.sender,
    message: sms.message,
    timestamp: sms.timestamp,
    type: sms.type || 'inbox',
  };
}

/**
 * SMS Sync Request - Sent to backend
 */
export interface SMSSyncRequest {
  simNumber: string;
  messages: APISMS[];
}

/**
 * SMS Sync Response - From backend
 */
export interface SMSSyncResponse {
  success: boolean;
  message: string;
  data?: {
    synced: number;
    inserted: number;
    matched: number;
  };
}

/**
 * SMS Sync Result - For UI display
 */
export interface SMSSyncResult {
  success: boolean;
  synced: number;
  failed: number;
  message: string;
  error?: string;
}