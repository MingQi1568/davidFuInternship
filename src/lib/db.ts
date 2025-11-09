import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { SECURITIES, type Security } from "./constants";

const DB_PATH = path.join(process.cwd(), "data", "bets.sqlite");

let db: Database.Database | null = null;

export function getSecurities(): Security[] {
  return [...SECURITIES];
}

function initialize() {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        chips REAL NOT NULL DEFAULT 100,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS positions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        security TEXT NOT NULL,
        shares REAL NOT NULL DEFAULT 0,
        UNIQUE (user_id, security),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS market_totals (
        security TEXT PRIMARY KEY,
        shares REAL NOT NULL DEFAULT 0
      );
    `);

    const insertTotal = db.prepare(
      `INSERT OR IGNORE INTO market_totals (security, shares) VALUES (?, 0)`
    );
    for (const security of SECURITIES) {
      insertTotal.run(security);
    }
  }
  return db!;
}

export function getDb() {
  return initialize();
}


