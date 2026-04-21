package com.sim_management.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.sim_management.services.SyncForegroundService

/**
 * Receiver for manual sync trigger from notifications or other sources
 */
class SyncTriggerReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "SyncTriggerReceiver"
        const val ACTION_SYNC_TRIGGER = "com.sim_management.SYNC_TRIGGER"
    }

    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "Sync trigger received")

        // Restart the sync service if needed
        if (intent.action == ACTION_SYNC_TRIGGER) {
            val syncInterval = intent.getIntExtra("syncInterval", 5) // Default 5 minutes
            SyncForegroundService.startService(context, syncInterval)
        }
    }
}