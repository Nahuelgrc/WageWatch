import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add your Neon connection string to .env.local",
    );
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

let cached: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!cached) {
    cached = createDb();
  }
  return cached;
}
