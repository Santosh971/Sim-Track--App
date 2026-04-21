package com.sim_management.storage

import android.content.Context
import android.content.SharedPreferences

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

        // Default values
        const val DEFAULT_SYNC_INTERVAL = 5 // minutes (changed from 15 to 5)
        const val MIN_SYNC_INTERVAL = 5 // minutes
        const val MAX_SYNC_INTERVAL = 60 // minutes
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

    fun clear() {
        prefs.edit().clear().apply()
    }
}