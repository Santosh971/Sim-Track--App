/**
 * Call Log Service - Reads call logs from device using native module
 */

import { Platform, PermissionsAndroid, Linking } from 'react-native';
import CallLogModule from '../native/CallLogModule';
import { DeviceCallLog, toAPICallLog, APICallLog } from '../models/index';
import { PERMISSIONS } from '../config/index';
import { SIMManager } from './SIMManager';

export interface PermissionStatus {
  readCallLog: boolean;
  readPhoneState: boolean;
  readPhoneNumbers?: boolean;
  readSms?: boolean;
}

/**
 * Call Log Service for reading Android call logs with SIM support
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
        readPhoneNumbers: status.readPhoneNumbers ?? false,
        readSms: status.readSms ?? false,
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
        readPhoneNumbers: results[PERMISSIONS.READ_PHONE_NUMBERS] ?? false,
        readSms: results[PERMISSIONS.READ_SMS] ?? false,
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
    // READ_PHONE_NUMBERS is only required on Android 10+ for multi-SIM detection
    return status.readCallLog && status.readPhoneState;
  },

  /**
   * Check if all permissions including phone numbers are granted
   */
  async hasAllPermissionsWithPhoneNumbers(): Promise<boolean> {
    const status = await this.checkPermissions();
    return !!(status.readCallLog && status.readPhoneState && status.readPhoneNumbers);
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
   * Get call logs filtered by SIM slot
   * @param simSlotIndex - SIM slot to filter by
   * @param lastSyncTimestamp - Only get logs after this timestamp
   */
  async getCallLogsBySIM(simSlotIndex: number, lastSyncTimestamp?: number | null): Promise<DeviceCallLog[]> {
    const allLogs = await this.getCallLogs(lastSyncTimestamp);
    return allLogs.filter(log => log.simSlotIndex === simSlotIndex);
  },

  /**
   * Get call logs grouped by SIM
   * Returns a map of SIM slot index to call logs
   */
  async getCallLogsGroupedBySIM(lastSyncTimestamp?: number | null): Promise<Map<number, DeviceCallLog[]>> {
    const allLogs = await this.getCallLogs(lastSyncTimestamp);
    const grouped = new Map<number, DeviceCallLog[]>();

    for (const log of allLogs) {
      const slotIndex = log.simSlotIndex ?? -1;
      if (!grouped.has(slotIndex)) {
        grouped.set(slotIndex, []);
      }
      grouped.get(slotIndex)!.push(log);
    }

    return grouped;
  },

  /**
   * Get call logs for matched SIMs only
   * Returns a map of SIM ID to call logs
   */
  async getCallLogsForMatchedSIMs(lastSyncTimestamp?: number | null): Promise<Map<string, DeviceCallLog[]>> {
    const [matchedSIMs, allLogs] = await Promise.all([
      SIMManager.getMatchedSIMs(),
      this.getCallLogs(lastSyncTimestamp),
    ]);

    const result = new Map<string, DeviceCallLog[]>();

    // Create slot to SIM ID mapping
    const slotToSimId = new Map<number, string>();
    for (const sim of matchedSIMs) {
      slotToSimId.set(sim.slotIndex, sim.simId);
    }

    // Group logs by SIM ID
    for (const log of allLogs) {
      const slotIndex = log.simSlotIndex ?? -1;
      const simId = slotToSimId.get(slotIndex);

      if (simId) {
        if (!result.has(simId)) {
          result.set(simId, []);
        }
        result.get(simId)!.push(log);
      }
    }

    return result;
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

  /**
   * Get all SIM phone numbers (for multi-SIM devices)
   */
  async getAllSIMPhoneNumbers(): Promise<(string | null)[]> {
    if (Platform.OS !== 'android') {
      return [];
    }

    try {
      const phoneNumbers = await CallLogModule.getAllSIMPhoneNumbers();
      return phoneNumbers || [];
    } catch (error) {
      console.error('Error getting all SIM phone numbers:', error);
      return [];
    }
  },

  /**
   * Get total call log count
   */
  async getCallLogCount(): Promise<number> {
    if (Platform.OS !== 'android') {
      return 0;
    }

    try {
      const count = await CallLogModule.getCallLogCount();
      return count || 0;
    } catch (error) {
      console.error('Error getting call log count:', error);
      return 0;
    }
  },

  /**
   * Get call log counts by type (total, incoming, outgoing, missed)
   * Efficient method that doesn't require fetching all call logs
   */
  async getCallLogCounts(): Promise<{ total: number; incoming: number; outgoing: number; missed: number }> {
    if (Platform.OS !== 'android') {
      return { total: 0, incoming: 0, outgoing: 0, missed: 0 };
    }

    try {
      const counts = await CallLogModule.getCallLogCounts();
      return {
        total: counts?.total || 0,
        incoming: counts?.incoming || 0,
        outgoing: counts?.outgoing || 0,
        missed: counts?.missed || 0,
      };
    } catch (error) {
      console.error('Error getting call log counts:', error);
      return { total: 0, incoming: 0, outgoing: 0, missed: 0 };
    }
  },
};

export default CallLogService;