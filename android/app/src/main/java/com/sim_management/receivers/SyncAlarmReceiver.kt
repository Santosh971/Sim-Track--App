package com.sim_management.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.sim_management.services.SyncForegroundService
import com.sim_management.storage.SyncPreferences

/**
 * Receiver for periodic sync alarms
 * This ensures sync runs even when app is in background
 *
 * How auto-sync works:
 * 1. SyncForegroundService runs as a foreground service (always alive)
 * 2. It uses handler.postDelayed() to schedule syncs every 5 minutes
 * 3. This alarm receiver is a backup to restart the service if it gets killed
 *
 * When this alarm fires:
 * 1. Check if auto-sync is enabled
 * 2. If SyncForegroundService is not running, start it
 * 3. The service will then perform sync via handler callbacks
 */
class SyncAlarmReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "SyncAlarmReceiver"
        const val ACTION_SYNC = "com.sim_management.SYNC_ALARM"
        const val ACTION_RESTART_SERVICE = "com.sim_management.RESTART_SERVICE"
        const val REQUEST_CODE = 1001

        /**
         * Schedule periodic sync alarms
         * This is a backup in case the foreground service gets killed
         */
        fun scheduleAlarm(context: Context, intervalMinutes: Int) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
            val intent = Intent(context, SyncAlarmReceiver::class.java).apply {
                action = ACTION_SYNC
            }

            val pendingIntent = android.app.PendingIntent.getBroadcast(
                context,
                REQUEST_CODE,
                intent,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
            )

            val intervalMs = (intervalMinutes * 60 * 1000).toLong()
            val triggerAtMs = System.currentTimeMillis() + intervalMs

            try {
                // Use setExactAndAllowWhileIdle for reliable background execution
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
                Log.d(TAG, "Scheduled sync alarm to trigger in $intervalMinutes minutes")
            } catch (e: Exception) {
                Log.e(TAG, "Error scheduling sync alarm: ${e.message}", e)
            }
        }

        /**
         * Cancel periodic sync alarms
         */
        fun cancelAlarm(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
            val intent = Intent(context, SyncAlarmReceiver::class.java).apply {
                action = ACTION_SYNC
            }

            val pendingIntent = android.app.PendingIntent.getBroadcast(
                context,
                REQUEST_CODE,
                intent,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
            )

            alarmManager.cancel(pendingIntent)
            Log.d(TAG, "Cancelled sync alarm")
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "========== ALARM RECEIVED ==========")
        Log.d(TAG, "Action: ${intent.action}")

        when (intent.action) {
            ACTION_SYNC, ACTION_RESTART_SERVICE -> {
                // Check if auto-sync is enabled
                val prefs = SyncPreferences(context)
                val isAutoSyncEnabled = prefs.isAutoSyncEnabled()

                Log.d(TAG, "Auto-sync enabled: $isAutoSyncEnabled")

                if (isAutoSyncEnabled) {
                    // Check if service is already running
                    if (!SyncForegroundService.isServiceRunning()) {
                        Log.d(TAG, "Service not running, starting it...")
                        val syncInterval = prefs.getSyncInterval()
                        SyncForegroundService.startService(context, syncInterval)
                    } else {
                        Log.d(TAG, "Service already running, no action needed")
                    }
                } else {
                    Log.d(TAG, "Auto-sync disabled, not starting service")
                }

                // Schedule next alarm
                val syncInterval = prefs.getSyncInterval()
                scheduleAlarm(context, syncInterval)
            }
        }

        Log.d(TAG, "========== ALARM HANDLED ==========")
    }
}