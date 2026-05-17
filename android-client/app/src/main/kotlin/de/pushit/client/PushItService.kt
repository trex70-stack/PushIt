package de.pushit.client

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
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

        val base    = Config.backendUrl(this).replace("http://", "ws://").replace("https://", "wss://")
        val apiKey  = URLEncoder.encode(Config.apiKey(this), "UTF-8")
        val devId   = URLEncoder.encode(Config.deviceId(this), "UTF-8")
        val url     = "$base/api/v1/ws?apiKey=$apiKey&deviceId=$devId"

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
        getSystemService(NotificationManager::class.java)
            .notify(OVERLAY_NOTIF_ID, notification)
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
    // Foreground notification
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
        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(NOTIF_ID, buildStatusNotification(text))
    }
}
