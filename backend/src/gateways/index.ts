import type { PushGateway } from "./types.js";
import { WebPushGateway } from "./webpush.gateway.js";
import { FCMGateway } from "./fcm.gateway.js";
import { ElectronGateway } from "./electron.gateway.js";

const gateways: PushGateway[] = [
  new ElectronGateway(),
  new WebPushGateway(),
  new FCMGateway(),
];

export function getGatewayForType(deviceType: string): PushGateway | null {
  return gateways.find((g) => g.supportedTypes.includes(deviceType)) ?? null;
}

export * from "./types.js";
