/**
 * Call Automation Native Module
 *
 * Android native module for automated SIM call verification.
 * Handles making calls, ending calls, multi-SIM selection, and background execution.
 *
 * Uses ForegroundService for reliable background operation even when app is minimized.
 *
 * IMPORTANT: This is ONLY for Private/Enterprise App Mode (APK distribution)
 * NOT for Play Store builds.
 */

package com.sim_management.modules

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.telecom.TelecomManager
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.sim_management.services.CallAutomationForegroundService
import com.sim_management.workers.CallAutomationWorker
import kotlinx.coroutines.*

class CallAutomationModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "CallAutomationModule"
        private const val MODULE_NAME = "CallAutomationModule"

        // Call states
        const val CALL_STATE_IDLE = "IDLE"
        const val CALL_STATE_RINGING = "RINGING"
        const val CALL_STATE_OFFHOOK = "OFFHOOK"

        // Request codes
        const val REQUEST_CODE_CALL_PERMISSION = 2001
    }

    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var isInCallFlag = false
    private var callJob: Job? = null

    override fun getName(): String = MODULE_NAME

    // ============================================
    // PERMISSION METHODS
    // ============================================

    @ReactMethod
    fun hasCallPermissions(promise: Promise) {
        try {
            val hasCallPhone = checkPermission(Manifest.permission.CALL_PHONE)
            val hasReadPhoneState = checkPermission(Manifest.permission.READ_PHONE_STATE)
            val hasReadCallLog = checkPermission(Manifest.permission.READ_CALL_LOG)

            // ANSWER_PHONE_CALLS is only needed for API 26+
            val hasAnswerPhoneCalls = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                checkPermission(Manifest.permission.ANSWER_PHONE_CALLS)
            } else {
                true
            }

            val hasAllPermissions = hasCallPhone && hasReadPhoneState && hasReadCallLog && hasAnswerPhoneCalls

            Log.d(TAG, "Permission check: callPhone=$hasCallPhone, readPhoneState=$hasReadPhoneState, " +
                    "readCallLog=$hasReadCallLog, answerPhoneCalls=$hasAnswerPhoneCalls, all=$hasAllPermissions")

            promise.resolve(hasAllPermissions)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking permissions", e)
            promise.reject("PERMISSION_ERROR", "Failed to check permissions: ${e.message}")
        }
    }

    @ReactMethod
    fun requestCallPermissions(promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity
            if (activity == null) {
                promise.reject("NO_ACTIVITY", "No current activity")
                return
            }

            val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                arrayOf(
                    Manifest.permission.CALL_PHONE,
                    Manifest.permission.READ_PHONE_STATE,
                    Manifest.permission.READ_CALL_LOG,
                    Manifest.permission.ANSWER_PHONE_CALLS
                )
            } else {
                arrayOf(
                    Manifest.permission.CALL_PHONE,
                    Manifest.permission.READ_PHONE_STATE,
                    Manifest.permission.READ_CALL_LOG
                )
            }

            // Request permissions using ActivityCompat
            ActivityCompat.requestPermissions(activity, permissions, REQUEST_CODE_CALL_PERMISSION)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error requesting permissions", e)
            promise.reject("PERMISSION_ERROR", "Failed to request permissions: ${e.message}")
        }
    }

    private fun checkPermission(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(reactApplicationContext, permission) == PackageManager.PERMISSION_GRANTED
    }

    // ============================================
    // SIM SLOT METHODS
    // ============================================

    @ReactMethod
    @SuppressLint("MissingPermission")
    fun getSimSlots(promise: Promise) {
        try {
            val subscriptionManager = reactApplicationContext.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager

            val activeSubscriptionInfoList = subscriptionManager.activeSubscriptionInfoList

            if (activeSubscriptionInfoList == null || activeSubscriptionInfoList.isEmpty()) {
                Log.d(TAG, "No active SIMs found")
                promise.resolve(Arguments.createArray())
                return
            }

            val result = Arguments.createArray()

            for (info in activeSubscriptionInfoList) {
                val simInfo = Arguments.createMap().apply {
                    putInt("slotIndex", info.simSlotIndex)
                    putString("phoneNumber", info.number?.toString() ?: "")
                    putString("carrierName", info.carrierName?.toString() ?: "")
                    putString("iccId", info.iccId?.toString() ?: "")
                }
                result.pushMap(simInfo)
            }

            Log.d(TAG, "Found ${result.size()} SIM slots")
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting SIM slots", e)
            promise.reject("SIM_ERROR", "Failed to get SIM slots: ${e.message}")
        }
    }

    // ============================================
    // CALL METHODS
    // ============================================

    @ReactMethod
    fun makeCall(phoneNumber: String, simSlotIndex: Int, durationSeconds: Int, promise: Promise) {
        Log.d(TAG, "makeCall called: number=$phoneNumber, slot=$simSlotIndex, duration=$durationSeconds")

        // Check permission
        if (!checkPermission(Manifest.permission.CALL_PHONE)) {
            promise.reject("PERMISSION_DENIED", "CALL_PHONE permission not granted")
            return
        }

        // Cancel any ongoing call job
        callJob?.cancel()

        callJob = serviceScope.launch {
            var success = false
            var errorMessage: String? = null
            var actualDuration = 0L

            try {
                // Start the call
                val callStarted = startCall(phoneNumber, simSlotIndex)

                if (!callStarted) {
                    errorMessage = "Failed to start call"
                } else {
                    isInCallFlag = true

                    // Wait for the specified duration
                    delay(durationSeconds * 1000L)
                    actualDuration = durationSeconds * 1000L

                    // End the call
                    val callEnded = endCall()
                    if (!callEnded) {
                        errorMessage = "Failed to end call"
                    } else {
                        success = true
                    }

                    isInCallFlag = false
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error during call execution", e)
                errorMessage = e.message
                isInCallFlag = false
            }

            val result = Arguments.createMap().apply {
                putBoolean("success", success)
                if (errorMessage != null) {
                    putString("error", errorMessage)
                }
                if (success) {
                    putDouble("callDuration", actualDuration.toDouble())
                }
            }

            promise.resolve(result)
        }
    }

    @SuppressLint("MissingPermission")
    private fun startCall(phoneNumber: String, simSlotIndex: Int): Boolean {
        return try {
            val context = reactApplicationContext

            // Create call intent
            val callIntent = Intent(Intent.ACTION_CALL)

            // Format phone number with tel: scheme
            val uri = Uri.parse("tel:$phoneNumber")
            callIntent.data = uri

            // Set SIM slot for dual SIM devices
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                val subscriptionManager = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager
                val subscriptionInfoList = subscriptionManager.activeSubscriptionInfoList

                if (subscriptionInfoList != null && subscriptionInfoList.isNotEmpty()) {
                    // Find the subscription for the requested slot
                    val subscriptionId = subscriptionInfoList.find { it.simSlotIndex == simSlotIndex }?.subscriptionId
                        ?: subscriptionInfoList[0].subscriptionId

                    // Set the subscription ID for the call
                    callIntent.putExtra("android.telecom.extra.PHONE_ACCOUNT_HANDLE", subscriptionId)
                }
            }

            callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            callIntent.addFlags(Intent.FLAG_FROM_BACKGROUND)

            context.startActivity(callIntent)

            Log.d(TAG, "Call started to $phoneNumber using SIM slot $simSlotIndex")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Error starting call", e)
            false
        }
    }

    @SuppressLint("MissingPermission", "NewApi")
    private fun endCall(): Boolean {
        return try {
            val context = reactApplicationContext

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                // Android 9+ (API 28+): Use TelecomManager
                val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
                telecomManager.endCall()
            } else {
                // Legacy method for older Android versions
                @Suppress("DEPRECATION")
                val telephonyManager = context.getSystemService(Context.TELECOM_SERVICE) as TelephonyManager
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

    @ReactMethod
    fun endCall(promise: Promise) {
        val result = endCall()
        isInCallFlag = false
        promise.resolve(result)
    }

    @ReactMethod
    fun isInCall(promise: Promise) {
        promise.resolve(isInCallFlag)
    }

    @ReactMethod
    fun getCallState(promise: Promise) {
        try {
            val telephonyManager = reactApplicationContext.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager

            @Suppress("DEPRECATION")
            val state = when (telephonyManager.callState) {
                TelephonyManager.CALL_STATE_IDLE -> CALL_STATE_IDLE
                TelephonyManager.CALL_STATE_RINGING -> CALL_STATE_RINGING
                TelephonyManager.CALL_STATE_OFFHOOK -> CALL_STATE_OFFHOOK
                else -> "UNKNOWN"
            }

            promise.resolve(state)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting call state", e)
            promise.resolve("UNKNOWN")
        }
    }

    // ============================================
    // BATTERY OPTIMIZATION
    // ============================================

    @ReactMethod
    fun isIgnoringBatteryOptimization(promise: Promise) {
        try {
            val powerManager = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
            val packageName = reactApplicationContext.packageName

            val isIgnoring = powerManager.isIgnoringBatteryOptimizations(packageName)
            Log.d(TAG, "Is ignoring battery optimization: $isIgnoring")
            promise.resolve(isIgnoring)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking battery optimization", e)
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimization(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${reactApplicationContext.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error requesting battery optimization exemption", e)
            promise.resolve(false)
        }
    }

    // ============================================
    // SERVICE CONTROL - Using Foreground Service
    // ============================================

    @ReactMethod
    fun startCallAutomationService(configJson: String, promise: Promise) {
        try {
            Log.d(TAG, "Starting call automation service with config")

            // Parse config to check if it's active
            val config = org.json.JSONObject(configJson)
            val isActive = config.optBoolean("isActive", true)
            val role = config.optString("role", "NONE")

            if (!isActive) {
                Log.d(TAG, "Call automation is DISABLED, not starting service")
                promise.resolve(false)
                return
            }

            if (role != "CALLER") {
                Log.d(TAG, "Role is not CALLER ($role), not starting service")
                promise.resolve(false)
                return
            }

            // Store config in shared preferences for the worker
            val prefs = reactApplicationContext.getSharedPreferences("call_automation", Context.MODE_PRIVATE)
            prefs.edit().putString("config", configJson).apply()

            // Start the Foreground Service (works even when app is minimized)
            CallAutomationForegroundService.startService(reactApplicationContext, configJson)

            // Also schedule WorkManager as backup
            CallAutomationWorker.scheduleWork(reactApplicationContext, configJson)

            Log.d(TAG, "Foreground service and WorkManager started")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error starting call automation service", e)
            promise.reject("SERVICE_ERROR", "Failed to start service: ${e.message}")
        }
    }

    @ReactMethod
    fun stopCallAutomationService(promise: Promise) {
        try {
            Log.d(TAG, "Stopping call automation service")

            // Stop the Foreground Service
            CallAutomationForegroundService.stopService(reactApplicationContext)

            // Cancel WorkManager
            CallAutomationWorker.cancelWork(reactApplicationContext)

            // Clear config
            val prefs = reactApplicationContext.getSharedPreferences("call_automation", Context.MODE_PRIVATE)
            prefs.edit().clear().apply()

            Log.d(TAG, "Foreground service and WorkManager stopped")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping call automation service", e)
            promise.reject("SERVICE_ERROR", "Failed to stop service: ${e.message}")
        }
    }

    @ReactMethod
    fun isServiceRunning(promise: Promise) {
        try {
            val isRunning = CallAutomationForegroundService.isServiceRunning() ||
                    CallAutomationWorker.isScheduled(reactApplicationContext)
            promise.resolve(isRunning)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking service status", e)
            promise.resolve(false)
        }
    }
}