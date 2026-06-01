/**
 * Sync Context - Manages call log and SMS sync state
 * Integrates with native BackgroundSync module for background execution
 * Updated for SIM-based sync
 * Updated: Includes battery optimization check for reliable background execution
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Platform, DeviceEventEmitter, NativeEventEmitter, NativeModules } from 'react-native';
import { SyncService, SyncResult } from '../services/SyncService';
import { SMSService } from '../services/SMSService';
import { StorageService } from '../services/StorageService';
import { SIMManager } from '../services/SIMManager';
import { BackgroundSync } from '../native/BackgroundSyncModule';
import { checkAndPromptBatteryOptimization } from '../utils/batteryOptimization';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

interface SyncContextValue {
  isSyncing: boolean;
  status: SyncStatus;
  lastSyncTime: string | null;
  pendingLogs: number;
  syncInterval: number;
  autoSyncEnabled: boolean;
  error: string | null;
  matchedSIMs: number;
  // SMS sync state
  isSmsSyncing: boolean;
  smsLastSyncTime: string | null;
  smsSyncStatus: SyncStatus;
  // Methods
  sync: () => Promise<SyncResult>;
  syncSMS: () => Promise<{ success: boolean; synced: number; failed: number; message: string }>;
  syncSMSForRegisteredSim: () => Promise<{ success: boolean; synced: number; failed: number; message: string }>;
  resetSmsSyncLock: () => void;
  setSyncInterval: (minutes: number) => Promise<void>;
  setAutoSyncEnabled: (enabled: boolean) => Promise<void>;
  refreshSyncState: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

interface SyncProviderProps {
  children: ReactNode;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [pendingLogs, setPendingLogs] = useState(0);
  const [syncInterval, setSyncIntervalState] = useState(5); // Default 5 minutes
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchedSIMs, setMatchedSIMs] = useState(0);
  // SMS sync state
  const [isSmsSyncing, setIsSmsSyncing] = useState(false);
  const [smsLastSyncTime, setSmsLastSyncTime] = useState<string | null>(null);
  const [smsSyncStatus, setSmsSyncStatus] = useState<SyncStatus>('idle');

  // Track the initial sync performed flag
  const initialSyncDone = useRef(false);
  // Track if native service is started
  const serviceRunning = useRef(false);

  // Refresh sync state from storage
  const refreshSyncState = useCallback(async () => {
    try {
      const [lastSync, pending, interval, autoEnabled] = await Promise.all([
        StorageService.getLastSync(),
        SyncService.getPendingCount(),
        StorageService.getSyncInterval(),
        StorageService.isAutoSyncEnabled(),
      ]);

      // Get matched SIM count
      const sims = await SIMManager.getMatchedSIMs();
      setMatchedSIMs(sims.length);

      if (lastSync) {
        setLastSyncTime(SyncService.formatLastSync(lastSync));
      }
      setPendingLogs(pending);
      setSyncIntervalState(interval);
      setAutoSyncEnabledState(autoEnabled);

      // Get SMS last sync time
      const smsLastSync = await SMSService.getLastSync();
      if (smsLastSync) {
        setSmsLastSyncTime(SMSService.formatLastSync(smsLastSync));
      }
    } catch (err) {
      console.error('Error refreshing sync state:', err);
    }
  }, []);

  // Manual sync (call logs)
  const sync = useCallback(async (): Promise<SyncResult> => {
    if (isSyncing) {
      return {
        success: false,
        synced: 0,
        failed: pendingLogs,
        message: 'Sync already in progress',
      };
    }

    setIsSyncing(true);
    setStatus('syncing');
    setError(null);

    try {
      const result = await SyncService.sync();

      if (result.success) {
        setStatus('success');
        // Update native module's last sync time
        if (Platform.OS === 'android') {
          await BackgroundSync.setLastSyncTime(Date.now());
        }
      } else {
        setStatus('error');
        setError(result.error || result.message);
      }

      // Refresh state
      await refreshSyncState();

      return result;
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Sync failed');
      return {
        success: false,
        synced: 0,
        failed: pendingLogs,
        message: err.message || 'Sync failed',
        error: err.message,
      };
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, pendingLogs, refreshSyncState]);

  // Manual SMS sync
  const syncSMS = useCallback(async (): Promise<{ success: boolean; synced: number; failed: number; message: string }> => {
    if (isSmsSyncing) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        message: 'SMS sync already in progress',
      };
    }

    setIsSmsSyncing(true);
    setSmsSyncStatus('syncing');

    try {
      const result = await SMSService.sync();

      if (result.success) {
        setSmsSyncStatus('success');
      } else {
        setSmsSyncStatus('error');
      }

      // Refresh state
      await refreshSyncState();

      return result;
    } catch (err: any) {
      setSmsSyncStatus('error');
      return {
        success: false,
        synced: 0,
        failed: 0,
        message: err.message || 'SMS sync failed',
        error: err.message,
      };
    } finally {
      setIsSmsSyncing(false);
    }
  }, [isSmsSyncing, refreshSyncState]);

  // NEW: SMS sync for registered SIM only (not all SIMs)
  const syncSMSForRegisteredSim = useCallback(async (): Promise<{ success: boolean; synced: number; failed: number; message: string }> => {
    if (isSmsSyncing) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        message: 'SMS sync already in progress',
      };
    }

    setIsSmsSyncing(true);
    setSmsSyncStatus('syncing');

    try {
      const result = await SMSService.syncForRegisteredSimOnly();

      if (result.success) {
        setSmsSyncStatus('success');
      } else {
        setSmsSyncStatus('error');
      }

      // Refresh state
      await refreshSyncState();

      return result;
    } catch (err: any) {
      setSmsSyncStatus('error');
      return {
        success: false,
        synced: 0,
        failed: 0,
        message: err.message || 'SMS sync failed',
        error: err.message,
      };
    } finally {
      setIsSmsSyncing(false);
    }
  }, [isSmsSyncing, refreshSyncState]);

  // Reset SMS sync lock (if stuck)
  const resetSmsSyncLock = useCallback(() => {
    SMSService.resetSyncLock();
    setIsSmsSyncing(false);
    setSmsSyncStatus('idle');
  }, []);

  // Start or stop the background sync service
  const updateBackgroundService = useCallback(async (enabled: boolean, interval: number) => {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      if (enabled) {
        // Set the sync interval in native module
        await BackgroundSync.setSyncInterval(interval);

        // Start the background service if not already running
        const isRunning = await BackgroundSync.isRunning();
        if (!isRunning) {
          await BackgroundSync.startSync();
          serviceRunning.current = true;
        }
      } else {
        // Stop the background service
        const isRunning = await BackgroundSync.isRunning();
        if (isRunning) {
          await BackgroundSync.stopSync();
          serviceRunning.current = false;
        }
      }
    } catch (err) {
      console.error('[SyncContext] Error updating background service:', err);
    }
  }, []);

  // Set sync interval
  const setSyncInterval = useCallback(async (minutes: number) => {
    await StorageService.setSyncInterval(minutes);
    setSyncIntervalState(minutes);

    // Update native service interval
    if (autoSyncEnabled) {
      await updateBackgroundService(true, minutes);
    }
  }, [autoSyncEnabled, updateBackgroundService]);

  // Set auto sync enabled
  const setAutoSyncEnabled = useCallback(async (enabled: boolean) => {
    await StorageService.setAutoSyncEnabled(enabled);
    setAutoSyncEnabledState(enabled);

    // Start or stop the background service
    await updateBackgroundService(enabled, syncInterval);

    // If enabling, trigger a background sync (non-blocking)
    // The sync will happen in the background via the service
    if (enabled) {
      // Don't await - let it run in background
      sync().catch(err => console.error('[SyncContext] Auto-enable sync failed:', err));
    }
  }, [sync, syncInterval, updateBackgroundService]);

  // Listen for background sync trigger events
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    // Check if BackgroundSyncModule exists before creating event emitter
    const { BackgroundSyncModule } = NativeModules;
    if (!BackgroundSyncModule) {
      console.warn('[SyncContext] BackgroundSyncModule not available');
      return;
    }

    const eventEmitter = new NativeEventEmitter(BackgroundSyncModule);

    const subscription = eventEmitter.addListener('BackgroundSyncTrigger', (data: { simIds?: string[]; syncInterval?: number }) => {
      

      // Run syncs SEQUENTIALLY (not parallel) to avoid JS context issues
      setTimeout(async () => {
        try {
          const callLogResult = await sync();
          console.log('[SyncContext] Call log sync result:', JSON.stringify(callLogResult));
        } catch (err) {
          console.error('[SyncContext] Call log sync FAILED:', err);
        }

        try {
          const smsResult = await syncSMS();
          console.log('[SyncContext] SMS sync result:', JSON.stringify(smsResult));
        } catch (err) {
          console.error('[SyncContext] SMS sync FAILED:', err);
        }

      }, 0);
    });

    return () => {
      subscription.remove();
    };
  }, [sync, syncSMS]);

  // Initial setup
  useEffect(() => {
    const initializeSync = async () => {
      // Check if user has matched SIMs or email (authenticated)
      const [email, matchedSIMs] = await Promise.all([
        StorageService.getEmail(),
        SIMManager.getMatchedSIMs(),
      ]);

      if (!email && matchedSIMs.length === 0) {
        // User not logged in and no matched SIMs, don't setup sync
        return;
      }

      // NEW: Check battery optimization status for reliable background sync
      try {
        const batteryStatus = await checkAndPromptBatteryOptimization();
        if (!batteryStatus.isIgnoring) {
          console.warn('[SyncContext] Battery optimization is enabled. Background sync may be interrupted.');
        }
      } catch (error) {
        console.warn('[SyncContext] Failed to check battery optimization:', error);
      }

      // Set up SIM IDs in native module for background sync
      if (Platform.OS === 'android' && matchedSIMs.length > 0) {
        const simIds = matchedSIMs.filter(sim => sim.isActive).map(sim => sim.simId);
        if (simIds.length > 0) {
          await BackgroundSync.setValidSIMIds(simIds);
        }
      }

      // Set email in native module if available
      if (Platform.OS === 'android' && email) {
        await BackgroundSync.setUserEmail(email);
      }

      await refreshSyncState();

      // Start background service if auto-sync is enabled
      // NOTE: Removed initial sync on mount to prevent UI blocking
      // Sync will happen in background via the foreground service
      if (autoSyncEnabled) {
        await updateBackgroundService(true, syncInterval);
      }
    };

    initializeSync().catch(err => {
      console.error('[SyncContext] Initialization error:', err);
    });

    // Cleanup on unmount
    return () => {
      // Don't stop the service on unmount - let it continue in background
      // The service will continue running even when app is closed
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update service when interval changes
  useEffect(() => {
    if (autoSyncEnabled && serviceRunning.current) {
      updateBackgroundService(true, syncInterval);
    }
  }, [syncInterval, autoSyncEnabled, updateBackgroundService]);

  const value: SyncContextValue = {
    isSyncing,
    status,
    lastSyncTime,
    pendingLogs,
    syncInterval,
    autoSyncEnabled,
    error,
    matchedSIMs,
    // SMS sync state
    isSmsSyncing,
    smsLastSyncTime,
    smsSyncStatus,
    sync,
    syncSMS,
    syncSMSForRegisteredSim,
    resetSmsSyncLock,
    setSyncInterval,
    setAutoSyncEnabled,
    refreshSyncState,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

export const useSync = (): SyncContextValue => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};

export default SyncContext;