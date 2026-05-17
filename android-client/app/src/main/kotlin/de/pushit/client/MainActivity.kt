package de.pushit.client

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import kotlinx.coroutines.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var pairingJob: Job? = null

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    // Layouts
    private lateinit var layoutSetup: LinearLayout
    private lateinit var layoutPairing: LinearLayout
    private lateinit var layoutConnected: LinearLayout

    // Setup
    private lateinit var etBackendUrl: EditText
    private lateinit var tvSetupError: TextView

    // Pairing
    private lateinit var tvPairingCode: TextView
    private lateinit var tvPairingUrl: TextView
    private lateinit var tvPairingStatus: TextView
    private lateinit var ivQrCode: ImageView

    // Connected
    private lateinit var tvConnStatus: TextView
    private lateinit var tvConnBackend: TextView

    // Status-Poller für den Verbunden-Screen
    private val statusRunnable = object : Runnable {
        override fun run() {
            if (layoutConnected.visibility == View.VISIBLE) {
                updateConnStatus()
                layoutConnected.postDelayed(this, 2_000)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        layoutSetup     = findViewById(R.id.layoutSetup)
        layoutPairing   = findViewById(R.id.layoutPairing)
        layoutConnected = findViewById(R.id.layoutConnected)

        etBackendUrl    = findViewById(R.id.etBackendUrl)
        tvSetupError    = findViewById(R.id.tvSetupError)

        tvPairingCode   = findViewById(R.id.tvPairingCode)
        tvPairingUrl    = findViewById(R.id.tvPairingUrl)
        tvPairingStatus = findViewById(R.id.tvPairingStatus)
        ivQrCode        = findViewById(R.id.ivQrCode)

        tvConnStatus    = findViewById(R.id.tvConnStatus)
        tvConnBackend   = findViewById(R.id.tvConnBackend)

        findViewById<Button>(R.id.btnStartPairing).setOnClickListener { startPairing() }
        findViewById<Button>(R.id.btnCancelPairing).setOnClickListener { cancelPairing() }
        findViewById<Button>(R.id.btnReset).setOnClickListener { resetConfig() }

        requestPermissionsIfNeeded()

        if (Config.isConfigured(this)) {
            showConnected()
            startPushItService()
        } else {
            showSetup()
        }
    }

    private fun requestPermissionsIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 100
                )
            }
        }
        val pm = getSystemService(PowerManager::class.java)
        if (!pm.isIgnoringBatteryOptimizations(packageName)) {
            startActivity(
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
            )
        }
        if (!Settings.canDrawOverlays(this)) {
            startActivity(
                Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
                    data = Uri.parse("package:$packageName")
                }
            )
        }
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    // ─── Screen-Übergänge ───────────────────────────────────────────────────────

    private fun showSetup() {
        layoutSetup.visibility     = View.VISIBLE
        layoutPairing.visibility   = View.GONE
        layoutConnected.visibility = View.GONE
        etBackendUrl.setText(Config.backendUrl(this))
        tvSetupError.visibility = View.GONE
    }

    private fun showPairing(code: String, backendUrl: String) {
        layoutSetup.visibility     = View.GONE
        layoutPairing.visibility   = View.VISIBLE
        layoutConnected.visibility = View.GONE
        tvPairingCode.text   = code
        tvPairingUrl.text    = "$backendUrl/pair/$code"
        tvPairingStatus.text = "Warte auf Bestätigung…"
        ivQrCode.setImageBitmap(generateQrBitmap("$backendUrl/pair/$code"))
    }

    private fun showConnected() {
        layoutSetup.visibility     = View.GONE
        layoutPairing.visibility   = View.GONE
        layoutConnected.visibility = View.VISIBLE
        tvConnBackend.text = Config.backendUrl(this)
        updateConnStatus()
        layoutConnected.post(statusRunnable)
    }

    private fun updateConnStatus() {
        val connected = PushItService.isConnected
        tvConnStatus.text = if (connected) "● Verbunden" else "○ Verbindung wird hergestellt…"
        tvConnStatus.setTextColor(
            if (connected) getColor(android.R.color.holo_green_light)
            else getColor(android.R.color.darker_gray)
        )
    }

    // ─── Pairing-Flow ───────────────────────────────────────────────────────────

    private fun startPairing() {
        val url = etBackendUrl.text.toString().trim().trimEnd('/')
        if (url.isEmpty()) {
            showSetupError("Bitte Backend-URL eingeben.")
            return
        }
        tvSetupError.visibility = View.GONE

        scope.launch {
            try {
                val body = """{"deviceType":"fire_tv"}"""
                    .toRequestBody("application/json".toMediaType())
                val response = withContext(Dispatchers.IO) {
                    httpClient.newCall(
                        Request.Builder().url("$url/api/v1/pair/init").post(body).build()
                    ).execute()
                }
                if (!response.isSuccessful) {
                    showSetupError("Server antwortet nicht (${response.code}). URL korrekt?")
                    return@launch
                }
                val json = JSONObject(response.body!!.string())
                val code = json.getString("code")
                showPairing(code, url)
                pollPairingStatus(url, code)
            } catch (e: Exception) {
                showSetupError("Verbindung fehlgeschlagen: ${e.message?.take(60)}")
            }
        }
    }

    private fun pollPairingStatus(backendUrl: String, code: String) {
        pairingJob = scope.launch {
            while (isActive) {
                delay(3_000)
                try {
                    val response = withContext(Dispatchers.IO) {
                        httpClient.newCall(
                            Request.Builder().url("$backendUrl/api/v1/pair/$code/status").get().build()
                        ).execute()
                    }
                    when {
                        response.code == 410 -> {
                            tvPairingStatus.text = "Code abgelaufen – bitte Pairing neu starten."
                            return@launch
                        }
                        response.isSuccessful -> {
                            val json = JSONObject(response.body!!.string())
                            if (json.getBoolean("done")) {
                                Config.save(
                                    this@MainActivity,
                                    backendUrl,
                                    json.getString("deviceId"),
                                    json.getString("apiKey")
                                )
                                showConnected()
                                startPushItService()
                                return@launch
                            }
                        }
                    }
                } catch (_: Exception) {
                    // kurz offline – einfach weiter pollen
                }
            }
        }
    }

    private fun cancelPairing() {
        pairingJob?.cancel()
        showSetup()
    }

    private fun resetConfig() {
        stopService(Intent(this, PushItService::class.java))
        Config.clear(this)
        showSetup()
    }

    // ─── Hilfsmethoden ──────────────────────────────────────────────────────────

    private fun showSetupError(msg: String) {
        tvSetupError.text = msg
        tvSetupError.visibility = View.VISIBLE
    }

    private fun startPushItService() {
        startForegroundService(Intent(this, PushItService::class.java))
    }

    private fun generateQrBitmap(content: String, sizePx: Int = 400): Bitmap {
        val hints = mapOf(EncodeHintType.MARGIN to 1)
        val bits = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, sizePx, sizePx, hints)
        val bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.RGB_565)
        for (x in 0 until sizePx) {
            for (y in 0 until sizePx) {
                bmp.setPixel(x, y, if (bits[x, y]) Color.BLACK else Color.WHITE)
            }
        }
        return bmp
    }
}
