/**
 * Native module for reading Android Call Log
 * This is the TypeScript interface for the native Android module
 */

import { NativeModules } from 'react-native';

/**
 * Call log data structure from native module
 */
export interface NativeCallLog {
  callId: string;
  phoneNumber: string;
  callType: 'incoming' | 'outgoing' | 'missed' | 'unknown';
  timestamp: number;
  duration: number;
  contactName: string | null;
  phoneAccountId?: string;
  simSlotIndex?: number;
}

/**
 * Permission check result
 */
export interface PermissionStatus {
  readCallLog: boolean;
  readPhoneState: boolean;
  readPhoneNumbers?: boolean;
  readSms?: boolean;
}

/**
 * Call log counts by type
 */
export interface CallLogCounts {
  total: number;
  incoming: number;
  outgoing: number;
  missed: number;
}

/**
 * Native module interface
 */
interface CallLogModuleInterface {
  /**
   * Check if required permissions are granted
   */
  checkPermissions(): Promise<PermissionStatus>;

  /**
   * Request required permissions
   */
  requestPermissions(): Promise<Record<string, boolean>>;

  /**
   * Get call logs from device
   * @param lastSyncTimestamp - Optional timestamp to filter logs after this time
   * @returns Array of call logs with SIM slot information
   */
  getCallLogs(lastSyncTimestamp?: number): Promise<NativeCallLog[]>;

  /**
   * Get the device's phone number (SIM number)
   * Requires READ_PHONE_STATE permission
   * @returns Phone number or null if not available
   */
  getDevicePhoneNumber(): Promise<string | null>;

  /**
   * Get all SIM phone numbers
   * Requires READ_PHONE_NUMBERS permission
   * @returns Array of phone numbers per SIM slot
   */
  getAllSIMPhoneNumbers(): Promise<(string | null)[]>;

  /**
   * Get total call log count
   */
  getCallLogCount(): Promise<number>;

  /**
   * Get call log counts by type (total, incoming, outgoing, missed)
   */
  getCallLogCounts(): Promise<CallLogCounts>;
}

// Get the native module
const { CallLogModule } = NativeModules;

// Export the typed interface
export default CallLogModule as CallLogModuleInterface;