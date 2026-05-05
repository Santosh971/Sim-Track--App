/**
 * Native module interface for SIM detection
 * This is the TypeScript interface for the Android native SIM module
 */

import { NativeModules, Platform } from 'react-native';
import { DeviceSIM } from '../models/SIM';

/**
 * Native SIM module interface
 */
interface SIMModuleInterface {
  /**
   * Get all SIM cards currently in the device
   */
  getDeviceSIMs(): Promise<DeviceSIM[]>;

  /**
   * Check if device has dual SIM capability
   */
  isDualSIMDevice(): Promise<boolean>;

  /**
   * Get count of active SIM cards
   */
  getActiveSIMCount(): Promise<number>;
}

// Get the native module
const { SIMModule } = NativeModules;

/**
 * SIM Detection Service
 */
export const SIMDetection = {
  /**
   * Get all SIM cards in the device
   */
  getDeviceSIMs: async (): Promise<DeviceSIM[]> => {
    if (Platform.OS !== 'android') {
      console.warn('SIM detection is only supported on Android');
      return [];
    }

    if (!SIMModule) {
      console.error('SIMModule native module not available');
      return [];
    }

    try {
      const sims = await SIMModule.getDeviceSIMs();
      return sims || [];
    } catch (error) {
      console.error('Error getting device SIMs:', error);
      return [];
    }
  },

  /**
   * Check if device has dual SIM capability
   */
  isDualSIMDevice: async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return false;
    }

    if (!SIMModule) {
      return false;
    }

    try {
      return await SIMModule.isDualSIMDevice();
    } catch (error) {
      console.error('Error checking dual SIM:', error);
      return false;
    }
  },

  /**
   * Get count of active SIM cards
   */
  getActiveSIMCount: async (): Promise<number> => {
    if (Platform.OS !== 'android') {
      return 0;
    }

    if (!SIMModule) {
      return 0;
    }

    try {
      return await SIMModule.getActiveSIMCount();
    } catch (error) {
      console.error('Error getting SIM count:', error);
      return 0;
    }
  },
};

export default SIMDetection;