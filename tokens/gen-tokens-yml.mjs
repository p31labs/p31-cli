#!/usr/bin/env node
/**
 * gen-tokens-yml.mjs — emit cli/tokens/tokens.yml from the canonical DTCG.
 *
 * Reads packages/canon/tokens/tokens.dtc.json `p31` subtree and emits it in
 * nested form (p31.glass.surface) under a top-level `p31` key, merging the
 * non-token config groups preserved in cli/tokens/tokens-meta.yml.
 *
 * Superseded token groups (primitive, semantic, component, root, scale, spacing,
 * typography, color, touch, z_index, animation, shadow, border, breakpoints) are
 * dropped — they map to the p31 namespace per token-vocabulary-map.md. The
 * component CSS templates (component.*) live in design-core/src/css.
 *
 * Dual-form tokens (flat p31.radius-sm + nested p31.radius.sm, identical values)
 * are emitted once, nested.
 *
 * Usage: node cli/tokens/gen-tokens-yml.mjs [output.yml]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const DTCG = resolve(here, '..', '..', 'packages', 'canon', 'tokens', 'tokens.dtc.json');
const META = join(here, 'tokens-meta.yml');
const OUT = resolve(process.argv[2] || join(here, 'tokens.yml'));

const dtcg = JSON.parse(readFileSync(DTCG, 'utf8'));
const meta = existsSync(META) ? yaml.parse(readFileSync(META, 'utf8')) : {};

// Flatten p31 → nested tokens, collapsing flat+dotted aliases (nested wins).
const byFlat = new Map();
(function walk(node, path) {
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith('$')) continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && v.$value === undefined) {
      walk(v, [...path, k]);
    } else {
      const dotted = [...path, k].join('.');
      const flat = dotted.split('.').join('-');
      const existing = byFlat.get(flat);
      if (!existing || dotted.split('.').length > existing.dotted.split('.').length) {
        byFlat.set(flat, { dotted, node: v });
      }
    }
  }
})(dtcg.p31, ['p31']);

// Re-nest the dotted paths under a top-level `p31` key.
const p31 = {};
for (const { dotted, node } of byFlat.values()) {
  const segs = dotted.split('.').slice(1); // drop leading 'p31'
  let cur = p31;
  for (let i = 0; i < segs.length - 1; i++) cur = cur[segs[i]] = cur[segs[i]] || {};
  cur[segs[segs.length - 1]] = node;
}

const out = { ...meta, p31 };
writeFileSync(OUT, yaml.stringify(out));
console.log(`wrote ${OUT} — p31 tokens: ${byFlat.size}, meta groups: ${Object.keys(meta).length}`);