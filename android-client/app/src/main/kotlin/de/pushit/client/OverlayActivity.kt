package de.pushit.client

import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class OverlayActivity : AppCompatActivity() {

    private val handler = Handler(Looper.getMainLooper())
    private var closeRunnable: Runnable? = null
    private var progressRunnable: Runnable? = null
    private var ttlMs = 30_000L
    private var startTime = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Über Sperrbildschirm und Screen einschalten
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )

        setContentView(R.layout.activity_overlay)

        val title    = intent.getStringExtra("title") ?: "Neue Nachricht"
        val body     = intent.getStringExtra("body") ?: ""
        val category = intent.getStringExtra("category") ?: "info"
        val ttlSec   = intent.getLongExtra("ttlSeconds", 30).coerceAtMost(60)
        ttlMs = ttlSec * 1000L

        applyCategory(category)

        findViewById<TextView>(R.id.tvTitle).text = title
        findViewById<TextView>(R.id.tvBody).text  = body
        findViewById<TextView>(R.id.tvCategory).text = when (category) {
            "warning"   -> "⚠  Warnung"
            "emergency" -> "🚨  Notfall"
            else        -> "ℹ  Information"
        }

        startTime = System.currentTimeMillis()
        startProgressBar()

        closeRunnable = Runnable { finish() }.also {
            handler.postDelayed(it, ttlMs)
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        onCreate(null)
    }

    override fun onDestroy() {
        closeRunnable?.let { handler.removeCallbacks(it) }
        progressRunnable?.let { handler.removeCallbacks(it) }
        super.onDestroy()
    }

    // D-Pad OK oder Zurück schließt das Overlay
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK ||
            keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
            keyCode == KeyEvent.KEYCODE_ENTER) {
            finish()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    // ---------------------------------------------------------------------------
    // Kategorie-Styling
    // ---------------------------------------------------------------------------

    private fun applyCategory(category: String) {
        val root      = findViewById<View>(R.id.root)
        val tvTitle   = findViewById<TextView>(R.id.tvTitle)
        val progress  = findViewById<ProgressBar>(R.id.progressBar)

        when (category) {
            "emergency" -> {
                root.setBackgroundColor(Color.parseColor("#1a0000"))
                tvTitle.setTextColor(Color.parseColor("#ff4444"))
                tvTitle.textSize = 36f
                progress.progressTintList =
                    android.content.res.ColorStateList.valueOf(Color.parseColor("#ef4444"))
            }
            "warning" -> {
                root.setBackgroundColor(Color.parseColor("#1e1500"))
                tvTitle.setTextColor(Color.parseColor("#fbbf24"))
                tvTitle.textSize = 24f
                progress.progressTintList =
                    android.content.res.ColorStateList.valueOf(Color.parseColor("#f59e0b"))
            }
            else -> {
                root.setBackgroundColor(Color.parseColor("#1a1a2e"))
                tvTitle.setTextColor(Color.WHITE)
                tvTitle.textSize = 22f
                progress.progressTintList =
                    android.content.res.ColorStateList.valueOf(Color.parseColor("#7c83ff"))
            }
        }
    }

    // ---------------------------------------------------------------------------
    // Fortschrittsbalken
    // ---------------------------------------------------------------------------

    private fun startProgressBar() {
        val pb = findViewById<ProgressBar>(R.id.progressBar)
        pb.max = 1000

        fun tick() {
            val elapsed = System.currentTimeMillis() - startTime
            val remaining = ((1 - elapsed.toFloat() / ttlMs) * 1000).toInt().coerceAtLeast(0)
            pb.progress = remaining
            if (remaining > 0) {
                progressRunnable = Runnable { tick() }.also { handler.postDelayed(it, 100) }
            }
        }
        tick()
    }
}
