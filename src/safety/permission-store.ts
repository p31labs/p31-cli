/**
 * PermissionStore — abstract permission backend interface.
 *
 * The execution guard consults this interface to check whether a human has
 * saved an "allow always" rule for a tool. The default implementation is
 * file-backed (saved-permissions.json). A multi-agent or remote deployment
 * can swap in a SQLite, worker, or KV-backed implementation without
 * changing the guard or the permission-sync plugin.
 */

export interface PermissionRule {
  type: string;   // tool name
  effect: 'allow' | 'deny';
  pattern?: string;
  savedAt?: string;
}

export interface PermissionStore {
  get(toolName: string): PermissionRule | undefined;
  set(rule: PermissionRule): void;
  list(): PermissionRule[];
}

// File-backed default implementation.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

const SAVED_PERMISSIONS_PATH = join(homedir(), '.p31', 'saved-permissions.json');

export class FilePermissionStore implements PermissionStore {
  private load(): PermissionRule[] {
    try {
      if (!existsSync(SAVED_PERMISSIONS_PATH)) return [];
      const parsed = JSON.parse(readFileSync(SAVED_PERMISSIONS_PATH, 'utf8'));
      return Array.isArray(parsed?.permissions) ? parsed.permissions : [];
    } catch {
      return [];
    }
  }

  private save(rules: PermissionRule[]): void {
    mkdirSync(dirname(SAVED_PERMISSIONS_PATH), { recursive: true });
    writeFileSync(SAVED_PERMISSIONS_PATH, JSON.stringify({ permissions: rules }, null, 2));
  }

  get(toolName: string): PermissionRule | undefined {
    return this.load().find((p) => p.effect === 'allow' && p.type === toolName);
  }

  set(rule: PermissionRule): void {
    const rules = this.load();
    const idx = rules.findIndex((r) => r.type === rule.type);
    if (idx >= 0) rules[idx] = rule;
    else rules.push(rule);
    this.save(rules);
  }

  list(): PermissionRule[] {
    return this.load();
  }
}

// Default singleton — can be replaced at startup.
let _store: PermissionStore = new FilePermissionStore();

export function getPermissionStore(): PermissionStore {
  return _store;
}

export function setPermissionStore(store: PermissionStore): void {
  _store = store;
}
