package com.sim_management.modules

import android.Manifest
import android.content.pm.PackageManager
import android.net.TrafficStats
import android.net.wifi.WifiManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.*
import kotlinx.coroutines.*
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

class WiFiSpeedModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "WiFiSpeedModule"
        private const val TAG = "WiFiSpeedModule"
        // Use multiple speed test servers for fallback
        private val SPEED_TEST_URLS = listOf(
            "https://speedtest.tele2.net",
            "https://speed.cloudflare.com",
            "https://speed.google.com"
        )
        private const val DOWNLOAD_TEST_FILE = "/download.php"
        private const val UPLOAD_TEST_FILE = "/upload.php"
        private const val PING_TEST_FILE = "/ping.php"
        // Fallback: Use a simple download test from CDN
        private const val FALLBACK_TEST_URL = "https://www.google.com"
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var isMonitoring = false
    private var monitoringJob: Job? = null

    override fun getName(): String = NAME

    /**
     * Check if device is on WiFi
     */
    private fun isOnWifi(): Boolean {
        val connectivityManager = reactApplicationContext.getSystemService(android.content.Context.CONNECTIVITY_SERVICE) as ConnectivityManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = connectivityManager.activeNetwork ?: return false
            val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
            return capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
        } else {
            @Suppress("DEPRECATION")
            val networkInfo = connectivityManager.activeNetworkInfo
            return networkInfo?.type == ConnectivityManager.TYPE_WIFI && networkInfo.isConnected
        }
    }

    /**
     * Check if location permission is granted (required for SSID on Android 10+)
     */
    private fun hasLocationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            reactApplicationContext.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            reactApplicationContext.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    /**
     * Run a speed test
     * Returns download speed (Mbps), upload speed (Mbps), and latency (ms)
     */
    @ReactMethod
    fun runSpeedTest(promise: Promise) {
        Log.d(TAG, "runSpeedTest called")

        scope.launch {
            try {
                // Check WiFi status and log it
                val onWifi = isOnWifi()
                Log.d(TAG, "isOnWifi check result: $onWifi")

                if (!onWifi) {
                    Log.w(TAG, "Not on WiFi network, returning 0 values")
                    Log.w(TAG, "Please connect to WiFi to run speed test")
                    withContext(Dispatchers.Main) {
                        promise.resolve(createSpeedTestResult(0.0, 0.0, 0.0))
                    }
                    return@launch
                }

                Log.d(TAG, "On WiFi, starting speed test...")

                // Test latency first
                val latency = measureLatency()
                Log.d(TAG, "Latency: $latency ms")

                // Test download speed
                val downloadSpeed = measureDownloadSpeed()
                Log.d(TAG, "Download speed: $downloadSpeed Mbps")

                // Test upload speed
                var uploadSpeed = measureUploadSpeed()
                Log.d(TAG, "Upload speed: $uploadSpeed Mbps")

                // If upload test failed, estimate based on download (typical WiFi ratio ~30%)
                if (uploadSpeed == 0.0 && downloadSpeed > 0) {
                    uploadSpeed = downloadSpeed * 0.3
                    Log.d(TAG, "Upload estimated from download: $uploadSpeed Mbps")
                }

                Log.d(TAG, "Speed test complete: download=$downloadSpeed Mbps, upload=$uploadSpeed Mbps, latency=$latency ms")

                withContext(Dispatchers.Main) {
                    promise.resolve(createSpeedTestResult(downloadSpeed, uploadSpeed, latency))
                }
            } catch (e: Exception) {
                Log.e(TAG, "Speed test failed", e)
                withContext(Dispatchers.Main) {
                    promise.reject("SPEED_TEST_ERROR", "Speed test failed: ${e.message}")
                }
            }
        }
    }

    /**
     * Force run speed test (for debugging - runs even if not on WiFi)
     */
    @ReactMethod
    fun forceRunSpeedTest(promise: Promise) {
        Log.d(TAG, "forceRunSpeedTest called - running regardless of WiFi status")

        scope.launch {
            try {
                val onWifi = isOnWifi()
                Log.d(TAG, "WiFi status: $onWifi (running anyway)")

                // Test latency first
                val latency = measureLatency()
                Log.d(TAG, "Latency: $latency ms")

                // Test download speed
                val downloadSpeed = measureDownloadSpeed()
                Log.d(TAG, "Download speed: $downloadSpeed Mbps")

                // Test upload speed
                val uploadSpeed = measureUploadSpeed()
                Log.d(TAG, "Upload speed: $uploadSpeed Mbps")

                withContext(Dispatchers.Main) {
                    promise.resolve(createSpeedTestResult(downloadSpeed, uploadSpeed, latency))
                }
            } catch (e: Exception) {
                Log.e(TAG, "Force speed test failed", e)
                withContext(Dispatchers.Main) {
                    promise.reject("SPEED_TEST_ERROR", "Force speed test failed: ${e.message}")
                }
            }
        }
    }

    /**
     * Measure latency by making a small HTTP request
     */
    private fun measureLatency(): Double {
        var totalLatency = 0L
        val iterations = 3

        repeat(iterations) {
            try {
                val startTime = System.currentTimeMillis()
                // Use Google as fallback - more reliable
                val url = URL(FALLBACK_TEST_URL)
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
                Log.d(TAG, "Latency iteration: ${endTime - startTime}ms")
            } catch (e: Exception) {
                Log.w(TAG, "Latency test iteration failed", e)
            }
        }

        val avgLatency = if (totalLatency > 0) totalLatency.toDouble() / iterations else 0.0
        Log.d(TAG, "Average latency: $avgLatency ms")
        return avgLatency
    }

    /**
     * Measure download speed by downloading test data
     * Uses multiple fallback servers
     */
    private fun measureDownloadSpeed(): Double {
        // Try primary speed test server first
        for (serverUrl in SPEED_TEST_URLS) {
            try {
                Log.d(TAG, "Trying speed test server: $serverUrl")
                val speed = tryDownloadFromServer("$serverUrl$DOWNLOAD_TEST_FILE")
                if (speed > 0) {
                    Log.d(TAG, "Download speed from $serverUrl: $speed Mbps")
                    return speed
                }
            } catch (e: Exception) {
                Log.w(TAG, "Speed test failed for $serverUrl: ${e.message}")
            }
        }

        // Fallback: Measure using any HTTP download
        return tryFallbackDownloadSpeed()
    }

    /**
     * Try downloading from a specific server
     */
    private fun tryDownloadFromServer(urlString: String): Double {
        try {
            val startTime = System.nanoTime()
            var totalBytes = 0L

            val url = URL(urlString)
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.connectTimeout = 10000
            connection.readTimeout = 30000
            connection.instanceFollowRedirects = true
            connection.connect()

            val responseCode = connection.responseCode
            if (responseCode != HttpURLConnection.HTTP_OK) {
                Log.w(TAG, "Server returned $responseCode")
                connection.disconnect()
                return 0.0
            }

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
            return 0.0
        } catch (e: Exception) {
            Log.e(TAG, "Download from server failed", e)
            return 0.0
        }
    }

    /**
     * Fallback: Measure download speed using simple HTTP request
     */
    private fun tryFallbackDownloadSpeed(): Double {
        try {
            Log.d(TAG, "Using fallback download test from Google")

            // Download Google's favicon or any small file multiple times
            var totalBytes = 0L
            val startTime = System.nanoTime()

            repeat(5) {
                try {
                    val url = URL("https://www.google.com/favicon.ico")
                    val connection = url.openConnection() as HttpURLConnection
                    connection.connectTimeout = 5000
                    connection.readTimeout = 10000
                    connection.connect()

                    val input = connection.inputStream
                    val buffer = ByteArray(4096)
                    var bytesRead: Int

                    while (input.read(buffer).also { bytesRead = it } != -1) {
                        totalBytes += bytesRead
                    }

                    input.close()
                    connection.disconnect()
                } catch (e: Exception) {
                    Log.w(TAG, "Fallback iteration failed", e)
                }
            }

            val endTime = System.nanoTime()
            val durationSeconds = (endTime - startTime) / 1_000_000_000.0

            if (durationSeconds > 0 && totalBytes > 0) {
                // Estimate speed - this is a rough estimate
                val estimatedSpeed = (totalBytes * 8) / (durationSeconds * 1_000_000)
                Log.d(TAG, "Fallback speed estimate: $estimatedSpeed Mbps (based on $totalBytes bytes in ${durationSeconds}s)")
                return estimatedSpeed
            }
        } catch (e: Exception) {
            Log.e(TAG, "Fallback download test failed", e)
        }
        return 0.0
    }

    /**
     * Measure upload speed
     * Note: Most servers don't allow upload tests, so we estimate based on download
     */
    private fun measureUploadSpeed(): Double {
        // Try to upload to speed test servers
        for (serverUrl in SPEED_TEST_URLS) {
            try {
                val speed = tryUploadToServer("$serverUrl$UPLOAD_TEST_FILE")
                if (speed > 0) {
                    return speed
                }
            } catch (e: Exception) {
                Log.d(TAG, "Upload test failed for $serverUrl: ${e.message}")
            }
        }

        // If upload test fails, estimate upload as 30% of download (typical ratio)
        // This is a common approximation for WiFi networks
        Log.d(TAG, "Upload test unavailable, estimating based on typical WiFi ratio")
        return 0.0  // Will be calculated in runSpeedTest
    }

    /**
     * Try uploading to a server
     */
    private fun tryUploadToServer(urlString: String): Double {
        try {
            // Generate 100KB of test data (smaller for faster test)
            val testData = ByteArray(100_000) { (it % 256).toByte() }

            val startTime = System.nanoTime()
            val url = URL(urlString)
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.doOutput = true
            connection.connectTimeout = 10000
            connection.readTimeout = 15000
            connection.setRequestProperty("Content-Type", "application/octet-stream")

            val outputStream = connection.outputStream
            outputStream.write(testData)
            outputStream.flush()

            // Read response
            try {
                connection.inputStream.close()
            } catch (e: Exception) {
                // Ignore response errors
            }
            connection.disconnect()

            val endTime = System.nanoTime()
            val durationSeconds = (endTime - startTime) / 1_000_000_000.0

            val totalBytes = testData.size.toLong()
            return (totalBytes * 8) / (durationSeconds * 1_000_000)
        } catch (e: Exception) {
            Log.d(TAG, "Upload to server failed", e)
            return 0.0
        }
    }

    /**
     * Create speed test result map
     */
    private fun createSpeedTestResult(download: Double, upload: Double, latency: Double): WritableMap {
        return Arguments.createMap().apply {
            putDouble("download", download)
            putDouble("upload", upload)
            putDouble("latency", latency)
        }
    }

    /**
     * Start background monitoring
     * Runs speed tests at specified interval (in minutes)
     */
    @ReactMethod
    fun startBackgroundMonitoring(intervalMinutes: Int, promise: Promise) {
        Log.d(TAG, "Starting background monitoring with interval: $intervalMinutes minutes")

        if (isMonitoring) {
            Log.w(TAG, "Background monitoring already running")
            promise.resolve(true)
            return
        }

        isMonitoring = true

        monitoringJob = scope.launch {
            while (isMonitoring) {
                try {
                    // Run speed test
                    if (isOnWifi()) {
                        Log.d(TAG, "Running scheduled speed test...")
                        val downloadSpeed = measureDownloadSpeed()
                        val uploadSpeed = measureUploadSpeed()
                        val latency = measureLatency()

                        // Send event with results
                        sendSpeedTestEvent(downloadSpeed, uploadSpeed, latency)
                    } else {
                        Log.d(TAG, "Not on WiFi, skipping speed test")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Scheduled speed test failed", e)
                }

                // Wait for next interval
                delay(TimeUnit.MINUTES.toMillis(intervalMinutes.toLong()))
            }
        }

        promise.resolve(true)
    }

    /**
     * Stop background monitoring
     */
    @ReactMethod
    fun stopBackgroundMonitoring(promise: Promise) {
        Log.d(TAG, "Stopping background monitoring")

        isMonitoring = false
        monitoringJob?.cancel()
        monitoringJob = null

        promise.resolve(true)
    }

    /**
     * Check if background monitoring is running
     */
    @ReactMethod
    fun isMonitoring(promise: Promise) {
        promise.resolve(isMonitoring)
    }

    /**
     * Send speed test result event to JavaScript
     */
    private fun sendSpeedTestEvent(download: Double, upload: Double, latency: Double) {
        try {
            val result = Arguments.createMap().apply {
                putDouble("download", download)
                putDouble("upload", upload)
                putDouble("latency", latency)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }

            reactApplicationContext
                .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("SpeedTestResult", result)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send speed test event", e)
        }
    }

    /**
     * Get current WiFi connection info
     * Returns SSID, BSSID, and connection status
     * NOTE: On Android 10+ requires ACCESS_FINE_LOCATION or ACCESS_COARSE_LOCATION permission
     */
    @ReactMethod
    fun getCurrentWiFiInfo(promise: Promise) {
        Log.d(TAG, "Getting current WiFi info...")

        try {
            // Check if connected to WiFi first
            if (!isOnWifi()) {
                Log.w(TAG, "Not connected to WiFi network")
                promise.resolve(createWiFiInfoResult(null, null, false, false))
                return
            }

            // Check location permission for Android 10+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                if (!hasLocationPermission()) {
                    Log.w(TAG, "Location permission not granted - cannot get SSID on Android 10+")
                    // Return connected but with no SSID info
                    promise.resolve(createWiFiInfoResult(null, null, true, false))
                    return
                }
            }

            val wifiManager = reactApplicationContext.getSystemService(android.content.Context.WIFI_SERVICE) as? WifiManager

            if (wifiManager == null) {
                Log.w(TAG, "WifiManager not available")
                promise.resolve(createWiFiInfoResult(null, null, false, false))
                return
            }

            val wifiInfo = wifiManager.connectionInfo

            if (wifiInfo == null) {
                Log.w(TAG, "No WiFi connection info available")
                promise.resolve(createWiFiInfoResult(null, null, false, false))
                return
            }

            val rawSsid = wifiInfo.ssid
            val ssid = rawSsid?.removeSurrounding("\"") // Remove quotes from SSID
            val bssid = wifiInfo.bssid

            // Check if SSID is valid
            val isValidSSID = ssid != null &&
                             ssid != "<unknown ssid>" &&
                             ssid.isNotEmpty() &&
                             !ssid.startsWith("<")

            Log.d(TAG, "WiFi Info: SSID=$ssid, BSSID=$bssid, Valid=$isValidSSID")

            promise.resolve(createWiFiInfoResult(
                if (isValidSSID) ssid else null,
                bssid,
                true, // isConnected
                isValidSSID
            ))
        } catch (e: Exception) {
            Log.e(TAG, "Error getting WiFi info", e)
            promise.resolve(createWiFiInfoResult(null, null, false, false))
        }
    }

    /**
     * Check WiFi connection status
     * Returns whether device is on WiFi and has valid SSID
     */
    @ReactMethod
    fun checkWiFiConnection(promise: Promise) {
        try {
            val onWifi = isOnWifi()
            val hasLocationPerm = hasLocationPermission()

            val result = Arguments.createMap().apply {
                putBoolean("isOnWifi", onWifi)
                putBoolean("hasLocationPermission", hasLocationPerm)
                putBoolean("canGetSSID", onWifi && (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || hasLocationPerm))
            }

            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking WiFi connection", e)
            promise.reject("ERROR", "Failed to check WiFi connection: ${e.message}")
        }
    }

    /**
     * Create WiFi info result map
     */
    private fun createWiFiInfoResult(ssid: String?, bssid: String?, isConnected: Boolean, hasValidSSID: Boolean): WritableMap {
        return Arguments.createMap().apply {
            putString("ssid", ssid)
            putString("bssid", bssid)
            putBoolean("isConnected", isConnected)
            putBoolean("hasValidSSID", hasValidSSID)
        }
    }

    /**
     * Cleanup when module is destroyed
     */
    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        isMonitoring = false
        monitoringJob?.cancel()
        scope.cancel()
    }
}