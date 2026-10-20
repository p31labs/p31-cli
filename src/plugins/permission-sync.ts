/**
 * src/plugins/permission-sync.ts
 * Permission sync plugin — reconcile OpenCode's saved permissions with the
 * P31 execution guard.
 *
 * OpenCode 2.1.0 made saved approvals editable: choosing "Allow always" on a
 * permission prompt creates a durable, project-scoped allow rule. This plugin
 * makes those rules first-class to the execution guard, so the guard does not
 * re-elicit a decision the human already made.
 *
 * Two flows:
 *   - permission.updated → stash the permission by id (type + pattern).
 *   - permission.replied → when the response is "always", persist an allow
 *     rule to ~/.p31/saved-permissions.json.
 *   - permission.ask     → if a matching saved allow exists, auto-allow
 *     (output.status = 'allow') instead of prompting.
 *
 * The execution guard (src/safety/execution-guard.ts) reads the same file to
 * skip elicitation for already-approved tool/resource pairs.
 */

import type { Plugin } from '@opencode-ai/plugin';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const STATE_PATH = join(homedir(), '.p31', 'saved-permissions.json');
const AUTO_ALLOW_RESPONSES = new Set(['always']);

interface SavedPermission {
  type: string;
  pattern: string[] | null;
  sessionID: string;
  effect: 'allow';
  savedAt: string;
}

interface PermissionLike {
  id: string;
  type: string;
  pattern?: string | Array<string>;
  sessionID: string;
}

function loadSaved(): SavedPermission[] {
  try {
    if (!existsSync(STATE_PATH)) return [];
    const parsed = JSON.parse(readFileSync(STATE_PATH, 'utf8'));
    return Array.isArray(parsed?.permissions) ? parsed.permissions : [];
  } catch {
    return [];
  }
}

function saveSaved(list: SavedPermission[]): void {
  mkdirSync(join(homedir(), '.p31'), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify({ schema: 'p31.saved-permissions.v1', permissions: list }, null, 2) + '\n');
}

function patternMatches(saved: string[] | null, asked: string | string[] | undefined): boolean {
  if (!saved || saved.length === 0) return true; // no pattern = applies to all
  const askedList = Array.isArray(asked) ? asked : asked ? [asked] : [];
  if (askedList.length === 0) return true;
  return askedList.some((a) => saved.some((s) => a === s || a.startsWith(s)));
}

export const PermissionSyncPlugin: Plugin = async () => {
  const pending = new Map<string, PermissionLike>();

  return {
    event: async ({ event }: { event: any }) => {
      if (event?.type === 'permission.updated' && event.properties) {
        pending.set(event.properties.id, event.properties);
      }
      if (event?.type === 'permission.replied') {
        const { permissionID, response } = event.properties ?? {};
        const perm = pending.get(permissionID);
        if (!perm || !AUTO_ALLOW_RESPONSES.has(response)) return;
        const saved = loadSaved();
        const pattern = perm.pattern
          ? (Array.isArray(perm.pattern) ? perm.pattern : [perm.pattern])
          : null;
        // Replace any prior allow for the same type + pattern.
        const key = (p: SavedPermission) => `${p.type}::${(p.pattern ?? []).join(',')}`;
        const next = saved.filter((p) => key(p) !== key({ type: perm.type, pattern, sessionID: perm.sessionID, effect: 'allow', savedAt: '' }));
        next.push({ type: perm.type, pattern, sessionID: perm.sessionID, effect: 'allow', savedAt: new Date().toISOString() });
        saveSaved(next);
        pending.delete(permissionID);
      }
    },
    'permission.ask': async (permission: any, output: any) => {
      const saved = loadSaved();
      const match = saved.find(
        (p) => p.effect === 'allow' && p.type === permission.type && patternMatches(p.pattern, permission.pattern),
      );
      if (match) output.status = 'allow';
      return output;
    },
  } as any;
};
