#!/usr/bin/env node
/**
 * Export P31 Unified Design System Manifest
 *
 * Usage:
 *   node cli/tokens/export-design-system.mjs                     -> stdout
 *   node cli/tokens/export-design-system.mjs --output design-system.json
 *
 * Generates a single JSON manifest containing:
 *   - Fully-resolved design tokens (DTCG format)
 *   - Component catalog with resolved token references
 *   - Icon catalog with SVG markup
 *   - WebMCP annotation JSON Schema
 *   - Sovereign design rules
 */

import yaml from 'yaml';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOKENS_FILE = path.join(__dirname, 'tokens.yml');
const COMPS_FILE  = path.join(__dirname, '..', '..', 'packages', 'design-core', 'registry.json');
// aiGuidance lives in the genui catalog (registry.json is a shadcn projection
// that drops it). Enrichment source, not a second contract: names match 1:1.
const AI_GUIDANCE_FILE = path.join(__dirname, '..', '..', 'packages', 'design-core', 'src', 'genui', 'catalog.json');
const ICONS_DIR   = '/home/p31/p31-icon-pack/icons';

// ─── Token resolution helpers ──────────────────────────────────────────

function getRaw(pathStr, tokens) {
  const parts = pathStr.split('.');
  let node = tokens;
  for (const part of parts) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  if (node == null) return undefined;
  if (typeof node === 'object' && node['$value'] !== undefined) {
    return node['$value'];
  }
  return node;
}

function resolveValue(value, tokens, visited = new Set()) {
  if (typeof value !== 'string') return value;
  if (!value.includes('{')) return value;
  return value.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\}/g, (_, ref) => {
    if (visited.has(ref)) {
      throw new Error(`Circular reference detected: ${ref}`);
    }
    visited.add(ref);
    const raw = getRaw(ref, tokens);
    if (raw === undefined) {
      throw new Error(`Unresolved reference: ${ref}`);
    }
    return resolveValue(raw, tokens, visited);
  });
}

const TOKEN_GROUP_NAMES = ['p31'];

function walkNode(obj, tokens, opts = {}, visited = new Set()) {
  const { allowedKeys } = opts;
  if (obj == null || typeof obj !== 'object') {
    if (typeof obj === 'string') return resolveValue(obj, tokens, visited);
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => walkNode(item, tokens, opts, new Set(visited)));
  }
  if ('$value' in obj) {
    const result = {};
    if (obj['$type'])        result.$type        = obj['$type'];
    if (obj['$description']) result.$description = obj['$description'];
    result.$value = resolveValue(obj['$value'], tokens, visited);
    return result;
  }
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('$')) continue;
    if (k === 'examples') continue;
    if (allowedKeys && !allowedKeys.has(k)) continue;
    const child = walkNode(v, tokens, opts, new Set(visited));
    if (child !== undefined && (typeof child !== 'object' || Object.keys(child).length > 0)) {
      result[k] = child;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

// ─── Icon helpers ──────────────────────────────────────────────────────

const REGULAR_ICONS = [
  { id: 'k4-tetrahedron',  name: 'K4 Tetrahedron',   file: 'regular/k4-tetrahedron.svg',  description: 'Foundational structure, sovereignty' },
  { id: 'molecule',        name: 'Molecule / Atom',   file: 'regular/molecule.svg',         description: 'Bonding, quantum mechanics, care connections' },
  { id: 'signal',          name: 'Signal',            file: 'regular/signal.svg',           description: 'Coordination, communication, mesh signalling' },
  { id: 'mesh-node',       name: 'Mesh Node',         file: 'regular/mesh-node.svg',        description: 'Mesh infrastructure, distributed nodes' },
  { id: 'spoon',           name: 'Spoon',             file: 'regular/spoon.svg',            description: 'Cognitive capacity, spoon-aware design' },
  { id: 'p31-wordmark',    name: 'P31 Wordmark',      file: 'regular/p31-wordmark.svg',     description: 'Sovereign brand identity' },
  { id: 'love-heart',      name: 'LOVE Heart',        file: 'regular/love-heart.svg',       description: 'Care economy, LOVE ledger' },
  { id: '863hz-resonance', name: '863 Hz Resonance',  file: 'regular/863hz-resonance.svg',  description: 'Phosphorus-31 Larmor frequency, quantum resonance' },
];

const ADVANCED_ICONS = [
  { id: 'sovereign-crown', name: 'Sovereign Crown', file: 'advanced/sovereign-crown.svg', description: 'Sovereign authority, six-faceted leadership' },
  { id: 'prism-fold',      name: 'Prism Fold',      file: 'advanced/prism-fold.svg',      description: 'Geometric transformation, multi-facet perspective' },
  { id: 'nebula-burst',    name: 'Nebula Burst',    file: 'advanced/nebula-burst.svg',    description: 'Emergence, chaos to structure, generative particles' },
  { id: 'comet-orb',       name: 'Comet Orb',       file: 'advanced/comet-orb.svg',       description: 'Swirling energy, harmonized orbital motion' },
];

const FAMILY_COLORS = {
  regular:  ['--p31-accent', '--p31-accent-violet', '--p31-text'],
  advanced: ['--p31-accent', '--p31-accent-violet', '--p31-accent-gold', '--p31-accent-green', '--p31-accent-iris', '--p31-accent-red'],
};

function readSvg(relPath) {
  try {
    return fs.readFileSync(path.join(ICONS_DIR, relPath), 'utf8').trim();
  } catch {
    return '';
  }
}

// ─── WebMCP schema ──────────────────────────────────────────────────────

function buildWebMcpSchema() {
  return {
    '$schema': 'http://json-schema.org/draft-07/schema#',
    title: 'MCPAnnotation',
    description: 'WebMCP annotation schema for declarative UI bindings. Combines MCPAttributeSchema attributes with MCPAnnotation runtime fields.',
    type: 'object',
    properties: {
      'data-mcp-tool':     { type: 'string' },
      'data-mcp-state':    { type: 'string' },
      'data-mcp-target':   { type: 'string' },
      'data-mcp-type':     { type: 'string', enum: ['control', 'action', 'state'] },
      'data-mcp-range':    { type: 'string' },
      'data-mcp-current':  { oneOf: [{ type: 'string' }, { type: 'number' }] },
      'data-mcp-href':     { type: 'string' },
      'data-mcp-external': { type: 'string', pattern: '^(true|false)$' },
      selector:            { type: 'string' },
      tagName:             { type: 'string' },
      childCount:          { type: 'number', minimum: 0 },
      isDisabled:          { type: 'boolean' },
      warnings:            { type: 'array', items: { type: 'string' } },
    },
    required: ['data-mcp-tool', 'selector', 'tagName', 'childCount', 'isDisabled', 'warnings'],
    additionalProperties: true,
  };
}

// ─── Component helpers ──────────────────────────────────────────────────

function resolveTokenRef(pathStr, tokens) {
  const raw = getRaw(pathStr, tokens);
  if (raw === undefined) return undefined;
  if (typeof raw === 'object') {
    return walkNode(raw, tokens);
  }
  return resolveValue(raw, tokens);
}

// ─── Main ──────────────────────────────────────────────────────────────

function main() {
  console.error('Loading sources...');
  const tokens      = yaml.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
  const reg = JSON.parse(fs.readFileSync(COMPS_FILE, 'utf8'));
  const aiByComponent = {};
  try {
    const cat = JSON.parse(fs.readFileSync(AI_GUIDANCE_FILE, 'utf8'));
    for (const c of cat.components || []) aiByComponent[c.name] = c.aiGuidance;
  } catch {
    // enrichment is optional — guidance falls back to empty
  }
  const components = { components: {} };
  for (const item of reg.items || []) {
    components.components[item.name] = {
      description: item.description,
      css_class: item.cssClass,
      tokens: item.tokens || [],
      slots: item.slots || [],
      variants: item.variants || [],
      props: item.props || {},
      // aiGuidance is the ARRAY form (canonical shape since the components.yml
      // regen); enriched from genui/catalog.json when registry.json omits it.
      aiGuidance: item.aiGuidance || aiByComponent[item.name] || {},
      // Derived deterministically when the source carries no `tool` field
      // (registry.json doesn't; components.yml carries render<Name>).
      tool: item.tool || 'render' + item.name,
    };
  }

  console.error('Resolving design tokens...');
  const resolvedTokens = {};
  for (const group of TOKEN_GROUP_NAMES) {
    if (tokens[group]) {
      resolvedTokens[group] = walkNode(tokens[group], tokens);
    }
  }

  const SOVEREIGN_KEYS = new Set([
    'bounding_boxes', 'layout_containers', 'spacing_rules',
    'cascade_layers', 'svg_rules', 'agent_prompt_injection',
    'examples', 'property-overrides', 'version_history'
  ]);

  const sovereign = {};
  for (const key of Object.keys(tokens)) {
    if (SOVEREIGN_KEYS.has(key)) {
      sovereign[key] = walkNode(tokens[key], tokens);
    }
  }

  console.error('Resolving component catalogs...');
  const componentList = [];
  for (const [name, comp] of Object.entries(components.components || {})) {
    const resolvedCompTokens = {};
    for (const t of (comp.tokens || [])) {
      const val = resolveTokenRef(t, tokens);
      if (val !== undefined) resolvedCompTokens[t] = val;
    }

    const aiGuidance = {};
    if (comp.aiGuidance) {
      if (comp.aiGuidance.useWhen)   aiGuidance.useWhen   = comp.aiGuidance.useWhen;
      if (comp.aiGuidance.avoidWhen) aiGuidance.avoidWhen = comp.aiGuidance.avoidWhen;
      if (comp.aiGuidance.examples)  aiGuidance.examples  = comp.aiGuidance.examples;
    }

    const props = {};
    for (const [propName, propDef] of Object.entries(comp.props || {})) {
      const out = { type: propDef.type || 'string' };
      if ('default' in propDef) out.default = propDef.default;
      if (propDef.options)      out.options = propDef.options;
      if (propDef.range)        out.range   = propDef.range;
      props[propName] = out;
    }

    componentList.push({
      name,
      description: comp.description,
      css_class:   comp.css_class,
      tool:        comp.tool || null,
      aiGuidance,
      props,
      slots:      comp.slots    || [],
      variants:   comp.variants || [],
      tokens:     resolvedCompTokens,
    });
  }

  console.error('Reading icon catalog...');
  const iconCatalog = [
    ...REGULAR_ICONS.map(i => ({ ...i, family: 'regular',  colors: FAMILY_COLORS.regular,  animated: true })),
    ...ADVANCED_ICONS.map(i => ({ ...i, family: 'advanced', colors: FAMILY_COLORS.advanced, animated: true })),
  ];

  console.error('Building WebMCP schema...');
  const webmcp = buildWebMcpSchema();

  // Build tools section — maps each tool name to its component bindings and schemas
  const tools = {};
  for (const comp of componentList) {
    if (comp.tool) {
      if (!tools[comp.tool]) {
        tools[comp.tool] = {
          description: `Renders or controls the ${comp.name} component`,
          components: [],
          tokens: [],
        };
      }
      tools[comp.tool].components.push(comp.name);
      if (comp.tokens) {
        tools[comp.tool].tokens.push(...Object.keys(comp.tokens));
      }
    }
  }

  const manifest = {
    '$schema': 'https://p31.ca/schemas/design-system.json',
    version:   tokens.version,
    metadata: {
      name:                tokens.metadata?.name,
      description:         tokens.metadata?.description,
      philosophy:          tokens.metadata?.philosophy,
      canonical_constants: tokens.metadata?.canonical_constants,
    },
    tokens:     resolvedTokens,
    components: componentList,
    icons:      iconCatalog.map(i => ({ ...i, svg: readSvg(i.file) })),
    tools,
    webmcp,
    sovereign,
  };

  const json = JSON.stringify(manifest, null, 2);

  const outputArg  = process.argv.find(a => a === '--output' || a === '-o');
  const outputIdx  = outputArg ? process.argv.indexOf(outputArg) : -1;
  const outputFile = outputIdx >= 0 ? process.argv[outputIdx + 1] : null;

  if (outputFile) {
    const outDir = path.dirname(outputFile);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outputFile, json);
    console.error(`Wrote design-system.json (${(Buffer.byteLength(json, 'utf8') / 1024).toFixed(1)} KB) to ${outputFile}`);
  } else {
    console.log(json);
  }
}

main();
