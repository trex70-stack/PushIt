package de.pushit.client

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED && Config.isConfigured(context)) {
            context.startForegroundService(Intent(context, PushItService::class.java))
        }
    }
}
