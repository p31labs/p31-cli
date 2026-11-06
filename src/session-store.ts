/**
 * src/session-store.ts
 * SQLite-backed session store for @p31/cli v3.
 * Per-session-tree sharding — each root session gets its own DB file.
 * Built on better-sqlite3 (synchronous, zero-config, embedded).
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
import type { Session, Message } from './types.js';

const P31_HOME = path.join(os.homedir(), '.p31');
const SESSIONS_DIR = path.join(P31_HOME, 'sessions');

export interface SessionStore {
  createSession(parentId?: string): Session;
  getSession(id: string): Session | undefined;
  listSessions(parentId?: string): Session[];
  appendMessage(sessionId: string, message: Message): void;
  updateSession(id: string, updates: Partial<Session>): void;
  deleteSession(id: string): void;
  getMessages(sessionId: string, limit?: number): Message[];
  searchSessions(query: string): Session[];
}

function ensureDir() {
  if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

function dbFile(sessionId: string): string {
  return path.join(SESSIONS_DIR, `${sessionId}.db`);
}

function openSessionDb(sessionId: string): any {
  ensureDir();
  const db = new Database(dbFile(sessionId));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      tool_calls TEXT,
      tool_results TEXT
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_messages_ts ON messages(timestamp);
  `);
  return db;
}

function openGlobalDb(): any {
  ensureDir();
  const db = new Database(dbFile('_global'));
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      parent_id TEXT,
      title TEXT DEFAULT '',
      model TEXT DEFAULT 'deepseek-v4-flash',
      spoon_level INTEGER DEFAULT 3,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_parent ON sessions(parent_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at);
  `);
  return db;
}

let globalDb: any = null;
let sessionStoreInstance: SessionStore | null = null;

function getGlobalDb(): any {
  if (!globalDb) globalDb = openGlobalDb();
  return globalDb;
}

export function getSessionStore(): SessionStore {
  if (!sessionStoreInstance) {
    sessionStoreInstance = createSessionStore();
  }
  return sessionStoreInstance;
}

export function createSessionStore(): SessionStore {
  const gdb = getGlobalDb();

  return {
    createSession(parentId?: string): Session {
      const id = uuidv4();
      const now = new Date().toISOString();
      gdb.prepare(
        'INSERT INTO sessions (id, parent_id, title, model, spoon_level, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(id, parentId || null, '', 'deepseek-v4-flash', 3, 'active', now, now);
      return {
        id,
        parentId,
        title: '',
        model: 'deepseek-v4-flash',
        spoonLevel: 3,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        messages: [],
        metadata: {},
      };
    },

    getSession(id: string): Session | undefined {
      const row = gdb.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
      if (!row) return undefined;
      return {
        id: row.id,
        parentId: row.parent_id || undefined,
        title: row.title,
        model: row.model,
        spoonLevel: row.spoon_level,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        messages: this.getMessages(id),
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
      };
    },

    listSessions(parentId?: string): Session[] {
      const rows: any[] = parentId
        ? gdb.prepare('SELECT * FROM sessions WHERE parent_id = ? ORDER BY updated_at DESC').all(parentId)
        : gdb.prepare('SELECT * FROM sessions WHERE parent_id IS NULL ORDER BY updated_at DESC').all();
      return rows.map((row) => ({
        id: row.id,
        parentId: row.parent_id || undefined,
        title: row.title,
        model: row.model,
        spoonLevel: row.spoon_level,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        messages: [],
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
      }));
    },

    appendMessage(sessionId: string, message: Message): void {
      const db = openSessionDb(sessionId);
      db.prepare(
        'INSERT INTO messages (id, role, content, timestamp, tool_calls, tool_results) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        message.id,
        message.role,
        message.content,
        message.timestamp || new Date().toISOString(),
        message.toolCalls ? JSON.stringify(message.toolCalls) : null,
        message.toolResults ? JSON.stringify(message.toolResults) : null,
      );
      db.close();
      gdb.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), sessionId);
    },

    updateSession(id: string, updates: Partial<Session>): void {
      const fields: string[] = [];
      const values: unknown[] = [];
      if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
      if (updates.model !== undefined) { fields.push('model = ?'); values.push(updates.model); }
      if (updates.spoonLevel !== undefined) { fields.push('spoon_level = ?'); values.push(updates.spoonLevel); }
      if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
      if (updates.metadata !== undefined) { fields.push('metadata = ?'); values.push(JSON.stringify(updates.metadata)); }
      fields.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);
      if (fields.length > 0) {
        gdb.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }
    },

    deleteSession(id: string): void {
      globalDb.prepare('DELETE FROM sessions WHERE id = ?').run(id);
      const p = dbFile(id);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    },

    getMessages(sessionId: string, limit = 100): Message[] {
      const db = openSessionDb(sessionId);
      const rows = db.prepare('SELECT * FROM messages ORDER BY timestamp ASC LIMIT ?').all(limit) as any[];
      db.close();
      return rows.map((row) => ({
        id: row.id,
        role: row.role as Message['role'],
        content: row.content,
        timestamp: row.timestamp,
        toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
        toolResults: row.tool_results ? JSON.parse(row.tool_results) : undefined,
      }));
    },

    searchSessions(query: string): Session[] {
      const rows = gdb.prepare(
        'SELECT * FROM sessions WHERE title LIKE ? OR metadata LIKE ? ORDER BY updated_at DESC'
      ).all(`%${query}%`, `%${query}%`) as any[];
      return rows.map((row) => ({
        id: row.id,
        parentId: row.parent_id || undefined,
        title: row.title,
        model: row.model,
        spoonLevel: row.spoon_level,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        messages: [],
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
      }));
    },
  };
}
