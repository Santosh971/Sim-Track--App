/**
 * useSync Hook
 */

import { useCallback, useEffect, useState } from 'react';
import { useSync as useSyncContext } from '../context/SyncContext';
import { SyncService } from '../services/SyncService';
import { SyncResult } from '../services/SyncService';

export const useSync = () => {
  const context = useSyncContext();
  return context;
};

/**
 * Hook for manual sync with loading state
 */
export const useManualSync = () => {
  const { sync, refreshSyncState } = useSyncContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manualSync = useCallback(async (): Promise<SyncResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await sync();
      if (!result.success) {
        setError(result.error || result.message);
      }
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Sync failed';
      setError(errorMessage);
      return {
        success: false,
        synced: 0,
        failed: 0,
        message: errorMessage,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  }, [sync]);

  return {
    isLoading,
    error,
    sync: manualSync,
    refreshSyncState,
  };
};

export default useSync;