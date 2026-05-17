package de.pushit.client

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.ProgressBar
import android.widget.TextView
import androidx.core.app.NotificationCompat
import okhttp3.*
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class PushItService : Service() {

    companion object {
        const val CHANNEL_ID         = "pushit_service"
        const val OVERLAY_CHANNEL_ID = "pushit_overlay"
        const val NOTIF_ID           = 1
        const val OVERLAY_NOTIF_ID   = 2
        @Volatile var isConnected = false
    }

    private var ws: WebSocket? = null
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .pingInterval(30, TimeUnit.SECONDS)
        .build()
    private val handler = Handler(Looper.getMainLooper())
    private var reconnectRunnable: Runnable? = null
    private var running = false

    private var currentOverlayView: View? = null
    private var overlayCloseRunnable: Runnable? = null
    private var overlayProgressRunnable: Runnable? = null

    // ---------------------------------------------------------------------------
    // Lifecycle
    // ---------------------------------------------------------------------------

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        createOverlayChannel()
        startForeground(NOTIF_ID, buildStatusNotification("Verbindung wird hergestellt…"))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        running = true
        connect()
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        cancelReconnect()
        ws?.close(1000, "Service gestoppt")
        isConnected = false
        dismissCurrentOverlay()
        super.onDestroy()
    }

    // ---------------------------------------------------------------------------
    // WebSocket
    // ---------------------------------------------------------------------------

    private fun connect() {
        if (!Config.isConfigured(this)) {
            updateNotification("Nicht konfiguriert")
            return
        }

        val base   = Config.backendUrl(this).replace("http://", "ws://").replace("https://", "wss://")
        val apiKey = URLEncoder.encode(Config.apiKey(this), "UTF-8")
        val devId  = URLEncoder.encode(Config.deviceId(this), "UTF-8")
        val url    = "$base/api/v1/ws?apiKey=$apiKey&deviceId=$devId"

        val request = Request.Builder().url(url).build()
        ws = client.newWebSocket(request, object : WebSocketListener() {

            override fun onOpen(webSocket: WebSocket, response: Response) {
                isConnected = true
                updateNotification("Verbunden")
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleMessage(text)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                isConnected = false
                updateNotification("Getrennt")
                scheduleReconnect()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                isConnected = false
                val detail = t.message?.take(60) ?: t.javaClass.simpleName
                updateNotification("Fehler: $detail")
                scheduleReconnect()
            }
        })
    }

    private fun handleMessage(text: String) {
        try {
            val json = JSONObject(text)
            when (json.optString("type")) {
                "notification" -> showOverlay(json)
                "error"        -> updateNotification("Fehler: ${json.optString("message")}")
            }
        } catch (_: Exception) { }
    }

    private fun showOverlay(json: JSONObject) {
        if (Settings.canDrawOverlays(this)) {
            // Direkt als WindowManager-Overlay – kein Notification-Banner nötig
            handler.post { showOverlayWindow(json) }
        } else {
            // Fallback: Full-Screen Intent über Notification
            showOverlayNotification(json)
        }
    }

    // ---------------------------------------------------------------------------
    // WindowManager-Overlay (direkt, ohne Notification-Umweg)
    // ---------------------------------------------------------------------------

    private fun showOverlayWindow(json: JSONObject) {
        val title    = json.optString("title", "Neue Nachricht")
        val body     = json.optString("body", "")
        val category = json.optString("category", "info")
        val ttlMs    = json.optLong("ttlSeconds", 30).coerceAtMost(60) * 1000L

        val wm = getSystemService(WindowManager::class.java)
        dismissCurrentOverlay()

        val view = LayoutInflater.from(this).inflate(R.layout.activity_overlay, null)

        view.findViewById<TextView>(R.id.tvCategory).text = when (category) {
            "warning"   -> "⚠  Warnung"
            "emergency" -> "🚨  Notfall"
            else        -> "ℹ  Information"
        }
        view.findViewById<TextView>(R.id.tvTitle).text = title
        view.findViewById<TextView>(R.id.tvBody).text  = body
        applyOverlayCategory(view, category)

        view.setOnClickListener { dismissCurrentOverlay() }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            PixelFormat.TRANSLUCENT
        )

        wm.addView(view, params)
        currentOverlayView = view

        startOverlayProgress(view, ttlMs)
        overlayCloseRunnable = Runnable { dismissCurrentOverlay() }.also {
            handler.postDelayed(it, ttlMs)
        }
    }

    private fun dismissCurrentOverlay() {
        overlayCloseRunnable?.let { handler.removeCallbacks(it) }
        overlayProgressRunnable?.let { handler.removeCallbacks(it) }
        overlayCloseRunnable = null
        overlayProgressRunnable = null
        currentOverlayView?.let {
            try { getSystemService(WindowManager::class.java).removeView(it) } catch (_: Exception) {}
        }
        currentOverlayView = null
    }

    private fun applyOverlayCategory(view: View, category: String) {
        val root     = view.findViewById<View>(R.id.root)
        val tvTitle  = view.findViewById<TextView>(R.id.tvTitle)
        val progress = view.findViewById<ProgressBar>(R.id.progressBar)

        when (category) {
            "emergency" -> {
                root.setBackgroundColor(Color.parseColor("#1a0000"))
                tvTitle.setTextColor(Color.parseColor("#ff4444"))
                tvTitle.textSize = 36f
                progress.progressTintList = ColorStateList.valueOf(Color.parseColor("#ef4444"))
            }
            "warning" -> {
                root.setBackgroundColor(Color.parseColor("#1e1500"))
                tvTitle.setTextColor(Color.parseColor("#fbbf24"))
                tvTitle.textSize = 24f
                progress.progressTintList = ColorStateList.valueOf(Color.parseColor("#f59e0b"))
            }
            else -> {
                root.setBackgroundColor(Color.parseColor("#1a1a2e"))
                tvTitle.setTextColor(Color.WHITE)
                tvTitle.textSize = 22f
                progress.progressTintList = ColorStateList.valueOf(Color.parseColor("#7c83ff"))
            }
        }
    }

    private fun startOverlayProgress(view: View, ttlMs: Long) {
        val pb = view.findViewById<ProgressBar>(R.id.progressBar)
        pb.max = 1000
        val startTime = System.currentTimeMillis()

        fun tick() {
            val elapsed   = System.currentTimeMillis() - startTime
            val remaining = ((1 - elapsed.toFloat() / ttlMs) * 1000).toInt().coerceAtLeast(0)
            pb.progress = remaining
            if (remaining > 0) {
                overlayProgressRunnable = Runnable { tick() }.also { handler.postDelayed(it, 100) }
            }
        }
        tick()
    }

    // ---------------------------------------------------------------------------
    // Fallback: Notification mit Full-Screen Intent
    // ---------------------------------------------------------------------------

    private fun showOverlayNotification(json: JSONObject) {
        val activityIntent = Intent(this, OverlayActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("title",      json.optString("title", "Neue Nachricht"))
            putExtra("body",       json.optString("body", ""))
            putExtra("category",   json.optString("category", "info"))
            putExtra("ttlSeconds", json.optLong("ttlSeconds", 30))
        }
        val pendingIntent = PendingIntent.getActivity(
            this, System.currentTimeMillis().toInt(), activityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(this, OVERLAY_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(json.optString("title", "Neue Nachricht"))
            .setContentText(json.optString("body", ""))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setFullScreenIntent(pendingIntent, true)
            .setAutoCancel(true)
            .build()
        getSystemService(NotificationManager::class.java).notify(OVERLAY_NOTIF_ID, notification)
    }

    // ---------------------------------------------------------------------------
    // Reconnect
    // ---------------------------------------------------------------------------

    private fun scheduleReconnect() {
        if (!running) return
        cancelReconnect()
        reconnectRunnable = Runnable { if (running) connect() }.also {
            handler.postDelayed(it, 10_000)
        }
    }

    private fun cancelReconnect() {
        reconnectRunnable?.let { handler.removeCallbacks(it) }
        reconnectRunnable = null
    }

    // ---------------------------------------------------------------------------
    // Foreground-Notification
    // ---------------------------------------------------------------------------

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID, "PushIt Service",
            NotificationManager.IMPORTANCE_LOW
        ).apply { description = "WebSocket-Verbindung zum PushIt-Server" }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun createOverlayChannel() {
        val channel = NotificationChannel(
            OVERLAY_CHANNEL_ID, "PushIt Meldungen",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Eingehende PushIt-Benachrichtigungen"
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildStatusNotification(text: String) =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("PushIt")
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_notification)
            .setOngoing(true)
            .setContentIntent(
                PendingIntent.getActivity(
                    this, 0,
                    Intent(this, MainActivity::class.java),
                    PendingIntent.FLAG_IMMUTABLE
                )
            )
            .build()

    private fun updateNotification(text: String) {
        getSystemService(NotificationManager::class.java).notify(NOTIF_ID, buildStatusNotification(text))
    }
}
