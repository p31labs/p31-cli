/**
 * @file Figma Variables sync — export tokens.yml → Figma Variables JSON.
 *
 * Usage:
 *   node cli/tokens/figma-sync.mjs [--output figma-variables.json]
 *   FIGMA_ACCESS_TOKEN=... node cli/tokens/figma-sync.mjs --push
 *
 * Direction: export-only (code is source of truth).
 * Optionally pushes to Figma via REST API when --push is set.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const MONOREPO_ROOT = resolve(process.cwd(), '..', '..');
const TOKENS_YAML = resolve(MONOREPO_ROOT, 'cli', 'tokens', 'tokens.yml');
const OUTPUT_DEFAULT = resolve(MONOREPO_ROOT, 'p31-figma-variables.json');

// Minimal YAML parser for our token format
function parseYamlSimple(text) {
  const root = {};
  const lines = text.split('\n');
  const stack = [{ obj: root, indent: -1 }];

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = line.search(/\S/);
    const content = line.trim();

    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1].obj;

    if (content.startsWith('- ')) {
      const value = content.slice(2).replace(/^["']|["']$/g, '');
      const parent = stack[stack.length - 2]?.obj;
      const lastKey = parent ? Object.keys(parent).pop() : undefined;

      if (lastKey && !Array.isArray(parent[lastKey])) {
        parent[lastKey] = [];
      }

      const targetArray = lastKey ? parent[lastKey] : current;
      if (Array.isArray(targetArray)) {
        targetArray.push(value);
      }
    } else if (content.includes(':')) {
      const colonIndex = content.indexOf(':');
      const key = content.slice(0, colonIndex).trim();
      const value = content.slice(colonIndex + 1).trim();

      if (!value) {
        current[key] = {};
        stack.push({ obj: current[key], indent });
      } else if (value.startsWith('[') && value.endsWith(']')) {
        current[key] = value.slice(1, -1).split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
      } else {
        current[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  }

  return root;
}

function loadTokens() {
  const content = readFileSync(TOKENS_YAML, 'utf-8');
  return parseYamlSimple(content);
}

export function resolveValue(value, tokens) {
  if (typeof value !== 'string') return value;
  if (value.startsWith('{') && value.endsWith('}')) {
    const ref = value.slice(1, -1);
    const parts = ref.split('.');
    let node = tokens;
    for (const part of parts) {
      if (node == null || typeof node !== 'object') return value;
      node = node[part];
    }
    return resolveValue(node?.$value ?? node, tokens);
  }
  return value;
}

export function toFigmaType(rawValue) {
  if (typeof rawValue !== 'string') return 'STRING';
  const v = rawValue.toLowerCase();
  if (v.startsWith('#') || v.startsWith('rgb')) return 'COLOR';
  if (v.endsWith('px') || v.endsWith('em') || v.endsWith('rem') || v.endsWith('%')) return 'FLOAT';
  return 'STRING';
}

export function walkTokens(node, prefix = '', tokens, variables = {}) {
  if (!node || typeof node !== 'object') return variables;

  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$') || key === 'metadata') continue;
    const path = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && '$value' in value) {
      const figmaKey = path.replace(/\./g, '/');
      const rawValue = resolveValue(value.$value, tokens);
      variables[figmaKey] = {
        type: toFigmaType(rawValue),
        value: rawValue,
      };
    } else {
      walkTokens(value, path, tokens, variables);
    }
  }

  return variables;
}

export function transformTokensToFigmaVariables(tokens) {
  const variables = walkTokens(tokens, '', tokens, {});

  return {
    name: 'P31 Sovereign Design System',
    description: 'Exported from cli/tokens/tokens.yml',
    version: tokens.version || '1.0',
    exportedAt: new Date().toISOString(),
    variables,
  };
}

export async function pushToFigma(figmaJson, fileKey) {
  const token = process.env.FIGMA_ACCESS_TOKEN;
  if (!token) {
    console.warn('[p31] FIGMA_ACCESS_TOKEN not set — skipping push. Export only.');
    return false;
  }

  const url = `https://api.figma.com/v1/files/${fileKey}/variables`;
  const body = JSON.stringify(figmaJson);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Figma-Token': token,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[p31] Figma API error ${res.status}: ${text}`);
      return false;
    }

    console.log(`[p31] Pushed variables to Figma file ${fileKey}`);
    return true;
  } catch (err) {
    console.error(`[p31] Figma push failed: ${err.message}`);
    return false;
  }
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

function runCli() {
  const args = process.argv.slice(2);
  const outputPath = args[args.indexOf('--output') + 1] || args[args.indexOf('-o') + 1] || OUTPUT_DEFAULT;
  const doPush = args.includes('--push');
  const fileKey = args[args.indexOf('--file') + 1] || args[args.indexOf('-f') + 1] || '';

  const figmaJson = transformTokensToFigmaVariables(loadTokens());
  writeFileSync(outputPath, JSON.stringify(figmaJson, null, 2) + '\n');
  console.log(`[p31] Exported Figma Variables JSON to ${outputPath}`);
  console.log(`[p31] Variables: ${Object.keys(figmaJson.variables).length}`);

  if (doPush) {
    if (!fileKey) {
      console.error('[p31] --push requires --file <figma-file-key>');
      process.exit(1);
    }
    pushToFigma(figmaJson, fileKey).then((ok) => {
      if (!ok) process.exit(1);
    });
  }
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
  runCli();
}
