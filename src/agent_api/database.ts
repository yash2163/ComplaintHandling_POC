import Database = require('better-sqlite3');
import * as path from 'path';

// Store DBs in the project root data/ folder
const DATA_DIR = path.resolve(__dirname, '../../data');

export const RESOLUTIONS_DB_PATH = path.join(DATA_DIR, 'resolutions.db');
export const MASTER_DB_PATH = path.join(DATA_DIR, 'master_table.db');

export function getResolutionsDb() {
    const db = new Database(RESOLUTIONS_DB_PATH);
    // Optional: db.pragma('journal_mode = WAL');
    return db;
}

export function getMasterDb() {
    const db = new Database(MASTER_DB_PATH);
    return db;
}

export function initializeDatabases() {
    const resDb = getResolutionsDb();
    resDb.exec(`
    CREATE TABLE IF NOT EXISTS resolutions (
      complaint_id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      complaint_text TEXT NOT NULL,
      action_taken TEXT NOT NULL,
      outcome TEXT NOT NULL,
      quality_flag TEXT NOT NULL CHECK(quality_flag IN ('Good', 'Bad')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    resDb.close();

    const masterDb = getMasterDb();
    masterDb.exec(`
    CREATE TABLE IF NOT EXISTS limits (
      action_type TEXT PRIMARY KEY,
      max_allowed_percentage INTEGER NOT NULL,
      description TEXT
    )
  `);
    masterDb.close();
}

/**
 * Checks if a proposed refund/compensation is within the allowed limits
 * limits: refund <= 30%, discount <= 20%
 */
export function checkPermissionLimit(actionType: string, percentage: number): boolean {
    const db = getMasterDb();
    const stmt = db.prepare('SELECT max_allowed_percentage FROM limits WHERE action_type = ?');
    const row = stmt.get(actionType.toLowerCase()) as { max_allowed_percentage: number } | undefined;
    db.close();

    if (!row) return false; // Action type not found or not permitted
    return percentage <= row.max_allowed_percentage;
}

export function getAllResolutions() {
    const db = getResolutionsDb();
    const rows = db.prepare('SELECT * FROM resolutions').all();
    db.close();
    return rows;
}
