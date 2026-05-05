package com.sim_management.modules

import android.Manifest
import android.content.pm.PackageManager
import android.provider.CallLog
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.PermissionAwareActivity

class CallLogModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val PERMISSIONS_REQUEST_CODE = 1001
        const val NAME = "CallLogModule"
        private const val TAG = "CallLogModule"
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
            val hasReadSms = reactApplicationContext.checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
            val hasReadPhoneNumbers = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                reactApplicationContext.checkSelfPermission(Manifest.permission.READ_PHONE_NUMBERS) == PackageManager.PERMISSION_GRANTED
            } else {
                hasReadPhoneState
            }

            val result = Arguments.createMap().apply {
                putBoolean("readCallLog", hasReadCallLog)
                putBoolean("readPhoneState", hasReadPhoneState)
                putBoolean("readPhoneNumbers", hasReadPhoneNumbers)
                putBoolean("readSms", hasReadSms)
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

            val permissions = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                arrayOf(
                    Manifest.permission.READ_CALL_LOG,
                    Manifest.permission.READ_PHONE_STATE,
                    Manifest.permission.READ_PHONE_NUMBERS,
                    Manifest.permission.READ_SMS,
                    Manifest.permission.POST_NOTIFICATIONS
                )
            } else {
                arrayOf(
                    Manifest.permission.READ_CALL_LOG,
                    Manifest.permission.READ_PHONE_STATE,
                    Manifest.permission.READ_SMS,
                    Manifest.permission.POST_NOTIFICATIONS
                )
            }

            // Check current permission status first
            val hasReadCallLog = reactApplicationContext.checkSelfPermission(Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED
            val hasReadPhoneState = reactApplicationContext.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED
            val hasReadSms = reactApplicationContext.checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED

            // If activity is PermissionAwareActivity, request permissions properly
            if (activity is PermissionAwareActivity) {
                activity.requestPermissions(permissions, PERMISSIONS_REQUEST_CODE)
            } else {
                // Fallback: just return current status
                val result = Arguments.createMap().apply {
                    putBoolean(Manifest.permission.READ_CALL_LOG, hasReadCallLog)
                    putBoolean(Manifest.permission.READ_PHONE_STATE, hasReadPhoneState)
                    putBoolean(Manifest.permission.READ_SMS, hasReadSms)
                    putBoolean(Manifest.permission.POST_NOTIFICATIONS, true)
                }
                promise.resolve(result)
                return
            }

            // Return current permission status immediately
            val result = Arguments.createMap().apply {
                putBoolean(Manifest.permission.READ_CALL_LOG, hasReadCallLog)
                putBoolean(Manifest.permission.READ_PHONE_STATE, hasReadPhoneState)
                putBoolean(Manifest.permission.READ_SMS, hasReadSms)
                putBoolean(Manifest.permission.POST_NOTIFICATIONS, true)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to request permissions: ${e.message}")
        }
    }

    /**
     * Get call logs from device with SIM slot information
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
                CallLog.Calls.CACHED_NAME,
                CallLog.Calls.PHONE_ACCOUNT_ID
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

            // Query call logs - sorted by date descending
            // Note: LIMIT is not supported in sortOrder for ContentResolver
            // We limit manually in the while loop below
            val cursor = contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                selection,
                selectionArgs,
                "${CallLog.Calls.DATE} DESC"
            )

            // Build SIM slot mapping
            val simSlotMap = buildSIMSlotMap()

            val callLogs = Arguments.createArray()
            var count = 0
            val maxLogs = 500 // Safety limit

            if (cursor != null) {
                try {
                    val idIndex = cursor.getColumnIndex(CallLog.Calls._ID)
                    val numberIndex = cursor.getColumnIndex(CallLog.Calls.NUMBER)
                    val typeIndex = cursor.getColumnIndex(CallLog.Calls.TYPE)
                    val dateIndex = cursor.getColumnIndex(CallLog.Calls.DATE)
                    val durationIndex = cursor.getColumnIndex(CallLog.Calls.DURATION)
                    val nameIndex = cursor.getColumnIndex(CallLog.Calls.CACHED_NAME)
                    val phoneAccountIndex = cursor.getColumnIndex(CallLog.Calls.PHONE_ACCOUNT_ID)

                    while (cursor.moveToNext() && count < maxLogs) {
                        count++
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
                        val phoneAccountId: String? = if (phoneAccountIndex >= 0) cursor.getString(phoneAccountIndex) else null

                        // Map phone account ID to SIM slot
                        val simSlotIndex = if (phoneAccountId != null) {
                            simSlotMap[phoneAccountId] ?: -1
                        } else {
                            -1
                        }

                        callLogs.pushMap(Arguments.createMap().apply {
                            putString("callId", callId)
                            putString("phoneNumber", phoneNumber)
                            putString("callType", callType)
                            putDouble("timestamp", timestamp)
                            putInt("duration", duration)
                            putString("contactName", contactName)
                            putString("phoneAccountId", phoneAccountId)
                            putInt("simSlotIndex", simSlotIndex)
                        })
                    }
                } finally {
                    cursor.close()
                }
            }

            Log.d(TAG, "Returning ${count} call logs")
            promise.resolve(callLogs)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read call logs", e)
            promise.reject("ERROR", "Failed to read call logs: ${e.message}")
        }
    }

    /**
     * Build mapping from phone account ID to SIM slot index
     */
    private fun buildSIMSlotMap(): Map<String, Int> {
        val slotMap = mutableMapOf<String, Int>()

        try {
            if (reactApplicationContext.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
                return slotMap
            }

            val subscriptionManager = reactApplicationContext.getSystemService(android.content.Context.TELEPHONY_SERVICE)
                as? SubscriptionManager ?: return slotMap

            @Suppress("DEPRECATION")
            val subscriptionInfoList = subscriptionManager.activeSubscriptionInfoList ?: return slotMap

            for (info in subscriptionInfoList) {
                val iccId = info.iccId
                val slotIndex = info.simSlotIndex
                if (iccId != null) {
                    slotMap[iccId] = slotIndex
                    // Also map subscription ID as phone account ID
                    slotMap[info.subscriptionId.toString()] = slotIndex
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not build SIM slot map: ${e.message}")
        }

        return slotMap
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
     * Get all SIM phone numbers (for multi-SIM devices)
     * Requires READ_PHONE_NUMBERS permission (Android 10+)
     */
    @ReactMethod
    fun getAllSIMPhoneNumbers(promise: Promise) {
        try {
            if (reactApplicationContext.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
                promise.resolve(Arguments.createArray())
                return
            }

            val subscriptionManager = reactApplicationContext.getSystemService(android.content.Context.TELEPHONY_SERVICE)
                as? SubscriptionManager

            if (subscriptionManager == null) {
                promise.resolve(Arguments.createArray())
                return
            }

            @Suppress("DEPRECATION")
            val subscriptionInfoList = subscriptionManager.activeSubscriptionInfoList ?: run {
                promise.resolve(Arguments.createArray())
                return
            }

            val phoneNumbers = Arguments.createArray()

            for (info in subscriptionInfoList) {
                val number = try {
                    info.number
                } catch (e: Exception) {
                    null
                }

                val cleanNumber = if (!number.isNullOrBlank()) {
                    val digits = number.toString().replace(Regex("[^0-9]"), "")
                    if (digits.length > 10) digits.takeLast(10) else digits
                } else {
                    null
                }

                phoneNumbers.pushString(cleanNumber)
            }

            promise.resolve(phoneNumbers)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting all SIM phone numbers", e)
            promise.resolve(Arguments.createArray())
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

    /**
     * Get call log counts by type (total, incoming, outgoing, missed)
     * Returns efficient count query without fetching all call logs
     */
    @ReactMethod
    fun getCallLogCounts(promise: Promise) {
        try {
            if (reactApplicationContext.checkSelfPermission(Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "READ_CALL_LOG permission not granted")
                return
            }

            val contentResolver = reactApplicationContext.contentResolver

            // Get total count
            val totalCursor = contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(CallLog.Calls._ID),
                null,
                null,
                null
            )
            val total = if (totalCursor != null) {
                try { totalCursor.count } finally { totalCursor.close() }
            } else { 0 }

            // Get incoming count (type = 1)
            val incomingCursor = contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(CallLog.Calls._ID),
                "${CallLog.Calls.TYPE} = ?",
                arrayOf(CallLog.Calls.INCOMING_TYPE.toString()),
                null
            )
            val incoming = if (incomingCursor != null) {
                try { incomingCursor.count } finally { incomingCursor.close() }
            } else { 0 }

            // Get outgoing count (type = 2)
            val outgoingCursor = contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(CallLog.Calls._ID),
                "${CallLog.Calls.TYPE} = ?",
                arrayOf(CallLog.Calls.OUTGOING_TYPE.toString()),
                null
            )
            val outgoing = if (outgoingCursor != null) {
                try { outgoingCursor.count } finally { outgoingCursor.close() }
            } else { 0 }

            // Get missed count (type = 3)
            val missedCursor = contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(CallLog.Calls._ID),
                "${CallLog.Calls.TYPE} = ?",
                arrayOf(CallLog.Calls.MISSED_TYPE.toString()),
                null
            )
            val missed = if (missedCursor != null) {
                try { missedCursor.count } finally { missedCursor.close() }
            } else { 0 }

            val result = Arguments.createMap().apply {
                putInt("total", total)
                putInt("incoming", incoming)
                putInt("outgoing", outgoing)
                putInt("missed", missed)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get call log counts: ${e.message}")
        }
    }
}