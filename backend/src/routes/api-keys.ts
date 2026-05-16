import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/index.js";
import { apiKeys } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth.js";
import { generateApiKey } from "../lib/crypto.js";

const createSchema = z.object({
  label: z.string().min(1).max(255),
  expiresAt: z.string().datetime().optional(),
});

export async function apiKeyRoutes(app: FastifyInstance) {
  app.get("/api-keys", { preHandler: requireAdmin }, async (request) => {
    return db
      .select({
        id: apiKeys.id,
        label: apiKeys.label,
        isActive: apiKeys.isActive,
        expiresAt: apiKeys.expiresAt,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.createdById, request.user!.id))
      .orderBy(apiKeys.createdAt);
  });

  app.post("/api-keys", { preHandler: requireAdmin }, async (request, reply) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const { key, hash } = generateApiKey();

    const inserted = await db.insert(apiKeys).values({
      keyHash: hash,
      label: body.data.label,
      createdById: request.user!.id,
      expiresAt: body.data.expiresAt ? new Date(body.data.expiresAt) : null,
    }).returning({
      id: apiKeys.id,
      label: apiKeys.label,
      isActive: apiKeys.isActive,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    });

    // key wird nur einmalig im Klartext zurückgegeben
    return reply.code(201).send({ ...inserted[0], key });
  });

  app.delete("/api-keys/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await db.delete(apiKeys).where(eq(apiKeys.id, id)).returning({ id: apiKeys.id });
    if (!deleted[0]) return reply.code(404).send({ error: "API key not found" });
    return reply.code(204).send();
  });
}
