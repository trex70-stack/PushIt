import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/index.js";
import { devices } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { notificationDeliveries } from "../db/schema.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const deviceTypeValues = [
  "desktop_windows", "desktop_macos", "desktop_linux",
  "desktop_electron", "desktop_tauri",
  "samsung_tv", "ios", "android", "fire_tv",
] as const;

const createSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(deviceTypeValues),
  platformId: z.string().max(512).optional(),
  platformMeta: z.record(z.unknown()).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
  platformId: z.string().max(512).optional(),
  platformMeta: z.record(z.unknown()).optional(),
});

export async function deviceRoutes(app: FastifyInstance) {
  app.get("/devices", { preHandler: requireAuth }, async () => {
    return db.select().from(devices).orderBy(devices.createdAt);
  });

  app.get("/devices/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
    if (!result[0]) return reply.code(404).send({ error: "Device not found" });
    return result[0];
  });

  app.post("/devices", { preHandler: requireAdmin }, async (request, reply) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const inserted = await db.insert(devices).values(body.data).returning();
    return reply.code(201).send(inserted[0]);
  });

  app.patch("/devices/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const updated = await db
      .update(devices)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(devices.id, id))
      .returning();

    if (!updated[0]) return reply.code(404).send({ error: "Device not found" });
    return updated[0];
  });

  app.delete("/devices/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    // Deliveries zuerst löschen (kein CASCADE in der DB definiert)
    await db.delete(notificationDeliveries).where(eq(notificationDeliveries.deviceId, id));
    const deleted = await db.delete(devices).where(eq(devices.id, id)).returning();
    if (!deleted[0]) return reply.code(404).send({ error: "Device not found" });
    return reply.code(204).send();
  });

  // Endpunkt für Devices um ihren Push-Token zu aktualisieren
  app.post("/devices/:id/register-token", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({
      platformId: z.string().min(1).max(512),
      platformMeta: z.record(z.unknown()).optional(),
    }).safeParse(request.body);

    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const updated = await db
      .update(devices)
      .set({ platformId: body.data.platformId, platformMeta: body.data.platformMeta ?? null, updatedAt: new Date() })
      .where(eq(devices.id, id))
      .returning();

    if (!updated[0]) return reply.code(404).send({ error: "Device not found" });
    return updated[0];
  });
}
