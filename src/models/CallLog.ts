/**
 * Call Log model (from device)
 */
export interface DeviceCallLog {
  callId: string;
  phoneNumber: string;
  callType: 'incoming' | 'outgoing' | 'missed' | 'unknown';
  timestamp: number;
  duration: number;
  contactName: string | null;
}

/**
 * Call Log model (API format)
 */
export interface APICallLog {
  phoneNumber: string;
  callType: 'incoming' | 'outgoing' | 'missed';
  duration: number;
  timestamp: string;
  contactName?: string | null;
}

/**
 * Sync request payload
 */
export interface SyncRequest {
  mobileNumber: string;
  callLogs: APICallLog[];
}

/**
 * Sync response
 */
export interface SyncResponse {
  success: boolean;
  message: string;
  data: {
    synced: number;
    duplicates?: number;
  };
}

/**
 * Sync status
 */
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

/**
 * Sync state
 */
export interface SyncState {
  isSyncing: boolean;
  lastSyncTime: string | null;
  status: SyncStatus;
  pendingLogs: number;
  syncInterval: number;
  autoSyncEnabled: boolean;
  error: string | null;
}

/**
 * Convert device call log to API format
 */
export function toAPICallLog(log: DeviceCallLog): APICallLog {
  const apiLog: APICallLog = {
    phoneNumber: log.phoneNumber,
    callType: log.callType === 'unknown' ? 'incoming' : log.callType,
    duration: log.duration,
    timestamp: new Date(log.timestamp).toISOString(),
  };

  // Only include contactName if it has a valid value
  if (log.contactName && log.contactName.trim() !== '') {
    apiLog.contactName = log.contactName;
  }

  return apiLog;
}

/**
 * Convert array of device call logs to API format
 */
export function toAPICallLogs(logs: DeviceCallLog[]): APICallLog[] {
  return logs.map(toAPICallLog);
}