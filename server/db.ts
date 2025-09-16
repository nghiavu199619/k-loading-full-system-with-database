import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Make sure to add it to your .env file.");
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql);