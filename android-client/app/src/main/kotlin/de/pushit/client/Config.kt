package de.pushit.client

import android.content.Context

object Config {
    private const val PREFS = "pushit_prefs"

    fun save(ctx: Context, backendUrl: String, deviceId: String, apiKey: String) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("backendUrl", backendUrl)
            .putString("deviceId", deviceId)
            .putString("apiKey", apiKey)
            .apply()
    }

    fun backendUrl(ctx: Context) =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("backendUrl", "") ?: ""

    fun deviceId(ctx: Context) =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("deviceId", "") ?: ""

    fun apiKey(ctx: Context) =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("apiKey", "") ?: ""

    fun isConfigured(ctx: Context) =
        backendUrl(ctx).isNotEmpty() && deviceId(ctx).isNotEmpty() && apiKey(ctx).isNotEmpty()

    fun clear(ctx: Context) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }
}
