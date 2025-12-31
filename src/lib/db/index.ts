import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// For now, we only support SQLite for simplicity
// PostgreSQL support can be added later via environment detection

// Database instance (lazy initialized)
let dbInstance: BetterSQLite3Database<typeof schema> | null = null;
let sqliteInstance: Database.Database | null = null;

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (dbInstance) {
    return dbInstance;
  }

  // SQLite - store in storage directory
  const storageDir = path.join(process.cwd(), "storage");
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  
  const dbPath = path.join(storageDir, "local.db");
  console.log(`Using SQLite database at: ${dbPath}`);
  
  sqliteInstance = new Database(dbPath);
  
  // Enable WAL mode for better performance
  sqliteInstance.pragma("journal_mode = WAL");
  
  dbInstance = drizzle(sqliteInstance, { schema });
  
  // Auto-create tables for SQLite
  initializeSqliteTables(sqliteInstance);

  return dbInstance;
}

// Initialize SQLite tables if they don't exist
function initializeSqliteTables(sqlite: Database.Database) {
  // Check if tables exist
  const tableCheck = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
  ).get();
  
  if (!tableCheck) {
    console.log("Creating SQLite tables...");
    
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        email_verified INTEGER,
        image TEXT,
        role TEXT NOT NULL DEFAULT 'USER',
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS accounts (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_account_id TEXT NOT NULL,
        refresh_token TEXT,
        access_token TEXT,
        expires_at INTEGER,
        token_type TEXT,
        scope TEXT,
        id_token TEXT,
        session_state TEXT,
        PRIMARY KEY (provider, provider_account_id)
      );

      CREATE TABLE IF NOT EXISTS sessions (
        session_token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS verification_tokens (
        identifier TEXT NOT NULL,
        token TEXT NOT NULL,
        expires INTEGER NOT NULL,
        PRIMARY KEY (identifier, token)
      );

      CREATE TABLE IF NOT EXISTS conversions (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        description TEXT,
        min_lat REAL NOT NULL,
        min_lon REAL NOT NULL,
        max_lat REAL NOT NULL,
        max_lon REAL NOT NULL,
        center_lat REAL NOT NULL,
        center_lon REAL NOT NULL,
        map_width INTEGER NOT NULL,
        map_height INTEGER NOT NULL,
        map_preset TEXT,
        config TEXT DEFAULT '{}',
        stats TEXT,
        osm_file TEXT,
        lua_file TEXT,
        log_file TEXT,
        thumbnail TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        progress INTEGER NOT NULL DEFAULT 0,
        error_msg TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        completed_at INTEGER,
        is_public INTEGER NOT NULL DEFAULT 1,
        featured INTEGER NOT NULL DEFAULT 0,
        downloads INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_conversions_status ON conversions(status);
      CREATE INDEX IF NOT EXISTS idx_conversions_public ON conversions(is_public, featured);
    `);
    
    console.log("SQLite tables created successfully");
  }
}

// Export the database with proper typing
export const db = {
  get instance() {
    return getDb();
  }
};

// Re-export schema
export * from "./schema";
