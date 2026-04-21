/**
 * Sync Context - Manages call log sync state
 * Integrates with native BackgroundSync module for background execution
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Platform, DeviceEventEmitter, NativeEventEmitter, NativeModules } from 'react-native';
import { SyncService, SyncResult } from '../services/SyncService';
import { StorageService } from '../services/StorageService';
import { BackgroundSync } from '../native/BackgroundSyncModule';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

interface SyncContextValue {
  isSyncing: boolean;
  status: SyncStatus;
  lastSyncTime: string | null;
  pendingLogs: number;
  syncInterval: number;
  autoSyncEnabled: boolean;
  error: string | null;
  sync: () => Promise<SyncResult>;
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

      if (lastSync) {
        setLastSyncTime(SyncService.formatLastSync(lastSync));
      }
      setPendingLogs(pending);
      setSyncIntervalState(interval);
      setAutoSyncEnabledState(autoEnabled);
    } catch (err) {
      console.error('Error refreshing sync state:', err);
    }
  }, []);

  // Manual sync
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
          console.log('[SyncContext] Background sync service started');
        }
      } else {
        // Stop the background service
        const isRunning = await BackgroundSync.isRunning();
        if (isRunning) {
          await BackgroundSync.stopSync();
          serviceRunning.current = false;
          console.log('[SyncContext] Background sync service stopped');
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

    if (enabled) {
      // Perform initial sync when enabling
      await sync();
    }

    // Start or stop the background service
    await updateBackgroundService(enabled, syncInterval);
  }, [sync, syncInterval, updateBackgroundService]);

  // Listen for background sync trigger events
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const eventEmitter = new NativeEventEmitter(NativeModules.BackgroundSyncModule);

    const subscription = eventEmitter.addListener('BackgroundSyncTrigger', async (data: { mobileNumber?: string; syncInterval?: number }) => {
      console.log('[SyncContext] Received background sync trigger');
      try {
        await sync();
        console.log('[SyncContext] Background sync completed');
      } catch (err) {
        console.error('[SyncContext] Background sync failed:', err);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [sync]);

  // Initial setup
  useEffect(() => {
    const initializeSync = async () => {
      // Check if user is authenticated (has mobile number)
      const mobileNumber = await StorageService.getMobileNumber();
      if (!mobileNumber) {
        // User not logged in, don't setup sync
        return;
      }

      // Set mobile number in native module
      if (Platform.OS === 'android') {
        await BackgroundSync.setMobileNumber(mobileNumber);
      }

      await refreshSyncState();

      // Perform initial sync if auto-sync is enabled and we haven't synced yet
      if (autoSyncEnabled && !initialSyncDone.current) {
        initialSyncDone.current = true;
        await sync();
      }

      // Start background service if auto-sync is enabled
      if (autoSyncEnabled) {
        await updateBackgroundService(true, syncInterval);
      }
    };

    initializeSync();

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
    sync,
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