import webpush from "web-push";
import type { PushGateway, PushDevice, PushPayload, DeliveryResult } from "./types.js";

export class WebPushGateway implements PushGateway {
  constructor() {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (pub && priv) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT ?? "mailto:admin@pushit.local",
        pub,
        priv
      );
    }
  }
  readonly supportedTypes = ["desktop_windows", "desktop_macos", "desktop_linux"];

  async send(device: PushDevice, payload: PushPayload): Promise<DeliveryResult> {
    if (!device.platformId) {
      return { success: false, errorMessage: "Kein Push-Subscription gespeichert" };
    }

    let subscription: webpush.PushSubscription;
    try {
      subscription = JSON.parse(device.platformId) as webpush.PushSubscription;
    } catch {
      return { success: false, errorMessage: "Ungültige Push-Subscription (kein gültiges JSON)" };
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: "/icon-192.png",
      image: payload.imageUrl ?? undefined,
      data: { notificationId: payload.notificationId },
    });

    const ttl = payload.ttlSeconds ?? 86400;

    try {
      await webpush.sendNotification(subscription, notificationPayload, { TTL: ttl });
      return { success: true };
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      // 410 Gone = Subscription ist nicht mehr gültig
      if (statusCode === 410) {
        return { success: false, errorMessage: "Subscription abgelaufen (410 Gone)" };
      }
      return { success: false, errorMessage: String(err) };
    }
  }
}
