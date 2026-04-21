package com.sim_management.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.sim_management.services.SyncForegroundService
import com.sim_management.storage.SyncPreferences

class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",
            "com.htc.intent.action.QUICKBOOT_POWERON" -> {
                Log.d(TAG, "Device boot completed, checking if sync should start")

                // Check if auto-sync was enabled before reboot
                val prefs = SyncPreferences(context)
                if (prefs.isAutoSyncEnabled()) {
                    val syncInterval = prefs.getSyncInterval()
                    Log.d(TAG, "Auto-sync enabled, starting service with interval: $syncInterval minutes")

                    // Start the foreground service
                    SyncForegroundService.startService(context, syncInterval)
                } else {
                    Log.d(TAG, "Auto-sync disabled, not starting service")
                }
            }
        }
    }
}