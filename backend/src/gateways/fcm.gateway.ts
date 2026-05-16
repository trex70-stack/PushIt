import admin from "firebase-admin";
import type { PushGateway, PushDevice, PushPayload, DeliveryResult } from "./types.js";

let app: admin.app.App | null = null;

function getApp(): admin.app.App {
  if (!app) {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FCM_PROJECT_ID,
        clientEmail: process.env.FCM_CLIENT_EMAIL,
        // Zeilenumbrüche in Umgebungsvariablen wiederherstellen
        privateKey: process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return app;
}

export class FCMGateway implements PushGateway {
  readonly supportedTypes = ["android"];

  async send(device: PushDevice, payload: PushPayload): Promise<DeliveryResult> {
    if (!device.platformId) {
      return { success: false, errorMessage: "Kein FCM-Token gespeichert" };
    }

    const message: admin.messaging.Message = {
      token: device.platformId,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl ?? undefined,
      },
      android: {
        ttl: payload.ttlSeconds ? payload.ttlSeconds * 1000 : undefined,
        notification: {
          sound: "default",
        },
      },
      data: { notificationId: payload.notificationId },
    };

    try {
      await getApp().messaging().send(message);
      return { success: true };
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      // Token ungültig oder nicht registriert → Device sollte deaktiviert werden
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        return { success: false, errorMessage: `FCM-Token ungültig: ${code}` };
      }
      return { success: false, errorMessage: String(err) };
    }
  }
}
