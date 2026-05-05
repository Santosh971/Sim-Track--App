package com.sim_management.workers

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.Build
import android.util.Log
import androidx.work.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit
import kotlin.math.min

/**
 * Worker for periodic WiFi speed tests
 * Runs in background every 5 minutes to test and submit WiFi speed
 */
class WiFiSpeedWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        private const val TAG = "WiFiSpeedWorker"
        private const val WORK_NAME = "wifi_speed_work"
        private const val KEY_SIM_NUMBER = "simNumber"
        private const val KEY_DEVICE_ID = "deviceId"
        private const val KEY_DEVICE_TOKEN = "deviceToken"
        private const val KEY_WIFI_CONFIG = "wifiConfig"

        // API endpoint
        private const val API_BASE_URL = "https://node.simtrackr.b100x.in/api"

        /**
         * Schedule periodic WiFi speed test
         * @param intervalMinutes Interval in minutes (default 5)
         */
        fun scheduleWork(context: Context, configJson: String, intervalMinutes: Long = 5) {
            Log.d(TAG, "========== SCHEDULING WIFI SPEED WORK ==========")
            Log.d(TAG, "Config: $configJson")
            Log.d(TAG, "Interval: $intervalMinutes minutes")

            try {
                val config = JSONObject(configJson)

                val constraints = Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .setRequiresBatteryNotLow(true)
                    .build()

                val inputData = workDataOf(
                    KEY_SIM_NUMBER to config.optString("simNumber", ""),
                    KEY_DEVICE_ID to config.optString("deviceId", ""),
                    KEY_DEVICE_TOKEN to config.optString("deviceToken", ""),
                    KEY_WIFI_CONFIG to configJson
                )

                val workRequest = PeriodicWorkRequestBuilder<WiFiSpeedWorker>(
                    intervalMinutes, TimeUnit.MINUTES
                )
                    .setConstraints(constraints)
                    .setInputData(inputData)
                    .setBackoffCriteria(
                        BackoffPolicy.LINEAR,
                        WorkRequest.MIN_BACKOFF_MILLIS,
                        TimeUnit.MILLISECONDS
                    )
                    .build()

                WorkManager.getInstance(context)
                    .enqueueUniquePeriodicWork(
                        WORK_NAME,
                        ExistingPeriodicWorkPolicy.REPLACE,
                        workRequest
                    )

                Log.d(TAG, "WiFi speed work scheduled successfully")
            } catch (e: Exception) {
                Log.e(TAG, "Error scheduling WiFi speed work", e)
            }
        }

        /**
         * Cancel scheduled work
         */
        fun cancelWork(context: Context) {
            Log.d(TAG, "Cancelling WiFi speed work")
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }

        /**
         * Check if work is scheduled
         */
        fun isScheduled(context: Context): Boolean {
            val workInfos = WorkManager.getInstance(context)
                .getWorkInfosForUniqueWork(WORK_NAME).get()
            return workInfos.any { it.state == WorkInfo.State.RUNNING || it.state == WorkInfo.State.ENQUEUED }
        }
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        Log.d(TAG, "========== WIFI SPEED WORKER STARTED ==========")

        try {
            // Get config from input data
            val simNumber = inputData.getString(KEY_SIM_NUMBER)
            val deviceId = inputData.getString(KEY_DEVICE_ID)
            val deviceToken = inputData.getString(KEY_DEVICE_TOKEN)

            if (simNumber.isNullOrEmpty() || deviceId.isNullOrEmpty()) {
                Log.w(TAG, "Missing config data, skipping")
                return@withContext Result.success()
            }

            Log.d(TAG, "Config: simNumber=$simNumber, deviceId=$deviceId")

            // Check if on WiFi
            if (!isOnWifi()) {
                Log.d(TAG, "Not on WiFi, skipping speed test")
                return@withContext Result.success()
            }

            // Get current WiFi info
            val wifiInfo = getCurrentWifiInfo()
            val ssid = wifiInfo.first
            val bssid = wifiInfo.second

            Log.d(TAG, "WiFi Info: SSID=$ssid, BSSID=$bssid")

            if (ssid.isNullOrEmpty()) {
                Log.w(TAG, "No valid SSID, skipping")
                return@withContext Result.success()
            }

            // Run speed test
            Log.d(TAG, "Running speed test...")
            val speedResult = runSpeedTest()

            Log.d(TAG, "Speed test result: download=${speedResult.download} Mbps, upload=${speedResult.upload} Mbps, latency=${speedResult.latency} ms")

            // Submit to backend
            val submitted = submitSpeedTest(
                simNumber = simNumber,
                deviceId = deviceId,
                deviceToken = deviceToken ?: "",
                ssid = ssid,
                bssid = bssid ?: "",
                downloadSpeed = speedResult.download,
                uploadSpeed = speedResult.upload,
                latency = speedResult.latency
            )

            if (submitted) {
                Log.d(TAG, "WiFi speed submitted successfully")
            } else {
                Log.w(TAG, "Failed to submit WiFi speed")
            }

            Log.d(TAG, "========== WIFI SPEED WORKER COMPLETE ==========")
            Result.success()

        } catch (e: Exception) {
            Log.e(TAG, "WiFi speed worker error", e)
            Result.retry()
        }
    }

    /**
     * Check if device is on WiFi
     */
    private fun isOnWifi(): Boolean {
        val connectivityManager = applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = connectivityManager.activeNetwork ?: return false
            val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
        } else {
            @Suppress("DEPRECATION")
            val networkInfo = connectivityManager.activeNetworkInfo
            networkInfo?.type == ConnectivityManager.TYPE_WIFI && networkInfo.isConnected
        }
    }

    /**
     * Get current WiFi SSID and BSSID
     */
    private fun getCurrentWifiInfo(): Pair<String?, String?> {
        return try {
            val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
                ?: return Pair(null, null)

            val wifiInfo = wifiManager.connectionInfo ?: return Pair(null, null)

            var ssid: String? = wifiInfo.ssid?.removeSurrounding("\"")
            val bssid: String? = wifiInfo.bssid

            // Check if SSID is valid
            if (ssid.isNullOrEmpty() || ssid == "<unknown ssid>" || ssid.startsWith("<")) {
                ssid = null
            }

            Pair(ssid, bssid)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting WiFi info", e)
            Pair(null, null)
        }
    }

    /**
     * Run speed test
     */
    private fun runSpeedTest(): SpeedResult {
        var downloadSpeed = 0.0
        var uploadSpeed = 0.0
        var latency = 0.0

        // Measure latency
        latency = measureLatency()
        Log.d(TAG, "Latency: $latency ms")

        // Measure download speed
        downloadSpeed = measureDownloadSpeed()
        Log.d(TAG, "Download speed: $downloadSpeed Mbps")

        // Measure upload speed (or estimate)
        uploadSpeed = measureUploadSpeed()
        if (uploadSpeed == 0.0 && downloadSpeed > 0) {
            uploadSpeed = downloadSpeed * 0.3 // Estimate upload as 30% of download
        }
        Log.d(TAG, "Upload speed: $uploadSpeed Mbps")

        return SpeedResult(downloadSpeed, uploadSpeed, latency)
    }

    /**
     * Measure latency
     */
    private fun measureLatency(): Double {
        var totalLatency = 0L
        val iterations = 3

        repeat(iterations) {
            try {
                val startTime = System.currentTimeMillis()
                val url = URL("https://www.google.com")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "GET"
                connection.connectTimeout = 5000
                connection.readTimeout = 5000
                connection.instanceFollowRedirects = true
                connection.connect()
                connection.inputStream.close()
                connection.disconnect()
                val endTime = System.currentTimeMillis()
                totalLatency += (endTime - startTime)
            } catch (e: Exception) {
                Log.w(TAG, "Latency test iteration failed", e)
            }
        }

        return if (totalLatency > 0) totalLatency.toDouble() / iterations else 0.0
    }

    /**
     * Measure download speed
     */
    private fun measureDownloadSpeed(): Double {
        val testUrls = listOf(
            "https://www.google.com/favicon.ico",
            "https://www.cloudflare.com/favicon.ico"
        )

        for (urlString in testUrls) {
            try {
                val startTime = System.nanoTime()
                var totalBytes = 0L

                val url = URL(urlString)
                val connection = url.openConnection() as HttpURLConnection
                connection.connectTimeout = 10000
                connection.readTimeout = 30000
                connection.connect()

                val inputStream = connection.inputStream
                val buffer = ByteArray(8192)
                var bytesRead: Int

                // Download for up to 5 seconds
                val maxDuration = TimeUnit.SECONDS.toNanos(5)
                var elapsed = 0L

                while (elapsed < maxDuration) {
                    bytesRead = inputStream.read(buffer)
                    if (bytesRead == -1) break
                    totalBytes += bytesRead
                    elapsed = System.nanoTime() - startTime
                }

                inputStream.close()
                connection.disconnect()

                val endTime = System.nanoTime()
                val durationSeconds = (endTime - startTime) / 1_000_000_000.0

                if (durationSeconds > 0 && totalBytes > 0) {
                    return (totalBytes * 8) / (durationSeconds * 1_000_000)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Download test failed for $urlString: ${e.message}")
            }
        }

        return 0.0
    }

    /**
     * Measure upload speed
     */
    private fun measureUploadSpeed(): Double {
        // Upload testing is complex and often blocked, return 0 and estimate from download
        return 0.0
    }

    /**
     * Submit speed test result to backend
     */
    private suspend fun submitSpeedTest(
        simNumber: String,
        deviceId: String,
        deviceToken: String,
        ssid: String,
        bssid: String,
        downloadSpeed: Double,
        uploadSpeed: Double,
        latency: Double
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val url = URL("$API_BASE_URL/device/metrics")
            val connection = url.openConnection() as H
            ttpURLConnection

            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $deviceToken")
            connection.connectTimeout = 30000
            connection.readTimeout = 30000

            val requestBody = JSONObject().apply {
                put("simNumber", simNumber)
                put("deviceId", deviceId)
                put("deviceToken", deviceToken)
                put("ssid", ssid)
                put("bssid", bssid)
                put("downloadSpeed", downloadSpeed)
                put("uploadSpeed", uploadSpeed)
                put("latency", latency)
            }

            Log.d(TAG, "Submitting: $requestBody")

            connection.outputStream.use { os ->
                val input = requestBody.toString().toByteArray(Charsets.UTF_8)
                os.write(input, 0, input.size)
            }

            val responseCode = connection.responseCode
            Log.d(TAG, "Response code: $responseCode")

            connection.disconnect()

            return@withContext responseCode in 200..299
        } catch (e: Exception) {
            Log.e(TAG, "Error submitting speed test", e)
            return@withContext false
        }
    }

    /**
     * Speed test result holder
     */
    data class SpeedResult(
        val download: Double,
        val upload: Double,
        val latency: Double
    )
}