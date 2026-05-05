/**
 * WiFi Context - Manages WiFi speed monitoring state
 * UPDATED: Works with SIM-based auto-authentication
 * UPDATED: Includes battery optimization check for reliable background execution
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { WiFiService } from '../services/WiFiService';
import {
  WiFiStatus,
  SpeedTestResult,
  WiFiContextValue,
} from '../models/index';
import { checkAndPromptBatteryOptimization, isIgnoringBatteryOptimizations } from '../utils/batteryOptimization';

const WiFiContext = createContext<WiFiContextValue | undefined>(undefined);

interface WiFiProviderProps {
  children: ReactNode;
}

export const WiFiProvider: React.FC<WiFiProviderProps> = ({ children }) => {
  // State (UNCHANGED - backward compatible)
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [wifiId, setWifiId] = useState<string | null>(null);
  const [wifiName, setWifiName] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastSpeedTest, setLastSpeedTest] = useState<SpeedTestResult | null>(null);
  const [status, setStatus] = useState<WiFiStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // NEW: Battery optimization state
  const [isBatteryOptimized, setIsBatteryOptimized] = useState(false);

  // Track if initialized
  const initializedRef = useRef(false);
  const companyIdRef = useRef<string | null>(null);

  /**
   * Initialize WiFi monitoring
   * UPDATED: Uses SIM-based auto-authentication internally
   * UPDATED: Checks battery optimization status
   * companyId parameter kept for backward compatibility but not used in new flow
   */
  const initialize = useCallback(async (companyId: string) => {
    console.log('[WiFiContext] Initializing WiFi monitoring...');
    console.log('[WiFiContext] Company ID received (kept for backward compatibility):', companyId);

    setStatus('idle');
    setError(null);
    companyIdRef.current = companyId;

    try {
      // NEW: Check battery optimization status
      const batteryStatus = await checkAndPromptBatteryOptimization();
      setIsBatteryOptimized(!batteryStatus.isIgnoring);
      if (!batteryStatus.isIgnoring) {
        console.warn('[WiFiContext] Battery optimization is enabled. Background WiFi speed tests may be interrupted.');
      }

      // Call the updated WiFiService.initialize()
      // This now uses SIM-based auto-auth internally
      const result = await WiFiService.initialize(companyId);

      if (result.success) {
        // Get device info
        const deviceInfo = await WiFiService.getDeviceInfo();
        setDeviceId(deviceInfo.deviceId);
        setWifiId(deviceInfo.wifiId);

        if (result.isActive) {
          // Device is authenticated and active
          setIsActive(true);
          setStatus('active');

          // Get WiFi name from stored config
          const selectedSim = await WiFiService.getSelectedSimData();
          if (selectedSim && selectedSim.wifiConfig && selectedSim.wifiConfig.length > 0) {
            setWifiName(selectedSim.wifiConfig[0].wifiName || 'WiFi Network');
          }

          console.log('[WiFiContext] Device active, ready for monitoring');
        } else {
          // Authentication failed or not allowed
          setIsActive(false);
          setStatus('error');
          setError(result.message);
          console.log('[WiFiContext] Device not active:', result.message);
        }

        // Get last speed test if available
        const lastTest = await WiFiService.getLastSpeedTest();
        if (lastTest) {
          setLastSpeedTest(lastTest);
        }
      } else {
        setStatus('error');
        setError(result.message);
        setIsActive(false);
      }
    } catch (err: any) {
      console.error('[WiFiContext] Initialization error:', err);
      setStatus('error');
      setError(err.message || 'Failed to initialize WiFi monitoring');
      setIsActive(false);
    }

    initializedRef.current = true;
  }, []);

  /**
   * Refresh device status
   * UPDATED: Validates token and checks SIM status
   */
  const refreshStatus = useCallback(async () => {
    if (!deviceId) return;

    try {
      // Validate device token
      const validation = await WiFiService.validateDevice();

      if (validation.valid) {
        setIsActive(true);
        setStatus('active');

        // Get WiFi name from stored config
        const selectedSim = await WiFiService.getSelectedSimData();
        if (selectedSim) {
          setWifiId(selectedSim.simId);
          if (selectedSim.wifiConfig && selectedSim.wifiConfig.length > 0) {
            setWifiName(selectedSim.wifiConfig[0].wifiName || 'WiFi Network');
          }
        }
      } else {
        setIsActive(false);
        if (status !== 'error') {
          setStatus('idle');
        }
      }
    } catch (err: any) {
      console.error('[WiFiContext] Refresh status error:', err);
    }
  }, [deviceId, status]);

  /**
   * Run a manual speed test
   * FIXED: Better error handling for WiFi connection issues
   */
  const runSpeedTest = useCallback(async (): Promise<SpeedTestResult> => {
    console.log('[WiFiContext] Running manual speed test...');

    try {
      const result = await WiFiService.performSpeedTest();
      setLastSpeedTest(result);

      // Submit if device is active (wifiId check removed - validation is done in service)
      if (isActive) {
        const submitResult = await WiFiService.submitMetrics(result);
        if (!submitResult.success) {
          console.warn('[WiFiContext] Metrics submission failed:', submitResult.message);
          // Don't throw error here - speed test was successful, just submission failed
          // The user can see the speed test results
        } else {
          console.log('[WiFiContext] Metrics submitted successfully');
        }
      } else {
        console.warn('[WiFiContext] Device not active, skipping metrics submission');
      }

      return result;
    } catch (err: any) {
      console.error('[WiFiContext] Speed test error:', err);
      // Set error state for UI to display
      setError(err.message || 'Speed test failed');
      throw err;
    }
  }, [isActive]);

  /**
   * Start background monitoring
   * UNCHANGED
   */
  const startMonitoring = useCallback(() => {
    if (!isActive) {
      console.warn('[WiFiContext] Cannot start monitoring - device not active');
      return;
    }

    console.log('[WiFiContext] Starting background monitoring');
    setIsMonitoring(true);

    WiFiService.startBackgroundMonitoring();
  }, [isActive]);

  /**
   * Stop background monitoring
   * UNCHANGED
   */
  const stopMonitoring = useCallback(() => {
    console.log('[WiFiContext] Stopping background monitoring');
    setIsMonitoring(false);

    WiFiService.stopBackgroundMonitoring();
  }, []);

  /**
   * Start status polling (when waiting for approval)
   * @deprecated - Not needed with SIM-based auth, kept for backward compatibility
   */
  const startStatusPolling = useCallback(() => {
    console.log('[WiFiContext] Status polling called - not needed in SIM-based auth');
    // In SIM-based auth, if initialization succeeded, we're already active
    // No polling needed
  }, []);

  // Auto-start monitoring when active
  useEffect(() => {
    if (status === 'active' && !isMonitoring && initializedRef.current) {
      console.log('[WiFiContext] Device active, auto-starting monitoring');
      startMonitoring();
    }
  }, [status, isMonitoring, startMonitoring]);

  // No polling needed in SIM-based auth - removed polling effect

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[WiFiContext] Cleaning up');
      WiFiService.stopBackgroundMonitoring();
      WiFiService.stopStatusPolling();
    };
  }, []);

  // Context value (UNCHANGED structure - backward compatible)
  const value: WiFiContextValue = {
    deviceId,
    isActive,
    wifiId,
    wifiName,
    isMonitoring,
    lastSpeedTest,
    status,
    error,
    initialize,
    startMonitoring,
    stopMonitoring,
    runSpeedTest,
    refreshStatus,
  };

  return <WiFiContext.Provider value={value}>{children}</WiFiContext.Provider>;
};

/**
 * Custom hook to use WiFi context
 */
export const useWiFi = (): WiFiContextValue => {
  const context = useContext(WiFiContext);
  if (context === undefined) {
    throw new Error('useWiFi must be used within a WiFiProvider');
  }
  return context;
};