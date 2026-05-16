import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

import { authRoutes } from "./routes/auth.js";
import { deviceRoutes } from "./routes/devices.js";
import { templateRoutes } from "./routes/templates.js";
import { apiKeyRoutes } from "./routes/api-keys.js";
import { notificationRoutes } from "./routes/notifications.js";
import { wsRoutes } from "./routes/ws.js";
import { pairRoutes } from "./routes/pair.js";
import { startDispatchWorker } from "./workers/notification-dispatcher.js";
import { startExpiryWorker } from "./workers/notification-expiry.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(websocket);

await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? "dev-secret-change-in-production",
});

await app.register(swagger, {
  openapi: {
    info: { title: "PushIt API", version: "0.1.0" },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        apiKey: { type: "apiKey", in: "header", name: "X-Api-Key" },
      },
    },
  },
});

await app.register(swaggerUi, { routePrefix: "/docs" });

const API_PREFIX = "/api/v1";

await app.register(authRoutes, { prefix: API_PREFIX });
await app.register(deviceRoutes, { prefix: API_PREFIX });
await app.register(templateRoutes, { prefix: API_PREFIX });
await app.register(apiKeyRoutes, { prefix: API_PREFIX });
await app.register(notificationRoutes, { prefix: API_PREFIX });
await app.register(wsRoutes, { prefix: API_PREFIX });
await app.register(pairRoutes, { prefix: API_PREFIX });

app.get("/health", async () => ({ status: "ok" }));

// Leitet /pair/:code direkt zur Frontend-Seite weiter – nützlich wenn
// Backend- und Frontend-URL identisch sind (Produktion) oder der Admin
// die Backend-URL aus der App öffnet.
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
app.get("/pair/:code", async (request, reply) => {
  const { code } = request.params as { code: string };
  return reply.redirect(`${frontendUrl}/pair/${code}`, 302);
});

// Worker starten
startDispatchWorker();
startExpiryWorker();

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: "0.0.0.0" });
