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
import { getPermissionStore, setPermissionStore } from '../safety/permission-store.js';
import type { PermissionRule } from '../safety/permission-store.js';

const AUTO_ALLOW_RESPONSES = new Set(['always']);

interface PermissionLike {
  id: string;
  type: string;
  pattern?: string | Array<string>;
  sessionID: string;
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
        const store = getPermissionStore();
        const pattern = perm.pattern
          ? (Array.isArray(perm.pattern) ? perm.pattern : [perm.pattern])
          : null;
        store.set({ projectId: perm.sessionID ?? 'default', type: perm.type, pattern: pattern ?? undefined, effect: 'allow', savedAt: new Date().toISOString() });
        pending.delete(permissionID);
      }
    },
    'permission.ask': async (permission: any, output: any) => {
      const store = getPermissionStore();
      const projectId = permission.sessionID ?? 'default';
      const match = store.get(projectId, permission.type);
      if (match && match.effect === 'allow' && patternMatches(match.pattern ?? null, permission.pattern)) {
        output.status = 'allow';
      }
      return output;
    },
  } as any;
};
