#!/usr/bin/env node
/**
 * Export P31 design tokens as W3C DTCG (Design Tokens Community Group) JSON.
 *
 * Usage:
 *   node cli/tokens/export-dtcg.mjs                    → stdout
 *   node cli/tokens/export-dtcg.mjs --output dist/tokens.dtcg.json
 *
 * DTCG spec: https://tr.designtokens.org/format/
 */

import yaml from 'yaml';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function toDTCG(node, pathSegments = []) {
  if (node == null || typeof node !== 'object') return node;

  // Leaf token: has $value
  if ('$value' in node) {
    const result = { $value: node['$value'] };
    if (node['$type']) result.$type = node['$type'];
    if (node['$description']) result.$description = node['$description'];
    return result;
  }

  // Skip metadata keys that aren't tokens
  const skipKeys = ['version', 'metadata', 'canonical_constants'];

  // Group node: walk children
  const result = {};
  for (const key of Object.keys(node)) {
    if (key.startsWith('$') || skipKeys.includes(key)) continue;
    const child = toDTCG(node[key], [...pathSegments, key]);
    if (child !== undefined && (typeof child !== 'object' || Object.keys(child).length > 0)) {
      result[key] = child;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function main() {
  const tokensFile = path.join(__dirname, 'tokens.yml');
  const raw = fs.readFileSync(tokensFile, 'utf8');
  const tokens = yaml.parse(raw);

  const dtcg = toDTCG(tokens);

  // Note: primitive.color.surface resolves to its DTCG form with $value
  // but semantic.color.accent.default resolves to the string "{primitive.color.cyan}"
  // We need to resolve these references OR leave them as-is (DTCG allows string values)
  // For DTCG compliance, we resolve them to actual values.

  function resolveReferences(obj) {
    if (typeof obj === 'string') {
      // Resolve {references} inline
      return obj.replace(/\{([^}]+)\}/g, (_, ref) => {
        const parts = ref.split('.');
        let node = dtcg;
        for (const part of parts) {
          if (node == null) return `{${ref}}`;
          node = node[part];
        }
        if (node && node['$value']) return node['$value'];
        return `{${ref}}`;
      });
    }
    if (Array.isArray(obj)) return obj.map(resolveReferences);
    if (obj && typeof obj === 'object') {
      const result = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = resolveReferences(v);
      }
      return result;
    }
    return obj;
  }

  // Resolve semantic references
  const resolved = resolveReferences(dtcg);

  const output = {
    ...resolved,
  };

  // Add schema
  output.$schema = 'https://tr.designtokens.org/format/v2/';

  const json = JSON.stringify(output, null, 2);

  // Output
  const outputArg = process.argv.find(a => a === '--output' || a === '-o');
  const outputIdx = outputArg ? process.argv.indexOf(outputArg) : -1;
  const outputFile = outputIdx >= 0 ? process.argv[outputIdx + 1] : null;

  if (outputFile) {
    const outDir = path.dirname(outputFile);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outputFile, json);
    console.error(`Wrote ${Object.keys(resolved).filter(k => !k.startsWith('$')).length} token groups to ${outputFile}`);
  } else {
    console.log(json);
  }
}

main();
