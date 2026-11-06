/**
 * P31 Design System MCP Server — Ported from production/cli/design-mcp-server.js
 * Exposes design tokens, component schemas, and usage data via MCP stdio JSON-RPC.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const tokensFile = path.join(ROOT, 'tokens', 'tokens.yml');

// ─── Load tokens ─────────────────────────────────────────────────────────────

let tokens: any = {};
try {
  if (fs.existsSync(tokensFile)) {
    tokens = yaml.parse(fs.readFileSync(tokensFile, 'utf8'));
  }
} catch (_) { /* ignore */ }

// ─── Token resolver ──────────────────────────────────────────────────────────

function dt(pathStr: string) {
  const parts = pathStr.split('.');
  let node = tokens;
  for (const part of parts) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return (node != null && typeof node === 'object' && node['$value'] != null) ? node['$value'] : node;
}

function resolveReferences(value: any, seen = new Set<string>()): any {
  if (typeof value !== 'string') return value;
  return value.replace(/\{([^}]+)\}/g, (_, ref) => {
    if (seen.has(ref)) throw new Error(`Circular reference: ${ref}`);
    seen.add(ref);
    const resolved = dt(ref);
    if (resolved === undefined) throw new Error(`Unresolved reference: ${ref}`);
    return resolveReferences(resolved, seen);
  });
}

function tokenResolve(pathStr: string) {
  const raw = dt(pathStr);
  if (raw === undefined) return null;
  return resolveReferences(raw);
}

// ─── Flatten token tree ──────────────────────────────────────────────────────

function flattenTokens(node: any, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};
  if (typeof node === 'object' && node !== null) {
    if (node['$value'] !== undefined) {
      result[prefix || 'value'] = { value: node['$value'], type: node['$type'] || 'string', description: node['$description'] || '' };
    } else {
      for (const key of Object.keys(node)) {
        if (key.startsWith('$')) continue;
        const childPrefix = prefix ? `${prefix}.${key}` : key;
        Object.assign(result, flattenTokens(node[key], childPrefix));
      }
    }
  }
  return result;
}

// ─── Component definitions ───────────────────────────────────────────────────

const COMPONENTS: any[] = [];

function loadComponents() {
  const regFile = path.join(ROOT, 'packages', 'design-core', 'registry.json');
  if (!fs.existsSync(regFile)) return;
  try {
    const reg = JSON.parse(fs.readFileSync(regFile, 'utf8'));
    for (const item of reg.items || []) {
      const props: any = {};
      if (item.props) {
        for (const [pname, pdef] of Object.entries(item.props)) { const pd = pdef as any;
          props[pname] = { type: pd.type || "string", default: pd.default };
          if (pd.options) props[pname].options = pd.options;
          if (pd.range) props[pname].range = pd.range;
        }
      }
      COMPONENTS.push({ name: item.name, description: item.description, css_class: item.cssClass, variants: item.variants || [], props, slots: item.slots || [], tokens: item.tokens || [] });
    }
  } catch (_) { /* ignore */ }
}

loadComponents();

// ─── Tool Definitions ────────────────────────────────────────────────────────

export const DESIGN_TOOLS = [
  { name: 'token_resolve', description: 'Resolve a DTCG token path to its computed value.', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
  { name: 'component_schema', description: 'Get the full schema for a component.', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'component_usage', description: 'Find which sovereign HTML pages use a given component.', inputSchema: { type: 'object', properties: { name: { type: 'string' } } } },
  { name: 'token_list', description: 'List all available token paths with their values and types.', inputSchema: { type: 'object', properties: { prefix: { type: 'string' } } } },
  { name: 'layout_generate', description: 'Generate sovereign HTML layout from a JSON description.', inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['hero', 'tetra-grid', 'card-grid', 'section', 'cta'] }, format: { type: 'string', enum: ['html', 'a2ui'] } }, required: ['type'] } },
  { name: 'validate_component', description: 'Validate a component or template code against P31 spatial rules.', inputSchema: { type: 'object', properties: { code: { type: 'string' }, type: { type: 'string', enum: ['component', 'template'] } }, required: ['code', 'type'] } },
  { name: 'audit_tokens', description: 'Audit the design token tree for orphans, dead references, and missing values.', inputSchema: { type: 'object', properties: { tokensPath: { type: 'string' } } } },
  { name: 'suggest_fix', description: 'Suggest a fix for a common design-system violation.', inputSchema: { type: 'object', properties: { violation: { type: 'string' }, code: { type: 'string' } }, required: ['violation', 'code'] } },
  { name: 'validate_output', description: 'Fail-closed validation of generated code.', inputSchema: { type: 'object', properties: { code: { type: 'string' }, component: { type: 'string' } }, required: ['code'] } },
  { name: 'scaffold_component', description: 'Return a contract-conformant scaffold for a known component.', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'propose_page', description: 'Propose a sovereign page composed from canon components.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, type: { type: 'string', enum: ['hero', 'tetra-grid', 'card-grid', 'section', 'cta'] }, components: { type: 'array', items: { type: 'string' } } }, required: ['type', 'components'] } },
];

// ─── Tool Execution ──────────────────────────────────────────────────────────

export function executeDesignTool(name: string, args: any) {
  switch (name) {
    case 'token_resolve': {
      const value = tokenResolve(args.path);
      if (value === null) return { error: `Token path not found: "${args.path}"`, status: 'error' };
      const raw = dt(args.path);
      return { path: args.path, value: typeof value === 'string' ? value : JSON.stringify(value), type: (raw && raw['$type']) || typeof value, status: 'ok' };
    }
    case 'component_schema': {
      const comp = COMPONENTS.find(c => c.name.toLowerCase() === (args.name || '').toLowerCase());
      if (!comp) return { error: `Unknown component: ${args.name}`, status: 'error' };
      const resolvedTokens: Record<string, any> = {};
      for (const t of comp.tokens) { try { resolvedTokens[t] = tokenResolve(t); } catch {} }
      return { component: { ...comp, resolved_tokens: resolvedTokens }, status: 'ok' };
    }
    case 'component_usage': {
      const usage: Record<string, any> = {};
      for (const comp of COMPONENTS) usage[comp.name] = { pages: [], total: 0 };
      if (args.name) {
        const comp = COMPONENTS.find(c => c.name.toLowerCase() === args.name.toLowerCase());
        if (!comp) return { error: `Unknown component: ${args.name}`, status: 'error' };
        return { name: comp.name, usage: usage[comp.name], status: 'ok' };
      }
      return { components: usage, status: 'ok' };
    }
    case 'token_list': {
      const all = flattenTokens(tokens);
      if (args.prefix) {
        const filtered: Record<string, any> = {};
        for (const [k, v] of Object.entries(all)) { if (k.startsWith(args.prefix)) filtered[k] = v; }
        return { tokens: filtered, total: Object.keys(filtered).length, status: 'ok' };
      }
      return { tokens: all, total: Object.keys(all).length, status: 'ok' };
    }
    case 'layout_generate': {
      // Simplified layout generation — full implementation uses renderLayout from tokens/shared/layout.js
      const layouts: Record<string, string> = {
        hero: '<section class="hero"><h1>{{title}}</h1><p>{{subtitle}}</p><div class="ctas">{{ctas}}</div></section>',
        'tetra-grid': '<section class="tetra-grid">{{items}}</section>',
        'card-grid': '<section class="card-grid">{{items}}</section>',
        section: '<section><h2>{{heading}}</h2><p>{{description}}</p></section>',
        cta: '<section class="cta"><h2>{{heading}}</h2><div class="buttons">{{buttons}}</div></section>',
      };
      return { html: layouts[args.type] || layouts.section, status: 'ok' };
    }
    case 'validate_component': {
      const code = args.code || '';
      const violations: string[] = [];
      const warnings: string[] = [];
      if (args.type === 'component') {
        const marginMatches = code.match(/margin[A-Z]?:\s*['"]?-?\d+px['"]?/g) || [];
        const transformMatches = code.match(/transform:\s*['"]?translate[XY]?\([^)]+px\)/g) || [];
        const positionMatches = code.match(/position:\s*['"]?(relative|absolute)/g) || [];
        const allHardcoded = [...marginMatches, ...transformMatches, ...positionMatches];
        if (allHardcoded.length > 0) violations.push(`Forbidden spacing: ${allHardcoded.join(', ')}`);
      }
      return { valid: violations.length === 0, violations, warnings, status: 'ok' };
    }
    case 'audit_tokens': {
      const tokensPath = args.tokensPath || tokensFile;
      if (!fs.existsSync(tokensPath)) return { error: `Tokens file not found: ${tokensPath}`, valid: false, status: 'error' };
      try {
        const parsed = yaml.parse(fs.readFileSync(tokensPath, 'utf8'));
        const defined = new Set<string>();
        function walk(node: any, p: string) {
          if (!node || typeof node !== 'object') return;
          const keys = Object.keys(node).filter(k => !k.startsWith('$'));
          if (keys.length === 0) return;
          const hasValue = node.$value !== undefined;
          const hasType = node.$type !== undefined;
          if (hasValue || hasType) { if (p) defined.add(p); }
          for (const key of keys) walk(node[key], p ? `${p}.${key}` : key);
        }
        walk(parsed, '');
        const orphanedTokens = [...defined].filter(t => !Object.keys(parsed.component || {}).some(c => parsed.component[c]?.tokens?.includes(t)));
        return { valid: orphanedTokens.length === 0, orphanedTokens, status: 'ok' };
      } catch (e: any) {
        return { error: e.message, status: 'error' };
      }
    }
    case 'suggest_fix': {
      const violation = args.violation || '';
      const code = args.code || '';
      let suggestion = '';
      let fixedCode = code;
      if (/margin\s*:\s*['"]?-?\d+px['"]?/.test(violation)) { suggestion = 'Replace hardcoded margin with template-level spacing.'; fixedCode = code.replace(/margin\s*:\s*['"]?-?\d+px['"]?/g, 'gap: 16px'); }
      else if (/height\s*:\s*56px/.test(violation)) { suggestion = 'Use the design token height (48px).'; fixedCode = code.replace(/height\s*:\s*56px/g, 'height: 48px'); }
      else if (/position\s*:\s*relative/.test(violation)) { suggestion = 'Remove position: relative.'; fixedCode = code.replace(/position\s*:\s*relative/g, '/* position removed */'); }
      else { suggestion = 'No specific fix pattern matched.'; }
      return { suggestion, fixedCode, status: 'ok' };
    }
    case 'validate_output': {
      const code = String(args.code || '');
      const violations: string[] = [];
      if (/#[0-9a-fA-F]{3,8}\b/.test(code)) violations.push('hardcoded_hex: replace with a var(--p31-*) token');
      if (/rgba?\([^)]*\)/.test(code)) violations.push('raw_color: replace with a color token');
      if (/style=\{/.test(code)) violations.push('inline_style: use tokens or catalog classes');
      if (/[\u{1F300}-\u{1F9FF}]/u.test(code)) violations.push('emoji_icon: use the P31 icon system');
      if (/primitive\.|semantic\.|component\./.test(code)) violations.push('legacy_token_vocabulary: use p31.* paths');
      return { valid: violations.length === 0, violations, status: 'ok' };
    }
    case 'scaffold_component': {
      const comp = COMPONENTS.find(c => c.name.toLowerCase() === (args.name || '').toLowerCase());
      if (!comp) return { error: `Component not found: ${args.name}`, status: 'error' };
      const cls = comp.css_class || comp.name.toLowerCase();
      return { name: comp.name, css_class: cls, contract: { props: Object.keys(comp.props || {}), slots: comp.slots || [], tokens: comp.tokens || [] }, status: 'ok' };
    }
    case 'propose_page': {
      const VALID_TYPES = ['hero', 'tetra-grid', 'card-grid', 'section', 'cta'];
      if (!VALID_TYPES.includes(args.type)) return { error: `Invalid type: ${args.type}`, status: 'error' };
      const errors: string[] = [];
      const sections = (args.components || []).map((c: string) => {
        const comp = COMPONENTS.find(x => x.name.toLowerCase() === c.toLowerCase());
        if (!comp) { errors.push(`unknown_component: ${c}`); return null; }
        return { component: comp.name, css_class: comp.css_class };
      }).filter(Boolean);
      return { valid: errors.length === 0, page: { title: args.title || null, type: args.type, sections }, errors, status: errors.length === 0 ? 'ok' : 'error' };
    }
    default:
      return { error: `Unknown tool: ${name}`, status: 'error' };
  }
}
