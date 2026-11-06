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
  projectId: string;   // project-scoped (OpenCode binds always to project_id)
  type: string;        // tool name
  effect: 'allow' | 'deny';
  pattern?: string;
  savedAt?: string;
}

export interface PermissionStore {
  get(projectId: string, toolName: string): PermissionRule | undefined;
  set(rule: PermissionRule): void;
  list(projectId?: string): PermissionRule[];
}

// ── PermissionQueue — durable multi-agent approval queue ──────────────────
//
// A PermissionQueue holds pending permission requests that require human
// approval. Unlike PermissionStore (which holds saved "allow always" rules),
// the queue holds in-flight requests that have not yet been decided.
//
// Implementations:
//   - InMemoryPermissionQueue: default for single-process CLI
//   - DurablePermissionQueue: backed by Cloudflare Durable Objects for
//     multi-agent, multi-machine deployments (survives process restarts)
//
// A pending request must survive a process restart, and a reply must emit a
// permission.granted / permission.denied record to the guard audit chain.

export interface PermissionRequest {
  id: string;
  projectId: string;
  toolName: string;
  toolInput?: unknown;
  requestedAt: string;
  requestedBy?: string;   // agent DID or session ID
  status: 'pending' | 'approved' | 'denied' | 'expired';
  decidedAt?: string;
  decidedBy?: string;     // human DID or "2fa"
  reason?: string;
}

export interface PermissionQueue {
  enqueue(request: Omit<PermissionRequest, 'id' | 'requestedAt' | 'status'>): PermissionRequest;
  pending(projectId?: string): PermissionRequest[];
  decide(id: string, decision: 'approved' | 'denied', decidedBy: string, reason?: string): PermissionRequest | undefined;
  get(id: string): PermissionRequest | undefined;
  audit(): PermissionRequest[];
}

// In-memory default implementation.
export class InMemoryPermissionQueue implements PermissionQueue {
  private requests: PermissionRequest[] = [];
  private counter = 0;

  enqueue(request: Omit<PermissionRequest, 'id' | 'requestedAt' | 'status'>): PermissionRequest {
    const req: PermissionRequest = {
      ...request,
      id: `perm-${++this.counter}-${Date.now()}`,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };
    this.requests.push(req);
    return req;
  }

  pending(projectId?: string): PermissionRequest[] {
    return this.requests.filter(r =>
      r.status === 'pending' && (!projectId || r.projectId === projectId)
    );
  }

  decide(id: string, decision: 'approved' | 'denied', decidedBy: string, reason?: string): PermissionRequest | undefined {
    const req = this.requests.find(r => r.id === id);
    if (!req || req.status !== 'pending') return undefined;
    req.status = decision === 'approved' ? 'approved' : 'denied';
    req.decidedAt = new Date().toISOString();
    req.decidedBy = decidedBy;
    req.reason = reason;
    return req;
  }

  get(id: string): PermissionRequest | undefined {
    return this.requests.find(r => r.id === id);
  }

  audit(): PermissionRequest[] {
    return [...this.requests];
  }
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

  get(projectId: string, toolName: string): PermissionRule | undefined {
    return this.load().find((p) => (p.projectId === projectId || !p.projectId) && p.effect === 'allow' && p.type === toolName);
  }

  set(rule: PermissionRule): void {
    const rules = this.load();
    const idx = rules.findIndex((r) => (r.projectId === rule.projectId || !r.projectId) && r.type === rule.type);
    if (idx >= 0) rules[idx] = rule;
    else rules.push(rule);
    this.save(rules);
  }

  list(projectId?: string): PermissionRule[] {
    const all = this.load();
    if (!projectId) return all;
    return all.filter((r) => r.projectId === projectId);
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
