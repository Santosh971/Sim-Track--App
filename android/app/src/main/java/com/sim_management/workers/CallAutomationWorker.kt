/**
 * Call Automation Worker
 *
 * WorkManager worker for background call automation execution.
 * Uses Android's WorkManager for battery-optimized periodic execution.
 *
 * IMPORTANT: This is ONLY for Private/Enterprise App Mode (APK distribution)
 * NOT for Play Store builds.
 */

package com.sim_management.workers

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.telecom.TelecomManager
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class CallAutomationWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        private const val TAG = "CallAutomationWorker"
        private const val WORK_NAME = "call_automation_work"
        // Use same SharedPreferences as other modules for API URL
        private const val PREFS_NAME = "sim_sync_prefs"
        private const val KEY_API_BASE_URL = "api_base_url"

        // API endpoint for call completion (fallback)
        private const val DEFAULT_API_BASE_URL = "https://simmanagement-2-2.onrender.com/api"

        // Interval constants (in minutes)
        const val INTERVAL_HOURLY = 60L
        const val INTERVAL_DAILY = 24 * 60L
        const val INTERVAL_WEEKLY = 7 * 24 * 60L

        /**
         * Schedule the periodic work
         */
        fun scheduleWork(context: Context, configJson: String) {
            Log.d(TAG, "========== SCHEDULING CALL AUTOMATION ==========")
            Log.d(TAG, "Config JSON: $configJson")

            // Parse config to determine interval
            val config = JSONObject(configJson)
            val frequency = config.optString("frequency", "daily")
            val scheduledTime = config.optString("scheduledTime", "09:00")
            val scheduledDay = config.optString("scheduledDay", "monday")
            val isActive = config.optBoolean("isActive", true)
            val role = config.optString("role", "NONE")
            val targets = config.optJSONArray("targets")

            Log.d(TAG, "Parsed config: role=$role, frequency=$frequency, isActive=$isActive, targets=${targets?.length()}")

            if (!isActive) {
                Log.d(TAG, "Call automation is DISABLED, cancelling any existing work")
                cancelWork(context)
                return
            }

            if (role != "CALLER") {
                Log.d(TAG, "Role is not CALLER ($role), cancelling work")
                cancelWork(context)
                return
            }

            val intervalMinutes = when (frequency) {
                "hourly" -> INTERVAL_HOURLY
                "daily" -> INTERVAL_DAILY
                "weekly" -> INTERVAL_WEEKLY
                else -> INTERVAL_DAILY
            }

            // Calculate initial delay based on scheduled time
            val initialDelayMinutes = calculateInitialDelay(frequency, scheduledTime, scheduledDay)

            Log.d(TAG, "Scheduling: interval=$intervalMinutes min, delay=$initialDelayMinutes min, time=$scheduledTime")

            // Create input data
            val inputData = workDataOf(
                "config" to configJson,
                "interval" to intervalMinutes,
                "scheduledTime" to scheduledTime,
                "scheduledDay" to scheduledDay
            )

            // Create periodic work request with initial delay
            val workRequest = PeriodicWorkRequestBuilder<CallAutomationWorker>(
                intervalMinutes,
                TimeUnit.MINUTES
            )
                .setInitialDelay(initialDelayMinutes, TimeUnit.MINUTES)
                .setInputData(inputData)
                .build()

            // Enqueue the work
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.REPLACE,
                workRequest
            )

            Log.d(TAG, "========== WORK SCHEDULED SUCCESSFULLY ==========")
            Log.d(TAG, "Next execution in ~$initialDelayMinutes minutes")
        }

        /**
         * Calculate initial delay in minutes based on scheduled time
         */
        private fun calculateInitialDelay(frequency: String, scheduledTime: String, scheduledDay: String): Long {
            if (frequency == "hourly") {
                Log.d(TAG, "Hourly frequency - starting immediately")
                return 0 // For hourly, start immediately
            }

            try {
                val parts = scheduledTime.split(":")
                val targetHour = parts[0].toInt()
                val targetMinute = if (parts.size > 1) parts[1].toInt() else 0

                val now = java.util.Calendar.getInstance()
                val target = java.util.Calendar.getInstance()
                target.set(java.util.Calendar.HOUR_OF_DAY, targetHour)
                target.set(java.util.Calendar.MINUTE, targetMinute)
                target.set(java.util.Calendar.SECOND, 0)
                target.set(java.util.Calendar.MILLISECOND, 0)

                // If weekly, set the correct day
                if (frequency == "weekly") {
                    val dayMap = mapOf(
                        "sunday" to java.util.Calendar.SUNDAY,
                        "monday" to java.util.Calendar.MONDAY,
                        "tuesday" to java.util.Calendar.TUESDAY,
                        "wednesday" to java.util.Calendar.WEDNESDAY,
                        "thursday" to java.util.Calendar.THURSDAY,
                        "friday" to java.util.Calendar.FRIDAY,
                        "saturday" to java.util.Calendar.SATURDAY
                    )
                    val targetDayOfWeek = dayMap[scheduledDay] ?: java.util.Calendar.MONDAY
                    target.set(java.util.Calendar.DAY_OF_WEEK, targetDayOfWeek)
                }

                // If target time has already passed today (or this week), move to next occurrence
                if (target.before(now)) {
                    if (frequency == "daily") {
                        target.add(java.util.Calendar.DAY_OF_MONTH, 1)
                    } else if (frequency == "weekly") {
                        target.add(java.util.Calendar.WEEK_OF_YEAR, 1)
                    }
                }

                val delayMillis = target.timeInMillis - now.timeInMillis
                val delayMinutes = maxOf(0, delayMillis / (60 * 1000))

                Log.d(TAG, "Initial delay calculated: $delayMinutes minutes (${delayMinutes / 60} hours ${delayMinutes % 60} minutes)")
                return delayMinutes
            } catch (e: Exception) {
                Log.e(TAG, "Error calculating initial delay", e)
                return 0
            }
        }

        /**
         * Cancel the scheduled work
         */
        fun cancelWork(context: Context) {
            Log.d(TAG, "Cancelling call automation work")
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }

        /**
         * Check if work is scheduled
         */
        fun isScheduled(context: Context): Boolean {
            val workInfos = WorkManager.getInstance(context)
                .getWorkInfosForUniqueWork(WORK_NAME)
                .get()

            return workInfos.any { it.state == androidx.work.WorkInfo.State.RUNNING || it.state == androidx.work.WorkInfo.State.ENQUEUED }
        }
    }

    // HTTP client for API calls
    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        Log.d(TAG, "========== CALL AUTOMATION WORKER STARTED ==========")

        try {
            // Get config from input data
            val configJson = inputData.getString("config")
            if (configJson.isNullOrEmpty()) {
                Log.e(TAG, "ERROR: No config provided")
                return@withContext Result.failure()
            }

            val config = JSONObject(configJson)
            Log.d(TAG, "Config: $configJson")

            // Check if automation is still active
            val isActive = config.optBoolean("isActive", true)
            if (!isActive) {
                Log.d(TAG, "Automation is DISABLED, skipping")
                return@withContext Result.success()
            }

            // Get call configuration
            val role = config.optString("role", "NONE")
            val targets = config.optJSONArray("targets")
            val callDuration = config.optInt("callDuration", 10)
            val simSlotIndex = config.optInt("simSlotIndex", 0)
            val simPhoneNumber = config.optString("simPhoneNumber", "Unknown")
            val configId = config.optString("configId", null)

            // Log the raw targets array for debugging
            Log.d(TAG, "========== TARGETS DEBUG ==========")
            Log.d(TAG, "Raw targets array: ${targets?.toString()}")
            Log.d(TAG, "Config: role=$role, targets count=${targets?.length() ?: 0}, duration=$callDuration sec, simSlot=$simSlotIndex")
            Log.d(TAG, "Caller SIM: $simPhoneNumber")

            // Only execute if role is CALLER
            if (role != "CALLER") {
                Log.d(TAG, "Not a CALLER (role=$role), skipping execution")
                return@withContext Result.success()
            }

            if (targets == null || targets.length() == 0) {
                Log.e(TAG, "ERROR: No targets configured")
                return@withContext Result.failure()
            }

            // Parse all targets first for logging
            val parsedTargets = mutableListOf<Pair<String, Int>>()
            for (i in 0 until targets.length()) {
                val targetObj = targets.optJSONObject(i)
                if (targetObj != null) {
                    val number = targetObj.optString("mobileNumber", "")
                    val duration = targetObj.optInt("callDuration", callDuration)
                    parsedTargets.add(Pair(number, duration))
                    Log.d(TAG, "Target ${i + 1}: number=$number, duration=$duration (object format)")
                } else {
                    val number = targets.getString(i)
                    parsedTargets.add(Pair(number, callDuration))
                    Log.d(TAG, "Target ${i + 1}: number=$number, duration=$callDuration (string format)")
                }
            }
            Log.d(TAG, "Parsed ${parsedTargets.size} targets to call")
            Log.d(TAG, "====================================")

            Log.d(TAG, "========== MAKING CALLS TO ALL TARGETS ==========")
            Log.d(TAG, "Total targets to call: ${parsedTargets.size}")

            var successCount = 0
            var failCount = 0

            // Call ALL targets (not rotation)
            for ((index, target) in parsedTargets.withIndex()) {
                val targetNumber = target.first
                val targetDuration = target.second

                if (targetNumber.isNullOrEmpty()) {
                    Log.w(TAG, "Skipping target ${index + 1}: empty phone number")
                    continue
                }

                Log.d(TAG, "---------- CALL ${index + 1}/${parsedTargets.size} ----------")
                Log.d(TAG, "Target: $targetNumber")
                Log.d(TAG, "SIM Slot: $simSlotIndex (Caller: $simPhoneNumber)")
                Log.d(TAG, "Duration: $targetDuration seconds")

                // Execute the call
                val success = executeCall(targetNumber, simSlotIndex, targetDuration)

                if (success) {
                    successCount++
                    Log.d(TAG, "Call ${index + 1}/${parsedTargets.size} to $targetNumber completed successfully")
                } else {
                    failCount++
                    Log.e(TAG, "Call ${index + 1}/${parsedTargets.size} to $targetNumber FAILED")
                }

                // Small delay between calls to avoid issues
                if (index < parsedTargets.size - 1) {
                    Log.d(TAG, "Waiting 3 seconds before next call...")
                    delay(3000)
                }
            }

            Log.d(TAG, "========== CALL SESSION COMPLETE ==========")
            Log.d(TAG, "Success: $successCount, Failed: $failCount")

            // Notify backend
            if (!configId.isNullOrEmpty()) {
                notifyCallComplete(configId, simPhoneNumber, successCount, failCount)
            }

            if (successCount > 0) {
                return@withContext Result.success()
            } else {
                Log.e(TAG, "All calls failed")
                return@withContext Result.retry()
            }

        } catch (e: Exception) {
            Log.e(TAG, "ERROR in doWork", e)
            return@withContext Result.retry()
        }
    }

    /**
     * Execute a call using Android Telephony APIs
     */
    @SuppressLint("MissingPermission")
    private suspend fun executeCall(phoneNumber: String, simSlotIndex: Int, durationSeconds: Int): Boolean {
        Log.d(TAG, "executeCall: Starting call to $phoneNumber")

        // Check if we have call permission
        if (!hasCallPermission()) {
            Log.e(TAG, "ERROR: No CALL_PHONE permission")
            return false
        }

        // Ensure minimum duration of 10 seconds
        val actualDuration = maxOf(10, durationSeconds)

        return try {
            // Make the call
            val callStarted = startCall(phoneNumber, simSlotIndex)

            if (!callStarted) {
                Log.e(TAG, "Failed to start call")
                return false
            }

            Log.d(TAG, "Call started, waiting $actualDuration seconds...")

            // Wait for the call duration
            delay(actualDuration * 1000L)

            // End the call
            val callEnded = endCall()

            if (callEnded) {
                Log.d(TAG, "Call ended successfully")
            } else {
                Log.w(TAG, "Failed to end call, but call was made")
            }

            true
        } catch (e: Exception) {
            Log.e(TAG, "Exception during call execution", e)
            false
        }
    }

    @SuppressLint("MissingPermission")
    private fun startCall(phoneNumber: String, simSlotIndex: Int): Boolean {
        return try {
            Log.d(TAG, "Starting call to $phoneNumber using SIM slot $simSlotIndex")

            val intent = android.content.Intent(android.content.Intent.ACTION_CALL)
            val uri = Uri.parse("tel:$phoneNumber")
            intent.data = uri
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            intent.addFlags(android.content.Intent.FLAG_FROM_BACKGROUND)

            // Try to select SIM slot for dual SIM devices
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                val subscriptionManager = applicationContext.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager
                val subscriptionInfoList = subscriptionManager.activeSubscriptionInfoList

                if (subscriptionInfoList != null && subscriptionInfoList.isNotEmpty()) {
                    // Find the subscription for the requested slot
                    val subscriptionId = subscriptionInfoList.find { it.simSlotIndex == simSlotIndex }?.subscriptionId
                        ?: subscriptionInfoList[0].subscriptionId

                    Log.d(TAG, "Using subscriptionId: $subscriptionId for slot $simSlotIndex")

                    intent.putExtra("android.telecom.extra.PHONE_ACCOUNT_HANDLE", subscriptionId)

                    // Alternative way to set SIM slot
                    intent.putExtra("com.android.phone.extra.slot", simSlotIndex)
                }
            }

            applicationContext.startActivity(intent)
            Log.d(TAG, "Call intent started successfully")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error starting call", e)
            false
        }
    }

    @SuppressLint("MissingPermission", "NewApi")
    private fun endCall(): Boolean {
        return try {
            Log.d(TAG, "Ending call")

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                // Android 9+ (API 28+): Use TelecomManager
                val telecomManager = applicationContext.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
                telecomManager.endCall()
            } else {
                // Legacy method for older Android versions
                @Suppress("DEPRECATION")
                val telephonyManager = applicationContext.getSystemService(Context.TELECOM_SERVICE) as TelephonyManager
                val endCallMethod = TelephonyManager::class.java.getDeclaredMethod("endCall")
                endCallMethod.invoke(telephonyManager) as Boolean
            }

            Log.d(TAG, "Call ended")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error ending call", e)
            false
        }
    }

    private fun hasCallPermission(): Boolean {
        return ActivityCompat.checkSelfPermission(
            applicationContext,
            Manifest.permission.CALL_PHONE
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Get API base URL from shared preferences or use default
     */
    private fun getApiBaseUrl(): String {
        val prefs: SharedPreferences = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_API_BASE_URL, DEFAULT_API_BASE_URL) ?: DEFAULT_API_BASE_URL
    }

    /**
     * Notify backend that call session was completed
     */
    private suspend fun notifyCallComplete(configId: String, simNumber: String, successCount: Int, failCount: Int) {
        Log.d(TAG, "Notifying backend: configId=$configId, sim=$simNumber, success=$successCount, failed=$failCount")

        try {
            val apiUrl = "${getApiBaseUrl()}/device/call-complete"
            Log.d(TAG, "API URL: $apiUrl")

            val jsonBody = JSONObject().apply {
                put("configId", configId)
                put("simNumber", simNumber)
                put("successCount", successCount)
                put("failCount", failCount)
            }

            val requestBody = jsonBody.toString().toRequestBody("application/json; charset=utf-8".toMediaType())

            val request = Request.Builder()
                .url(apiUrl)
                .post(requestBody)
                .addHeader("Content-Type", "application/json")
                .build()

            val response = okHttpClient.newCall(request).execute()

            if (response.isSuccessful) {
                Log.d(TAG, "Backend notified successfully: ${response.code}")
                val responseBody = response.body?.string()
                Log.d(TAG, "Response: $responseBody")
            } else {
                Log.e(TAG, "Failed to notify backend: ${response.code} - ${response.message}")
            }

            response.close()
        } catch (e: Exception) {
            Log.e(TAG, "Error notifying backend", e)
            // Don't fail the work just because notification failed
        }
    }
}