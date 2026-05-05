/**
 * Native SMS Module - Interface to Android SMS content provider
 * Requires READ_SMS permission on Android
 */

import { NativeModules, Platform } from 'react-native';

/**
 * SMS message read from device
 */
export interface DeviceSMS {
  _id: string;              // Message ID from device
  sender: string;           // Sender phone number or ID
  message: string;          // SMS content
  timestamp: number;        // Unix timestamp (ms)
  type: 'inbox' | 'sent';   // Message type
  simSlotIndex: number;     // SIM slot index (-1 if unknown)
}

/**
 * Permission status for SMS module
 */
export interface SMSPermissions {
  readSms: boolean;
  readPhoneState: boolean;
}

export interface SMSCounts {
  total: number;
  inbox: number;
  sent: number;
}

interface SMSModuleInterface {
  checkPermissions(): Promise<SMSPermissions>;
  requestPermissions(): Promise<SMSPermissions>;
  getSMSMessages(lastSyncTimestamp?: number): Promise<DeviceSMS[]>;
  getSMSCount(): Promise<number>;
  getSMSCounts(): Promise<SMSCounts>;
}

const LINKING_ERROR =
  `The package 'SMSModule' doesn't seem to be linked. Make sure:\n` +
  `- You rebuilt the app after installing the package\n` +
  `- If you are using CocoaPods on iOS, run 'pod install'`;

const SMSModule: SMSModuleInterface = {
  checkPermissions: async (): Promise<SMSPermissions> => {
    if (Platform.OS !== 'android') {
      return { readSms: false, readPhoneState: false };
    }

    try {
      const result = await NativeModules.SMSModule.checkPermissions();
      return {
        readSms: result.readSms || false,
        readPhoneState: result.readPhoneState || false,
      };
    } catch (error) {
      console.error('[SMSModule] Error checking permissions:', error);
      return { readSms: false, readPhoneState: false };
    }
  },

  requestPermissions: async (): Promise<SMSPermissions> => {
    if (Platform.OS !== 'android') {
      return { readSms: false, readPhoneState: false };
    }

    try {
      const result = await NativeModules.SMSModule.requestPermissions();
      return {
        readSms: result['android.permission.READ_SMS'] || false,
        readPhoneState: result['android.permission.READ_PHONE_STATE'] || false,
      };
    } catch (error) {
      console.error('[SMSModule] Error requesting permissions:', error);
      return { readSms: false, readPhoneState: false };
    }
  },

  getSMSMessages: async (lastSyncTimestamp?: number): Promise<DeviceSMS[]> => {
    if (Platform.OS !== 'android') {
      console.warn('[SMSModule] SMS reading is only available on Android');
      return [];
    }

    try {
      const messages = await NativeModules.SMSModule.getSMSMessages(lastSyncTimestamp || null);
      return messages || [];
    } catch (error) {
      console.error('[SMSModule] Error getting SMS messages:', error);
      return [];
    }
  },

  getSMSCount: async (): Promise<number> => {
    if (Platform.OS !== 'android') {
      return 0;
    }

    try {
      const count = await NativeModules.SMSModule.getSMSCount();
      return count || 0;
    } catch (error) {
      console.error('[SMSModule] Error getting SMS count:', error);
      return 0;
    }
  },

  getSMSCounts: async (): Promise<{ total: number; inbox: number; sent: number }> => {
    if (Platform.OS !== 'android') {
      return { total: 0, inbox: 0, sent: 0 };
    }

    try {
      const counts = await NativeModules.SMSModule.getSMSCounts();
      return {
        total: counts?.total || 0,
        inbox: counts?.inbox || 0,
        sent: counts?.sent || 0,
      };
    } catch (error) {
      console.error('[SMSModule] Error getting SMS counts:', error);
      return { total: 0, inbox: 0, sent: 0 };
    }
  },
};

export default SMSModule;