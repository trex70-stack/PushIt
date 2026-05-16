import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { apiKeys, users, devices } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { hashApiKey } from "../lib/crypto.js";
import { wsManager } from "../lib/ws-manager.js";

export async function wsRoutes(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, async (socket, request) => {
    // request.query ist bei WS-Upgrades nicht immer befüllt – URL direkt parsen
    const rawQuery = request.url.includes("?") ? request.url.split("?")[1] : "";
    const params = new URLSearchParams(rawQuery);
    const apiKey = params.get("apiKey") ?? "";
    const deviceId = params.get("deviceId") ?? "";

    app.log.info(`[WS] Verbindungsversuch deviceId=${deviceId} keyPrefix=${apiKey.slice(0, 8)}…`);

    if (!apiKey || !deviceId) {
      socket.send(JSON.stringify({ type: "error", message: "apiKey und deviceId erforderlich" }));
      socket.close();
      return;
    }

    // API-Key validieren
    const hash = hashApiKey(apiKey);
    const keyResult = await db
      .select({ id: apiKeys.id, isActive: apiKeys.isActive, expiresAt: apiKeys.expiresAt })
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, hash))
      .limit(1);

    const key = keyResult[0];
    if (!key || !key.isActive || (key.expiresAt && key.expiresAt < new Date())) {
      socket.send(JSON.stringify({ type: "error", message: "Ungültiger oder abgelaufener API-Key" }));
      socket.close();
      return;
    }

    // Device prüfen
    const deviceResult = await db
      .select({ id: devices.id, name: devices.name, type: devices.type, isActive: devices.isActive })
      .from(devices)
      .where(eq(devices.id, deviceId))
      .limit(1);

    const device = deviceResult[0];
    const wsClientTypes = ["desktop_electron", "desktop_tauri", "fire_tv"];
    if (!device || !wsClientTypes.includes(device.type)) {
      socket.send(JSON.stringify({ type: "error", message: "Gerät nicht gefunden oder falscher Typ" }));
      socket.close();
      return;
    }

    if (!device.isActive) {
      socket.send(JSON.stringify({ type: "error", message: "Gerät ist deaktiviert" }));
      socket.close();
      return;
    }

    wsManager.add(deviceId, socket);
    socket.send(JSON.stringify({ type: "connected", deviceName: device.name }));
    app.log.info(`[WS] Desktop-Client verbunden: ${device.name} (${deviceId})`);

    socket.on("close", () => {
      wsManager.remove(deviceId);
      app.log.info(`[WS] Desktop-Client getrennt: ${deviceId}`);
    });

    socket.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "ping") socket.send(JSON.stringify({ type: "pong" }));
      } catch { /* ignorieren */ }
    });
  });
}
