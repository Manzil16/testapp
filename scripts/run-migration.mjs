#!/usr/bin/env node
/**
 * Run the initial migration against your Supabase database.
 *
 * Usage:
 *   node scripts/run-migration.mjs "postgresql://postgres:<DB_PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres"
 *
 * Find your connection string at:
 *   Supabase Dashboard → Settings → Database → Connection string → URI tab
 *   (see .env.local for your project URL)
 */
import { readFileSync } from "fs";
import pg from "pg";

const connectionString = process.argv[2];
if (!connectionString) {
  console.error("Usage: node scripts/run-migration.mjs <DATABASE_URL>");
  console.error(
    "\nFind your connection string at:\nSupabase Dashboard → Settings → Database → Connection string → URI tab"
  );
  process.exit(1);
}

const sql = readFileSync("supabase/migrations/00001_initial_schema.sql", "utf8");

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log("Connected to database");
  await client.query(sql);
  console.log("Migration executed successfully!");

  const res = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  console.log("Tables:", res.rows.map((r) => r.tablename).join(", "));
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
