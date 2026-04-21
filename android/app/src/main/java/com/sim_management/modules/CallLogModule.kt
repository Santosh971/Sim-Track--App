package com.sim_management.modules

import android.Manifest
import android.content.pm.PackageManager
import android.provider.CallLog
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.PermissionAwareActivity

class CallLogModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val PERMISSIONS_REQUEST_CODE = 1001
        const val NAME = "CallLogModule"
    }

    override fun getName(): String = NAME

    /**
     * Check if required permissions are granted
     */
    @ReactMethod
    fun checkPermissions(promise: Promise) {
        try {
            val hasReadCallLog = reactApplicationContext.checkSelfPermission(Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED
            val hasReadPhoneState = reactApplicationContext.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED

            val result = Arguments.createMap().apply {
                putBoolean("readCallLog", hasReadCallLog)
                putBoolean("readPhoneState", hasReadPhoneState)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to check permissions: ${e.message}")
        }
    }

    /**
     * Request required permissions
     */
    @ReactMethod
    fun requestPermissions(promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity
            if (activity == null) {
                promise.reject("ERROR", "No activity available")
                return
            }

            val permissions = arrayOf(
                Manifest.permission.READ_CALL_LOG,
                Manifest.permission.READ_PHONE_STATE,
                Manifest.permission.POST_NOTIFICATIONS
            )

            // Check current permission status first
            val hasReadCallLog = reactApplicationContext.checkSelfPermission(Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED
            val hasReadPhoneState = reactApplicationContext.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED

            // If activity is PermissionAwareActivity, request permissions properly
            if (activity is PermissionAwareActivity) {
                activity.requestPermissions(permissions, PERMISSIONS_REQUEST_CODE)
            } else {
                // Fallback: just return current status
                val result = Arguments.createMap().apply {
                    putBoolean(Manifest.permission.READ_CALL_LOG, hasReadCallLog)
                    putBoolean(Manifest.permission.READ_PHONE_STATE, hasReadPhoneState)
                    putBoolean(Manifest.permission.POST_NOTIFICATIONS, true)
                }
                promise.resolve(result)
                return
            }

            // Return current permission status immediately
            val result = Arguments.createMap().apply {
                putBoolean(Manifest.permission.READ_CALL_LOG, hasReadCallLog)
                putBoolean(Manifest.permission.READ_PHONE_STATE, hasReadPhoneState)
                putBoolean(Manifest.permission.POST_NOTIFICATIONS, true)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to request permissions: ${e.message}")
        }
    }

    /**
     * Get call logs from device
     * @param lastSyncTimestamp - Optional timestamp to filter logs after this time (in milliseconds)
     */
    @ReactMethod
    fun getCallLogs(lastSyncTimestamp: Double?, promise: Promise) {
        try {
            // Check permissions first
            if (reactApplicationContext.checkSelfPermission(Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "READ_CALL_LOG permission not granted")
                return
            }

            val contentResolver = reactApplicationContext.contentResolver
            val projection = arrayOf(
                CallLog.Calls._ID,
                CallLog.Calls.NUMBER,
                CallLog.Calls.TYPE,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION,
                CallLog.Calls.CACHED_NAME
            )

            // Build selection clause based on lastSyncTimestamp
            val selection: String? = if (lastSyncTimestamp != null) {
                "${CallLog.Calls.DATE} > ?"
            } else {
                null
            }

            val selectionArgs: Array<String>? = if (lastSyncTimestamp != null) {
                arrayOf(lastSyncTimestamp.toLong().toString())
            } else {
                null
            }

            val cursor = contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                selection,
                selectionArgs,
                "${CallLog.Calls.DATE} DESC"
            )

            val callLogs = Arguments.createArray()

            if (cursor != null) {
                try {
                    val idIndex = cursor.getColumnIndex(CallLog.Calls._ID)
                    val numberIndex = cursor.getColumnIndex(CallLog.Calls.NUMBER)
                    val typeIndex = cursor.getColumnIndex(CallLog.Calls.TYPE)
                    val dateIndex = cursor.getColumnIndex(CallLog.Calls.DATE)
                    val durationIndex = cursor.getColumnIndex(CallLog.Calls.DURATION)
                    val nameIndex = cursor.getColumnIndex(CallLog.Calls.CACHED_NAME)

                    while (cursor.moveToNext()) {
                        val type = cursor.getInt(typeIndex)
                        val callType = when (type) {
                            CallLog.Calls.INCOMING_TYPE -> "incoming"
                            CallLog.Calls.OUTGOING_TYPE -> "outgoing"
                            CallLog.Calls.MISSED_TYPE -> "missed"
                            else -> "unknown"
                        }

                        val callId = if (idIndex >= 0) cursor.getString(idIndex) else ""
                        val phoneNumber = if (numberIndex >= 0) cursor.getString(numberIndex) else ""
                        val timestamp = if (dateIndex >= 0) cursor.getDouble(dateIndex) else 0.0
                        val duration = if (durationIndex >= 0) cursor.getInt(durationIndex) else 0
                        val contactName: String? = if (nameIndex >= 0) cursor.getString(nameIndex) else null

                        callLogs.pushMap(Arguments.createMap().apply {
                            putString("callId", callId)
                            putString("phoneNumber", phoneNumber)
                            putString("callType", callType)
                            putDouble("timestamp", timestamp)
                            putInt("duration", duration)
                            putString("contactName", contactName)
                        })
                    }
                } finally {
                    cursor.close()
                }
            }

            promise.resolve(callLogs)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to read call logs: ${e.message}")
        }
    }

    /**
     * Get the device's phone number (SIM number)
     * Requires READ_PHONE_STATE permission
     */
    @ReactMethod
    fun getDevicePhoneNumber(promise: Promise) {
        try {
            if (reactApplicationContext.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
                promise.resolve(null)
                return
            }

            val telephonyManager = reactApplicationContext.getSystemService(android.content.Context.TELEPHONY_SERVICE)
                as android.telephony.TelephonyManager

            @Suppress("DEPRECATION")
            val lineNumber = telephonyManager.line1Number

            if (lineNumber.isNullOrBlank()) {
                promise.resolve(null)
            } else {
                // Clean up the number (remove country code if present)
                val cleanNumber = lineNumber.replace(Regex("^\\+91|^91"), "")
                promise.resolve(cleanNumber)
            }
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }

    /**
     * Get total call log count
     */
    @ReactMethod
    fun getCallLogCount(promise: Promise) {
        try {
            if (reactApplicationContext.checkSelfPermission(Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "READ_CALL_LOG permission not granted")
                return
            }

            val contentResolver = reactApplicationContext.contentResolver
            val cursor = contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(CallLog.Calls._ID),
                null,
                null,
                null
            )

            val count = if (cursor != null) {
                try {
                    cursor.count
                } finally {
                    cursor.close()
                }
            } else {
                0
            }
            promise.resolve(count)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get call log count: ${e.message}")
        }
    }
}