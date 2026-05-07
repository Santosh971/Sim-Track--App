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

        // Reliable CDN endpoints for speed testing with larger files
        // Cloudflare provides a reliable speed test endpoint with configurable file size
        private val SPEED_TEST_URLS = listOf(
            // Cloudflare speed test - 10MB download (most reliable)
            "https://speed.cloudflare.com/__down?bytes=10000000",
            // Cloudflare speed test - 5MB fallback
            "https://speed.cloudflare.com/__down?bytes=5000000",
            // Netflix Fast.com test files
            "https://fast.com/0.5mb",
            // Linode speed test
            "https://speedtest.dallas.linode.com/10MB.dallas"
        )

        // Test duration in seconds
        private const val TEST_DURATION_SECONDS = 10L
        // Minimum bytes to download for valid result
        private const val MIN_BYTES_FOR_VALID_TEST = 100000L // 100KB minimum
        // Timeout in milliseconds
        private const val CONNECT_TIMEOUT = 10000
        private const val READ_TIMEOUT = 30000
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
                    withContext(Dispatchers.Main) {
                        promise.resolve(createSpeedTestResult(0.0, 0.0, 0.0))
                    }
                    return@launch
                }

                Log.d(TAG, "On WiFi, starting speed test...")

                // Test latency first
                val latency = measureLatency()
                Log.d(TAG, "Latency: $latency ms")

                // Test download speed with improved method
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
        var successCount = 0
        val iterations = 3

        repeat(iterations) {
            try {
                val startTime = System.currentTimeMillis()
                val url = URL("https://www.google.com")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "HEAD"
                connection.connectTimeout = 5000
                connection.readTimeout = 5000
                connection.instanceFollowRedirects = true
                connection.connect()
                val responseCode = connection.responseCode
                connection.disconnect()
                val endTime = System.currentTimeMillis()

                if (responseCode == HttpURLConnection.HTTP_OK || responseCode == 301 || responseCode == 302) {
                    totalLatency += (endTime - startTime)
                    successCount++
                    Log.d(TAG, "Latency iteration: ${endTime - startTime}ms")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Latency test iteration failed", e)
            }
        }

        val avgLatency = if (successCount > 0) totalLatency.toDouble() / successCount else 0.0
        Log.d(TAG, "Average latency: $avgLatency ms (from $successCount successful tests)")
        return avgLatency
    }

    /**
     * Measure download speed by downloading test data
     * Uses multiple reliable CDN servers with large files
     */
    private fun measureDownloadSpeed(): Double {
        // Try each speed test URL until one works
        for (testUrl in SPEED_TEST_URLS) {
            try {
                Log.d(TAG, "Trying speed test URL: $testUrl")
                val speed = downloadFromUrl(testUrl)
                if (speed > 0) {
                    Log.d(TAG, "Download speed from $testUrl: $speed Mbps")
                    return speed
                }
            } catch (e: Exception) {
                Log.w(TAG, "Speed test failed for $testUrl: ${e.message}")
            }
        }

        // All primary tests failed - try fallback with larger download
        return tryFallbackDownloadSpeed()
    }

    /**
     * Download from a specific URL and measure speed
     * Downloads for up to TEST_DURATION_SECONDS or until EOF
     */
    private fun downloadFromUrl(urlString: String): Double {
        var connection: HttpURLConnection? = null
        var inputStream: java.io.InputStream? = null

        try {
            val startTime = System.nanoTime()
            var totalBytes = 0L

            val url = URL(urlString)
            connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.connectTimeout = CONNECT_TIMEOUT
            connection.readTimeout = READ_TIMEOUT
            connection.instanceFollowRedirects = true
            connection.connect()

            val responseCode = connection.responseCode
            if (responseCode != HttpURLConnection.HTTP_OK) {
                Log.w(TAG, "Server returned $responseCode for $urlString")
                return 0.0
            }

            // Get expected content length if available
            val contentLength = connection.contentLengthLong
            Log.d(TAG, "Content length: $contentLength bytes")

            inputStream = connection.inputStream
            val buffer = ByteArray(8192)
            var bytesRead: Int

            // Download for up to TEST_DURATION_SECONDS
            val maxDuration = TimeUnit.SECONDS.toNanos(TEST_DURATION_SECONDS)
            var elapsed = 0L

            while (elapsed < maxDuration) {
                bytesRead = inputStream.read(buffer)
                if (bytesRead == -1) break
                totalBytes += bytesRead
                elapsed = System.nanoTime() - startTime

                // Log progress every 1MB
                if (totalBytes % 1_000_000 < 8192) {
                    Log.d(TAG, "Downloaded ${totalBytes / 1_000_000}MB, elapsed: ${elapsed / 1_000_000_000.0}s")
                }
            }

            val endTime = System.nanoTime()
            val durationSeconds = (endTime - startTime) / 1_000_000_000.0

            Log.d(TAG, "Download complete: $totalBytes bytes in ${durationSeconds}s")

            // Validate - need minimum bytes for accurate result
            if (durationSeconds > 0 && totalBytes >= MIN_BYTES_FOR_VALID_TEST) {
                val speedMbps = (totalBytes * 8.0) / (durationSeconds * 1_000_000.0)
                Log.d(TAG, "Calculated speed: $speedMbps Mbps (${totalBytes} bytes / ${durationSeconds}s)")
                return speedMbps
            } else if (totalBytes < MIN_BYTES_FOR_VALID_TEST) {
                Log.w(TAG, "Downloaded too few bytes ($totalBytes) for accurate measurement")
            }
            return 0.0
        } catch (e: Exception) {
            Log.e(TAG, "Download from $urlString failed", e)
            return 0.0
        } finally {
            try {
                inputStream?.close()
            } catch (e: Exception) {
                // Ignore
            }
            connection?.disconnect()
        }
    }

    /**
     * Fallback: Measure download speed using multiple parallel downloads
     */
    private fun tryFallbackDownloadSpeed(): Double {
        Log.d(TAG, "Using fallback download test with parallel downloads")

        try {
            // Use Cloudflare with 5MB file as most reliable fallback
            val testUrl = "https://speed.cloudflare.com/__down?bytes=5000000"

            val totalBytes = java.util.concurrent.atomic.AtomicLong(0L)
            val startTime = System.nanoTime()

            // Run 3 parallel downloads to better saturate connection
            val jobs = List(3) {
                scope.async {
                    try {
                        val bytes = downloadBytesOnly(testUrl, 5)
                        totalBytes.addAndGet(bytes)
                    } catch (e: Exception) {
                        Log.w(TAG, "Parallel download failed", e)
                    }
                }
            }

            // Wait for all downloads
            runBlocking {
                jobs.awaitAll()
            }

            val endTime = System.nanoTime()
            val durationSeconds = (endTime - startTime) / 1_000_000_000.0
            val finalBytes = totalBytes.get()

            if (durationSeconds > 0 && finalBytes >= MIN_BYTES_FOR_VALID_TEST) {
                val speedMbps = (finalBytes * 8.0) / (durationSeconds * 1_000_000.0)
                Log.d(TAG, "Fallback speed: $speedMbps Mbps (${finalBytes} bytes / ${durationSeconds}s)")
                return speedMbps
            }
        } catch (e: Exception) {
            Log.e(TAG, "Fallback download test failed", e)
        }

        return 0.0
    }

    /**
     * Download bytes from URL (helper for parallel downloads)
     */
    private fun downloadBytesOnly(urlString: String, timeoutSeconds: Long): Long {
        var connection: HttpURLConnection? = null
        var inputStream: java.io.InputStream? = null

        try {
            val url = URL(urlString)
            connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.connectTimeout = CONNECT_TIMEOUT
            connection.readTimeout = (timeoutSeconds * 1000).toInt()
            connection.connect()

            if (connection.responseCode != HttpURLConnection.HTTP_OK) {
                return 0L
            }

            inputStream = connection.inputStream
            val buffer = ByteArray(8192)
            var totalBytes = 0L
            var bytesRead: Int

            val startTime = System.nanoTime()
            val maxDuration = TimeUnit.SECONDS.toNanos(timeoutSeconds)

            while ((System.nanoTime() - startTime) < maxDuration) {
                bytesRead = inputStream.read(buffer)
                if (bytesRead == -1) break
                totalBytes += bytesRead
            }

            return totalBytes
        } catch (e: Exception) {
            Log.w(TAG, "downloadBytesOnly failed", e)
            return 0L
        } finally {
            try {
                inputStream?.close()
            } catch (e: Exception) {}
            connection?.disconnect()
        }
    }

    /**
     * Measure upload speed
     * Uses Cloudflare's upload endpoint if available
     */
    private fun measureUploadSpeed(): Double {
        try {
            // Try Cloudflare upload test
            val uploadUrl = "https://speed.cloudflare.com/__up"
            val testData = ByteArray(500_000) { (it % 256).toByte() } // 500KB test data

            val startTime = System.nanoTime()
            val url = URL(uploadUrl)
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.doOutput = true
            connection.connectTimeout = CONNECT_TIMEOUT
            connection.readTimeout = READ_TIMEOUT
            connection.setRequestProperty("Content-Type", "application/octet-stream")

            val outputStream = connection.outputStream
            outputStream.write(testData)
            outputStream.flush()

            // Read response (ignore content)
            try {
                connection.inputStream.close()
            } catch (e: Exception) {
                // Ignore
            }
            connection.disconnect()

            val endTime = System.nanoTime()
            val durationSeconds = (endTime - startTime) / 1_000_000_000.0

            val speedMbps = (testData.size * 8.0) / (durationSeconds * 1_000_000.0)
            Log.d(TAG, "Upload speed: $speedMbps Mbps")
            return speedMbps
        } catch (e: Exception) {
            Log.d(TAG, "Upload test failed, will estimate from download: ${e.message}")
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