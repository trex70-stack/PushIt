import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/index.js";
import { pairingCodes, devices, apiKeys } from "../db/schema.js";
import { eq, and, gt } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth.js";
import { generatePairingCode, generateApiKey } from "../lib/crypto.js";

const PAIRING_TTL_MS = 10 * 60 * 1000; // 10 Minuten

const deviceTypeValues = [
  "desktop_windows", "desktop_macos", "desktop_linux",
  "desktop_electron", "desktop_tauri",
  "samsung_tv", "ios", "android", "fire_tv",
] as const;

export async function pairRoutes(app: FastifyInstance) {
  // Schritt 1: Gerät initiiert Pairing und erhält einen Code
  app.post("/pair/init", async (request, reply) => {
    const body = z.object({
      deviceType: z.enum(deviceTypeValues),
    }).safeParse(request.body);

    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const code = generatePairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);

    await db.insert(pairingCodes).values({
      code,
      deviceType: body.data.deviceType,
      expiresAt,
    });

    return reply.code(201).send({ code, expiresAt });
  });

  // Schritt 2: Browser ruft Code-Details ab (für die Admin-Bestätigungsseite)
  app.get("/pair/:code", async (request, reply) => {
    const { code } = request.params as { code: string };

    const result = await db
      .select()
      .from(pairingCodes)
      .where(and(eq(pairingCodes.code, code), gt(pairingCodes.expiresAt, new Date())))
      .limit(1);

    if (!result[0]) return reply.code(404).send({ error: "Pairing-Code nicht gefunden oder abgelaufen" });

    const entry = result[0];
    return {
      deviceType: entry.deviceType,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      completed: !!entry.completedAt,
    };
  });

  // Schritt 3: Admin bestätigt das Pairing und legt Gerät + API-Key an
  app.post("/pair/:code/complete", { preHandler: requireAdmin }, async (request, reply) => {
    const { code } = request.params as { code: string };
    const body = z.object({
      deviceName: z.string().min(1).max(255),
    }).safeParse(request.body);

    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const entry = await db
      .select()
      .from(pairingCodes)
      .where(and(eq(pairingCodes.code, code), gt(pairingCodes.expiresAt, new Date())))
      .limit(1)
      .then((r) => r[0]);

    if (!entry) return reply.code(404).send({ error: "Pairing-Code nicht gefunden oder abgelaufen" });
    if (entry.completedAt) return reply.code(409).send({ error: "Pairing bereits abgeschlossen" });

    const { key, hash } = generateApiKey();

    const [newDevice] = await db.insert(devices).values({
      name: body.data.deviceName,
      type: entry.deviceType,
    }).returning();

    await db.insert(apiKeys).values({
      keyHash: hash,
      label: `Pairing: ${body.data.deviceName}`,
      createdById: request.user.id,
    });

    await db
      .update(pairingCodes)
      .set({
        completedAt: new Date(),
        deviceId: newDevice.id,
        pendingApiKey: key,
      })
      .where(eq(pairingCodes.code, code));

    return { success: true };
  });

  // Schritt 4: Gerät pollt diesen Endpunkt bis Pairing abgeschlossen ist
  app.get("/pair/:code/status", async (request, reply) => {
    const { code } = request.params as { code: string };

    const entry = await db
      .select()
      .from(pairingCodes)
      .where(eq(pairingCodes.code, code))
      .limit(1)
      .then((r) => r[0]);

    if (!entry) return reply.code(404).send({ error: "Pairing-Code nicht gefunden" });

    if (!entry.completedAt || !entry.pendingApiKey) {
      if (entry.expiresAt < new Date()) {
        return reply.code(410).send({ error: "Pairing-Code abgelaufen" });
      }
      return { done: false };
    }

    // API-Key einmalig zurückgeben und danach aus der DB entfernen
    const apiKey = entry.pendingApiKey;
    await db
      .update(pairingCodes)
      .set({ pendingApiKey: null })
      .where(eq(pairingCodes.code, code));

    return {
      done: true,
      deviceId: entry.deviceId,
      apiKey,
    };
  });
}
