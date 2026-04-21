/**
 * usePermissions Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { CallLogService } from '../services/CallLogService';
import { StorageService } from '../services/StorageService';

interface PermissionsState {
  hasPermissions: boolean;
  isLoading: boolean;
  error: string | null;
}

export const usePermissions = () => {
  const [state, setState] = useState<PermissionsState>({
    hasPermissions: false,
    isLoading: true,
    error: null,
  });

  const checkPermissions = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setState({ hasPermissions: true, isLoading: false, error: null });
      return;
    }

    try {
      const result = await CallLogService.hasAllPermissions();
      const hasPermissions = result;

      if (hasPermissions) {
        await StorageService.setPermissionsGranted(true);
      }

      setState({ hasPermissions, isLoading: false, error: null });
    } catch (error: any) {
      setState({ hasPermissions: false, isLoading: false, error: error.message });
    }
  }, []);

  const requestPermissions = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return { granted: true, error: null };
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await CallLogService.requestPermissions();
      const hasAll = result.readCallLog && result.readPhoneState;

      if (hasAll) {
        await StorageService.setPermissionsGranted(true);
      }

      setState({ hasPermissions: hasAll, isLoading: false, error: null });
      return { granted: hasAll, error: null };
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to request permissions';
      setState((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      return { granted: false, error: errorMessage };
    }
  }, []);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  return {
    ...state,
    checkPermissions,
    requestPermissions,
  };
};

export default usePermissions;