package com.sim_management.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.sim_management.services.SyncForegroundService
import com.sim_management.services.CallAutomationForegroundService
import com.sim_management.storage.SyncPreferences
import org.json.JSONObject

class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
        private const val CALL_AUTOMATION_PREFS = "call_automation"
    }

    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "========== BOOT RECEIVED ==========")
        Log.d(TAG, "Action: ${intent.action}")

        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",
            "com.htc.intent.action.QUICKBOOT_POWERON" -> {
                Log.d(TAG, "Device boot completed, checking services to start")

                // Start Sync Foreground Service if auto-sync was enabled
                startSyncServiceIfNeeded(context)

                // Start Call Automation Service if it was enabled
                startCallAutomationIfNeeded(context)
            }
        }
    }

    private fun startSyncServiceIfNeeded(context: Context) {
        try {
            val prefs = SyncPreferences(context)
            val isAutoSyncEnabled = prefs.isAutoSyncEnabled()
            val syncInterval = prefs.getSyncInterval()

            Log.d(TAG, "Auto-sync enabled: $isAutoSyncEnabled, interval: $syncInterval minutes")

            if (isAutoSyncEnabled) {
                Log.d(TAG, "Starting SyncForegroundService with interval: $syncInterval minutes")
                SyncForegroundService.startService(context, syncInterval)

                // Also schedule alarm as backup
                SyncAlarmReceiver.scheduleAlarm(context, syncInterval)
                Log.d(TAG, "Alarm scheduled as backup")
            } else {
                Log.d(TAG, "Auto-sync disabled, not starting service")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error starting sync service", e)
        }
    }

    private fun startCallAutomationIfNeeded(context: Context) {
        try {
            val prefs = context.getSharedPreferences(CALL_AUTOMATION_PREFS, Context.MODE_PRIVATE)
            val configJson = prefs.getString("config", null)

            if (configJson != null) {
                val config = JSONObject(configJson)
                val isActive = config.optBoolean("isActive", false)
                val role = config.optString("role", "NONE")

                if (isActive && role == "CALLER") {
                    Log.d(TAG, "Call automation was active, restarting service")
                    CallAutomationForegroundService.startService(context, configJson)
                } else {
                    Log.d(TAG, "Call automation not active or not CALLER, not starting")
                }
            } else {
                Log.d(TAG, "No call automation config found, not starting")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error starting call automation service", e)
        }
    }
}