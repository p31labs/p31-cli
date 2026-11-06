/**
 * P31 SOULSAFE MCP Server — Ported from production/cli/soulsafe-server.js
 * 3-Gate Verification Protocol Expert (Paper XIX)
 */

import fs from 'fs';
import path from 'path';

const AGENTS_ROOT = path.resolve(process.env.HOME || '/home/p31', 'p31-agents');
const MANIFEST_PATH = path.join(AGENTS_ROOT, 'manifest.yaml');
const GROUND_TRUTH_PATH = path.join(AGENTS_ROOT, 'ground-truth.json');
const SOULSAFE_PATH = path.join(AGENTS_ROOT, 'SOULSAFE.md');
const PROTOCOL_VERSION = '2026-07-28';

function readFileSafe(filePath: string) {
  try { return fs.readFileSync(path.resolve(filePath), 'utf-8'); } catch { return null; }
}

function readJsonSafe(filePath: string) {
  const content = readFileSafe(filePath);
  if (!content) return null;
  try { return JSON.parse(content); } catch { return null; }
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
  const manifest = parseManifestYaml(readFileSafe(MANIFEST_PATH) || '');
  if (manifest.length > 0) return manifest;
  return [
    { name: 'soulsafe-architect', description: 'Orchestrator + 3-gate verification', triad_archetype: 'Architect', temperature: 0.2, model: 'inherit', tools: ['read', 'write', 'edit', 'glob', 'grep', 'bash'], competence: ['3-gate protocol', 'OQE evidence classification', 'severity grading', 'Red Board'], not_competent: ['surface-specific expertise'] },
  ];
}

function getGroundTruth() {
  return readJsonSafe(GROUND_TRUTH_PATH);
}

function findOwningExpert(surface: string) {
  const agents = getAgents();
  const tokens = String(surface || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let best = null;
  let bestScore = 0;
  for (const a of agents) {
    const hay = `${a.description} ${(a.competence || []).join(' ')}`.toLowerCase();
    let score = 0;
    for (const t of tokens) if (hay.includes(t)) score += 1;
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return bestScore > 0 ? best : null;
}

export const SOULSAFE_TOOLS = [
  { name: 'soulsafe_tagout', description: 'Evaluate a task against the competence boundary.', inputSchema: { type: 'object', properties: { task: { type: 'string' }, surface: { type: 'string' }, agent: { type: 'string' } }, required: ['task'] } },
  { name: 'soulsafe_redboard_detect', description: 'Run Red Board diagnostics.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, signals: { type: 'object' } } } },
  { name: 'soulsafe_zero_work', description: 'Classify a statement as a zero-work hazard.', inputSchema: { type: 'object', properties: { statement: { type: 'string' } }, required: ['statement'] } },
  { name: 'soulsafe_oqe_classify', description: 'Classify a claim into an OQE category.', inputSchema: { type: 'object', properties: { claim: { type: 'string' } }, required: ['claim'] } },
  { name: 'soulsafe_severity', description: 'Grade a finding by severity.', inputSchema: { type: 'object', properties: { finding: { type: 'string' }, details: { type: 'string' } }, required: ['finding'] } },
  { name: 'soulsafe_policy', description: 'Look up a SOULSAFE protocol section.', inputSchema: { type: 'object', properties: { section: { type: 'string' } }, required: ['section'] } },
  { name: 'soulsafe_gate1_self_review', description: 'Gate 1 — self-review checklist.', inputSchema: { type: 'object', properties: { change: { type: 'string' }, claims: { type: 'array', items: { type: 'string' } } }, required: ['change'] } },
  { name: 'soulsafe_gate2_cross_review', description: 'Gate 2 — cross-review with information barrier.', inputSchema: { type: 'object', properties: { change: { type: 'string' }, reviewer: { type: 'string' } }, required: ['change'] } },
  { name: 'soulsafe_gate3_full', description: 'Gate 3 — architect verification.', inputSchema: { type: 'object', properties: { change: { type: 'string' } }, required: ['change'] } },
  { name: 'soulsafe_run_protocol', description: 'Run the full SOULSAFE 3-gate protocol.', inputSchema: { type: 'object', properties: { change: { type: 'string' }, surface: { type: 'string' } }, required: ['change'] } },
  { name: 'soulsafe_manifest', description: 'List the crew agents.', inputSchema: { type: 'object', properties: { includeCompetence: { type: 'boolean' } } } },
  { name: 'soulsafe_competence_check', description: 'Check whether a surface falls inside a given agent\'s competence.', inputSchema: { type: 'object', properties: { agent: { type: 'string' }, surface: { type: 'string' } }, required: ['agent', 'surface'] } },
  { name: 'soulsafe_verify_invariants', description: 'Report the canonical toolchain invariants.', inputSchema: { type: 'object', properties: {} } },
  { name: 'soulsafe_protocol_info', description: 'Report server and protocol metadata.', inputSchema: { type: 'object', properties: {} } },
];

export function executeSoulsafeTool(name: string, args: any): any {
  switch (name) {
    case 'soulsafe_tagout': {
      const owning = findOwningExpert(args.surface);
      if (!owning) return { status: 'ok', tag_out: true, recommendation: 'No owning expert matched. Tag out to SOULSAFE Architect.' };
      return { status: 'ok', tag_out: false, owning_expert: owning.name, requesting_agent: args.agent || 'unknown' };
    }
    case 'soulsafe_redboard_detect': {
      const t = String(args.text || '').toLowerCase();
      const detected: any[] = [];
      if (/typo/i.test(t) || /declining (quality|output)/.test(t)) detected.push({ mode: 'burnout', label: 'Burnout', response: 'Halt current task. Enforce rest block.' });
      if (/grandiose|scope expansion|(3|three)[+ ]am/.test(t)) detected.push({ mode: 'hypomania', label: 'Hypomania', response: 'Flag output for review. Do not deploy without gate check.' });
      if (/withdraw|scrap everything|abandon[- ]ship/.test(t)) detected.push({ mode: 'rsd_collapse', label: 'RSD Collapse', response: 'Validate the work done. Do not agree to scrap everything.' });
      return { status: 'ok', detected, clean: detected.length === 0 };
    }
    case 'soulsafe_zero_work': {
      const stmt = String(args.statement || '').toLowerCase().trim();
      const hazards = ['everything is going to be okay', 'i know how you feel', "it'll work out", 'it will work out', 'thoughts and prayers'];
      const hit = hazards.find(h => stmt.includes(h));
      if (hit) return { status: 'ok', hazardous: true, classification: 'zero-work hazard', reason: `Consumes cognition without actionable info: "${hit}"` };
      return { status: 'ok', hazardous: false, classification: 'actionable' };
    }
    case 'soulsafe_oqe_classify': {
      const c = String(args.claim || '').toLowerCase();
      let category = 'Aspirational';
      if (/vitest|test suite|all passing|tests pass/i.test(c)) category = 'Test Suite Output';
      else if (/tsc|typescript|exit 0|compiler/i.test(c)) category = 'Compiler Output';
      else if (/wrangler|deploy(ed)? as|version \w*id/i.test(c)) category = 'Deployment Log';
      else if (/verify-shell|186\/186|verify suite/i.test(c)) category = 'Verify Suite';
      else if (/(\.tsx?|\.js|\.mjs)(:\d+)?|source code|at .*:[0-9]+/.test(c)) category = 'Source Code';
      else if (/10\.5281|doi|zenodo/i.test(c)) category = 'Published DOI';
      else if (/per .* section|datasheet|spec(ification)?|legal|primary source/i.test(c)) category = 'Primary Source';
      return { status: 'ok', category, traceable: category !== 'Aspirational' };
    }
    case 'soulsafe_severity': {
      const f = String(args.finding || '').toLowerCase();
      const d = String(args.details || '').toLowerCase();
      const hay = `${f} ${d}`;
      let severity = 'medium';
      if (/secret|leak|corrupt|breaks? (a )?gate|blocks? (the )?deploy/i.test(hay)) severity = 'critical';
      else if (/production|feature path|breaks? .*flow|data loss/i.test(hay)) severity = 'high';
      else if (/cosmetic|non-functional|visual|a11y gap/i.test(hay)) severity = 'medium';
      else if (/style|naming|nit|formatting/i.test(hay)) severity = 'low';
      return { status: 'ok', severity };
    }
    case 'soulsafe_policy': {
      const sections: Record<string, string> = {
        competence: 'No single agent operates outside its verified lane.',
        red_board: 'Monitor for Burnout, Hypomania, and RSD Collapse.',
        oqe: 'Every claim must trace to Test Suite Output, Compiler Output, Deployment Log, Source Code, Verify Suite, Primary Source, or Published DOI.',
        zero_work: '"Everything is going to be okay" is a system hazard. Replace with specific, actionable information.',
        gates: 'Gate 1: self-review. Gate 2: cross-review with information barrier. Gate 3: architect verification. Critical findings block deployment.',
        severity: 'Critical blocks deploy. High blocks deploy (fix first). Medium deploy allowed after review. Low deploy allowed.',
      };
      const key = args.section || 'gates';
      return { status: 'ok', section: key, found: key in sections, content: sections[key] || `Unknown section: ${key}` };
    }
    case 'soulsafe_gate1_self_review': {
      return { status: 'ok', gate: 1, name: 'Self-Review', change: args.change, checklist: [
        { item: 'Every claim carries an OQE citation', required: true },
        { item: 'Known failure modes identified', required: true },
        { item: 'Confidence scores are NOT shared downstream', required: true },
        { item: 'No zero-work language', required: true },
      ] };
    }
    case 'soulsafe_gate2_cross_review': {
      return { status: 'ok', gate: 2, name: 'Cross-Review (Information Barrier)', change: args.change, reviewer: args.reviewer || 'unassigned', informationBarrier: true, generatorConfidenceStripped: true };
    }
    case 'soulsafe_gate3_full': {
      const gt = getGroundTruth() || {};
      const verify = gt.verify || { baseline: '~186/186 gates', runTwice: true, command: 'NODE_PATH=/home/p31/node_modules node scripts/verify-shell.cjs' };
      return { status: 'ok', gate: 3, name: 'Architect Verification', change: args.change, baseline: verify.baseline, runTwice: verify.runTwice === true, command: verify.command };
    }
    case 'soulsafe_run_protocol': {
      const tagout: any = executeSoulsafeTool('soulsafe_tagout', { task: args.change, surface: args.surface });
      const gate1: any = executeSoulsafeTool('soulsafe_gate1_self_review', { change: args.change });
      const gate2: any = executeSoulsafeTool('soulsafe_gate2_cross_review', { change: args.change });
      const gate3: any = executeSoulsafeTool('soulsafe_gate3_full', { change: args.change });
      const severity: any = executeSoulsafeTool('soulsafe_severity', { finding: args.change });
      const critical = severity.severity === 'critical';
      return { status: 'ok', protocol: 'SOULSAFE 3-Gate (Paper XIX)', change: args.change, tagout, gates: [gate1, gate2, gate3], severity: severity.severity, verdict: critical ? 'DEPLOY BLOCKED — critical finding' : severity.severity === 'high' ? 'DEPLOY BLOCKED — high finding, fix first' : 'CLEARED — deploy allowed after gate pass' };
    }
    case 'soulsafe_manifest': {
      const agents = getAgents().map((a: any) => ({
        name: a.name, description: a.description, triad_archetype: a.triad_archetype,
        temperature: a.temperature, model: a.model,
        ...(args.includeCompetence !== false ? { competence: a.competence, not_competent: a.not_competent } : {}),
      }));
      return { status: 'ok', manifest: MANIFEST_PATH, count: agents.length, agents };
    }
    case 'soulsafe_competence_check': {
      const target = getAgents().find((a: any) => a.name === args.agent);
      if (!target) return { status: 'error', error: `Unknown agent: ${args.agent}` };
      const owning = findOwningExpert(args.surface);
      const inLane = owning && owning.name === target.name;
      return { status: 'ok', agent: args.agent, surface: args.surface, in_lane: inLane, owning_expert: owning ? owning.name : null };
    }
    case 'soulsafe_verify_invariants': {
      const gt = getGroundTruth() || {};
      const invariants = (gt.toolchain && gt.toolchain.invariants) || [];
      return { status: 'ok', source: GROUND_TRUTH_PATH, invariants, count: invariants.length };
    }
    case 'soulsafe_protocol_info': {
      return { status: 'ok', server: { name: 'p31-soulsafe', version: '2.0.0' }, protocolVersion: PROTOCOL_VERSION, consumes: { manifest: MANIFEST_PATH, groundTruth: GROUND_TRUTH_PATH, protocol: SOULSAFE_PATH } };
    }
    default:
      return { status: 'error', error: `Unknown tool: ${name}` };
  }
}
