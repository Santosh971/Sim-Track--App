package com.sim_management.modules

import android.content.Context
import android.content.Intent
import android.os.Build
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

        /**
         * Called from SyncForegroundService to trigger sync
         * Sends event to JS - the foreground service keeps JS context alive
         */
        fun sendSyncTriggerEvent(simIds: Set<String>, syncInterval: Int) {
            instance?.sendSyncEvent(simIds, syncInterval)
        }
    }

    private val prefs: SyncPreferences = SyncPreferences(reactContext)

    init {
        instance = this
    }

    override fun getName(): String = NAME

    /**
     * Send sync trigger event to JS
     * The SyncForegroundService holds a WakeLock which keeps the JS context alive
     */
    private fun sendSyncEvent(simIds: Set<String>, syncInterval: Int) {
        try {
            Log.d(TAG, "Sending sync trigger event to JS")
            Log.d(TAG, "SIM IDs: $simIds, Sync Interval: $syncInterval")

            val reactContext = reactApplicationContext

            // Create params
            val params = Arguments.createMap().apply {
                putArray("simIds", Arguments.fromList(simIds.toList()))
                putInt("syncInterval", syncInterval)
                putString("deviceId", prefs.getDeviceId())
                putString("mobileNumber", prefs.getMobileNumber())
            }

            // Send event to JS
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("BackgroundSyncTrigger", params)

            Log.d(TAG, "Sync trigger event sent successfully")

        } catch (e: Exception) {
            Log.e(TAG, "Error sending sync event: ${e.message}", e)
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
            val simIds = prefs.getValidSIMIds()
            if (simIds.isEmpty()) {
                // Fall back to mobile number if no SIM IDs
                val mobileNumber = prefs.getMobileNumber()
                if (mobileNumber.isNullOrEmpty()) {
                    promise.reject("NO_AUTH", "User not authenticated. No SIM IDs or mobile number set.")
                    return
                }
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
     * Set valid SIM IDs for sync authentication
     */
    @ReactMethod
    fun setValidSIMIds(simIds: ReadableArray, promise: Promise) {
        try {
            val simIdSet = simIds.toArrayList().filterIsInstance<String>().toSet()
            prefs.setValidSIMIds(simIdSet)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to set SIM IDs: ${e.message}")
        }
    }

    /**
     * Get valid SIM IDs
     */
    @ReactMethod
    fun getValidSIMIds(promise: Promise) {
        try {
            val simIds = prefs.getValidSIMIds()
            val array = Arguments.createArray()
            simIds.forEach { array.pushString(it) }
            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get SIM IDs: ${e.message}")
        }
    }

    /**
     * Set device ID
     */
    @ReactMethod
    fun setDeviceId(deviceId: String, promise: Promise) {
        try {
            prefs.setDeviceId(deviceId)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to set device ID: ${e.message}")
        }
    }

    /**
     * Get device ID
     */
    @ReactMethod
    fun getDeviceId(promise: Promise) {
        try {
            val deviceId = prefs.getDeviceId()
            promise.resolve(deviceId)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get device ID: ${e.message}")
        }
    }

    /**
     * Set mobile number for sync authentication (legacy)
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
     * Set user email
     */
    @ReactMethod
    fun setUserEmail(email: String, promise: Promise) {
        try {
            prefs.setUserEmail(email)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to set email: ${e.message}")
        }
    }

    /**
     * Get user email
     */
    @ReactMethod
    fun getUserEmail(promise: Promise) {
        try {
            val email = prefs.getUserEmail()
            promise.resolve(email)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get email: ${e.message}")
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

    // ============================================
    // API Configuration Methods
    // ============================================

    /**
     * Set API Base URL for native modules
     * This allows native code to use the same URL as JS
     */
    @ReactMethod
    fun setApiBaseUrl(url: String, promise: Promise) {
        try {
            prefs.setApiBaseUrl(url)
            Log.d(TAG, "API Base URL set: $url")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to set API URL: ${e.message}")
        }
    }

    /**
     * Get stored API Base URL
     */
    @ReactMethod
    fun getApiBaseUrl(promise: Promise) {
        try {
            val url = prefs.getApiBaseUrl()
            promise.resolve(url)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get API URL: ${e.message}")
        }
    }

    // ============================================
    // WiFi Speed Test Methods
    // ============================================

    /**
     * Set WiFi speed test configuration
     * UPDATED: Now includes deviceId parameter for proper WiFi metrics submission
     */
    @ReactMethod
    fun setWiFiConfig(
        simNumber: String,
        deviceId: String,
        deviceToken: String,
        tokenExpires: String,
        wifiConfigJson: String,
        promise: Promise
    ) {
        try {
            prefs.setWiFiSimNumber(simNumber)
            prefs.setWiFiDeviceId(deviceId)  // Store WiFi device ID
            prefs.setWiFiDeviceToken(deviceToken)
            prefs.setWiFiTokenExpires(tokenExpires)
            prefs.setWiFiConfigJson(wifiConfigJson)
            prefs.setWiFiSpeedEnabled(true)
            Log.d(TAG, "WiFi config saved: simNumber=$simNumber, deviceId=$deviceId, configLength=${wifiConfigJson.length}")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set WiFi config", e)
            promise.reject("ERROR", "Failed to set WiFi config: ${e.message}")
        }
    }

    /**
     * Get WiFi config
     */
    @ReactMethod
    fun getWiFiConfig(promise: Promise) {
        try {
            val config = Arguments.createMap().apply {
                putString("simNumber", prefs.getWiFiSimNumber())
                putString("deviceId", prefs.getWiFiDeviceId())
                putString("deviceToken", prefs.getWiFiDeviceToken())
                putString("tokenExpires", prefs.getWiFiTokenExpires())
                putString("wifiConfigJson", prefs.getWiFiConfigJson())
                putBoolean("enabled", prefs.isWiFiSpeedEnabled())
            }
            promise.resolve(config)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get WiFi config: ${e.message}")
        }
    }

    /**
     * Enable/disable WiFi speed test
     */
    @ReactMethod
    fun setWiFiSpeedEnabled(enabled: Boolean, promise: Promise) {
        try {
            prefs.setWiFiSpeedEnabled(enabled)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to set WiFi speed enabled: ${e.message}")
        }
    }

    /**
     * Check if WiFi speed test is enabled
     */
    @ReactMethod
    fun isWiFiSpeedEnabled(promise: Promise) {
        try {
            val enabled = prefs.isWiFiSpeedEnabled()
            promise.resolve(enabled)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to check WiFi speed enabled: ${e.message}")
        }
    }

    /**
     * Get last WiFi speed test timestamp
     */
    @ReactMethod
    fun getLastWiFiSpeedTest(promise: Promise) {
        try {
            val timestamp = prefs.getLastWiFiSpeedTest()
            promise.resolve(timestamp.toDouble())
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get last WiFi speed test: ${e.message}")
        }
    }

    /**
     * Required for NativeEventEmitter - add event listener
     */
    @ReactMethod
    fun addListener(eventName: String) {
        // Required for NativeEventEmitter compatibility
        // No-op - we don't need to track listeners individually
        Log.d(TAG, "addListener called for event: $eventName")
    }

    /**
     * Required for NativeEventEmitter - remove event listeners
     */
    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for NativeEventEmitter compatibility
        // No-op - we don't need to track listeners individually
        Log.d(TAG, "removeListeners called with count: $count")
    }

    // ============================================
    // Battery Optimization Methods
    // ============================================

    /**
     * Check if app is ignoring battery optimizations
     */
    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val powerManager = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
                val isIgnoring = powerManager.isIgnoringBatteryOptimizations(reactApplicationContext.packageName)
                promise.resolve(isIgnoring)
            } else {
                // Pre-Marshmallow, no battery optimization restrictions
                promise.resolve(true)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to check battery optimization status", e)
            promise.reject("ERROR", "Failed to check battery optimization: ${e.message}")
        }
    }

    /**
     * Request to ignore battery optimizations
     * Opens the battery optimization settings
     */
    @ReactMethod
    fun requestIgnoreBatteryOptimizations(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = android.net.Uri.parse("package:${reactApplicationContext.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactApplicationContext.startActivity(intent)
                promise.resolve(true)
            } else {
                // Pre-Marshmallow, no need for this
                promise.resolve(true)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to request battery optimization exemption", e)
            promise.reject("ERROR", "Failed to request battery optimization: ${e.message}")
        }
    }

    /**
     * Open battery optimization settings
     */
    @ReactMethod
    fun openBatterySettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactApplicationContext.startActivity(intent)
                promise.resolve(true)
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open battery settings", e)
            promise.reject("ERROR", "Failed to open battery settings: ${e.message}")
        }
    }

    // ============================================
    // WiFi Speed Background Worker Methods
    // ============================================

    /**
     * Start WiFi speed background monitoring
     * Uses WorkManager for periodic speed tests
     */
    @ReactMethod
    fun startWiFiSpeedBackground(configJson: String, intervalMinutes: Int, promise: Promise) {
        try {
            Log.d(TAG, "Starting WiFi speed background monitoring")
            Log.d(TAG, "Config: $configJson")
            Log.d(TAG, "Interval: $intervalMinutes minutes")

            com.sim_management.workers.WiFiSpeedWorker.scheduleWork(
                reactApplicationContext,
                configJson,
                intervalMinutes.toLong()
            )

            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start WiFi speed background", e)
            promise.reject("ERROR", "Failed to start WiFi speed background: ${e.message}")
        }
    }

    /**
     * Stop WiFi speed background monitoring
     */
    @ReactMethod
    fun stopWiFiSpeedBackground(promise: Promise) {
        try {
            Log.d(TAG, "Stopping WiFi speed background monitoring")
            com.sim_management.workers.WiFiSpeedWorker.cancelWork(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop WiFi speed background", e)
            promise.reject("ERROR", "Failed to stop WiFi speed background: ${e.message}")
        }
    }

    /**
     * Check if WiFi speed background monitoring is running
     */
    @ReactMethod
    fun isWiFiSpeedBackgroundRunning(promise: Promise) {
        try {
            val isRunning = com.sim_management.workers.WiFiSpeedWorker.isScheduled(reactApplicationContext)
            promise.resolve(isRunning)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to check WiFi speed background status", e)
            promise.reject("ERROR", "Failed to check WiFi speed background: ${e.message}")
        }
    }
}