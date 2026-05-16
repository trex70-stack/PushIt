import type { WebSocket } from "@fastify/websocket";

class WsConnectionManager {
  private connections = new Map<string, WebSocket>();

  add(deviceId: string, socket: WebSocket) {
    this.connections.set(deviceId, socket);
  }

  remove(deviceId: string) {
    this.connections.delete(deviceId);
  }

  send(deviceId: string, data: object): boolean {
    const socket = this.connections.get(deviceId);
    if (!socket || socket.readyState !== 1 /* OPEN */) return false;
    socket.send(JSON.stringify(data));
    return true;
  }

  isConnected(deviceId: string): boolean {
    const socket = this.connections.get(deviceId);
    return !!socket && socket.readyState === 1;
  }
}

export const wsManager = new WsConnectionManager();
