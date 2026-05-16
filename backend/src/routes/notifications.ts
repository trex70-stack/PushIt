import { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, desc, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  notifications,
  notificationDeliveries,
  devices,
  templates,
  templateDevices,
} from "../db/schema.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { dispatchQueue, expiryQueue } from "../lib/queue.js";

const createSchema = z.object({
  title: z.string().min(1).max(255),
  body: z.string().min(1),
  category: z.enum(["info", "warning", "emergency"]).default("info"),
  imageUrl: z.string().url().optional(),
  ttlSeconds: z.number().int().positive().optional(),
  deviceIds: z.array(z.string().uuid()).optional(),
  templateId: z.string().uuid().optional(),
});

export async function notificationRoutes(app: FastifyInstance) {
  app.get("/notifications", { preHandler: requireAuth }, async (request) => {
    const list = await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(100);
    return list;
  });

  app.get("/notifications/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);

    if (!notification) return reply.code(404).send({ error: "Notification nicht gefunden" });

    const deliveries = await db
      .select({
        id: notificationDeliveries.id,
        status: notificationDeliveries.status,
        errorMessage: notificationDeliveries.errorMessage,
        sentAt: notificationDeliveries.sentAt,
        device: {
          id: devices.id,
          name: devices.name,
          type: devices.type,
        },
      })
      .from(notificationDeliveries)
      .innerJoin(devices, eq(notificationDeliveries.deviceId, devices.id))
      .where(eq(notificationDeliveries.notificationId, id));

    return { ...notification, deliveries };
  });

  app.post("/notifications", { preHandler: requireAuth }, async (request, reply) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const { title, body: msgBody, category, imageUrl, ttlSeconds, deviceIds, templateId } = body.data;

    // Ziel-Device-IDs bestimmen: direkt angegeben oder aus Template auflösen
    let targetDeviceIds: string[] = deviceIds ?? [];

    if (templateId && targetDeviceIds.length === 0) {
      const links = await db
        .select({ deviceId: templateDevices.deviceId })
        .from(templateDevices)
        .where(eq(templateDevices.templateId, templateId));
      targetDeviceIds = links.map((l) => l.deviceId);
    }

    if (targetDeviceIds.length === 0) {
      return reply.code(400).send({ error: "Mindestens ein Zielgerät erforderlich" });
    }

    // Nur aktive Devices berücksichtigen
    const activeDevices = await db
      .select({ id: devices.id })
      .from(devices)
      .where(inArray(devices.id, targetDeviceIds));

    const activeIds = activeDevices.map((d) => d.id);
    if (activeIds.length === 0) {
      return reply.code(400).send({ error: "Keine aktiven Zielgeräte gefunden" });
    }

    const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;
    const createdBy = request.user?.email ?? "api";

    const [notification] = await db
      .insert(notifications)
      .values({ title, body: msgBody, category, imageUrl, ttlSeconds, expiresAt, templateId, createdBy })
      .returning();

    await db.insert(notificationDeliveries).values(
      activeIds.map((deviceId) => ({ notificationId: notification.id, deviceId }))
    );

    // Dispatch-Job einreihen
    await dispatchQueue.add("dispatch", { notificationId: notification.id });

    // TTL-Job als Delayed Job einreihen
    if (ttlSeconds) {
      await expiryQueue.add(
        "expire",
        { notificationId: notification.id },
        { delay: ttlSeconds * 1000 }
      );
    }

    return reply.code(201).send(notification);
  });

  app.delete("/notifications/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    // notificationDeliveries werden per CASCADE mitgelöscht (Schema-Definition)
    const deleted = await db.delete(notifications).where(eq(notifications.id, id)).returning();
    if (!deleted[0]) return reply.code(404).send({ error: "Notification nicht gefunden" });
    return reply.code(204).send();
  });

  // VAPID Public Key für Browser-Registrierung
  app.get("/notifications/vapid-public-key", async () => ({
    publicKey: process.env.VAPID_PUBLIC_KEY ?? "",
  }));
}
