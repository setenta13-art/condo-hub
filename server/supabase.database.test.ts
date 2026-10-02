import { describe, expect, it } from "vitest";
import pg from "pg";

const { Client } = pg;

describe("Supabase database credentials", () => {
  it("can execute a lightweight query through the configured PostgreSQL connection", async () => {
    const connectionString = process.env.SUPABASE_DB_URL;
    expect(connectionString, "SUPABASE_DB_URL must be configured").toMatch(/^postgres(?:ql)?:\/\//);

    const client = new Client({ connectionString, connectionTimeoutMillis: 15_000, statement_timeout: 15_000 });
    await client.connect();
    try {
      const result = await client.query<{ ok: number }>("SELECT 1 AS ok");
      expect(result.rows[0]?.ok).toBe(1);
    } finally {
      await client.end();
    }
  }, 30_000);
});
