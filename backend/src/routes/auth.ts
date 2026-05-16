import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../lib/crypto.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid input" });

    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, body.data.email))
      .limit(1);

    const user = result[0];
    if (!user || !(await verifyPassword(body.data.password, user.passwordHash))) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const token = await reply.jwtSign(
      { id: user.id, email: user.email, role: user.role },
      { expiresIn: "8h" }
    );

    return { token, user: { id: user.id, email: user.email, role: user.role } };
  });

  app.post("/auth/register", {
    // Nur intern nutzbar – kein öffentlicher Endpunkt in Produktion
    schema: { hide: true },
  }, async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid input" });

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, body.data.email)).limit(1);
    if (existing[0]) return reply.code(409).send({ error: "Email already registered" });

    const passwordHash = await hashPassword(body.data.password);
    const inserted = await db.insert(users).values({
      email: body.data.email,
      passwordHash,
      role: "admin",
    }).returning({ id: users.id, email: users.email, role: users.role });

    return reply.code(201).send(inserted[0]);
  });

  app.get("/auth/me", async (request, reply) => {
    try {
      await request.jwtVerify();
      return request.user;
    } catch {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });
}
