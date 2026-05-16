import { Worker } from "bullmq";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { notifications, notificationDeliveries } from "../db/schema.js";
import { redisConnection, type ExpiryJobData } from "../lib/queue.js";

export function startExpiryWorker() {
  const worker = new Worker<ExpiryJobData>(
    "notification-expiry",
    async (job) => {
      const { notificationId } = job.data;

      // Nur noch ausstehende Deliveries als expired markieren – bereits gesendete bleiben
      await db
        .update(notificationDeliveries)
        .set({ status: "expired", updatedAt: new Date() })
        .where(
          and(
            eq(notificationDeliveries.notificationId, notificationId),
            inArray(notificationDeliveries.status, ["pending"])
          )
        );

      await db
        .update(notifications)
        .set({ expiresAt: new Date() })
        .where(eq(notifications.id, notificationId));
    },
    { connection: redisConnection }
  );

  worker.on("failed", (job, err) => {
    console.error(`[Expiry] Job ${job?.id} fehlgeschlagen:`, err.message);
  });

  return worker;
}
