/**
 * P31 Ground Truth MCP Server — Ported from production/cli/ground-truth-server.js
 * Canonical Verified-Facts Registry Expert
 */

import fs from 'fs';
import path from 'path';

const AGENTS_ROOT = path.resolve(process.env.HOME || '/home/p31', 'p31-agents');
const GROUND_TRUTH_PATH = path.join(AGENTS_ROOT, 'ground-truth.json');
const MANIFEST_PATH = path.join(AGENTS_ROOT, 'manifest.yaml');

function readFileSafe(filePath: string) {
  try { return fs.readFileSync(path.resolve(filePath), 'utf-8'); } catch { return null; }
}

function readJsonSafe(filePath: string) {
  const content = readFileSafe(filePath);
  if (!content) return null;
  try { return JSON.parse(content); } catch { return null; }
}

function getGroundTruth() {
  return readJsonSafe(GROUND_TRUTH_PATH);
}

function stripQuotes(s: string) {
  return String(s).replace(/^["']|["']$/g, '');
}

function parseManifestYaml(content: string) {
  const agents: any[] = [];
  let current: any = null;
  let listMode: string | null = null;
  for (const line of (content || '').split('\n')) {
    const m = line.match(/^(\s*)(.*)$/);
    if (!m) continue;
    const indent = m[1].length;
    const text = m[2].trim();
    if (!text || text === 'agents:' || text.startsWith('#')) continue;
    if (indent === 2 && text.endsWith(':') && /^[a-z][a-z0-9-]*:$/.test(text)) {
      if (current) agents.push(current);
      current = { name: text.slice(0, -1), description: '', triad_archetype: '', temperature: null, model: '', tools: [], competence: [], not_competent: [] };
      listMode = null;
      continue;
    }
    if (!current) continue;
    if (indent === 4) {
      const kv = text.match(/^([a-z][a-z0-9-]*):\s*(.*)$/);
      if (!kv) continue;
      const key = kv[1];
      const val = stripQuotes(kv[2].trim());
      if (key === 'competence') { listMode = 'competence'; continue; }
      if (key === 'not_competent') { listMode = 'not_competent'; continue; }
      listMode = null;
      if (key === 'description') current.description = val;
      else if (key === 'triad-archetype') current.triad_archetype = val;
      else if (key === 'temperature') current.temperature = parseFloat(val);
      else if (key === 'model') current.model = val;
      else if (key === 'tools') current.tools = val.replace(/^\[|\]$/g, '').split(',').map(s => stripQuotes(s.trim())).filter(Boolean);
      continue;
    }
    if (indent === 6 && text.startsWith('-')) {
      const item = stripQuotes(text.slice(1).trim());
      if (listMode === 'competence') current.competence.push(item);
      else if (listMode === 'not_competent') current.not_competent.push(item);
    }
  }
  if (current) agents.push(current);
  return agents;
}

function getAgents() {
  const manifest = parseManifestYaml(readFileSafe(MANIFEST_PATH) || "");
  if (manifest.length > 0) return manifest;
  return [{ name: 'unknown', description: 'manifest unavailable', triad_archetype: '', temperature: null, model: '', tools: [], competence: [], not_competent: [] }];
}

export const GROUND_TRUTH_TOOLS = [
  { name: 'truth_lookup', description: 'Look up a verified fact by key.', inputSchema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] } },
  { name: 'truth_file_map', description: 'Return the canonical file map.', inputSchema: { type: 'object', properties: {} } },
  { name: 'truth_invariants', description: 'Return the canonical toolchain invariants.', inputSchema: { type: 'object', properties: {} } },
  { name: 'truth_design_tokens', description: 'Return the verified design tokens.', inputSchema: { type: 'object', properties: {} } },
  { name: 'truth_layout_gates', description: 'Return the verified layout gates.', inputSchema: { type: 'object', properties: {} } },
  { name: 'truth_care_score', description: 'Return the verified care-score formula.', inputSchema: { type: 'object', properties: {} } },
  { name: 'truth_mcp_inventory', description: 'Return the MCP server inventory.', inputSchema: { type: 'object', properties: {} } },
  { name: 'truth_manifest', description: 'Return the crew manifest.', inputSchema: { type: 'object', properties: { includeCompetence: { type: 'boolean' } } } },
  { name: 'truth_verify_baseline', description: 'Return the verify-suite baseline.', inputSchema: { type: 'object', properties: {} } },
  { name: 'truth_register_fact', description: 'Register a new verified fact.', inputSchema: { type: 'object', properties: { key: { type: 'string' }, claim: { type: 'string' }, evidence: { type: 'string' }, citation: { type: 'string' }, file: { type: 'string' } }, required: ['key', 'claim', 'evidence', 'citation'] } },
  { name: 'truth_facts', description: 'List all verified facts.', inputSchema: { type: 'object', properties: { verifiedOnly: { type: 'boolean' } } } },
  { name: 'truth_paths', description: 'Return the canonical root paths.', inputSchema: { type: 'object', properties: {} } },
  { name: 'truth_evidence', description: 'Return the OQE evidence categories.', inputSchema: { type: 'object', properties: {} } },
  { name: 'truth_health', description: 'Registry health check.', inputSchema: { type: 'object', properties: {} } },
];

export function executeGroundTruthTool(name: string, args: any) {
  switch (name) {
    case 'truth_lookup': {
      const gt = getGroundTruth();
      if (!gt) return { status: 'error', error: `Ground-truth registry not found at ${GROUND_TRUTH_PATH}` };
      if (!args.key) return { status: 'error', error: 'Missing key' };
      const fact = (gt.facts || []).find((f: any) => f.key === args.key);
      if (!fact) return { status: 'ok', found: false, available_keys: (gt.facts || []).map((f: any) => f.key) };
      return { status: 'ok', found: true, fact };
    }
    case 'truth_file_map': {
      const gt = getGroundTruth();
      if (!gt) return { status: 'error', error: 'Ground-truth registry not found' };
      return { status: 'ok', real: gt.fileMap?.real || {}, hallucinated: gt.fileMap?.hallucinated || [] };
    }
    case 'truth_invariants': {
      const gt = getGroundTruth();
      if (!gt) return { status: 'error', error: 'Ground-truth registry not found' };
      return { status: 'ok', invariants: gt.toolchain?.invariants || [], count: (gt.toolchain?.invariants || []).length };
    }
    case 'truth_design_tokens': {
      const gt = getGroundTruth();
      if (!gt) return { status: 'error', error: 'Ground-truth registry not found' };
      return { status: 'ok', tokens: gt.designTokens || {} };
    }
    case 'truth_layout_gates': {
      const gt = getGroundTruth();
      if (!gt) return { status: 'error', error: 'Ground-truth registry not found' };
      return { status: 'ok', layout: gt.layout || {} };
    }
    case 'truth_care_score': {
      const gt = getGroundTruth();
      if (!gt) return { status: 'error', error: 'Ground-truth registry not found' };
      const cs = gt.careScore || {};
      return { status: 'ok', formula: 'care_score = spoons*0.40 + love*0.30 + mesh*0.20 + rituals*0.10', weights: cs.weights || {}, location: cs.location || 'unknown' };
    }
    case 'truth_mcp_inventory': {
      const gt = getGroundTruth();
      if (!gt) return { status: 'error', error: 'Ground-truth registry not found' };
      return { status: 'ok', inventory: gt.mcpInventory || {} };
    }
    case 'truth_manifest': {
      const gt = getGroundTruth();
      const crew = (gt && gt.crew) || {};
      const agents = getAgents().map((a: any) => ({
        name: a.name, description: a.description, triad_archetype: a.triad_archetype,
        temperature: a.temperature,
        ...(args.includeCompetence !== false ? { competence: a.competence, not_competent: a.not_competent } : {}),
      }));
      return { status: 'ok', manifest_path: crew.manifest || MANIFEST_PATH, protocol_path: crew.protocol || null, count: agents.length, agents };
    }
    case 'truth_verify_baseline': {
      const gt = getGroundTruth();
      if (!gt) return { status: 'error', error: 'Ground-truth registry not found' };
      const v = gt.verify || {};
      return { status: 'ok', baseline: v.baseline || 'unknown', runTwice: v.runTwice === true, command: v.command || 'unknown', knownFlakes: v.knownFlakes || [] };
    }
    case 'truth_register_fact': {
      const target = args.file ? path.resolve(args.file) : GROUND_TRUTH_PATH;
      const gt = readJsonSafe(target);
      if (!gt) return { status: 'error', error: `Registry not found at ${target}` };
      if (!args.key || !args.claim || !args.evidence || !args.citation) return { status: 'error', error: 'Missing key, claim, evidence, or citation' };
      if (!/^[a-z0-9_-]+$/.test(args.key)) return { status: 'error', error: `Invalid fact key: ${args.key}` };
      const existing = (gt.facts || []).find((f: any) => f.key === args.key);
      if (existing) return { status: 'error', error: `Fact key already exists: ${args.key}` };
      const fact = { key: args.key, claim: args.claim, evidence: args.evidence, citation: args.citation, verified: true };
      gt.facts = gt.facts || [];
      gt.facts.push(fact);
      try { fs.writeFileSync(target, JSON.stringify(gt, null, 2) + '\n', 'utf-8'); } catch (e: any) { return { status: 'error', error: `Failed to persist: ${e.message}` }; }
      return { status: 'ok', persisted: true, file: target, fact, factCount: gt.facts.length };
    }
    case 'truth_facts': {
      const gt = getGroundTruth();
      if (!gt) return { status: 'error', error: 'Ground-truth registry not found' };
      const facts = (gt.facts || []).filter((f: any) => args.verifiedOnly !== false || f.verified !== false);
      return { status: 'ok', facts, count: facts.length };
    }
    case 'truth_paths': {
      const gt = getGroundTruth();
      if (!gt) return { status: 'error', error: 'Ground-truth registry not found' };
      return { status: 'ok', paths: gt.paths || {} };
    }
    case 'truth_evidence': {
      const categories = [
        { type: 'Test Suite Output', cite: 'Vitest reports all passing (verified)' },
        { type: 'Compiler Output', cite: 'TypeScript passes (tsc --noEmit)' },
        { type: 'Deployment Log', cite: 'Deployed as Version [ID]' },
        { type: 'Source Code', cite: 'Care score formula at DashboardPage.tsx:66-72' },
        { type: 'Verify Suite', cite: 'Verify suite reports 186/186 checks passing' },
        { type: 'Primary Source', cite: 'Per [source], Section [n]' },
        { type: 'Published DOI', cite: 'As documented in Paper XIX, Section 3' },
      ];
      return { status: 'ok', categories };
    }
    case 'truth_health': {
      const gt = getGroundTruth();
      if (!gt) return { status: 'error', error: `Registry missing at ${GROUND_TRUTH_PATH}` };
      const sections = ['paths', 'toolchain', 'verify', 'careScore', 'designTokens', 'layout', 'mcpInventory', 'fileMap', 'crew', 'facts'];
      const present = sections.filter(s => gt[s] !== undefined);
      const missing = sections.filter(s => gt[s] === undefined);
      const facts = gt.facts || [];
      const verifiedCount = facts.filter((f: any) => f.verified === true).length;
      return { status: 'ok', file: GROUND_TRUTH_PATH, sections_present: present.length, sections_total: sections.length, missing_sections: missing, facts: facts.length, verified_facts: verifiedCount, unverified_facts: facts.length - verifiedCount, healthy: missing.length === 0 };
    }
    default:
      return { status: 'error', error: `Unknown tool: ${name}` };
  }
}
