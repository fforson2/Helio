import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let dbInstance: Database.Database | null = null;

function ensureSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      listing_type TEXT NOT NULL,
      property_type TEXT NOT NULL,
      price REAL NOT NULL,
      beds REAL NOT NULL,
      baths REAL NOT NULL,
      sqft REAL NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      search_text TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS search_sessions (
      id TEXT PRIMARY KEY,
      query_text TEXT NOT NULL,
      summary TEXT NOT NULL,
      filters_json TEXT NOT NULL,
      property_ids_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

export function getDb() {
  if (dbInstance) return dbInstance;

  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  dbInstance = new Database(path.join(dataDir, "helio.sqlite"));
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");
  ensureSchema(dbInstance);
  return dbInstance;
}
