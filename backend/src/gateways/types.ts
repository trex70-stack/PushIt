export interface PushPayload {
  notificationId: string;
  title: string;
  body: string;
  category?: string | null;
  imageUrl?: string | null;
  ttlSeconds?: number | null;
}

export interface DeliveryResult {
  success: boolean;
  errorMessage?: string;
  /** Neues Token wenn die Plattform ein rotiertes Token liefert */
  updatedPlatformId?: string;
}

export interface PushDevice {
  id: string;
  type: string;
  platformId: string | null;
  platformMeta: unknown;
}

export interface PushGateway {
  readonly supportedTypes: string[];
  send(device: PushDevice, payload: PushPayload): Promise<DeliveryResult>;
}
