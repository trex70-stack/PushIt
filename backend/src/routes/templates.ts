import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/index.js";
import { templates, templateDevices, devices } from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  deviceIds: z.array(z.string().uuid()).min(1),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  deviceIds: z.array(z.string().uuid()).optional(),
});

async function templateWithDevices(templateId: string) {
  const template = await db.select().from(templates).where(eq(templates.id, templateId)).limit(1);
  if (!template[0]) return null;

  const links = await db.select({ deviceId: templateDevices.deviceId }).from(templateDevices).where(eq(templateDevices.templateId, templateId));
  const deviceIds = links.map((l) => l.deviceId);
  const deviceList = deviceIds.length > 0
    ? await db.select().from(devices).where(inArray(devices.id, deviceIds))
    : [];

  return { ...template[0], devices: deviceList };
}

export async function templateRoutes(app: FastifyInstance) {
  app.get("/templates", { preHandler: requireAuth }, async () => {
    const all = await db.select().from(templates).orderBy(templates.createdAt);
    return all;
  });

  app.get("/templates/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await templateWithDevices(id);
    if (!result) return reply.code(404).send({ error: "Template not found" });
    return result;
  });

  app.post("/templates", { preHandler: requireAdmin }, async (request, reply) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const inserted = await db.insert(templates).values({
      name: body.data.name,
      description: body.data.description,
    }).returning();

    const template = inserted[0];

    await db.insert(templateDevices).values(
      body.data.deviceIds.map((deviceId) => ({ templateId: template.id, deviceId }))
    );

    return reply.code(201).send(await templateWithDevices(template.id));
  });

  app.patch("/templates/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const { deviceIds, ...fields } = body.data;

    if (Object.keys(fields).length > 0) {
      await db.update(templates).set({ ...fields, updatedAt: new Date() }).where(eq(templates.id, id));
    }

    if (deviceIds !== undefined) {
      await db.delete(templateDevices).where(eq(templateDevices.templateId, id));
      if (deviceIds.length > 0) {
        await db.insert(templateDevices).values(deviceIds.map((deviceId) => ({ templateId: id, deviceId })));
      }
    }

    const result = await templateWithDevices(id);
    if (!result) return reply.code(404).send({ error: "Template not found" });
    return result;
  });

  app.delete("/templates/bulk", { preHandler: requireAdmin }, async (request, reply) => {
    const body = z.object({ ids: z.array(z.string().uuid()).min(1) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    await db.delete(templateDevices).where(inArray(templateDevices.templateId, body.data.ids));
    await db.delete(templates).where(inArray(templates.id, body.data.ids));
    return reply.code(204).send();
  });

  app.delete("/templates/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await db.delete(templates).where(eq(templates.id, id)).returning();
    if (!deleted[0]) return reply.code(404).send({ error: "Template not found" });
    return reply.code(204).send();
  });
}
