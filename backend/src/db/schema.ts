import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const deviceTypeEnum = pgEnum("device_type", [
  "desktop_windows",
  "desktop_macos",
  "desktop_linux",
  "desktop_electron",
  "desktop_tauri",
  "samsung_tv",
  "ios",
  "android",
  "fire_tv",
]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",
  "sent",
  "delivered",
  "failed",
  "expired",
]);

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);

export const notificationCategoryEnum = pgEnum("notification_category", [
  "info",
  "warning",
  "emergency",
]);

// ---

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  keyHash: varchar("key_hash", { length: 255 }).notNull().unique(),
  label: varchar("label", { length: 255 }).notNull(),
  createdById: uuid("created_by_id").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  type: deviceTypeEnum("type").notNull(),
  platformId: varchar("platform_id", { length: 512 }),
  platformMeta: jsonb("platform_meta"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const templateDevices = pgTable("template_devices", {
  templateId: uuid("template_id").notNull().references(() => templates.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  category: notificationCategoryEnum("category").notNull().default("info"),
  imageUrl: text("image_url"),
  ttlSeconds: integer("ttl_seconds"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  templateId: uuid("template_id").references(() => templates.id),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationDeliveries = pgTable("notification_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  notificationId: uuid("notification_id").notNull().references(() => notifications.id, { onDelete: "cascade" }),
  deviceId: uuid("device_id").notNull().references(() => devices.id),
  status: deliveryStatusEnum("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pairingCodes = pgTable("pairing_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 8 }).notNull().unique(),
  deviceType: deviceTypeEnum("device_type").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  deviceId: uuid("device_id").references(() => devices.id),
  pendingApiKey: varchar("pending_api_key", { length: 128 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Relations ---

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  createdBy: one(users, { fields: [apiKeys.createdById], references: [users.id] }),
}));

export const templatesRelations = relations(templates, ({ many }) => ({
  templateDevices: many(templateDevices),
}));

export const devicesRelations = relations(devices, ({ many }) => ({
  templateDevices: many(templateDevices),
  deliveries: many(notificationDeliveries),
}));

export const templateDevicesRelations = relations(templateDevices, ({ one }) => ({
  template: one(templates, { fields: [templateDevices.templateId], references: [templates.id] }),
  device: one(devices, { fields: [templateDevices.deviceId], references: [devices.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one, many }) => ({
  template: one(templates, { fields: [notifications.templateId], references: [templates.id] }),
  deliveries: many(notificationDeliveries),
}));

export const notificationDeliveriesRelations = relations(notificationDeliveries, ({ one }) => ({
  notification: one(notifications, { fields: [notificationDeliveries.notificationId], references: [notifications.id] }),
  device: one(devices, { fields: [notificationDeliveries.deviceId], references: [devices.id] }),
}));
