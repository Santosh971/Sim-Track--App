package com.sim_management.services

import android.Manifest
import android.annotation.SuppressLint
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.sim_management.R
import com.sim_management.modules.BackgroundSyncModule
import com.sim_management.storage.SyncPreferences
import kotlinx.coroutines.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class SyncForegroundService : Service() {

    companion object {
        private const val TAG = "SyncForegroundService"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "sync_channel"
        private const val CHANNEL_NAME = "Call Log, SMS & WiFi Sync"

        const val ACTION_START_SYNC = "com.sim_management.START_SYNC"
        const val ACTION_STOP_SYNC = "com.sim_management.STOP_SYNC"
        const val EXTRA_SYNC_INTERVAL = "sync_interval"

        // API endpoint for WiFi metrics
        private const val API_BASE_URL = "https://node.simtrackr.b100x.in/api"
        private const val METRICS_ENDPOINT = "$API_BASE_URL/device/metrics"

        private var isRunning = false
        private var syncIntervalMinutes: Int = 5 // Default 5 minutes

        // WakeLock for reliable background execution
        private var wakeLock: PowerManager.WakeLock? = null
        private const val WAKE_LOCK_TAG = "SyncForegroundService:WakeLock"

        fun isServiceRunning(): Boolean = isRunning

        fun startService(context: Context, syncIntervalMinutes: Int = 5) {
            val intent = Intent(context, SyncForegroundService::class.java).apply {
                action = ACTION_START_SYNC
                putExtra(EXTRA_SYNC_INTERVAL, syncIntervalMinutes)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopService(context: Context) {
            val intent = Intent(context, SyncForegroundService::class.java).apply {
                action = ACTION_STOP_SYNC
            }
            context.startService(intent)
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private var prefs: SyncPreferences? = null
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        prefs = SyncPreferences(applicationContext)
        createNotificationChannel()
        acquireWakeLock()
        Log.d(TAG, "Service created, wake lock acquired")
    }

    override fun onDestroy() {
        Log.d(TAG, "Service onDestroy called")

        isRunning = false
        handler.removeCallbacksAndMessages(null)
        serviceScope.cancel()

        // Cancel alarm backup
        try {
            val alarmIntent = Intent(this, com.sim_management.receivers.SyncAlarmReceiver::class.java).apply {
                action = com.sim_management.receivers.SyncAlarmReceiver.ACTION_SYNC
            }
            val pendingIntent = android.app.PendingIntent.getBroadcast(
                this,
                com.sim_management.receivers.SyncAlarmReceiver.REQUEST_CODE,
                alarmIntent,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
            )
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
            alarmManager.cancel(pendingIntent)
            Log.d(TAG, "Alarm backup cancelled")
        } catch (e: Exception) {
            Log.e(TAG, "Error cancelling alarm: ${e.message}", e)
        }

        releaseWakeLock()
        Log.d(TAG, "Service destroyed, wake lock released")
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_SYNC -> {
                syncIntervalMinutes = intent.getIntExtra(EXTRA_SYNC_INTERVAL, 5)
                startForegroundWithNotification()

                // Start periodic sync
                handler.removeCallbacksAndMessages(null)

                // Perform first sync immediately
                performSync()

                // Schedule recurring sync
                scheduleRecurringSync()

                Log.d(TAG, "Starting sync with interval: $syncIntervalMinutes minutes")
            }
            ACTION_STOP_SYNC -> {
                handler.removeCallbacksAndMessages(null)
                serviceScope.cancel()
                releaseWakeLock()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                Log.d(TAG, "Stopping sync service")
            }
        }
        return START_STICKY
    }

    @SuppressLint("WakelockTimeout")
    private fun acquireWakeLock() {
        try {
            if (wakeLock == null) {
                val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
                wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    WAKE_LOCK_TAG
                )
                wakeLock?.setReferenceCounted(false)
            }
            if (wakeLock?.isHeld == false) {
                wakeLock?.acquire()
                Log.d(TAG, "Wake lock acquired")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to acquire wake lock: ${e.message}", e)
        }
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
                Log.d(TAG, "Wake lock released")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to release wake lock: ${e.message}", e)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Call log, SMS, and WiFi speed synchronization service"
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun startForegroundWithNotification() {
        val notification = createNotification()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun createNotification(): Notification {
        val stopIntent = Intent(this, SyncForegroundService::class.java).apply {
            action = ACTION_STOP_SYNC
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            0,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SIM Sync Active")
            .setContentText("Syncing call logs & SMS every $syncIntervalMinutes min...")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopPendingIntent)
            .build()
    }

    private fun scheduleRecurringSync() {
        val intervalMs = (syncIntervalMinutes * 60 * 1000).toLong()
        Log.d(TAG, "Scheduling recurring sync every $syncIntervalMinutes minutes ($intervalMs ms)")

        // Schedule with handler for in-app sync
        handler.postDelayed({
            Log.d(TAG, "Recurring sync triggered by handler")
            performSync()
            scheduleRecurringSync() // Schedule next sync
        }, intervalMs)

        // Also schedule alarm as backup for when app is in background
        try {
            val alarmIntent = Intent(this, com.sim_management.receivers.SyncAlarmReceiver::class.java).apply {
                action = com.sim_management.receivers.SyncAlarmReceiver.ACTION_SYNC
            }

            val pendingIntent = android.app.PendingIntent.getBroadcast(
                this,
                com.sim_management.receivers.SyncAlarmReceiver.REQUEST_CODE,
                alarmIntent,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
            )

            val alarmManager = getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
            val triggerAtMs = System.currentTimeMillis() + intervalMs

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(
                    android.app.AlarmManager.RTC_WAKEUP,
                    triggerAtMs,
                    pendingIntent
                )
            } else {
                alarmManager.setExact(
                    android.app.AlarmManager.RTC_WAKEUP,
                    triggerAtMs,
                    pendingIntent
                )
            }

            Log.d(TAG, "Alarm backup scheduled for +$syncIntervalMinutes minutes")
        } catch (e: Exception) {
            Log.e(TAG, "Error scheduling alarm backup: ${e.message}", e)
        }
    }

    private fun performSync() {
        Log.d(TAG, "========== PERFORMING SYNC ==========")

        // Ensure wake lock is held during sync
        acquireWakeLock()

        // Run sync operations in background coroutine to avoid blocking main thread
        serviceScope.launch {
            try {
                Log.d(TAG, "Step 1: Getting SIM IDs from preferences...")

                // Get SIM IDs for sync
                val simIds = prefs?.getValidSIMIds()
                val mobileNumber = prefs?.getMobileNumber()

                Log.d(TAG, "SIM IDs: $simIds, Mobile: $mobileNumber")

                if (!simIds.isNullOrEmpty() || !mobileNumber.isNullOrEmpty()) {
                    Log.d(TAG, "Step 2: Sending sync trigger to JS...")

                    // Send event to JS (works when app is in foreground or background with JS context)
                    try {
                        if (!simIds.isNullOrEmpty()) {
                            BackgroundSyncModule.sendSyncTriggerEvent(simIds, syncIntervalMinutes)
                            Log.d(TAG, "Sync trigger sent to JS with ${simIds.size} SIM IDs")
                        } else if (!mobileNumber.isNullOrEmpty()) {
                            BackgroundSyncModule.sendSyncTriggerEvent(setOf("legacy_$mobileNumber"), syncIntervalMinutes)
                            Log.d(TAG, "Legacy sync trigger sent with mobile number")
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error sending sync trigger: ${e.message}", e)
                    }
                } else {
                    Log.w(TAG, "No SIM IDs or mobile number, skipping sync")
                }

                // Update last sync time
                prefs?.setLastSyncTime(System.currentTimeMillis())
                Log.d(TAG, "========== SYNC COMPLETED ==========")
            } catch (e: Exception) {
                Log.e(TAG, "Error during sync", e)
            } finally {
                // Keep wake lock for a bit after sync completes
                delay(5000)
            }
        }
    }

    // ============================================
    // WiFi Speed Test Methods - Native Implementation
    // ============================================

    private suspend fun performWiFiSpeedTest() {
        // WiFi speed test implementation removed for brevity
        // This method is kept for future use
    }

    private fun isOnWifi(): Boolean {
        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
    }

    private fun getWiFiInfo(): WifiInfo {
        // Implementation simplified
        return WifiInfo()
    }

    private suspend fun runSpeedTest(): SpeedTestResult {
        // Implementation simplified
        return SpeedTestResult(0.0, 0.0, 0)
    }

    private suspend fun submitWiFiMetrics(result: SpeedTestResult, wifiInfo: WifiInfo) {
        // Implementation simplified
    }

    data class SpeedTestResult(
        val download: Double,
        val upload: Double,
        val latency: Int
    )

    data class WifiInfo(
        val ssid: String = "",
        val bssid: String = ""
    )
}