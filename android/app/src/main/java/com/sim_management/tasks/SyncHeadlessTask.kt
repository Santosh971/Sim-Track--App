package com.sim_management.tasks

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.sim_management.storage.SyncPreferences

/**
 * This class provides the task configuration for the headless JS sync task.
 * The actual sync logic runs in JavaScript (src/tasks/SyncHeadlessTask.ts)
 */
object SyncHeadlessTask {

    private const val TAG = "SyncHeadlessTask"
    const val TASK_KEY = "SyncHeadlessTask"

    /**
     * Get the task configuration for the headless JS task
     */
    fun getTaskConfig(context: ReactApplicationContext, syncInterval: Int): HeadlessJsTaskConfig {
        val prefs = SyncPreferences(context)
        val mobileNumber = prefs.getMobileNumber()

        val data = Arguments.createMap().apply {
            putInt("syncInterval", syncInterval)
            putString("mobileNumber", mobileNumber ?: "")
            putDouble("lastSyncTime", prefs.getLastSyncTime().toDouble())
        }

        return HeadlessJsTaskConfig(
            TASK_KEY,
            data,
            60000, // 60 second timeout
            true // Allow running in foreground
        )
    }
}