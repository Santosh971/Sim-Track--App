/**
 * Call Automation Service
 *
 * Manages call automation lifecycle:
 * - Fetches config from backend on app start
 * - Starts/stops the native call automation service
 * - Handles role determination and target rotation
 * - Periodic config refresh (every 5 minutes)
 * - Reports call completion to backend
 */

import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { callAutomationApi, CallConfigResponse } from '../api/callAutomation.api';
import { simApi } from '../api/sim.api';

const { CallAutomationModule } = NativeModules;

const STORAGE_KEY = 'call_automation_config';
const LAST_CALL_KEY = 'call_automation_last_call';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

class CallAutomationService {
  private config: CallConfigResponse | null = null;
  private isInitialized: boolean = false;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private currentSimSlotIndex: number = 0;
  private currentSimPhoneNumber: string = '';

  /**
   * Initialize call automation on app start
   * Fetches config from backend and starts background service if needed
   */
  async initialize(): Promise<void> {
    console.log('[CallAutomationService] Initializing...');

    if (Platform.OS !== 'android') {
      console.log('[CallAutomationService] Only supported on Android');
      return;
    }

    try {
      // FIX: Check battery optimization status
      await this.checkBatteryOptimization();

      // Check and request permissions
      const hasPermissions = await this.checkAndRequestPermissions();
      if (!hasPermissions) {
        console.warn('[CallAutomationService] Permissions not granted');
        return;
      }

      // Get ALL SIM info from device
      const allSimSlots = await this.getAllSimSlots();
      if (!allSimSlots || allSimSlots.length === 0) {
        console.warn('[CallAutomationService] No SIM slots available');
        return;
      }

      console.log('[CallAutomationService] Found ' + allSimSlots.length + ' SIM slots');

      // Check each SIM against the backend to find if any is a CALLER
      let callerConfig: { config: any; simSlot: any } | null = null;

      for (const simSlot of allSimSlots) {
        const simNumber = simSlot.phoneNumber;
        if (!simNumber) {
          console.log('[CallAutomationService] Skipping SIM slot ' + simSlot.slotIndex + ' - no phone number');
          continue;
        }

        console.log('[CallAutomationService] Checking SIM: ' + simNumber + ' (slot ' + simSlot.slotIndex + ')');

        try {
          const config = await this.fetchConfigForSim(simNumber);
          console.log('[CallAutomationService] Config for ' + simNumber + ':', JSON.stringify(config));

          if (config && config.role === 'CALLER' && config.isActive) {
            console.log('[CallAutomationService] *** FOUND CALLER SIM: ' + simNumber + ' ***');
            callerConfig = { config, simSlot };
            break; // Found a caller SIM, use this one
          } else {
            console.log('[CallAutomationService] SIM ' + simNumber + ' role: ' + (config?.role || 'NONE') + ', active: ' + (config?.isActive || false));
          }
        } catch (error) {
          console.log('[CallAutomationService] Error checking SIM ' + simNumber + ':', error);
        }
      }

      if (callerConfig) {
        console.log('[CallAutomationService] Starting call automation service for SIM:', callerConfig.simSlot.phoneNumber);
        console.log('[CallAutomationService] Config:', JSON.stringify(callerConfig.config, null, 2));

        this.config = callerConfig.config;
        this.currentSimSlotIndex = callerConfig.simSlot.slotIndex;
        this.currentSimPhoneNumber = callerConfig.simSlot.phoneNumber;

        // Save SIM slot index for making calls
        const configWithSlot = {
          ...callerConfig.config,
          simSlotIndex: callerConfig.simSlot.slotIndex,
          simPhoneNumber: callerConfig.simSlot.phoneNumber
        };

        await this.startService(configWithSlot);

        // Start periodic config refresh
        this.startPeriodicRefresh();
      } else {
        console.log('[CallAutomationService] No CALLER SIM found on this device');
      }

      this.isInitialized = true;
      console.log('[CallAutomationService] Initialization complete');
    } catch (error) {
      console.error('[CallAutomationService] Initialization error:', error);
    }
  }

  /**
   * FIX: Check battery optimization status and warn user if not disabled
   */
  private async checkBatteryOptimization(): Promise<void> {
    try {
      const { BackgroundSync } = require('../native/BackgroundSyncModule');

      const isIgnoring = await BackgroundSync.isIgnoringBatteryOptimizations();
      console.log('[CallAutomationService] Battery optimization ignored:', isIgnoring);

      if (!isIgnoring) {
        console.warn('[CallAutomationService] ⚠️ Battery optimization is ENABLED for this app');
        console.warn('[CallAutomationService] Call automation may not work reliably when phone is locked');
        console.warn('[CallAutomationService] Please disable battery optimization in Settings > Battery > App battery optimization');
      }
    } catch (error) {
      console.log('[CallAutomationService] Could not check battery optimization status:', error);
    }
  }

  /**
   * Start periodic config refresh (every 5 minutes)
   */
  private startPeriodicRefresh(): void {
    // Clear any existing timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    console.log('[CallAutomationService] Starting periodic config refresh (every 5 minutes)');

    this.refreshTimer = setInterval(async () => {
      console.log('[CallAutomationService] Periodic refresh triggered');
      await this.refreshConfig();
    }, REFRESH_INTERVAL);
  }

  /**
   * Stop periodic config refresh
   */
  private stopPeriodicRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      console.log('[CallAutomationService] Periodic refresh stopped');
    }
  }

  /**
   * Get ALL SIM slots from device
   */
  private async getAllSimSlots(): Promise<any[]> {
    try {
      const slots = await CallAutomationModule.getSimSlots();
      console.log('[CallAutomationService] All SIM Slots:', JSON.stringify(slots, null, 2));
      return slots || [];
    } catch (error) {
      console.error('[CallAutomationService] Error getting SIM slots:', error);
      return [];
    }
  }

  /**
   * Fetch config for a specific SIM number
   */
  private async fetchConfigForSim(simNumber: string): Promise<any> {
    try {
      console.log('[CallAutomationService] Fetching config for SIM:', simNumber);
      const response = await callAutomationApi.getConfig(simNumber);
      console.log('[CallAutomationService] API response:', JSON.stringify(response.data, null, 2));
      console.log('[CallAutomationService] Schedule info from API:', {
        frequency: response.data?.frequency,
        scheduledTime: response.data?.scheduledTime,
        scheduledDay: response.data?.scheduledDay,
      });
      return response.data;
    } catch (error) {
      console.error('[CallAutomationService] Error fetching config for ' + simNumber + ':', error);
      return null;
    }
  }

  /**
   * Check and request necessary permissions
   */
  private async checkAndRequestPermissions(): Promise<boolean> {
    try {
      const hasPermissions = await CallAutomationModule.hasCallPermissions();
      console.log('[CallAutomationService] Has permissions:', hasPermissions);

      if (!hasPermissions) {
        console.log('[CallAutomationService] Requesting permissions...');
        await CallAutomationModule.requestCallPermissions();
        // Wait a bit for user to respond
        await new Promise(resolve => setTimeout(resolve, 2000));
        return await CallAutomationModule.hasCallPermissions();
      }

      return hasPermissions;
    } catch (error) {
      console.error('[CallAutomationService] Permission check error:', error);
      return false;
    }
  }

  /**
   * Get SIM info from device
   */
  private async getSimInfo(): Promise<{ phoneNumber: string; slotIndex: number } | null> {
    try {
      const simSlots = await CallAutomationModule.getSimSlots();
      console.log('[CallAutomationService] SIM Slots:', JSON.stringify(simSlots, null, 2));

      if (simSlots && simSlots.length > 0) {
        // Use first SIM slot
        const slot = simSlots[0];
        return {
          phoneNumber: slot.phoneNumber || '',
          slotIndex: slot.slotIndex
        };
      }

      return null;
    } catch (error) {
      console.error('[CallAutomationService] Error getting SIM info:', error);
      return null;
    }
  }

  /**
   * Fetch config from backend
   */
  private async fetchConfig(simNumber: string): Promise<void> {
    try {
      console.log('[CallAutomationService] Fetching config for SIM:', simNumber);

      const response = await callAutomationApi.getConfig(simNumber);
      this.config = response.data;

      // Save to storage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));

      console.log('[CallAutomationService] Config fetched:', this.config);
    } catch (error) {
      console.error('[CallAutomationService] Error fetching config:', error);

      // Try to load from storage
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.config = JSON.parse(stored);
        console.log('[CallAutomationService] Loaded config from storage:', this.config);
      }
    }
  }

  /**
   * Start the call automation background service
   */
  private async startService(config: any): Promise<void> {
    if (!config) {
      console.warn('[CallAutomationService] No config to start service');
      return;
    }

    try {
      const configJson = JSON.stringify({
        role: config.role,
        targets: config.targets,
        callDuration: config.callDuration,
        frequency: config.frequency,
        scheduledTime: config.scheduledTime,
        scheduledDay: config.scheduledDay,
        isActive: config.isActive,
        configId: config.configId,
        simSlotIndex: config.simSlotIndex ?? 0,
        simPhoneNumber: config.simPhoneNumber
      });

      console.log('[CallAutomationService] Starting service with config:', configJson);
      console.log('[CallAutomationService] Schedule info:', {
        frequency: config.frequency,
        scheduledTime: config.scheduledTime,
        scheduledDay: config.scheduledDay,
      });

      const result = await CallAutomationModule.startCallAutomationService(configJson);
      console.log('[CallAutomationService] Service started:', result);
    } catch (error) {
      console.error('[CallAutomationService] Error starting service:', error);
    }
  }

  /**
   * Stop the call automation service
   */
  async stopService(): Promise<void> {
    try {
      this.stopPeriodicRefresh();
      const result = await CallAutomationModule.stopCallAutomationService();
      console.log('[CallAutomationService] Service stopped:', result);
    } catch (error) {
      console.error('[CallAutomationService] Error stopping service:', error);
    }
  }

  /**
   * Get current config
   */
  getConfig(): CallConfigResponse | null {
    return this.config;
  }

  /**
   * Check if service is running
   */
  async isServiceRunning(): Promise<boolean> {
    try {
      return await CallAutomationModule.isServiceRunning();
    } catch (error) {
      console.error('[CallAutomationService] Error checking service:', error);
      return false;
    }
  }

  /**
   * Manually trigger a test call
   */
  async makeTestCall(phoneNumber: string, simSlotIndex: number = 0, duration: number = 10): Promise<{ success: boolean; error?: string }> {
    console.log('[CallAutomationService] Making test call:', { phoneNumber, simSlotIndex, duration });

    // Ensure minimum duration of 10 seconds
    const actualDuration = Math.max(10, duration);

    try {
      const result = await CallAutomationModule.makeCall(phoneNumber, simSlotIndex, actualDuration);
      console.log('[CallAutomationService] Call result:', result);
      return result;
    } catch (error: any) {
      console.error('[CallAutomationService] Call error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get available SIM slots
   */
  async getSimSlots(): Promise<any[]> {
    try {
      return await CallAutomationModule.getSimSlots();
    } catch (error) {
      console.error('[CallAutomationService] Error getting SIM slots:', error);
      return [];
    }
  }

  /**
   * Refresh config from backend (manual or periodic)
   * This fetches the latest config and restarts the service if needed
   */
  async refreshConfig(): Promise<{ success: boolean; message: string; config?: CallConfigResponse }> {
    console.log('[CallAutomationService] Refreshing config...');

    try {
      if (!this.currentSimPhoneNumber) {
        // Try to find a caller SIM again
        const allSimSlots = await this.getAllSimSlots();
        for (const simSlot of allSimSlots) {
          if (simSlot.phoneNumber) {
            const config = await this.fetchConfigForSim(simSlot.phoneNumber);
            if (config && config.role === 'CALLER') {
              this.currentSimPhoneNumber = simSlot.phoneNumber;
              this.currentSimSlotIndex = simSlot.slotIndex;
              break;
            }
          }
        }
      }

      if (!this.currentSimPhoneNumber) {
        return { success: false, message: 'No caller SIM found on this device' };
      }

      // Fetch latest config
      const newConfig = await this.fetchConfigForSim(this.currentSimPhoneNumber);

      if (!newConfig) {
        return { success: false, message: 'Failed to fetch config from server' };
      }

      const wasActive = this.config?.isActive;
      const wasRunning = await this.isServiceRunning();

      this.config = newConfig;

      // Save to storage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));

      console.log('[CallAutomationService] Config refreshed:', {
        role: newConfig.role,
        isActive: newConfig.isActive,
        targetsCount: newConfig.targets?.length || 0,
        frequency: newConfig.frequency,
        scheduledTime: newConfig.scheduledTime,
        scheduledDay: newConfig.scheduledDay,
      });

      // Check if service needs to be restarted
      if (newConfig.role === 'CALLER' && newConfig.isActive) {
        const configWithSlot = {
          ...newConfig,
          simSlotIndex: this.currentSimSlotIndex,
          simPhoneNumber: this.currentSimPhoneNumber
        };

        // Stop existing service and restart with new config
        if (wasRunning) {
          await CallAutomationModule.stopCallAutomationService();
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        await this.startService(configWithSlot);

        // Ensure periodic refresh is running
        if (!this.refreshTimer) {
          this.startPeriodicRefresh();
        }

        return { success: true, message: 'Config refreshed and service restarted', config: newConfig };
      } else {
        // Config is no longer active or not a caller, stop service
        if (wasRunning) {
          await CallAutomationModule.stopCallAutomationService();
        }

        if (newConfig.role !== 'CALLER') {
          return { success: true, message: 'This SIM is no longer a caller', config: newConfig };
        }
        if (!newConfig.isActive) {
          return { success: true, message: 'Call automation is disabled', config: newConfig };
        }

        return { success: true, message: 'Config refreshed', config: newConfig };
      }
    } catch (error: any) {
      console.error('[CallAutomationService] Error refreshing config:', error);
      return { success: false, message: error.message || 'Failed to refresh config' };
    }
  }

  /**
   * Report call completion to backend
   * Called by the native worker after calls are completed
   */
  async reportCallComplete(successCount: number, failCount: number): Promise<void> {
    if (!this.config?.configId) {
      console.warn('[CallAutomationService] No configId to report call completion');
      return;
    }

    try {
      console.log('[CallAutomationService] Reporting call complete:', {
        configId: this.config.configId,
        simNumber: this.currentSimPhoneNumber,
        successCount,
        failCount
      });

      await callAutomationApi.callComplete(this.config.configId);

      console.log('[CallAutomationService] Call completion reported successfully');
    } catch (error) {
      console.error('[CallAutomationService] Error reporting call completion:', error);
    }
  }

  /**
   * Get current status for UI display
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    config: CallConfigResponse | null;
    simPhoneNumber: string;
    simSlotIndex: number;
  }> {
    const isRunning = await this.isServiceRunning();
    return {
      isRunning,
      config: this.config,
      simPhoneNumber: this.currentSimPhoneNumber,
      simSlotIndex: this.currentSimSlotIndex
    };
  }

  /**
   * FIX: Check if battery optimization is disabled
   */
  async isBatteryOptimizationDisabled(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const { BackgroundSync } = require('../native/BackgroundSyncModule');
      return await BackgroundSync.isIgnoringBatteryOptimizations();
    } catch (error) {
      console.error('[CallAutomationService] Error checking battery optimization:', error);
      return false;
    }
  }

  /**
   * FIX: Request to disable battery optimization
   */
  async requestDisableBatteryOptimization(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const { BackgroundSync } = require('../native/BackgroundSyncModule');
      const result = await BackgroundSync.requestIgnoreBatteryOptimizations();
      console.log('[CallAutomationService] Battery optimization request result:', result);
      return result;
    } catch (error) {
      console.error('[CallAutomationService] Error requesting battery optimization exemption:', error);
      return false;
    }
  }

  /**
   * FIX: Open battery optimization settings
   */
  async openBatterySettings(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const { BackgroundSync } = require('../native/BackgroundSyncModule');
      return await BackgroundSync.openBatterySettings();
    } catch (error) {
      console.error('[CallAutomationService] Error opening battery settings:', error);
      return false;
    }
  }

  /**
   * Cleanup on app exit or logout
   */
  cleanup(): void {
    this.stopPeriodicRefresh();
    this.config = null;
    this.isInitialized = false;
  }
}

export const callAutomationService = new CallAutomationService();
export default callAutomationService;