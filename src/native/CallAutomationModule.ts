/**
 * Call Automation Native Module Wrapper
 *
 * TypeScript interface for the native Android call automation module.
 * Handles making calls, ending calls, and multi-SIM selection.
 */

import { NativeModules, Platform } from 'react-native';

// Types
export interface SimSlotInfo {
  slotIndex: number;
  phoneNumber: string | null;
  carrierName: string;
  iccId: string;
}

export interface CallResult {
  success: boolean;
  error?: string;
  callDuration?: number;
}

// Native module interface
export interface CallAutomationModuleInterface {
  // Permission checks
  hasCallPermissions(): Promise<boolean>;
  requestCallPermissions(): Promise<boolean>;

  // SIM slot management
  getSimSlots(): Promise<SimSlotInfo[]>;

  // Call execution
  makeCall(phoneNumber: string, simSlotIndex: number, durationSeconds: number): Promise<CallResult>;
  endCall(): Promise<boolean>;

  // State checks
  isInCall(): Promise<boolean>;
  getCallState(): Promise<string>;

  // Battery optimization
  isIgnoringBatteryOptimization(): Promise<boolean>;
  requestIgnoreBatteryOptimization(): Promise<boolean>;

  // Service control
  startCallAutomationService(configJson: string): Promise<boolean>;
  stopCallAutomationService(): Promise<boolean>;
  isServiceRunning(): Promise<boolean>;
}

// Get native module
const { CallAutomationModule } = NativeModules;

// Wrapper with platform checks
export const CallAutomation: CallAutomationModuleInterface = {
  /**
   * Check if call permissions are granted
   */
  hasCallPermissions: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      console.warn('[CallAutomation] Only supported on Android');
      return false;
    }

    try {
      return await CallAutomationModule.hasCallPermissions();
    } catch (error) {
      console.error('[CallAutomation] Error checking permissions:', error);
      return false;
    }
  },

  /**
   * Request call permissions
   */
  requestCallPermissions: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      return await CallAutomationModule.requestCallPermissions();
    } catch (error) {
      console.error('[CallAutomation] Error requesting permissions:', error);
      return false;
    }
  },

  /**
   * Get available SIM slots
   */
  getSimSlots: async (): Promise<SimSlotInfo[]> => {
    if (Platform.OS !== 'android') {
      return [];
    }

    try {
      const slots = await CallAutomationModule.getSimSlots();
      console.log('[CallAutomation] SIM slots:', slots);
      return slots || [];
    } catch (error) {
      console.error('[CallAutomation] Error getting SIM slots:', error);
      return [];
    }
  },

  /**
   * Make a call using specified SIM slot
   */
  makeCall: async (phoneNumber: string, simSlotIndex: number, durationSeconds: number): Promise<CallResult> => {
    if (Platform.OS !== 'android') {
      return { success: false, error: 'Only supported on Android' };
    }

   

    try {
      const result = await CallAutomationModule.makeCall(phoneNumber, simSlotIndex, durationSeconds);
      return result;
    } catch (error: any) {
      console.error('[CallAutomation] Error making call:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * End current call
   */
  endCall: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      return await CallAutomationModule.endCall();
    } catch (error) {
      console.error('[CallAutomation] Error ending call:', error);
      return false;
    }
  },

  /**
   * Check if currently in a call
   */
  isInCall: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      return await CallAutomationModule.isInCall();
    } catch (error) {
      console.error('[CallAutomation] Error checking call state:', error);
      return false;
    }
  },

  /**
   * Get current call state
   */
  getCallState: async (): Promise<string> => {
    if (Platform.OS !== 'android') {
      return 'IDLE';
    }

    try {
      return await CallAutomationModule.getCallState();
    } catch (error) {
      console.error('[CallAutomation] Error getting call state:', error);
      return 'UNKNOWN';
    }
  },

  /**
   * Check if ignoring battery optimization
   */
  isIgnoringBatteryOptimization: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      return await CallAutomationModule.isIgnoringBatteryOptimization();
    } catch (error) {
      console.error('[CallAutomation] Error checking battery optimization:', error);
      return false;
    }
  },

  /**
   * Request to ignore battery optimization
   */
  requestIgnoreBatteryOptimization: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      return await CallAutomationModule.requestIgnoreBatteryOptimization();
    } catch (error) {
      console.error('[CallAutomation] Error requesting battery optimization exemption:', error);
      return false;
    }
  },

  /**
   * Start the call automation background service
   */
  startCallAutomationService: async (configJson: string): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      console.log('[CallAutomation] Starting service with config:', configJson);
      return await CallAutomationModule.startCallAutomationService(configJson);
    } catch (error) {
      console.error('[CallAutomation] Error starting service:', error);
      return false;
    }
  },

  /**
   * Stop the call automation service
   */
  stopCallAutomationService: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      return await CallAutomationModule.stopCallAutomationService();
    } catch (error) {
      console.error('[CallAutomation] Error stopping service:', error);
      return false;
    }
  },

  /**
   * Check if service is running
   */
  isServiceRunning: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      return await CallAutomationModule.isServiceRunning();
    } catch (error) {
      console.error('[CallAutomation] Error checking service:', error);
      return false;
    }
  },
};

export default CallAutomation;