/**
 * App Configuration
 */

// API Configuration
export const API_CONFIG = {
  // Backend API URL - change this for production
  // Production (cPanel) - requires proper server configuration
  // BASE_URL: 'https://simtrackr.b100x.in/api',
  // Render backend (working)
  // BASE_URL: 'https://sim-management-3ba9.onrender.com/api',
  BASE_URL : 'https://node.simtrackr.b100x.in/api',
  TIMEOUT: 30000,
  HEADERS: {
    'Content-Type': 'application/json',
  },
};

// Sync Configuration
export const SYNC_CONFIG = {
  // Default sync interval in minutes
  DEFAULT_INTERVAL: 5, // Changed from 15 to 5 minutes
  // Minimum sync interval in minutes
  MIN_INTERVAL: 5,
  // Maximum sync interval in minutes
  MAX_INTERVAL: 60,
  // Available sync intervals
  INTERVALS: [5, 10, 15, 30, 60],
  // Batch size for call logs
  BATCH_SIZE: 100,
};

// OTP Configuration
export const OTP_CONFIG = {
  LENGTH: 6,
  RESEND_COOLDOWN: 30, // seconds
  MAX_ATTEMPTS: 5,
};

// Storage Keys
export const STORAGE_KEYS = {
  MOBILE_NUMBER: 'mobile_number',
  JWT_TOKEN: 'jwt_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  LAST_SYNC: 'last_sync_timestamp',
  OFFLINE_QUEUE: 'offline_queue',
  SYNC_INTERVAL: 'sync_interval',
  AUTO_SYNC_ENABLED: 'auto_sync_enabled',
  PERMISSIONS_GRANTED: 'permissions_granted',
};

// Permission Types
export const PERMISSIONS = {
  READ_CALL_LOG: 'android.permission.READ_CALL_LOG',
  READ_PHONE_STATE: 'android.permission.READ_PHONE_STATE',
  POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
};

// App Info
export const APP_INFO = {
  NAME: 'SIM Management',
  VERSION: '1.0.0',
};