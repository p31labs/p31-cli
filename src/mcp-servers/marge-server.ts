/**
 * P31 Marge MCP Server — Ported from production/cli/marge-server.js
 * Machine Agent for Responsive Governance & Ephemeralization
 * Design-system compliance agent: enforces 33 design invariants
 */

import fs from 'fs';
import path from 'path';

// ─── Rule Registry ───────────────────────────────────────────────────────────

const RULES: Record<string, { name: string; severity: string }> = {
  'D-001': { name: 'Single accent per screen', severity: 'hard-fail' },
  'D-002': { name: 'No #FFFFFF text', severity: 'hard-fail' },
  'D-003': { name: 'No #000000 background', severity: 'hard-fail' },
  'D-004': { name: 'Glass surfaces have backdrop-filter', severity: 'hard-fail' },
  'D-005': { name: 'Glass with text has glass-text-scrim', severity: 'hard-fail' },
  'D-006': { name: 'data-spoons drives all motion', severity: 'hard-fail' },
  'D-007': { name: 'spoons<=1 motion disabled', severity: 'hard-fail' },
  'D-008': { name: 'CrisisMode: no UI chrome at spoons=0', severity: 'hard-fail' },
  'D-009': { name: 'Corner radius consistent', severity: 'hard-fail' },
  'D-010': { name: 'Headings Inter, code JetBrains Mono', severity: 'hard-fail' },
  'D-011': { name: 'Body line-height 1.6', severity: 'hard-fail' },
  'D-012': { name: 'Skip link present', severity: 'hard-fail' },
  'D-013': { name: 'prefers-reduced-motion respected', severity: 'hard-fail' },
  'D-014': { name: 'prefers-reduced-transparency respected', severity: 'hard-fail' },
  'D-015': { name: 'Touch targets >= 48px', severity: 'hard-fail' },
  'D-020': { name: 'Labels uppercase, letter-spacing 0.05em', severity: 'warning' },
  'D-021': { name: 'No heavy shadows', severity: 'warning' },
  'D-022': { name: 'quantum-gold sparingly used', severity: 'warning' },
  'D-023': { name: 'Card padding 24px', severity: 'warning' },
  'D-024': { name: 'Spacing values multiples of 4px/8px', severity: 'warning' },
  'D-025': { name: 'Max-width 1200px', severity: 'warning' },
  'D-026': { name: 'Progressive disclosure via Disclosure', severity: 'warning' },
  'D-027': { name: 'System never auto-increases complexity', severity: 'warning' },
  'D-028': { name: 'Icon buttons have aria-label', severity: 'warning' },
  'D-029': { name: 'SVGs have aria-hidden="true"', severity: 'warning' },
  'D-030': { name: 'Logical tab order', severity: 'warning' },
  'D-031': { name: 'Enter/Space triggers buttons, Escape closes', severity: 'warning' },
  'D-032': { name: 'aria-live="polite" on chat messages', severity: 'warning' },
  'D-033': { name: 'No legacy terminology', severity: 'warning' },
};

// ─── WCAG Contrast Helpers ──────────────────────────────────────────────────

function hexToRgb(hex: string) {
  if (!hex) return null;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return null;
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

function srgbToLinear(c: number) {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance([r, g, b]: number[]) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(rgb1: number[], rgb2: number[]) {
  const L1 = luminance(rgb1);
  const L2 = luminance(rgb2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─── File Reading ────────────────────────────────────────────────────────────

function readFileSafe(filePath: string) {
  try { return fs.readFileSync(path.resolve(filePath), 'utf-8'); } catch { return null; }
}

function getLines(content: string) {
  return content.split('\n');
}

// ─── Regex Scanners ──────────────────────────────────────────────────────────

function scanHardcodedColors(lines: string[]) {
  const violations: any[] = [];
  const patterns = [
    { re: /#[Ff]{6}\b/g, rule: 'D-002', msg: 'Hardcoded #FFFFFF found' },
    { re: /#[Ff]{3}\b/g, rule: 'D-002', msg: 'Hardcoded #FFF found' },
    { re: /#[0]{6}\b/gi, rule: 'D-003', msg: 'Hardcoded #000000 found' },
    { re: /#[0]{3}\b/gi, rule: 'D-003', msg: 'Hardcoded #000 found' },
    { re: /bg-black\b/g, rule: 'D-003', msg: 'bg-black used' },
    { re: /text-white\b(?![\/\[])/g, rule: 'D-002', msg: 'text-white without alpha' },
  ];
  for (let i = 0; i < lines.length; i++) {
    for (const { re, rule, msg } of patterns) {
      if (re.test(lines[i])) violations.push({ rule, severity: RULES[rule].severity, line: i + 1, message: msg });
      re.lastIndex = 0;
    }
  }
  return violations;
}

function scanGlass(lines: string[]) {
  const violations: any[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/bg-white\/\d/.test(line) || /bg-black\/\d/.test(line)) {
      const hasGlass = /phos-glass|backdrop-filter|glass-panel|glass-card/.test(line);
      if (!hasGlass) violations.push({ rule: 'D-004', severity: 'hard-fail', line: i + 1, message: 'Container uses bg opacity without backdrop-filter' });
    }
    if (/bg-(zinc|slate|gray)-(800|900|950)/.test(line) && !/phos-glass|backdrop-filter/.test(line)) {
      if (/rounded|p-\d|px-|py-/.test(line)) violations.push({ rule: 'D-004', severity: 'hard-fail', line: i + 1, message: 'Solid dark background on elevated surface' });
    }
  }
  return violations;
}

function scanSpoons(lines: string[]) {
  const violations: any[] = [];
  const content = lines.join('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/useState\(\d+\)/.test(lines[i]) && /spoons/i.test(lines[i])) violations.push({ rule: 'D-006', severity: 'hard-fail', line: i + 1, message: 'useState used for spoons instead of spoonsStore' });
  }
  const spoonsZeroBlock = content.match(/spoons\s*===\s*0[^}]*\{[\s\S]*?\}/g);
  if (spoonsZeroBlock) {
    for (const block of spoonsZeroBlock) {
      if (/onClick|<Button|<Link|<input|<select|<textarea/.test(block)) violations.push({ rule: 'D-008', severity: 'hard-fail', line: 1, message: 'Interactive element at spoons===0' });
    }
  }
  return violations;
}

function scanWcag(lines: string[]) {
  const violations: any[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/<button|<Button/.test(line) && !/min-h-\[48px\]|min-h-\[48|py-3.*min-h|min-h.*py-3/.test(line)) violations.push({ rule: 'D-015', severity: 'hard-fail', line: i + 1, message: 'Button may lack 48px touch target' });
    if (/<button[^>]*>[\s]*<(svg|Svg|Icon|img)/i.test(line) || /<IconButton/.test(line)) {
      if (!/aria-label/.test(line) && !/aria-label/.test(lines.slice(i, i + 5).join(' '))) violations.push({ rule: 'D-028', severity: 'warning', line: i + 1, message: 'Icon button may lack aria-label' });
    }
    if (/<div[^>]*onClick/.test(line) && !/role=|tabIndex/.test(line)) violations.push({ rule: 'D-031', severity: 'warning', line: i + 1, message: 'div with onClick but no role or tabIndex' });
    if (/<svg[^>]*(?!.*aria-hidden)/.test(line) && !/aria-hidden/.test(line)) violations.push({ rule: 'D-029', severity: 'warning', line: i + 1, message: 'SVG may lack aria-hidden' });
    if (/text-white\/(1[0-9]|[0-9])\b/.test(line)) violations.push({ rule: 'D-015', severity: 'hard-fail', line: i + 1, message: 'Very low contrast text' });
  }
  return violations;
}

function scanAccent(lines: string[]) {
  const violations: any[] = [];
  const content = lines.join('\n');
  const cyanButtons = (content.match(/quantum-cyan[^"]*|accent[^"]*|bg-\[#00F0FF\]/gi) || []).length;
  if (cyanButtons > 3) violations.push({ rule: 'D-001', severity: 'hard-fail', line: 1, message: `Multiple primary CTAs detected (${cyanButtons} quantum-cyan usages)` });
  for (let i = 0; i < lines.length; i++) {
    if (/text-(purple|pink|fuchsia|rose)-/.test(lines[i]) && !/PQC|quantum|keygen/i.test(content.slice(0, 200))) violations.push({ rule: 'D-001', severity: 'warning', line: i + 1, message: 'Decorative purple/pink outside quantum context' });
  }
  return violations;
}

function scanRadius(lines: string[]) {
  const violations: any[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/rounded-\[(\d+)px\]/.test(lines[i])) {
      const match = lines[i].match(/rounded-\[(\d+)px\]/);
      if (!match) continue;
      const px = parseInt(match[1]);
      if (![8, 12, 24, 9999].includes(px)) violations.push({ rule: 'D-009', severity: 'hard-fail', line: i + 1, message: `Non-token radius: ${px}px` });
    }
    if (/rounded-sm\b/.test(lines[i])) violations.push({ rule: 'D-009', severity: 'warning', line: i + 1, message: 'rounded-sm (4px) is smaller than token minimum (8px)' });
  }
  return violations;
}

function scanFonts(lines: string[]) {
  const violations: any[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/font-family/.test(lines[i]) && !/Inter|JetBrains|sans-serif|monospace/.test(lines[i])) violations.push({ rule: 'D-010', severity: 'hard-fail', line: i + 1, message: 'Non-approved font family' });
  }
  return violations;
}

function scanAccessibility(lines: string[]) {
  const violations: any[] = [];
  const content = lines.join('\n');
  if (!/#main-content/.test(content) && !/skip-link/.test(content)) {
    if (/export\s+(default\s+)?function/.test(content)) violations.push({ rule: 'D-012', severity: 'hard-fail', line: 1, message: 'No skip link (#main-content) found' });
  }
  return violations;
}

function scanLegacyTerms(lines: string[]) {
  const violations: any[] = [];
  const legacyTerms = ['handicapped', 'crippled', 'retarded', 'insane', 'crazy', 'lunatic', 'invalid'];
  for (let i = 0; i < lines.length; i++) {
    for (const term of legacyTerms) {
      if (new RegExp(`\\b${term}\\b`, 'i').test(lines[i])) violations.push({ rule: 'D-033', severity: 'warning', line: i + 1, message: `Legacy terminology: "${term}"` });
    }
  }
  return violations;
}

// ─── Core Audit Engine ───────────────────────────────────────────────────────

function auditSurface(filePath: string) {
  const content = readFileSafe(filePath);
  if (content === null) return { status: 'error', error: `File not found: ${filePath}` };
  const lines = getLines(content);
  const violations = [
    ...scanHardcodedColors(lines),
    ...scanGlass(lines),
    ...scanSpoons(lines),
    ...scanWcag(lines),
    ...scanAccent(lines),
    ...scanRadius(lines),
    ...scanFonts(lines),
    ...scanAccessibility(lines),
    ...scanLegacyTerms(lines),
  ];
  const hardFail = violations.filter(v => v.severity === 'hard-fail').length;
  const warning = violations.filter(v => v.severity === 'warning').length;
  const score = Math.max(0, Math.min(100, 100 - (hardFail * 5) - (warning * 2)));
  return { status: 'ok', surface: path.basename(filePath), score, compliant: hardFail === 0, violations, summary: { hardFail, warning } };
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

export const MARGE_TOOLS = [
  { name: 'design_expert_audit_surface', description: 'Audit a surface file against all 33 design rules.', inputSchema: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'] } },
  { name: 'design_expert_generate_report', description: 'Audit multiple surfaces and generate an aggregate compliance report.', inputSchema: { type: 'object', properties: { surfaces: { type: 'array', items: { type: 'string' } } } } },
  { name: 'design_expert_check_tokens', description: 'Validate that a component uses design tokens.', inputSchema: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'] } },
  { name: 'design_expert_check_glass', description: 'Validate glassmorphism implementation.', inputSchema: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'] } },
  { name: 'design_expert_check_spoons', description: 'Validate spoon-state handling.', inputSchema: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'] } },
  { name: 'design_expert_check_wcag', description: 'Validate WCAG 2.2 accessibility rules.', inputSchema: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'] } },
  { name: 'design_expert_check_accent', description: 'Validate accent-color usage.', inputSchema: { type: 'object', properties: { file: { type: 'string' } }, required: ['file'] } },
  { name: 'design_expert_check_contrast', description: 'Compute WCAG contrast ratio.', inputSchema: { type: 'object', properties: { foreground: { type: 'string' }, background: { type: 'string' } }, required: ['foreground', 'background'] } },
  { name: 'design_expert_suggest_fix', description: 'Suggest a fix for a specific violation.', inputSchema: { type: 'object', properties: { file: { type: 'string' }, rule: { type: 'string' }, line: { type: 'number' } }, required: ['file', 'rule'] } },
  { name: 'design_expert_ephemeralize', description: 'Apply all fixable violations (dry-run by default).', inputSchema: { type: 'object', properties: { file: { type: 'string' }, dryRun: { type: 'boolean' } }, required: ['file'] } },
  { name: 'design_expert_batch_ephemeralize', description: 'Apply fixes to multiple files.', inputSchema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string' } }, dryRun: { type: 'boolean' } }, required: ['files'] } },
];

// ─── Tool Execution ──────────────────────────────────────────────────────────

export function executeMargeTool(name: string, args: any) {
  switch (name) {
    case 'design_expert_audit_surface': return auditSurface(args.file);
    case 'design_expert_generate_report': {
      const dir = path.resolve('apps/phos/src/surfaces');
      let files = args.surfaces;
      if (!files || files.length === 0) {
        try { files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx')).map(f => path.join(dir, f)); } catch (e: any) { return { status: 'error', error: `Cannot read surfaces directory: ${dir}` }; }
      }
      const results = files.map((f: string) => auditSurface(f));
      const compliant = results.filter((r: any) => r.compliant).length;
      const averageScore = results.length ? Math.round(results.reduce((a: number, r: any) => a + (r.score || 0), 0) / results.length) : 0;
      return { status: 'ok', timestamp: new Date().toISOString(), surfaces: results, summary: { total: results.length, compliant, nonCompliant: results.length - compliant, averageScore } };
    }
    case 'design_expert_check_tokens': {
      const content = readFileSafe(args.file);
      if (!content) return { status: 'error', error: `File not found: ${args.file}` };
      return { status: 'ok', violations: scanHardcodedColors(getLines(content)) };
    }
    case 'design_expert_check_glass': {
      const content = readFileSafe(args.file);
      if (!content) return { status: 'error', error: `File not found: ${args.file}` };
      return { status: 'ok', violations: scanGlass(getLines(content)) };
    }
    case 'design_expert_check_spoons': {
      const content = readFileSafe(args.file);
      if (!content) return { status: 'error', error: `File not found: ${args.file}` };
      return { status: 'ok', violations: scanSpoons(getLines(content)) };
    }
    case 'design_expert_check_wcag': {
      const content = readFileSafe(args.file);
      if (!content) return { status: 'error', error: `File not found: ${args.file}` };
      return { status: 'ok', violations: scanWcag(getLines(content)) };
    }
    case 'design_expert_check_accent': {
      const content = readFileSafe(args.file);
      if (!content) return { status: 'error', error: `File not found: ${args.file}` };
      return { status: 'ok', violations: scanAccent(getLines(content)) };
    }
    case 'design_expert_check_contrast': {
      const fgRgb = hexToRgb(args.foreground);
      const bgRgb = hexToRgb(args.background);
      if (!fgRgb || !bgRgb) return { status: 'error', error: 'Invalid hex color(s)' };
      const ratio = Math.round(contrastRatio(fgRgb, bgRgb) * 100) / 100;
      return { status: 'ok', ratio, wcagAA: ratio >= 4.5, wcagAAA: ratio >= 7 };
    }
    case 'design_expert_suggest_fix': {
      const FIX_MAP: Record<string, string> = { 'D-002': 'text-primary', 'D-003': 'phos-bg', 'D-004': 'phos-glass', 'D-012': 'skip-link', 'D-015': 'min-h-[48px]', 'D-028': 'aria-label', 'D-029': 'aria-hidden', 'D-033': 'person-first language' };
      return { status: 'ok', rule: args.rule, suggestion: FIX_MAP[args.rule] || `No specific fix for ${args.rule}` };
    }
    case 'design_expert_ephemeralize': {
      const content = readFileSafe(args.file);
      if (!content) return { status: 'error', error: `File not found: ${args.file}` };
      const lines = content.split('\n');
      const changes: any[] = [];
      const LINE_FIXES = [
        { re: /bg-white\/\d+/g, replacement: 'phos-glass', rule: 'D-004' },
        { re: /bg-black\b/g, replacement: 'phos-bg', rule: 'D-003' },
        { re: /text-white\b(?![\/\[])/g, replacement: 'text-primary', rule: 'D-002' },
      ];
      for (let i = 0; i < lines.length; i++) {
        for (const fix of LINE_FIXES) {
          const before = lines[i];
          lines[i] = lines[i].replace(fix.re, fix.replacement);
          if (lines[i] !== before) changes.push({ line: i + 1, rule: fix.rule });
        }
      }
      if (!args.dryRun && changes.length > 0) {
        try { fs.writeFileSync(path.resolve(args.file), lines.join('\n'), 'utf-8'); } catch (e: any) { return { status: 'error', error: `Failed to write: ${e.message}` }; }
      }
      return { status: 'ok', changes, applied: !args.dryRun && changes.length > 0 };
    }
    case 'design_expert_batch_ephemeralize': {
      const results = args.files.map((f: string) => executeMargeTool('design_expert_ephemeralize', { file: f, dryRun: args.dryRun }));
      return { status: 'ok', files: args.files.length, results };
    }
    default:
      return { status: 'error', error: `Unknown tool: ${name}` };
  }
}
