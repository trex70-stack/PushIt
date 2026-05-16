import { Worker } from "bullmq";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { notifications, notificationDeliveries, devices } from "../db/schema.js";
import { getGatewayForType } from "../gateways/index.js";
import { redisConnection, type DispatchJobData } from "../lib/queue.js";

export function startDispatchWorker() {
  const worker = new Worker<DispatchJobData>(
    "notification-dispatch",
    async (job) => {
      const { notificationId } = job.data;

      const [notification] = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, notificationId))
        .limit(1);

      if (!notification) {
        throw new Error(`Notification ${notificationId} nicht gefunden`);
      }

      // Alle pending Deliveries für diese Notification laden
      const pendingDeliveries = await db
        .select({
          deliveryId: notificationDeliveries.id,
          deviceId: notificationDeliveries.deviceId,
        })
        .from(notificationDeliveries)
        .where(eq(notificationDeliveries.notificationId, notificationId));

      if (pendingDeliveries.length === 0) return;

      const deviceIds = pendingDeliveries.map((d) => d.deviceId);
      const deviceList = await db
        .select()
        .from(devices)
        .where(inArray(devices.id, deviceIds));

      const deviceMap = new Map(deviceList.map((d) => [d.id, d]));

      const payload = {
        notificationId: notification.id,
        title: notification.title,
        body: notification.body,
        category: notification.category,
        imageUrl: notification.imageUrl,
        ttlSeconds: notification.ttlSeconds,
      };

      // Parallel an alle Devices senden – ein Fehler bricht die anderen nicht ab
      await Promise.allSettled(
        pendingDeliveries.map(async ({ deliveryId, deviceId }) => {
          const device = deviceMap.get(deviceId);
          if (!device || !device.isActive) {
            await db
              .update(notificationDeliveries)
              .set({ status: "failed", errorMessage: "Gerät nicht aktiv oder nicht gefunden", updatedAt: new Date() })
              .where(eq(notificationDeliveries.id, deliveryId));
            return;
          }

          const gateway = getGatewayForType(device.type);
          if (!gateway) {
            await db
              .update(notificationDeliveries)
              .set({ status: "failed", errorMessage: `Kein Gateway für Typ '${device.type}'`, updatedAt: new Date() })
              .where(eq(notificationDeliveries.id, deliveryId));
            return;
          }

          const result = await gateway.send(device, payload);

          await db
            .update(notificationDeliveries)
            .set({
              status: result.success ? "sent" : "failed",
              errorMessage: result.errorMessage ?? null,
              sentAt: result.success ? new Date() : null,
              updatedAt: new Date(),
            })
            .where(eq(notificationDeliveries.id, deliveryId));

          // Rotierten Token persistieren
          if (result.updatedPlatformId) {
            await db
              .update(devices)
              .set({ platformId: result.updatedPlatformId, updatedAt: new Date() })
              .where(eq(devices.id, deviceId));
          }
        })
      );
    },
    { connection: redisConnection, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[Dispatcher] Job ${job?.id} fehlgeschlagen:`, err.message);
  });

  return worker;
}
