import { FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/index.js";
import { apiKeys, users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { hashApiKey } from "../lib/crypto.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { id: string; email: string; role: "admin" | "user" };
    user: { id: string; email: string; role: "admin" | "user" };
  }
}

declare module "fastify" {
  interface FastifyRequest {
    apiKeyId?: string;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const apiKeyHeader = request.headers["x-api-key"];

  if (apiKeyHeader && typeof apiKeyHeader === "string") {
    await authenticateApiKey(request, reply, apiKeyHeader);
    return;
  }

  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ error: "Unauthorized" });
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply);
  if (reply.sent) return;

  if (request.user?.role !== "admin") {
    reply.code(403).send({ error: "Forbidden" });
  }
}

async function authenticateApiKey(
  request: FastifyRequest,
  reply: FastifyReply,
  rawKey: string
) {
  const hash = hashApiKey(rawKey);
  const result = await db
    .select({ id: apiKeys.id, isActive: apiKeys.isActive, expiresAt: apiKeys.expiresAt, createdById: apiKeys.createdById })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash))
    .limit(1);

  const key = result[0];

  if (!key || !key.isActive) {
    reply.code(401).send({ error: "Invalid API key" });
    return;
  }

  if (key.expiresAt && key.expiresAt < new Date()) {
    reply.code(401).send({ error: "API key expired" });
    return;
  }

  // Resolve user for role information
  const userResult = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, key.createdById))
    .limit(1);

  if (!userResult[0]) {
    reply.code(401).send({ error: "Invalid API key" });
    return;
  }

  request.user = userResult[0];
  request.apiKeyId = key.id;

  // Fire-and-forget: update lastUsedAt
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, key.id))
    .catch(() => {});
}
