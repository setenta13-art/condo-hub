import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  announcements,
  condominiums,
  documents,
  InsertUser,
  memberships,
  organizations,
  tickets,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  textFields.forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  values.lastSignedIn ??= new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserScope(userId: number, isPlatformAdmin = false) {
  const db = await getDb();
  if (!db) return undefined;

  const rows = await db
    .select({ membership: memberships, condominium: condominiums, organization: organizations })
    .from(memberships)
    .innerJoin(condominiums, eq(memberships.condominiumId, condominiums.id))
    .innerJoin(organizations, eq(condominiums.organizationId, organizations.id))
    .where(and(eq(memberships.userId, userId), eq(condominiums.status, "active")))
    .limit(1);

  if (rows[0]) return rows[0];
  if (!isPlatformAdmin) return undefined;

  const adminRows = await db
    .select({ condominium: condominiums, organization: organizations })
    .from(condominiums)
    .innerJoin(organizations, eq(condominiums.organizationId, organizations.id))
    .where(eq(condominiums.status, "active"))
    .limit(1);

  return adminRows[0]
    ? { membership: undefined, condominium: adminRows[0].condominium, organization: adminRows[0].organization }
    : undefined;
}

export async function getAnnouncements(condominiumId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(announcements)
    .where(eq(announcements.condominiumId, condominiumId))
    .orderBy(desc(announcements.isPinned), desc(announcements.publishedAt));
}

export async function getTickets(condominiumId: number, userId: number, isStaff: boolean) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(tickets)
    .where(
      isStaff
        ? eq(tickets.condominiumId, condominiumId)
        : and(eq(tickets.condominiumId, condominiumId), eq(tickets.openedById, userId)),
    )
    .orderBy(desc(tickets.createdAt));
}

export async function getDocuments(condominiumId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(documents)
    .where(eq(documents.condominiumId, condominiumId))
    .orderBy(desc(documents.createdAt));
}
