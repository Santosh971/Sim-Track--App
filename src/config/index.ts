/**
 * App Configuration
 * Uses environment variables from .env file
 */

// Import environment variable
import { API_BASE_URL } from '@env';

// API Configuration
export const API_CONFIG = {
  // Backend API URL - loaded from .env file
  BASE_URL: API_BASE_URL,
  TIMEOUT: 60000,  // 60 seconds for large payloads
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
  EMAIL: 'user_email',
  MOBILE_NUMBER: 'mobile_number',
  JWT_TOKEN: 'jwt_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  LAST_SYNC: 'last_sync_timestamp',
  OFFLINE_QUEUE: 'offline_queue',
  SYNC_INTERVAL: 'sync_interval',
  AUTO_SYNC_ENABLED: 'auto_sync_enabled',
  PERMISSIONS_GRANTED: 'permissions_granted',
  MATCHED_SIMS: 'matched_sims',
  DEVICE_ID: 'device_id',
  VALID_SIM_IDS: 'valid_sim_ids',
  // WiFi Speed Monitoring (Legacy - kept for backward compatibility)
  WIFI_DEVICE_ID: 'wifi_device_id',
  WIFI_STATUS: 'wifi_status',
  WIFI_LAST_TEST: 'wifi_last_speed_test',
  WIFI_WIFI_ID: 'wifi_wifi_id',
  WIFI_COMPANY_ID: 'wifi_company_id',
  // NEW: SIM-based WiFi Auth
  WIFI_SELECTED_SIM: 'wifi_selected_sim',        // Selected SIM number (locked)
  WIFI_DEVICE_TOKEN: 'wifi_device_token',        // Device token from auto-auth
  WIFI_TOKEN_EXPIRES: 'wifi_token_expires',      // Token expiry timestamp
  WIFI_CONFIG: 'wifi_config',                     // WiFi config array
  WIFI_SIM_ID: 'wifi_sim_id',                     // SIM ID from backend
  WIFI_SELECTED_AT: 'wifi_selected_at',           // When SIM was selected
};

// Permission Types
export const PERMISSIONS = {
  READ_CALL_LOG: 'android.permission.READ_CALL_LOG',
  READ_PHONE_STATE: 'android.permission.READ_PHONE_STATE',
  READ_PHONE_NUMBERS: 'android.permission.READ_PHONE_NUMBERS',
  READ_SMS: 'android.permission.READ_SMS',
  POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
  // Location - Required for WiFi SSID on Android 10+
  ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
  ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION',
};

// WiFi Speed Monitoring Configuration
export const WIFI_CONFIG = {
  // Speed test interval in minutes
  SPEED_TEST_INTERVAL: 20,
  // Status polling interval in minutes (when waiting for approval)
  STATUS_POLL_INTERVAL: 1,
  // Speed test timeout in milliseconds
  SPEED_TEST_TIMEOUT: 30000,
  // Speed test server URL for download test
  SPEED_TEST_SERVER: 'https://speedtest.tele2.net',
  // Test file size in bytes (1MB)
  TEST_FILE_SIZE: 1000000,
};

// App Info
export const APP_INFO = {
  NAME: 'SIM Management',
  VERSION: '1.0.0',
};