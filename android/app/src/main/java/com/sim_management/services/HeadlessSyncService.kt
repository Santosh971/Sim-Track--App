package com.sim_management.services

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Headless JS Service for background sync
 * This service runs the JavaScript sync task when the app is in background
 * or the screen is locked
 */
class HeadlessSyncService : HeadlessJsTaskService() {

    companion object {
        private const val TAG = "HeadlessSyncService"
        const val TASK_NAME = "BackgroundSyncTask"
        private const val TIMEOUT_MS = 300000L // 5 minutes timeout

        /**
         * Start the headless sync task
         * Uses the standard service start approach
         */
        fun startHeadlessTask(
            context: Context,
            simIds: List<String>?,
            mobileNumber: String?,
            syncInterval: Int
        ) {
            try {
                Log.d(TAG, "Starting headless sync task with ${simIds?.size ?: 0} SIM IDs")

                val intent = Intent(context, HeadlessSyncService::class.java).apply {
                    putStringArrayListExtra("simIds", simIds?.let { ArrayList(it) })
                    putExtra("syncInterval", syncInterval)
                    putExtra("mobileNumber", mobileNumber)
                }

                // Start the service - HeadlessJsTaskService handles the rest
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }

                Log.d(TAG, "Headless task service started")
            } catch (e: Exception) {
                Log.e(TAG, "Error starting headless task: ${e.message}", e)
            }
        }
    }

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        try {
            val extras = intent?.extras
            val simIds = extras?.getStringArrayList("simIds")
            val syncInterval = extras?.getInt("syncInterval", 5) ?: 5
            val mobileNumber = extras?.getString("mobileNumber")

            Log.d(TAG, "Creating task config: $TASK_NAME")
            Log.d(TAG, "SIM IDs: $simIds, Sync Interval: $syncInterval")

            val data = Arguments.createMap().apply {
                if (simIds != null && simIds.isNotEmpty()) {
                    putArray("simIds", Arguments.fromList(simIds))
                }
                putInt("syncInterval", syncInterval)
                if (mobileNumber != null) {
                    putString("mobileNumber", mobileNumber)
                }
            }

            return HeadlessJsTaskConfig(
                TASK_NAME,
                data,
                TIMEOUT_MS,
                true // Allow execution in foreground
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error creating task config: ${e.message}", e)
            return null
        }
    }
}