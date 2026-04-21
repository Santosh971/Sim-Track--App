package com.sim_management.modules

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.sim_management.services.SyncForegroundService
import com.sim_management.storage.SyncPreferences

class BackgroundSyncModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "BackgroundSyncModule"
        const val NAME = "BackgroundSyncModule"
        private var instance: BackgroundSyncModule? = null

        fun getInstance(): BackgroundSyncModule? = instance

        fun sendSyncTriggerEvent(mobileNumber: String, syncInterval: Int) {
            instance?.sendEventToJS(mobileNumber, syncInterval)
        }
    }

    private val prefs: SyncPreferences = SyncPreferences(reactContext)

    init {
        instance = this
    }

    override fun getName(): String = NAME

    private fun sendEventToJS(mobileNumber: String, syncInterval: Int) {
        try {
            val reactContext = reactApplicationContext
            if (reactContext.hasActiveCatalystInstance()) {
                val params = Arguments.createMap().apply {
                    putString("mobileNumber", mobileNumber)
                    putInt("syncInterval", syncInterval)
                }
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("BackgroundSyncTrigger", params)
                Log.d(TAG, "BackgroundSyncTrigger event sent to JS")
            } else {
                Log.w(TAG, "No active catalyst instance, cannot send event")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error sending event to JS: ${e.message}", e)
        }
    }

    /**
     * Check if background sync service is running
     */
    @ReactMethod
    fun isRunning(promise: Promise) {
        try {
            val running = SyncForegroundService.isServiceRunning()
            promise.resolve(running)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to check service status: ${e.message}")
        }
    }

    /**
     * Start background sync service
     */
    @ReactMethod
    fun startSync(promise: Promise) {
        try {
            val mobileNumber = prefs.getMobileNumber()
            if (mobileNumber.isNullOrEmpty()) {
                promise.reject("NO_AUTH", "User not authenticated. Mobile number not set.")
                return
            }

            val syncInterval = prefs.getSyncInterval()
            Log.d(TAG, "Starting sync service with interval: $syncInterval minutes")

            SyncForegroundService.startService(reactApplicationContext, syncInterval)
            prefs.setAutoSyncEnabled(true)

            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start sync service", e)
            promise.reject("ERROR", "Failed to start sync service: ${e.message}")
        }
    }

    /**
     * Stop background sync service
     */
    @ReactMethod
    fun stopSync(promise: Promise) {
        try {
            Log.d(TAG, "Stopping sync service")
            SyncForegroundService.stopService(reactApplicationContext)
            prefs.setAutoSyncEnabled(false)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop sync service", e)
            promise.reject("ERROR", "Failed to stop sync service: ${e.message}")
        }
    }

    /**
     * Set sync interval (in minutes)
     */
    @ReactMethod
    fun setSyncInterval(intervalMinutes: Int, promise: Promise) {
        try {
            val clampedInterval = intervalMinutes.coerceIn(
                SyncPreferences.MIN_SYNC_INTERVAL,
                SyncPreferences.MAX_SYNC_INTERVAL
            )
            prefs.setSyncInterval(clampedInterval)
            promise.resolve(clampedInterval)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to set sync interval: ${e.message}")
        }
    }

    /**
     * Get sync interval
     */
    @ReactMethod
    fun getSyncInterval(promise: Promise) {
        try {
            val interval = prefs.getSyncInterval()
            promise.resolve(interval)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get sync interval: ${e.message}")
        }
    }

    /**
     * Check if auto-sync is enabled
     */
    @ReactMethod
    fun isAutoSyncEnabled(promise: Promise) {
        try {
            val enabled = prefs.isAutoSyncEnabled()
            promise.resolve(enabled)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to check auto-sync status: ${e.message}")
        }
    }

    /**
     * Set mobile number for sync authentication
     */
    @ReactMethod
    fun setMobileNumber(mobileNumber: String, promise: Promise) {
        try {
            prefs.setMobileNumber(mobileNumber)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to set mobile number: ${e.message}")
        }
    }

    /**
     * Get mobile number
     */
    @ReactMethod
    fun getMobileNumber(promise: Promise) {
        try {
            val mobileNumber = prefs.getMobileNumber()
            promise.resolve(mobileNumber)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get mobile number: ${e.message}")
        }
    }

    /**
     * Get last sync timestamp
     */
    @ReactMethod
    fun getLastSyncTime(promise: Promise) {
        try {
            val timestamp = prefs.getLastSyncTime()
            promise.resolve(timestamp.toDouble())
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get last sync time: ${e.message}")
        }
    }

    /**
     * Set last sync timestamp
     */
    @ReactMethod
    fun setLastSyncTime(timestamp: Double, promise: Promise) {
        try {
            prefs.setLastSyncTime(timestamp.toLong())
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to set last sync time: ${e.message}")
        }
    }
}