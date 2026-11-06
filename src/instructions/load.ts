import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import type { InstructionSet, InstructionPrecedenceLevel } from './index.js';

function sha256Hex(s: string): string { return createHash('sha256').update(s, 'utf8').digest('hex'); }
function canonicalize(content: string): string { return content.replace(/\r\n/g, '\n').trimEnd() + '\n'; }
function tryRead(p: string): string | null { try { if (existsSync(p)) return readFileSync(p, 'utf8'); } catch {} return null; }

export function loadInstructionSet(agentId: string, projectRoot = process.cwd()): InstructionSet {
  const now = new Date().toISOString();
  const candidates: Array<{ level: InstructionPrecedenceLevel; path: string }> = [
    { level: 1, path: resolve(projectRoot, 'src/safety/guard-policy.json') },
    { level: 2, path: '/home/p31/production/AGENTS.md' },
    { level: 3, path: resolve(projectRoot, 'AGENTS.md') },
    { level: 4, path: resolve(projectRoot, `agents/${agentId}.json`) },
    { level: 5, path: resolve(homedir(), '.p31', 'cli-session.json') },
  ];
  let selected: { level: InstructionPrecedenceLevel; path: string; content: string } | null = null;
  for (const c of candidates) {
    if (selected && c.level >= selected.level) continue;
    const content = tryRead(c.path);
    if (content != null) selected = { level: c.level, path: c.path, content };
  }
  if (!selected) return { source: 'builtin:fallback', hash: sha256Hex(`agent:${agentId}`), precedenceLevel: 5, loadedAt: now };
  return { source: selected.path, hash: sha256Hex(canonicalize(selected.content)), precedenceLevel: selected.level, loadedAt: now };
}
