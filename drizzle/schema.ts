import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing the Manus OAuth flow.
 * Global role is reserved for platform-level access; condominium access is
 * defined by memberships below.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const condominiums = mysqlTable("condominiums", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  address: varchar("address", { length: 255 }),
  city: varchar("city", { length: 120 }),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const memberships = mysqlTable("memberships", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  condominiumId: int("condominiumId").notNull(),
  role: mysqlEnum("role", ["resident", "staff", "manager", "admin"])
    .default("resident")
    .notNull(),
  unit: varchar("unit", { length: 40 }),
  block: varchar("block", { length: 40 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const announcements = mysqlTable("announcements", {
  id: int("id").autoincrement().primaryKey(),
  condominiumId: int("condominiumId").notNull(),
  authorId: int("authorId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  summary: varchar("summary", { length: 300 }).notNull(),
  body: text("body").notNull(),
  category: mysqlEnum("category", ["maintenance", "finance", "event", "general"])
    .default("general")
    .notNull(),
  isPinned: int("isPinned").default(0).notNull(),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const tickets = mysqlTable("tickets", {
  id: int("id").autoincrement().primaryKey(),
  condominiumId: int("condominiumId").notNull(),
  openedById: int("openedById").notNull(),
  assignedToId: int("assignedToId"),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  category: mysqlEnum("category", ["maintenance", "security", "cleaning", "billing", "other"])
    .default("other")
    .notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "resolved"])
    .default("open")
    .notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high"])
    .default("medium")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  condominiumId: int("condominiumId").notNull(),
  uploadedById: int("uploadedById").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: varchar("description", { length: 300 }),
  category: mysqlEnum("category", ["governance", "rules", "finance", "meeting", "other"])
    .default("other")
    .notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const invitations = mysqlTable("invitations", {
  id: int("id").autoincrement().primaryKey(),
  condominiumId: int("condominiumId").notNull(),
  createdById: int("createdById").notNull(),
  acceptedById: int("acceptedById"),
  email: varchar("email", { length: 320 }),
  token: varchar("token", { length: 96 }).notNull().unique(),
  role: mysqlEnum("role", ["resident", "staff", "manager"]).default("resident").notNull(),
  unit: varchar("unit", { length: 40 }),
  block: varchar("block", { length: 40 }),
  status: mysqlEnum("status", ["pending", "accepted", "expired", "revoked"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type Condominium = typeof condominiums.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
