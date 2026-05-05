package com.sim_management.modules

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = SIMModule.NAME)
class SIMModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "SIMModule"
        private const val TAG = "SIMModule"
    }

    override fun getName(): String = NAME

    /**
     * Get all SIM cards currently in the device
     */
    @ReactMethod
    fun getDeviceSIMs(promise: Promise) {
        try {
            Log.d(TAG, "getDeviceSIMs called")

            // Check permission
            val hasPermission = reactApplicationContext.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED
            Log.d(TAG, "READ_PHONE_STATE permission granted: $hasPermission")

            if (!hasPermission) {
                Log.e(TAG, "READ_PHONE_STATE permission not granted")
                promise.reject("PERMISSION_DENIED", "READ_PHONE_STATE permission not granted")
                return
            }

            val subscriptionManager = reactApplicationContext.getSystemService(android.content.Context.TELEPHONY_SUBSCRIPTION_SERVICE)
                as? SubscriptionManager

            if (subscriptionManager == null) {
                Log.e(TAG, "SubscriptionManager not available")
                promise.reject("ERROR", "SubscriptionManager not available")
                return
            }

            Log.d(TAG, "SubscriptionManager obtained, getting activeSubscriptionInfoList...")

            // Get active subscription info list
            @Suppress("DEPRECATION")
            val subscriptionInfoList: List<SubscriptionInfo>? = subscriptionManager.activeSubscriptionInfoList

            Log.d(TAG, "activeSubscriptionInfoList result: ${subscriptionInfoList?.size ?: "null"}")

            if (subscriptionInfoList == null) {
                Log.w(TAG, "activeSubscriptionInfoList returned null - no SIMs detected or restricted access")
                // Try alternate method - check if we can at least get SIM count
                try {
                    val telephonyManager = reactApplicationContext.getSystemService(android.content.Context.TELEPHONY_SERVICE)
                        as? TelephonyManager
                    val simCount = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        telephonyManager?.activeModemCount ?: 0
                    } else {
                        @Suppress("DEPRECATION")
                        telephonyManager?.phoneCount ?: 0
                    }
                    Log.d(TAG, "Alternate method - phoneCount/modemCount: $simCount")
                } catch (e: Exception) {
                    Log.w(TAG, "Could not get phone count: ${e.message}")
                }

                // Return empty array - this device might not support SIM detection
                promise.resolve(Arguments.createArray())
                return
            }

            if (subscriptionInfoList.isEmpty()) {
                Log.w(TAG, "No active SIMs found in subscriptionInfoList")
                promise.resolve(Arguments.createArray())
                return
            }

            Log.d(TAG, "Found ${subscriptionInfoList.size} active SIMs")

            val simsArray = Arguments.createArray()

            for ((index, info) in subscriptionInfoList.withIndex()) {
                val phoneNumber = getPhoneNumber(info)
                Log.d(TAG, "SIM ${index}: slotIndex=${info.simSlotIndex}, phone=$phoneNumber, carrier=${info.carrierName}, iccid=${info.iccId}, subscriptionId=${info.subscriptionId}")

                val simInfo = Arguments.createMap().apply {
                    putInt("slotIndex", info.simSlotIndex)
                    putString("phoneNumber", phoneNumber)
                    putString("carrierName", info.carrierName?.toString())
                    putString("iccid", info.iccId)
                    putInt("subscriptionId", info.subscriptionId)
                    putBoolean("isActive", true)
                }
                simsArray.pushMap(simInfo)
            }

            Log.d(TAG, "Returning ${simsArray.size()} SIMs")
            promise.resolve(simsArray)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting device SIMs", e)
            promise.reject("ERROR", "Failed to get device SIMs: ${e.message}")
        }
    }

    /**
     * Check if device has dual SIM capability
     */
    @ReactMethod
    fun isDualSIMDevice(promise: Promise) {
        try {
            val telephonyManager = reactApplicationContext.getSystemService(android.content.Context.TELEPHONY_SERVICE)
                as? TelephonyManager

            if (telephonyManager == null) {
                promise.resolve(false)
                return
            }

            // Check phone count (SIM slots)
            val phoneCount = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                telephonyManager.activeModemCount
            } else {
                @Suppress("DEPRECATION")
                telephonyManager.phoneCount
            }

            promise.resolve(phoneCount > 1)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking dual SIM", e)
            promise.resolve(false)
        }
    }

    /**
     * Get count of active SIM cards
     */
    @ReactMethod
    fun getActiveSIMCount(promise: Promise) {
        try {
            if (reactApplicationContext.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
                promise.resolve(0)
                return
            }

            val subscriptionManager = reactApplicationContext.getSystemService(android.content.Context.TELEPHONY_SUBSCRIPTION_SERVICE)
                as? SubscriptionManager

            if (subscriptionManager == null) {
                promise.resolve(0)
                return
            }

            @Suppress("DEPRECATION")
            val subscriptionInfoList = subscriptionManager.activeSubscriptionInfoList

            val count = subscriptionInfoList?.size ?: 0
            promise.resolve(count)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting SIM count", e)
            promise.resolve(0)
        }
    }

    /**
     * Get phone number from subscription info
     * Tries multiple methods as Android restricts phone number access
     */
    private fun getPhoneNumber(info: SubscriptionInfo): String? {
        // Method 1: Try SubscriptionInfo.getNumber() (deprecated but might work on some devices)
        try {
            @Suppress("DEPRECATION")
            val number = info.number
            if (!number.isNullOrBlank()) {
                Log.d(TAG, "Got phone number from info.number: $number")
                return normalizePhoneNumber(number)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Method 1 (info.number) failed: ${e.message}")
        }

        // Method 2: Try SubscriptionManager.getActiveSubscriptionInfo() with phone number
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            try {
                if (reactApplicationContext.checkSelfPermission(Manifest.permission.READ_PHONE_NUMBERS) == PackageManager.PERMISSION_GRANTED) {
                    // For Android 13+, try getting number via TelephonyManager
                    val telephonyManager = reactApplicationContext.getSystemService(android.content.Context.TELEPHONY_SERVICE)
                        as? TelephonyManager

                    // Create a TelephonyManager for this specific subscription
                    val subTelephonyManager = telephonyManager?.createForSubscriptionId(info.subscriptionId)
                    val number = subTelephonyManager?.line1Number
                    if (!number.isNullOrBlank()) {
                        Log.d(TAG, "Got phone number from TelephonyManager: $number")
                        return normalizePhoneNumber(number)
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Method 2 (TelephonyManager) failed: ${e.message}")
            }
        }

        // Method 3: Try getting from TelephonyManager for older devices
        try {
            val telephonyManager = reactApplicationContext.getSystemService(android.content.Context.TELEPHONY_SERVICE)
                as? TelephonyManager

            @Suppress("DEPRECATION")
            val number = telephonyManager?.line1Number
            if (!number.isNullOrBlank()) {
                Log.d(TAG, "Got phone number from line1Number: $number")
                return normalizePhoneNumber(number)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Method 3 (line1Number) failed: ${e.message}")
        }

        Log.w(TAG, "Could not get phone number for SIM at slot ${info.simSlotIndex}")
        return null
    }

    /**
     * Normalize phone number (remove country code and formatting)
     */
    private fun normalizePhoneNumber(phoneNumber: String): String {
        // Remove all non-numeric characters
        val cleaned = phoneNumber.replace(Regex("[^0-9]"), "")

        // Remove country code if present (assuming +91 or 91 for India)
        return when {
            cleaned.startsWith("91") && cleaned.length > 10 -> cleaned.substring(2)
            cleaned.length > 10 -> cleaned.takeLast(10)
            else -> cleaned
        }
    }
}