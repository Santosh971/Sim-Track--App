/**
 * Call Log Service - Reads call logs from device using native module
 */

import { Platform, PermissionsAndroid, Linking } from 'react-native';
import CallLogModule from '../native/CallLogModule';
import { DeviceCallLog, toAPICallLog, APICallLog } from '../models/index';
import { PERMISSIONS } from '../config/index';

export interface PermissionStatus {
  readCallLog: boolean;
  readPhoneState: boolean;
}

/**
 * Call Log Service for reading Android call logs
 */
export const CallLogService = {
  /**
   * Check if required permissions are granted
   */
  async checkPermissions(): Promise<PermissionStatus> {
    if (Platform.OS !== 'android') {
      return { readCallLog: false, readPhoneState: false };
    }

    try {
      const status = await CallLogModule.checkPermissions();
      return {
        readCallLog: status.readCallLog ?? false,
        readPhoneState: status.readPhoneState ?? false,
      };
    } catch (error) {
      console.error('Error checking permissions:', error);
      return { readCallLog: false, readPhoneState: false };
    }
  },

  /**
   * Request required permissions
   */
  async requestPermissions(): Promise<PermissionStatus> {
    if (Platform.OS !== 'android') {
      return { readCallLog: false, readPhoneState: false };
    }

    try {
      // Request permissions using native module
      const results = await CallLogModule.requestPermissions();

      return {
        readCallLog: results[PERMISSIONS.READ_CALL_LOG] ?? false,
        readPhoneState: results[PERMISSIONS.READ_PHONE_STATE] ?? false,
      };
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return { readCallLog: false, readPhoneState: false };
    }
  },

  /**
   * Check if all required permissions are granted
   */
  async hasAllPermissions(): Promise<boolean> {
    const status = await this.checkPermissions();
    return status.readCallLog && status.readPhoneState;
  },

  /**
   * Open app settings for permission
   */
  async openSettings(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        await Linking.openSettings();
      }
    } catch (error) {
      console.error('Error opening settings:', error);
    }
  },

  /**
   * Get call logs from device
   * @param lastSyncTimestamp - Only get logs after this timestamp (milliseconds)
   */
  async getCallLogs(lastSyncTimestamp?: number | null): Promise<DeviceCallLog[]> {
    if (Platform.OS !== 'android') {
      console.warn('Call log reading is only supported on Android');
      return [];
    }

    // Check permissions first
    const hasPermissions = await this.hasAllPermissions();
    if (!hasPermissions) {
      throw new Error('Missing required permissions');
    }

    try {
      const callLogs = await CallLogModule.getCallLogs(
        lastSyncTimestamp ?? undefined
      );
      return callLogs as DeviceCallLog[];
    } catch (error) {
      console.error('Error getting call logs:', error);
      throw error;
    }
  },

  /**
   * Get call logs in API format
   */
  async getAPICallLogs(lastSyncTimestamp?: number | null): Promise<APICallLog[]> {
    const logs = await this.getCallLogs(lastSyncTimestamp);
    return logs.map(toAPICallLog);
  },

  /**
   * Get device phone number (SIM number)
   */
  async getDevicePhoneNumber(): Promise<string | null> {
    if (Platform.OS !== 'android') {
      return null;
    }

    try {
      const phoneNumber = await CallLogModule.getDevicePhoneNumber();
      return phoneNumber;
    } catch (error) {
      console.error('Error getting device phone number:', error);
      return null;
    }
  },
};

export default CallLogService;