/**
 * Tool Description Fingerprinting — Defense against tool poisoning (OWASP MCP03)
 *
 * Computes a SHA-256 fingerprint of each tool's canonical {name, description, inputSchema}.
 * The bridge checks the fingerprint at startup and refuses to register a tool
 * whose description has drifted since the committed fingerprint file.
 */

import { createHash } from 'node:crypto';

export interface ToolFingerprint {
  name: string;
  hash: string;
  version: string;
}

export function computeFingerprint(tool: any): string {
  const canonical = JSON.stringify({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }, Object.keys({ name: 0, description: 0, inputSchema: 0 }).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

export interface SkillFingerprint {
  path: string;
  hash: string;
}

export function computeSkillFingerprint(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function generateSkillFingerprints(skillContents: Record<string, string>): SkillFingerprint[] {
  return Object.entries(skillContents).map(([path, content]) => ({
    path,
    hash: computeSkillFingerprint(content),
  }));
}

export function generateFingerprintManifest(tools: any[]): ToolFingerprint[] {
  return tools.map(t => ({
    name: t.name,
    hash: computeFingerprint(t),
    version: '1.0.0',
  }));
}

export function verifyFingerprints(tools: any[], manifest: ToolFingerprint[]): { valid: boolean; drifted: string[] } {
  const manifestMap = new Map(manifest.map(m => [m.name, m.hash]));
  const drifted: string[] = [];

  for (const tool of tools) {
    const expected = manifestMap.get(tool.name);
    if (!expected) continue; // new tool, no fingerprint yet
    const actual = computeFingerprint(tool);
    if (actual !== expected) {
      drifted.push(tool.name);
    }
  }

  return { valid: drifted.length === 0, drifted };
}
