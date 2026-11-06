#!/usr/bin/env node
/**
 * Export P31 component registry as A2UI (Agent-to-UI) JSON schema.
 *
 * A2UI is a declarative component format that agents send to renderers.
 * This exports the P31 component catalog in A2UI 0.8 schema.
 *
 * Usage:
 *   node cli/tokens/export-a2ui.mjs                      → stdout
 *   node cli/tokens/export-a2ui.mjs --output dist/a2ui-schema.json
 */

import yaml from 'yaml';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function main() {
  const compFile = path.join(__dirname, '..', '..', 'packages', 'design-core', 'registry.json');
  const tokensFile = path.join(__dirname, 'tokens.yml');

  const reg = JSON.parse(fs.readFileSync(compFile, 'utf8'));
  const components = { components: {} };
  for (const item of reg.items || []) {
    components.components[item.name] = {
      description: item.description,
      css_class: item.cssClass,
      tokens: item.tokens || [],
      slots: item.slots || [],
      variants: item.variants || [],
      props: item.props || {},
    };
  }
  const tokens = yaml.parse(fs.readFileSync(tokensFile, 'utf8'));

  function dt(pathStr) {
    const parts = pathStr.split('.');
    let node = tokens;
    for (const part of parts) {
      if (node == null || typeof node !== 'object') return undefined;
      node = node[part];
    }
    return (node != null && typeof node === 'object' && node['$value'] != null) ? node['$value'] : node;
  }

  function resolveToken(pathStr) {
    const raw = dt(pathStr);
    if (typeof raw === 'string' && raw.includes('{')) {
      return raw.replace(/\{([^}]+)\}/g, (_, ref) => resolveToken(ref));
    }
    return raw;
  }

  const a2ui = {
    $schema: 'https://a2ui.dev/schema/0.8/components.json',
    name: 'P31 Sovereign Design System',
    version: '1.0.0',
    description: 'Neurodivergent-first design system with glassmorphism, spoon-awareness, and sovereign dark/light themes.',
    components: [],
  };

  for (const [name, comp] of Object.entries(components.components)) {
    const resolvedTokens = {};
    for (const t of (comp.tokens || [])) {
      try { resolvedTokens[t] = resolveToken(t); } catch {}
    }

    const a2uiComp = {
      name,
      description: comp.description,
      classification: {
        type: name.endsWith('Panel') || name.endsWith('Card') || name.endsWith('Subtle') || name.endsWith('Strong')
          ? 'container' : name === 'Button' ? 'action' : name === 'SpoonMeter' ? 'indicator'
          : name === 'Starfield' ? 'background' : name === 'CrisisOverlay' ? 'overlay'
          : name === 'ThemeToggle' ? 'action' : name === 'TetraGrid' ? 'layout'
          : name === 'HonestLabel' ? 'display' : name === 'StatusBadge' ? 'indicator' : 'display',
        tags: [],
      },
      props: {},
      slots: (comp.slots || []).map(s => ({ name: s, required: s === 'default' })),
      variants: (comp.variants || []).map(v => ({ name: v })),
      css: {
        class: comp.css_class,
        tokens: resolvedTokens,
      },
      a11y: {
        spoon_aware: ['CrisisOverlay', 'SpoonMeter', 'Starfield'].includes(name),
        role: name === 'Button' ? 'button' : name === 'CrisisOverlay' ? 'alertdialog' : 'region',
      },
    };

    for (const [propName, propDef] of Object.entries(comp.props || {})) {
      a2uiComp.props[propName] = {
        type: propDef.type || 'string',
        required: propDef.required || false,
        default: propDef.default,
      };
      if (propDef.options) a2uiComp.props[propName].enum = propDef.options;
      if (propDef.range) a2uiComp.props[propName].range = propDef.range;
    }

    if (name === 'CrisisOverlay') a2uiComp.classification.tags.push('crisis-mode');
    if (name === 'SpoonMeter') a2uiComp.classification.tags.push('spoon-aware', 'cognitive-load');
    if (comp.css_class && comp.css_class.includes('glass')) a2uiComp.classification.tags.push('glassmorphism');

    a2ui.components.push(a2uiComp);
  }

  a2ui.statistics = {
    total_components: a2ui.components.length,
    containers: a2ui.components.filter(c => c.classification.type === 'container').length,
    actions: a2ui.components.filter(c => c.classification.type === 'action').length,
    indicators: a2ui.components.filter(c => c.classification.type === 'indicator').length,
    layouts: a2ui.components.filter(c => c.classification.type === 'layout').length,
    overlays: a2ui.components.filter(c => c.classification.type === 'overlay').length,
    backgrounds: a2ui.components.filter(c => c.classification.type === 'background').length,
  };

  const json = JSON.stringify(a2ui, null, 2);

  const outputArg = process.argv.find(a => a === '--output' || a === '-o');
  const outputIdx = outputArg ? process.argv.indexOf(outputArg) : -1;
  const outputFile = outputIdx >= 0 ? process.argv[outputIdx + 1] : null;

  if (outputFile) {
    const outDir = path.dirname(outputFile);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outputFile, json);
    console.error(`Wrote ${a2ui.components.length} A2UI components to ${outputFile}`);
  } else {
    console.log(json);
  }
}

main();
