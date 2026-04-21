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
}

/**
 * Permission check result
 */
export interface PermissionStatus {
  readCallLog: boolean;
  readPhoneState: boolean;
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
   * @returns Array of call logs
   */
  getCallLogs(lastSyncTimestamp?: number): Promise<NativeCallLog[]>;

  /**
   * Get the device's phone number (SIM number)
   * Requires READ_PHONE_STATE permission
   * @returns Phone number or null if not available
   */
  getDevicePhoneNumber(): Promise<string | null>;
}

// Get the native module
const { CallLogModule } = NativeModules;

// Export the typed interface
export default CallLogModule as CallLogModuleInterface;