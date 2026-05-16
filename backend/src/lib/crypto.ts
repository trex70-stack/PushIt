import { createHash, randomBytes } from "crypto";

export function generateApiKey(): { key: string; hash: string } {
  const key = `pk_${randomBytes(32).toString("hex")}`;
  const hash = hashApiKey(key);
  return { key, hash };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// Ambiguity-free chars (kein 0/O, 1/I/L) für einfache Lesbarkeit auf TV-Bildschirmen
const PAIRING_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generatePairingCode(): string {
  const bytes = randomBytes(6);
  const chars = Array.from(bytes).map((b) => PAIRING_CHARS[b % PAIRING_CHARS.length]);
  return `${chars.slice(0, 3).join("")}-${chars.slice(3).join("")}`;
}

export function hashPassword(password: string): Promise<string> {
  return import("crypto").then(({ scrypt, randomBytes }) =>
    new Promise((resolve, reject) => {
      const salt = randomBytes(16).toString("hex");
      scrypt(password, salt, 64, (err, key) => {
        if (err) reject(err);
        else resolve(`${salt}:${key.toString("hex")}`);
      });
    })
  );
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  return import("crypto").then(({ scrypt }) =>
    new Promise((resolve, reject) => {
      const [salt, hash] = stored.split(":");
      scrypt(password, salt, 64, (err, key) => {
        if (err) reject(err);
        else resolve(key.toString("hex") === hash);
      });
    })
  );
}
