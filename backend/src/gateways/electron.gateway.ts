import { wsManager } from "../lib/ws-manager.js";
import type { PushGateway, PushDevice, PushPayload, DeliveryResult } from "./types.js";

export class ElectronGateway implements PushGateway {
  readonly supportedTypes = ["desktop_electron", "desktop_tauri", "fire_tv"];

  async send(device: PushDevice, payload: PushPayload): Promise<DeliveryResult> {
    const sent = wsManager.send(device.id, {
      type: "notification",
      notificationId: payload.notificationId,
      title: payload.title,
      body: payload.body,
      category: payload.category ?? "info",
      imageUrl: payload.imageUrl ?? null,
      ttlSeconds: payload.ttlSeconds ?? null,
    });

    if (!sent) {
      return { success: false, errorMessage: "Kein aktiver Desktop-Client verbunden" };
    }
    return { success: true };
  }
}
