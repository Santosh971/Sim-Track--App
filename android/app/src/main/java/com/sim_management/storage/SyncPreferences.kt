package com.sim_management.storage

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import org.json.JSONArray

class SyncPreferences(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(
        PREFS_NAME,
        Context.MODE_PRIVATE
    )

    companion object {
        private const val PREFS_NAME = "sim_sync_prefs"
        private const val KEY_AUTO_SYNC_ENABLED = "auto_sync_enabled"
        private const val KEY_SYNC_INTERVAL = "sync_interval_minutes"
        private const val KEY_LAST_SYNC_TIME = "last_sync_time"
        private const val KEY_MOBILE_NUMBER = "mobile_number"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_VALID_SIM_IDS = "valid_sim_ids"

        // WiFi Speed Test Keys
        private const val KEY_WIFI_ENABLED = "wifi_speed_enabled"
        private const val KEY_WIFI_SIM_NUMBER = "wifi_sim_number"
        private const val KEY_WIFI_DEVICE_ID = "wifi_device_id"  // Dedicated WiFi device ID
        private const val KEY_WIFI_DEVICE_TOKEN = "wifi_device_token"
        private const val KEY_WIFI_TOKEN_EXPIRES = "wifi_token_expires"
        private const val KEY_WIFI_CONFIG_JSON = "wifi_config_json"
        private const val KEY_WIFI_LAST_SPEED_TEST = "wifi_last_speed_test"

        // Default values
        const val DEFAULT_SYNC_INTERVAL = 5 // minutes (changed from 15 to 5)
        const val MIN_SYNC_INTERVAL = 5 // minutes
        const val MAX_SYNC_INTERVAL = 60 // minutes

        // API Configuration
        private const val KEY_API_BASE_URL = "api_base_url"
    }

    fun isAutoSyncEnabled(): Boolean {
        return prefs.getBoolean(KEY_AUTO_SYNC_ENABLED, false)
    }

    fun setAutoSyncEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_AUTO_SYNC_ENABLED, enabled).apply()
    }

    fun getSyncInterval(): Int {
        val interval = prefs.getInt(KEY_SYNC_INTERVAL, DEFAULT_SYNC_INTERVAL)
        return interval.coerceIn(MIN_SYNC_INTERVAL, MAX_SYNC_INTERVAL)
    }

    fun setSyncInterval(intervalMinutes: Int) {
        val clampedInterval = intervalMinutes.coerceIn(MIN_SYNC_INTERVAL, MAX_SYNC_INTERVAL)
        prefs.edit().putInt(KEY_SYNC_INTERVAL, clampedInterval).apply()
    }

    fun getLastSyncTime(): Long {
        return prefs.getLong(KEY_LAST_SYNC_TIME, 0)
    }

    fun setLastSyncTime(timestamp: Long) {
        prefs.edit().putLong(KEY_LAST_SYNC_TIME, timestamp).apply()
    }

    fun getMobileNumber(): String? {
        return prefs.getString(KEY_MOBILE_NUMBER, null)
    }

    fun setMobileNumber(mobileNumber: String) {
        prefs.edit().putString(KEY_MOBILE_NUMBER, mobileNumber).apply()
    }

    fun getUserEmail(): String? {
        return prefs.getString(KEY_USER_EMAIL, null)
    }

    fun setUserEmail(email: String) {
        prefs.edit().putString(KEY_USER_EMAIL, email).apply()
    }

    fun getDeviceId(): String? {
        return prefs.getString(KEY_DEVICE_ID, null)
    }

    fun setDeviceId(deviceId: String) {
        prefs.edit().putString(KEY_DEVICE_ID, deviceId).apply()
    }

    fun getValidSIMIds(): Set<String> {
        return prefs.getStringSet(KEY_VALID_SIM_IDS, emptySet()) ?: emptySet()
    }

    fun setValidSIMIds(simIds: Set<String>) {
        prefs.edit().putStringSet(KEY_VALID_SIM_IDS, simIds).apply()
    }

    // ============================================
    // WiFi Speed Test Methods
    // ============================================

    fun isWiFiSpeedEnabled(): Boolean {
        return prefs.getBoolean(KEY_WIFI_ENABLED, false)
    }

    fun setWiFiSpeedEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_WIFI_ENABLED, enabled).apply()
    }

    fun getWiFiSimNumber(): String? {
        return prefs.getString(KEY_WIFI_SIM_NUMBER, null)
    }

    fun setWiFiSimNumber(simNumber: String) {
        prefs.edit().putString(KEY_WIFI_SIM_NUMBER, simNumber).apply()
    }

    fun getWiFiDeviceToken(): String? {
        return prefs.getString(KEY_WIFI_DEVICE_TOKEN, null)
    }

    fun setWiFiDeviceToken(token: String) {
        prefs.edit().putString(KEY_WIFI_DEVICE_TOKEN, token).apply()
    }

    fun getWiFiTokenExpires(): String? {
        return prefs.getString(KEY_WIFI_TOKEN_EXPIRES, null)
    }

    fun setWiFiTokenExpires(expires: String) {
        prefs.edit().putString(KEY_WIFI_TOKEN_EXPIRES, expires).apply()
    }

    fun getWiFiDeviceId(): String? {
        return prefs.getString(KEY_WIFI_DEVICE_ID, null)
    }

    fun setWiFiDeviceId(deviceId: String) {
        prefs.edit().putString(KEY_WIFI_DEVICE_ID, deviceId).apply()
    }

    /**
     * Store WiFi config as JSON string
     * Format: [{"ssid": "NetworkName", "bssid": "AA:BB:CC:DD:EE:FF", "wifiName": "Office WiFi"}, ...]
     */
    fun getWiFiConfigJson(): String? {
        return prefs.getString(KEY_WIFI_CONFIG_JSON, null)
    }

    fun setWiFiConfigJson(configJson: String) {
        prefs.edit().putString(KEY_WIFI_CONFIG_JSON, configJson).apply()
    }

    /**
     * Get first WiFi config SSID (for fallback when location permission not granted)
     */
    fun getFirstWiFiSSID(): String? {
        val configJson = getWiFiConfigJson() ?: return null
        try {
            val jsonArray = JSONArray(configJson)
            if (jsonArray.length() > 0) {
                val firstConfig = jsonArray.getJSONObject(0)
                return firstConfig.optString("ssid", null)
            }
        } catch (e: Exception) {
            Log.e("SyncPreferences", "Error parsing WiFi config: ${e.message}")
        }
        return null
    }

    /**
     * Get first WiFi config BSSID
     */
    fun getFirstWiFiBSSID(): String? {
        val configJson = getWiFiConfigJson() ?: return null
        try {
            val jsonArray = JSONArray(configJson)
            if (jsonArray.length() > 0) {
                val firstConfig = jsonArray.getJSONObject(0)
                return firstConfig.optString("bssid", null)
            }
        } catch (e: Exception) {
            Log.e("SyncPreferences", "Error parsing WiFi config: ${e.message}")
        }
        return null
    }

    fun getLastWiFiSpeedTest(): Long {
        return prefs.getLong(KEY_WIFI_LAST_SPEED_TEST, 0)
    }

    fun setLastWiFiSpeedTest(timestamp: Long) {
        prefs.edit().putLong(KEY_WIFI_LAST_SPEED_TEST, timestamp).apply()
    }

    // ============================================
    // API Configuration Methods
    // ============================================

    /**
     * Get API Base URL for native modules
     * Returns null if not set, defaults should be handled by caller
     */
    fun getApiBaseUrl(): String? {
        return prefs.getString(KEY_API_BASE_URL, null)
    }

    /**
     * Set API Base URL from JS side
     * This allows native modules to use the same URL as JS
     */
    fun setApiBaseUrl(url: String) {
        prefs.edit().putString(KEY_API_BASE_URL, url).apply()
        Log.d("SyncPreferences", "API Base URL saved: $url")
    }

    fun clear() {
        prefs.edit().clear().apply()
    }
}