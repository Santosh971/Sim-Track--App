package com.sim_management.modules

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Telephony
import android.telephony.SubscriptionManager
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.PermissionAwareActivity

class SMSModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val PERMISSIONS_REQUEST_CODE = 1002
        const val NAME = "SMSModule"
        private const val TAG = "SMSModule"
    }

    override fun getName(): String = NAME

    /**
     * Check if required permissions are granted
     */
    @ReactMethod
    fun checkPermissions(promise: Promise) {
        try {
            val hasReadSms = reactApplicationContext.checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
            val hasReadPhoneState = reactApplicationContext.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED

            val result = Arguments.createMap().apply {
                putBoolean("readSms", hasReadSms)
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
                Manifest.permission.READ_SMS,
                Manifest.permission.READ_PHONE_STATE
            )

            // Check current permission status first
            val hasReadSms = reactApplicationContext.checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
            val hasReadPhoneState = reactApplicationContext.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED

            // If activity is PermissionAwareActivity, request permissions properly
            if (activity is PermissionAwareActivity) {
                activity.requestPermissions(permissions, PERMISSIONS_REQUEST_CODE)
            }

            // Return current permission status
            val result = Arguments.createMap().apply {
                putBoolean(Manifest.permission.READ_SMS, hasReadSms)
                putBoolean(Manifest.permission.READ_PHONE_STATE, hasReadPhoneState)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to request permissions: ${e.message}")
        }
    }

    /**
     * Get SMS messages from device with SIM slot information
     * @param lastSyncTimestamp - Optional timestamp to filter messages after this time (in milliseconds)
     */
    @ReactMethod
    fun getSMSMessages(lastSyncTimestamp: Double?, promise: Promise) {
        Log.d(TAG, "===== getSMSMessages STARTED =====")
        Log.d(TAG, "lastSyncTimestamp: $lastSyncTimestamp (${lastSyncTimestamp?.javaClass})")

        try {
            // Check permissions first
            if (reactApplicationContext.checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
                Log.e(TAG, "READ_SMS permission not granted")
                promise.reject("PERMISSION_DENIED", "READ_SMS permission not granted")
                return
            }

            Log.d(TAG, "READ_SMS permission GRANTED, starting query...")

            val contentResolver = reactApplicationContext.contentResolver
            val uri = Uri.parse("content://sms")

            Log.d(TAG, "Content URI: $uri")

            // Use simpler projection first to test
            val projection = arrayOf(
                "_id",
                "address",
                "body",
                "date",
                "type"
            )
            // Note: Removed subscription_id to test if that's causing issues

            // NO timestamp filter - fetch ALL messages
            val selection: String? = null
            val selectionArgs: Array<String>? = null

            // Sort by date DESCENDING to get latest messages first
            val sortOrder = "date DESC"

            Log.d(TAG, "Querying SMS: selection=$selection, args=$selectionArgs, sortOrder=$sortOrder")

            var cursor: android.database.Cursor? = null
            val messages = Arguments.createArray()

            try {
                Log.d(TAG, "Calling contentResolver.query()...")
                // Sort by date DESC to get latest messages first
                cursor = contentResolver.query(uri, projection, selection, selectionArgs, sortOrder)

                if (cursor == null) {
                    Log.e(TAG, "Cursor is NULL - content resolver returned null")
                    promise.resolve(messages)
                    return
                }

                val cursorCount = cursor.count
                Log.d(TAG, "Cursor count: $cursorCount")

                if (cursorCount == 0) {
                    Log.w(TAG, "Cursor returned 0 rows")
                    cursor.close()
                    promise.resolve(messages)
                    return
                }

                val idIndex = cursor.getColumnIndex("_id")
                val addressIndex = cursor.getColumnIndex("address")
                val bodyIndex = cursor.getColumnIndex("body")
                val dateIndex = cursor.getColumnIndex("date")
                val typeIndex = cursor.getColumnIndex("type")

                Log.d(TAG, "Column indices: id=$idIndex, address=$addressIndex, body=$bodyIndex, date=$dateIndex, type=$typeIndex")

                // Limit to 100 messages to prevent memory issues and app crashes
                // Messages are sorted by date DESC, so we get the LATEST messages
                val maxMessages = 100
                var processedCount = 0
                while (cursor.moveToNext() && processedCount < maxMessages) {
                    processedCount++
                    val messageId = if (idIndex >= 0) cursor.getString(idIndex) else ""
                    val address = if (addressIndex >= 0) cursor.getString(addressIndex) ?: "" else ""
                    val body = if (bodyIndex >= 0) cursor.getString(bodyIndex) ?: "" else ""
                    val timestamp = if (dateIndex >= 0) cursor.getDouble(dateIndex) else 0.0
                    val type = if (typeIndex >= 0) cursor.getInt(typeIndex) else 0

                    // Map type to string
                    val messageType = when (type) {
                        Telephony.Sms.MESSAGE_TYPE_INBOX -> "inbox"
                        Telephony.Sms.MESSAGE_TYPE_SENT -> "sent"
                        1 -> "inbox"   // Fallback for inbox
                        2 -> "sent"    // Fallback for sent
                        else -> "inbox"
                    }

                    // Log first few messages for debugging (these are the LATEST messages)
                    if (processedCount <= 3) {
                        Log.d(TAG, "Message $processedCount (LATEST): id=$messageId, sender=$address, timestamp=$timestamp, type=$messageType")
                    }

                    messages.pushMap(Arguments.createMap().apply {
                        putString("_id", messageId)
                        putString("sender", address)
                        putString("message", body)
                        putDouble("timestamp", timestamp)
                        putString("type", messageType)
                        putInt("simSlotIndex", -1) // Default to -1 since we're not using subscription_id
                    })
                }

                Log.d(TAG, "Processed $processedCount SMS messages from cursor")
                Log.d(TAG, "Returning ${messages.size()} SMS messages")

            } catch (e: Exception) {
                Log.e(TAG, "Exception while reading cursor", e)
                throw e
            } finally {
                cursor?.close()
            }

            promise.resolve(messages)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read SMS messages", e)
            promise.reject("ERROR", "Failed to read SMS messages: ${e.message}")
        }
    }

    /**
     * Get total SMS message count
     */
    @ReactMethod
    fun getSMSCount(promise: Promise) {
        try {
            if (reactApplicationContext.checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "READ_SMS permission not granted")
                return
            }

            val contentResolver = reactApplicationContext.contentResolver
            val uri = Uri.parse("content://sms")
            val cursor = contentResolver.query(
                uri,
                arrayOf("_id"),
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
            promise.reject("ERROR", "Failed to get SMS count: ${e.message}")
        }
    }

    /**
     * Get SMS counts by type (total, inbox, sent)
     * Returns efficient count query without fetching all messages
     */
    @ReactMethod
    fun getSMSCounts(promise: Promise) {
        try {
            if (reactApplicationContext.checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "READ_SMS permission not granted")
                return
            }

            val contentResolver = reactApplicationContext.contentResolver
            val uri = Uri.parse("content://sms")

            // Get total count
            val totalCursor = contentResolver.query(uri, arrayOf("_id"), null, null, null)
            val total = if (totalCursor != null) {
                try { totalCursor.count } finally { totalCursor.close() }
            } else { 0 }

            // Get inbox count (type = 1)
            val inboxCursor = contentResolver.query(uri, arrayOf("_id"), "type = ?", arrayOf("1"), null)
            val inbox = if (inboxCursor != null) {
                try { inboxCursor.count } finally { inboxCursor.close() }
            } else { 0 }

            // Get sent count (type = 2)
            val sentCursor = contentResolver.query(uri, arrayOf("_id"), "type = ?", arrayOf("2"), null)
            val sent = if (sentCursor != null) {
                try { sentCursor.count } finally { sentCursor.close() }
            } else { 0 }

            val result = Arguments.createMap().apply {
                putInt("total", total)
                putInt("inbox", inbox)
                putInt("sent", sent)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get SMS counts: ${e.message}")
        }
    }

    /**
     * Build mapping from subscription ID to SIM slot index
     */
    private fun buildSIMSlotMap(): Map<String, Int> {
        val slotMap = mutableMapOf<String, Int>()

        try {
            if (reactApplicationContext.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
                return slotMap
            }

            val subscriptionManager = reactApplicationContext.getSystemService(android.content.Context.TELEPHONY_SUBSCRIPTION_SERVICE)
                as? SubscriptionManager ?: return slotMap

            @Suppress("DEPRECATION")
            val subscriptionInfoList = subscriptionManager.activeSubscriptionInfoList ?: return slotMap

            for (info in subscriptionInfoList) {
                val subscriptionId = info.subscriptionId
                val slotIndex = info.simSlotIndex
                slotMap[subscriptionId.toString()] = slotIndex
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not build SIM slot map: ${e.message}")
        }

        return slotMap
    }
}