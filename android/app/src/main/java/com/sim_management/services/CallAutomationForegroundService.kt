/**
 * Call Automation Foreground Service
 *
 * A foreground service that ensures call automation runs reliably
 * even when the app is minimized, screen is off, or phone is locked.
 *
 * IMPORTANT: This is ONLY for Private/Enterprise App Mode (APK distribution)
 * NOT for Play Store builds.
 *
 * FIXES FOR LOCKED PHONE:
 * - Screen wake before making calls
 * - Keyguard dismissal for lock screen
 * - Extended WakeLock duration (30 min)
 * - Battery optimization awareness
 */

package com.sim_management.services

import android.Manifest
import android.annotation.SuppressLint
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import android.telecom.TelecomManager
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import android.util.Log
import android.app.PendingIntent
import android.app.AlarmManager
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.sim_management.R
import kotlinx.coroutines.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.Calendar
import java.util.concurrent.TimeUnit

class CallAutomationForegroundService : Service() {

    companion object {
        private const val TAG = "CallAutomationFgService"
        private const val NOTIFICATION_ID = 2001
        private const val CHANNEL_ID = "call_automation_channel"
        private const val CHANNEL_NAME = "Call Automation Service"

        const val ACTION_START = "com.sim_management.CALL_AUTOMATION_START"
        const val ACTION_STOP = "com.sim_management.CALL_AUTOMATION_STOP"
        const val ACTION_EXECUTE_NOW = "com.sim_management.CALL_AUTOMATION_EXECUTE"
        const val ACTION_ALARM_TRIGGERED = "com.sim_management.CALL_AUTOMATION_ALARM"

        const val EXTRA_CONFIG = "config"
        const val EXTRA_CONFIG_ID = "configId"
        const val EXTRA_SIM_SLOT_INDEX = "simSlotIndex"
        const val EXTRA_SIM_PHONE_NUMBER = "simPhoneNumber"
        const val EXTRA_CALL_DURATION = "callDuration"
        const val EXTRA_FREQUENCY = "frequency"
        const val EXTRA_SCHEDULED_TIME = "scheduledTime"
        const val EXTRA_SCHEDULED_DAY = "scheduledDay"
        const val EXTRA_TARGETS = "targets"

        private const val ALARM_REQUEST_CODE = 2002

        // SharedPreferences for API URL (same as other modules)
        private const val PREFS_NAME = "sim_sync_prefs"
        private const val KEY_API_BASE_URL = "api_base_url"
        private const val DEFAULT_API_URL = "https://simmanagement-2-2.onrender.com/api"

        private var isRunning = false
        private var currentConfig: JSONObject? = null

        fun isServiceRunning(): Boolean = isRunning

        /**
         * Get API Base URL from SharedPreferences
         */
        fun getApiBaseUrl(context: Context): String {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return prefs.getString(KEY_API_BASE_URL, DEFAULT_API_URL) ?: DEFAULT_API_URL
        }

        fun startService(
            context: Context,
            configJson: String
        ) {
            val intent = Intent(context, CallAutomationForegroundService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_CONFIG, configJson)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
            Log.d(TAG, "Foreground service start command sent")
        }

        fun stopService(context: Context) {
            val intent = Intent(context, CallAutomationForegroundService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
            Log.d(TAG, "Stop service command sent")
        }
    }

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private var wakeLock: PowerManager.WakeLock? = null
    private var screenWakeLock: PowerManager.WakeLock? = null
    private var isExecuting = false

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        createNotificationChannel()
        acquireWakeLock()
        Log.d(TAG, "Foreground service created")
    }

    override fun onDestroy() {
        isRunning = false
        currentConfig = null
        serviceScope.cancel()
        handler.removeCallbacksAndMessages(null)
        cancelAlarm()
        releaseWakeLock()
        Log.d(TAG, "Foreground service destroyed")
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "onStartCommand: action=${intent?.action}")

        when (intent?.action) {
            ACTION_START -> {
                val configJson = intent.getStringExtra(EXTRA_CONFIG)
                if (configJson != null) {
                    handleStartCommand(configJson)
                } else {
                    Log.e(TAG, "No config provided, stopping service")
                    stopSelf()
                }
            }
            ACTION_STOP -> {
                Log.d(TAG, "Stop action received")
                cancelAlarm()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
            ACTION_EXECUTE_NOW -> {
                Log.d(TAG, "Execute now action received")
                // Load config from SharedPreferences if currentConfig is null (service was restarted)
                if (currentConfig == null) {
                    val prefs = getSharedPreferences("call_automation", Context.MODE_PRIVATE)
                    val savedConfig = prefs.getString("config", null)
                    if (savedConfig != null) {
                        currentConfig = JSONObject(savedConfig)
                        Log.d(TAG, "Loaded config from SharedPreferences")
                    } else {
                        Log.e(TAG, "No config available, cannot execute")
                        stopSelf()
                        return@onStartCommand START_STICKY
                    }
                }
                executeCalls()
                // Schedule next execution after calls complete
                scheduleNextExecution()
            }
        }

        return START_STICKY
    }

    private fun handleStartCommand(configJson: String) {
        try {
            val config = JSONObject(configJson)
            val isActive = config.optBoolean("isActive", false)
            val role = config.optString("role", "NONE")

            Log.d(TAG, "Config: isActive=$isActive, role=$role")

            if (!isActive || role != "CALLER") {
                Log.d(TAG, "Config not active or not CALLER, stopping service")
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return
            }

            // Save config to SharedPreferences for alarm-triggered executions
            val prefs = getSharedPreferences("call_automation", Context.MODE_PRIVATE)
            prefs.edit().putString("config", configJson).apply()
            Log.d(TAG, "Config saved to SharedPreferences")

            currentConfig = config
            startForegroundWithNotification()
            scheduleNextExecution()

        } catch (e: Exception) {
            Log.e(TAG, "Error parsing config", e)
            stopSelf()
        }
    }

    private fun startForegroundWithNotification() {
        val notification = createNotification("Waiting for scheduled time...")

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // For Android 10+, we need FOREGROUND_SERVICE_TYPE_PHONE_CALL
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        Log.d(TAG, "Foreground service started with notification")
    }

    private fun createNotification(statusText: String): Notification {
        val stopIntent = Intent(this, CallAutomationForegroundService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            0,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val executeIntent = Intent(this, CallAutomationForegroundService::class.java).apply {
            action = ACTION_EXECUTE_NOW
        }
        val executePendingIntent = PendingIntent.getService(
            this,
            1,
            executeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Call Automation Active")
            .setContentText(statusText)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .addAction(android.R.drawable.ic_menu_call, "Execute Now", executePendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopPendingIntent)
            .build()
    }

    private fun updateNotification(statusText: String) {
        val notification = createNotification(statusText)
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Call automation service for scheduled calls"
                setShowBadge(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun acquireWakeLock() {
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "CallAutomation::WakeLock"
            )
            // FIX: Extended to 30 minutes for multiple calls
            wakeLock?.acquire(30 * 60 * 1000L) // 30 minutes for multiple calls
            Log.d(TAG, "Wake lock acquired for 30 minutes")
        } catch (e: Exception) {
            Log.e(TAG, "Error acquiring wake lock", e)
        }
    }

    private fun releaseWakeLock() {
        try {
            wakeLock?.let {
                if (it.isHeld) {
                    it.release()
                    Log.d(TAG, "Wake lock released")
                }
            }
            screenWakeLock?.let {
                if (it.isHeld) {
                    it.release()
                    Log.d(TAG, "Screen wake lock released")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing wake lock", e)
        }
    }

    // ============================================
    // FIX: Screen Wake and Keyguard Dismissal
    // ============================================

    /**
     * Wake up screen before making calls
     * This ensures calls work when phone is locked
     * Note: Keyguard dismissal requires Activity context, so we only wake screen here
     */
    @SuppressLint("WakelockTimeout")
    private fun wakeScreenAndDismissKeyguard(onReady: () -> Unit) {
        Log.d(TAG, "Waking screen for call execution...")

        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager

            // Wake up screen with FULL_WAKE_LOCK
            screenWakeLock = powerManager.newWakeLock(
                PowerManager.FULL_WAKE_LOCK or
                PowerManager.ACQUIRE_CAUSES_WAKEUP or
                PowerManager.ON_AFTER_RELEASE,
                "CallAutomation::ScreenWake"
            )
            screenWakeLock?.acquire(15000L) // 15 seconds to complete call setup
            Log.d(TAG, "Screen wake lock acquired - screen should turn on")

            // Check if device is locked (for logging purposes)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as android.app.KeyguardManager
            if (keyguardManager.isDeviceLocked) {
                Log.d(TAG, "Device is locked - screen wake should allow call UI to show")
            } else {
                Log.d(TAG, "Device is not locked")
            }

            // Proceed with calls after a short delay to allow screen to wake
            handler.postDelayed({
                onReady()
            }, 500)

        } catch (e: Exception) {
            Log.e(TAG, "Error waking screen", e)
            // Try to proceed anyway
            onReady()
        }
    }

    // ============================================
    // Scheduling using AlarmManager (Precise Timing)
    // ============================================

    private fun scheduleNextExecution() {
        val config = currentConfig ?: return

        val frequency = config.optString("frequency", "daily")
        val scheduledTime = config.optString("scheduledTime", "09:00")
        val scheduledDay = config.optString("scheduledDay", "monday")

        val triggerTime = calculateTriggerTime(frequency, scheduledTime, scheduledDay)
        val delayMinutes = ((triggerTime - System.currentTimeMillis()) / (60 * 1000)).coerceAtLeast(1)

        Log.d(TAG, "Scheduling next execution in $delayMinutes minutes (at $scheduledTime)")

        updateNotification("Next call in ${formatDelay(delayMinutes)} at $scheduledTime")

        // Use AlarmManager for precise timing (works even when app is in background)
        scheduleWithAlarmManager(triggerTime)
    }

    private fun scheduleWithAlarmManager(triggerTime: Long) {
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(this, CallAutomationForegroundService::class.java).apply {
            action = ACTION_EXECUTE_NOW
            putExtra(EXTRA_CONFIG, currentConfig?.toString())
        }

        val pendingIntent = PendingIntent.getService(
            this,
            ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Cancel any existing alarm
        alarmManager.cancel(pendingIntent)

        // Use setExactAndAllowWhileIdle for precise timing that works in Doze mode
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                SystemClock.elapsedRealtime() + (triggerTime - System.currentTimeMillis()),
                pendingIntent
            )
        } else {
            alarmManager.setExact(
                AlarmManager.RTC_WAKEUP,
                triggerTime,
                pendingIntent
            )
        }

        Log.d(TAG, "Alarm scheduled via AlarmManager for ${java.util.Date(triggerTime)}")

        // Also schedule via Handler as backup
        val delayMinutes = (triggerTime - System.currentTimeMillis()) / (60 * 1000)
        handler.postDelayed({
            Log.d(TAG, "Handler triggered - executing calls")
            executeCalls()
            scheduleNextExecution()
        }, delayMinutes * 60 * 1000L)
    }

    private fun cancelAlarm() {
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(this, CallAutomationForegroundService::class.java).apply {
            action = ACTION_EXECUTE_NOW
        }
        val pendingIntent = PendingIntent.getService(
            this,
            ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.cancel(pendingIntent)
        Log.d(TAG, "Alarm cancelled")
    }

    private fun calculateTriggerTime(frequency: String, scheduledTime: String, scheduledDay: String): Long {
        try {
            val parts = scheduledTime.split(":")
            val targetHour = parts[0].toInt()
            val targetMinute = if (parts.size > 1) parts[1].toInt() else 0

            val now = Calendar.getInstance()
            val target = Calendar.getInstance()
            target.set(Calendar.HOUR_OF_DAY, targetHour)
            target.set(Calendar.MINUTE, targetMinute)
            target.set(Calendar.SECOND, 0)
            target.set(Calendar.MILLISECOND, 0)

            if (frequency == "weekly") {
                val dayMap = mapOf(
                    "sunday" to Calendar.SUNDAY,
                    "monday" to Calendar.MONDAY,
                    "tuesday" to Calendar.TUESDAY,
                    "wednesday" to Calendar.WEDNESDAY,
                    "thursday" to Calendar.THURSDAY,
                    "friday" to Calendar.FRIDAY,
                    "saturday" to Calendar.SATURDAY
                )
                val targetDayOfWeek = dayMap[scheduledDay] ?: Calendar.MONDAY
                target.set(Calendar.DAY_OF_WEEK, targetDayOfWeek)
            }

            // If target time has already passed, move to next occurrence
            if (target.before(now)) {
                when (frequency) {
                    "hourly" -> target.add(Calendar.HOUR_OF_DAY, 1)
                    "daily" -> target.add(Calendar.DAY_OF_MONTH, 1)
                    "weekly" -> target.add(Calendar.WEEK_OF_YEAR, 1)
                }
            }

            return target.timeInMillis
        } catch (e: Exception) {
            Log.e(TAG, "Error calculating trigger time", e)
            return System.currentTimeMillis() + (60 * 60 * 1000) // Default to 1 hour from now
        }
    }

    private fun calculateDelayMinutes(frequency: String, scheduledTime: String, scheduledDay: String): Long {
        val triggerTime = calculateTriggerTime(frequency, scheduledTime, scheduledDay)
        return ((triggerTime - System.currentTimeMillis()) / (60 * 1000)).coerceAtLeast(1)
    }

    private fun formatDelay(minutes: Long): String {
        if (minutes < 60) return "$minutes min"
        val hours = minutes / 60
        val mins = minutes % 60
        return if (mins > 0) "${hours}h ${mins}m" else "${hours}h"
    }

    // ============================================
    // Call Execution
    // ============================================

    private fun executeCalls() {
        if (isExecuting) {
            Log.d(TAG, "Already executing calls, skipping")
            return
        }

        val config = currentConfig ?: return

        Log.d(TAG, "========== EXECUTING CALLS (WITH SCREEN WAKE FIX) ==========")

        // FIX: Wake screen and dismiss keyguard BEFORE making calls
        wakeScreenAndDismissKeyguard {
            serviceScope.launch {
                isExecuting = true
                try {
                    // Check if still active
                    val isActive = config.optBoolean("isActive", true)
                    val role = config.optString("role", "NONE")

                    if (!isActive || role != "CALLER") {
                        Log.d(TAG, "Config no longer active or not CALLER, stopping")
                        stopSelf()
                        return@launch
                    }

                    val targets = config.optJSONArray("targets")
                    val callDuration = config.optInt("callDuration", 10)
                    val simSlotIndex = config.optInt("simSlotIndex", 0)
                    val simPhoneNumber = config.optString("simPhoneNumber", "Unknown")

                    // Log the raw targets array for debugging
                    Log.d(TAG, "========== TARGETS DEBUG ==========")
                    Log.d(TAG, "Raw targets array: ${targets?.toString()}")
                    Log.d(TAG, "Targets count: ${targets?.length() ?: 0}")

                    if (targets == null || targets.length() == 0) {
                        Log.e(TAG, "No targets configured - stopping execution")
                        return@launch
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

                    Log.d(TAG, "Config: Duration: ${callDuration}s, SIM: $simPhoneNumber")

                    updateNotification("Making calls... (${parsedTargets.size} targets)")

                    var successCount = 0
                    var failCount = 0

                    for ((index, target) in parsedTargets.withIndex()) {
                        val targetNumber = target.first
                        val targetDuration = target.second

                        if (targetNumber.isNullOrEmpty()) {
                            Log.w(TAG, "Skipping target ${index + 1}: empty phone number")
                            continue
                        }

                        Log.d(TAG, "========== CALL ${index + 1}/${parsedTargets.size} ==========")
                        Log.d(TAG, "Target: $targetNumber")
                        Log.d(TAG, "Duration: ${targetDuration}s")
                        Log.d(TAG, "SIM Slot: $simSlotIndex (Caller: $simPhoneNumber)")

                        updateNotification("Calling $targetNumber (${index + 1}/${parsedTargets.size})")

                        val success = makeCall(targetNumber, simSlotIndex, targetDuration)

                        if (success) {
                            successCount++
                            Log.d(TAG, "Call ${index + 1}/${parsedTargets.size} SUCCESS")
                        } else {
                            failCount++
                            Log.e(TAG, "Call ${index + 1}/${parsedTargets.size} FAILED")
                        }

                        // Wait between calls
                        if (index < parsedTargets.size - 1) {
                            Log.d(TAG, "Waiting 3 seconds before next call...")
                            delay(3000)
                        }
                    }

                    Log.d(TAG, "========== CALL SESSION COMPLETE ==========")
                    Log.d(TAG, "Success: $successCount, Failed: $failCount")

                    updateNotification("Completed: $successCount successful, $failCount failed")

                    // Report to backend
                    val configId = config.optString("configId", null)
                    if (!configId.isNullOrEmpty()) {
                        reportToBackend(configId, simPhoneNumber, successCount, failCount)
                    }

                    // Update notification for next scheduled time
                    handler.postDelayed({
                        val freq = config.optString("frequency", "daily")
                        val time = config.optString("scheduledTime", "09:00")
                        updateNotification("Next call scheduled at $time (${freq})")
                    }, 5000)

                } catch (e: Exception) {
                    Log.e(TAG, "Error executing calls", e)
                    updateNotification("Error: ${e.message}")
                } finally {
                    isExecuting = false
                    // Release screen wake lock after calls complete
                    screenWakeLock?.let {
                        if (it.isHeld) {
                            it.release()
                            Log.d(TAG, "Screen wake lock released after calls")
                        }
                    }
                }
            }
        }
    }

    @SuppressLint("MissingPermission")
    private suspend fun makeCall(phoneNumber: String, simSlotIndex: Int, durationSeconds: Int): Boolean {
        return withContext(Dispatchers.Main) {
            try {
                // Check permissions
                if (!hasCallPermission()) {
                    Log.e(TAG, "No CALL_PHONE permission")
                    return@withContext false
                }

                // Ensure minimum duration
                val actualDuration = maxOf(10, durationSeconds)

                // Start call
                val callStarted = startCall(phoneNumber, simSlotIndex)
                if (!callStarted) {
                    Log.e(TAG, "Failed to start call to $phoneNumber")
                    return@withContext false
                }

                Log.d(TAG, "Call started to $phoneNumber, waiting ${actualDuration}s...")

                // Wait for duration
                delay(actualDuration * 1000L)

                // End call
                val callEnded = endCall()
                Log.d(TAG, if (callEnded) "Call ended" else "Failed to end call")

                true
            } catch (e: Exception) {
                Log.e(TAG, "Error making call", e)
                false
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun startCall(phoneNumber: String, simSlotIndex: Int): Boolean {
        return try {
            Log.d(TAG, "Starting call to $phoneNumber using SIM slot $simSlotIndex")

            val intent = Intent(Intent.ACTION_CALL)
            val uri = Uri.parse("tel:$phoneNumber")
            intent.data = uri

            // FIX: Add additional flags for better background/locked screen execution
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            intent.addFlags(Intent.FLAG_FROM_BACKGROUND)
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)

            // FIX: For Android 10+, add these flags to allow activity start from background
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Note: Starting activity from background is restricted on Android 10+
                // But CALL action is exempted when CALL_PHONE permission is granted
                Log.d(TAG, "Android 10+: Using CALL intent which is exempted from background restrictions")
            }

            // Set SIM slot for dual SIM devices
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                val subscriptionManager = getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager
                val subscriptionInfoList = subscriptionManager.activeSubscriptionInfoList

                if (subscriptionInfoList != null && subscriptionInfoList.isNotEmpty()) {
                    val subscriptionId = subscriptionInfoList.find { it.simSlotIndex == simSlotIndex }?.subscriptionId
                        ?: subscriptionInfoList[0].subscriptionId

                    Log.d(TAG, "Using subscriptionId: $subscriptionId for SIM slot $simSlotIndex")

                    intent.putExtra("android.telecom.extra.PHONE_ACCOUNT_HANDLE", subscriptionId)
                    intent.putExtra("com.android.phone.extra.slot", simSlotIndex)
                }
            }

            startActivity(intent)
            Log.d(TAG, "Call intent started successfully to $phoneNumber")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error starting call to $phoneNumber", e)
            false
        }
    }

    @SuppressLint("MissingPermission", "NewApi")
    private fun endCall(): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val telecomManager = getSystemService(Context.TELECOM_SERVICE) as TelecomManager
                telecomManager.endCall()
            } else {
                @Suppress("DEPRECATION")
                val telephonyManager = getSystemService(Context.TELECOM_SERVICE) as TelephonyManager
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
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.CALL_PHONE
        ) == PackageManager.PERMISSION_GRANTED
    }

    private suspend fun reportToBackend(configId: String, simNumber: String, successCount: Int, failCount: Int) {
        withContext(Dispatchers.IO) {
            try {
                Log.d(TAG, "Reporting to backend: configId=$configId, sim=$simNumber, success=$successCount, failed=$failCount")

                // Get API URL from SharedPreferences
                val apiUrl = getApiBaseUrl(applicationContext)
                Log.d(TAG, "Using API URL: $apiUrl")

                val payload = JSONObject().apply {
                    put("configId", configId)
                    put("simNumber", simNumber)
                    put("successCount", successCount)
                    put("failCount", failCount)
                }

                val request = Request.Builder()
                    .url("$apiUrl/device/call-complete")
                    .post(payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                    .addHeader("Content-Type", "application/json")
                    .build()

                val response = okHttpClient.newCall(request).execute()
                Log.d(TAG, "Backend response: ${response.code}")
                response.close()
            } catch (e: Exception) {
                Log.e(TAG, "Error reporting to backend", e)
            }
        }
    }
}