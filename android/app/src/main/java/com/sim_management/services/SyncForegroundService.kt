package com.sim_management.services

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.sim_management.R
import com.sim_management.modules.BackgroundSyncModule
import com.sim_management.storage.SyncPreferences

class SyncForegroundService : Service() {

    companion object {
        private const val TAG = "SyncForegroundService"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "sync_channel"
        private const val CHANNEL_NAME = "Call Log Sync"

        const val ACTION_START_SYNC = "com.sim_management.START_SYNC"
        const val ACTION_STOP_SYNC = "com.sim_management.STOP_SYNC"
        const val EXTRA_SYNC_INTERVAL = "sync_interval"

        private var isRunning = false
        private var syncIntervalMinutes: Int = 5 // Default 5 minutes

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

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        prefs = SyncPreferences(applicationContext)
        createNotificationChannel()
        Log.d(TAG, "Service created")
    }

    override fun onDestroy() {
        isRunning = false
        handler.removeCallbacksAndMessages(null)
        Log.d(TAG, "Service destroyed")
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_SYNC -> {
                syncIntervalMinutes = intent.getIntExtra(EXTRA_SYNC_INTERVAL, 5) // Default 5 minutes
                startForegroundWithNotification()

                // Start periodic sync
                handler.removeCallbacksAndMessages(null)
                scheduleNextSync()

                Log.d(TAG, "Starting sync with interval: $syncIntervalMinutes minutes")
            }
            ACTION_STOP_SYNC -> {
                handler.removeCallbacksAndMessages(null)
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                Log.d(TAG, "Stopping sync service")
            }
        }
        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Call log synchronization service"
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
            .setContentText("Syncing call logs in background...")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopPendingIntent)
            .build()
    }

    private fun scheduleNextSync() {
        // Perform sync immediately first
        performSync()

        // Then schedule next sync
        handler.postDelayed({
            scheduleNextSync()
        }, (syncIntervalMinutes * 60 * 1000).toLong())
    }

    private fun performSync() {
        Log.d(TAG, "Performing sync...")

        try {
            val mobileNumber = prefs?.getMobileNumber()
            if (mobileNumber.isNullOrEmpty()) {
                Log.w(TAG, "No mobile number, skipping sync")
                return
            }

            // Send event to React Native via BackgroundSyncModule
            BackgroundSyncModule.sendSyncTriggerEvent(mobileNumber, syncIntervalMinutes)

            // Update last sync time
            prefs?.setLastSyncTime(System.currentTimeMillis())

            Log.d(TAG, "Sync trigger sent to React Native")
        } catch (e: Exception) {
            Log.e(TAG, "Error during sync", e)
        }
    }
}