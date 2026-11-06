#!/usr/bin/env node
/**
 * build-sovereign.mjs — Regenerate token CSS from tokens.yml
 * and inject it into all sovereign HTML templates.
 *
 * Usage: node cli/tokens/build-sovereign.mjs
 */

import yaml from 'yaml';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const TOKENS_FILE = path.join(__dirname, 'tokens.yml');
const TEMPLATE_FILE = path.join(__dirname, 'component-css-template.css');
const HTML_FILES = [
  path.join(ROOT, 'apps', 'p31ca', 'index.html'),
  path.join(ROOT, 'apps', 'phosphorus31', 'index.html'),
  path.join(ROOT, '..', 'production', 'portals', 'design', 'index.html'),
  path.join(ROOT, '..', 'production', 'portals', 'design', 'deploy', 'index.html'),
  path.join(ROOT, 'apps', 'a2ui-renderer', 'index.html'),
  path.join(ROOT, '..', 'production', 'portals', 'children', 'willow-portal.html'),
  path.join(ROOT, '..', 'production', 'portals', 'parent', 'tetra-ops.html'),
  path.join(ROOT, '..', 'production', 'portals', 'teen', 'p31-portal.html'),
  path.join(ROOT, '..', 'production', 'portals', 'developer', 'p31ca', 'index.html'),
  path.join(ROOT, '..', 'production', 'portals', 'institutional', 'phosphorus31', 'index.html'),
  path.join(ROOT, '..', 'production', 'portals', 'meatspace', 'meatspace-bonding-mvp.html'),
];

const TOKENS_CSS_TEMPLATE = path.join(__dirname, 'tokens-css-template.css');
const TOKENS_CSS_OUT = path.join(ROOT, 'packages', 'design-core', 'src', 'css', 'tokens.css');

// ─── Load and flatten tokens ────────────────────────────────────────────────

function loadTokens(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return yaml.parse(raw);
}

/**
 * Walk a dotted path through the token tree.
 * Returns the DTCG $value if the node has one, otherwise the raw object/string.
 */
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

/**
 * Recursively resolve a value that may contain {references}.
 * E.g. "{p31.color.accent.default}" → the OKLCH value
 */
function resolveValue(value, tokens, visited = new Set()) {
  if (typeof value !== 'string') return String(value);

  return value.replace(/\{([^}]+)\}/g, (_, ref) => {
    if (visited.has(ref)) {
      throw new Error(`Circular reference detected: ${ref}`);
    }
    visited.add(ref);
    const resolved = getRaw(ref, tokens);
    if (resolved === undefined) {
      throw new Error(`Unresolved reference: ${ref}`);
    }
    return resolveValue(resolved, tokens, visited);
  });
}

/**
 * Resolve a {{path}} placeholder in the template.
 * Returns the fully-resolved string value.
 */
function resolvePlaceholder(pathStr, tokens) {
  const raw = getRaw(pathStr, tokens);
  if (raw === undefined) {
    throw new Error(`Missing token: ${pathStr}`);
  }
  return resolveValue(raw, tokens);
}

// ─── Render CSS ─────────────────────────────────────────────────────────────

function renderCSS(tokens, templateFile) {
  let template = fs.readFileSync(templateFile, 'utf8');

  return template.replace(/\{\{(.+?)\}\}/g, (_, tokenPath) => {
    const trimmed = tokenPath.trim();
    return resolvePlaceholder(trimmed, tokens);
  });
}

// ─── Inject into HTML ───────────────────────────────────────────────────────

function injectCSS(htmlPath, css) {
  if (!fs.existsSync(htmlPath)) {
    console.error(`  SKIP: ${htmlPath} not found`);
    return false;
  }

  let html = fs.readFileSync(htmlPath, 'utf8');
  const placeholder = '<!-- TOKENS -->';

  if (!html.includes(placeholder)) {
    console.error(`  SKIP: ${htmlPath} has no <!-- TOKENS --> placeholder`);
    return false;
  }

  html = html.replace(placeholder, `<style>\n${css}\n</style>`);
  fs.writeFileSync(htmlPath, html);
  return true;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log('P31 Sovereign — Build Script');
  console.log('═════════════════════════════\n');

  console.log(`[1/3] Loading tokens from: ${TOKENS_FILE}`);
  const tokens = loadTokens(TOKENS_FILE);
  console.log('  Loaded metadata:', tokens.metadata?.name || 'unknown');

  console.log(`[2/3] Rendering CSS from template: ${TEMPLATE_FILE}`);
  let css; // defined outside try block
  try {
    css = renderCSS(tokens, TEMPLATE_FILE);
  } catch (err) {
    console.error('  ERROR rendering template:', err.message);
    process.exit(1);
  }
  console.log(`  Generated ${css.split('\n').length} lines of CSS`);

  console.log('[3/3] Injecting into HTML files:');
  let success = 0;
  for (const htmlPath of HTML_FILES) {
    const rel = path.relative(ROOT, htmlPath);
    try {
      if (injectCSS(htmlPath, css)) {
        console.log(`  OK  ${rel}`);
        success++;
      }
    } catch (err) {
      console.error(`  ERR ${rel}: ${err.message}`);
    }
  }

  console.log(`\nDone: ${success}/${HTML_FILES.length} files updated.`);

  // Generate tokens.css for React apps (design-core package)
  console.log('\n[4/4] Generating tokens.css for React apps:');
  try {
    const tokensCss = renderCSS(tokens, TOKENS_CSS_TEMPLATE);
    const outDir = path.dirname(TOKENS_CSS_OUT);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(TOKENS_CSS_OUT, tokensCss);
    console.log(`  OK  ${path.relative(ROOT, TOKENS_CSS_OUT)} (${tokensCss.split('\n').length} lines)`);
  } catch (err) {
    console.error(`  ERR generating tokens.css: ${err.message}`);
  }

  // Generate components.css for production/assets
  console.log('\n[5/8] Generating components.css for production/assets:');
  try {
    const compCss = renderCSS(tokens, TEMPLATE_FILE);
    const assetsDir = path.resolve(ROOT, '..', 'production', 'assets');
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(assetsDir, 'components.css'), compCss);
    console.log(`  OK  production/assets/components.css (${compCss.split('\n').length} lines)`);
  } catch (err) {
    console.error(`  ERR generating components.css: ${err.message}`);
  }

  // Generate design-system.json manifest
  console.log('\n[6/9] Generating design-system.json manifest:');
  try {
    const manifestPath = path.join(ROOT, 'design-system.json');
    execSync(`node ${path.join(__dirname, 'export-design-system.mjs')} --output ${manifestPath}`, { stdio: 'inherit' });
    console.log(`  OK  design-system.json`);
  } catch (err) {
    console.error(`  ERR generating design-system.json: ${err.message}`);
  }

  // Generate A2UI catalog (scanner + fallback)
  console.log('\n[7/9] Generating A2UI catalog:');
  try {
    const scanScript = path.join(ROOT, 'scripts', 'scan-a2ui-catalog.mjs');
    if (fs.existsSync(scanScript)) {
      execSync(`node ${scanScript}`, { stdio: 'inherit' });
      console.log('  OK  a2ui-catalog.json → 5 consumer apps + 7 production portals');
    } else {
      console.warn('  SKIP: scripts/scan-a2ui-catalog.mjs not found');
    }
  } catch (err) {
    console.error(`  ERR generating A2UI catalog: ${err.message}`);
  }

  // Generate semantic-token-manifest.json (tool-token bindings, interactive mapping, brand overrides)
  console.log('\n[8/9] Generating semantic-token-manifest.json:');
  try {
    const semanticManifest = buildSemanticManifest(tokens);
    const outDir = path.dirname(TOKENS_CSS_OUT);
    const manifestPath = path.join(outDir, 'semantic-token-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(semanticManifest, null, 2));
    console.log(`  OK  ${path.relative(ROOT, manifestPath)} (${Object.keys(semanticManifest).length} sections)`);
  } catch (err) {
    console.error(`  ERR generating semantic manifest: ${err.message}`);
  }

  // Sync assets to production portal webroot
  console.log('\n[9/9] Syncing UMD bundle + state-sync to production assets:');
  const ASSETS_SRC = path.join(ROOT, 'production', 'shared', 'assets');
  const ASSETS_DEST = '/home/p31/production/portals/assets';
  try {
    const copyAssets = ['p31-ui.umd.js', 'p31-ui.umd.css', 'state-sync.js'];
    for (const file of copyAssets) {
      const src = path.join(ASSETS_SRC, file);
      const dest = path.join(ASSETS_DEST, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`  ✅ ${file} → ${dest}`);
      } else {
        console.warn(`  ⚠️ ${file} not found in ${ASSETS_SRC} — skipping. Build UMD first.`);
      }
    }
  } catch (err) {
    console.error(`  ERR syncing production assets: ${err.message}`);
  }

  if (success === 0) {
    process.exit(1);
  }
}

// ─── Semantic Manifest ────────────────────────────────────────────────────────

/**
 * Build a machine-readable semantic manifest mapping design tokens to
 * components, interactive states (spoons/speed-factor), and brand overrides.
 */
function buildSemanticManifest(tokens) {
  // Load component definitions from registry.json for tool-token bindings
  const COMPS_FILE = path.join(__dirname, '..', '..', 'packages', 'design-core', 'registry.json');
  let components = {};
  try {
    const raw = fs.readFileSync(COMPS_FILE, 'utf8');
    const reg = JSON.parse(raw);
    for (const item of reg.items || []) {
      components[item.name] = {
        description: item.description,
        css_class: item.cssClass,
        tokens: item.tokens || [],
        props: item.props || {},
      };
    }
  } catch {
    // proceed without component bindings
  }

  // Resolve CSS variable names from token paths
  function resolveCssVars(tokenPath) {
    const parts = tokenPath.split('.');
    let node = tokens;
    for (const part of parts) {
      if (node == null || typeof node !== 'object') return null;
      node = node[part];
    }
    if (node == null) return null;

    if (typeof node === 'object' && '$value' in node) {
      // Derive CSS variable name: p31.glass.background → --p31-glass-background
      const cssName = '--p31-' + parts.slice(1).join('-');
      const resolved = resolveValue(String(node.$value), tokens);
      return [{ css: cssName, raw: node.$value, resolved }];
    }
    return null;
  }

  // Tool-to-token bindings for each component from components.yml
  const toolTokenBindings = {};
  for (const [name, def] of Object.entries(components)) {
    if (def.tokens && def.tokens.length > 0) {
      const binding = { tokens: [] };
      for (const t of def.tokens) {
        const vars = resolveCssVars(t);
        if (vars) binding.tokens.push(...vars);
      }
      if (def.props) binding.props = Object.keys(def.props);
      if (binding.tokens.length > 0) {
        toolTokenBindings[name] = binding;
      }
    }
  }

  // Speed factor → spoon level mapping
  const speedFactorMapping = [
    { spoons: 0, speed_factor: 0, label: 'crisis — no motion' },
    { spoons: 1, speed_factor: 0, label: 'minimal — no motion' },
    { spoons: 2, speed_factor: 0.25, label: 'reduced' },
    { spoons: 3, speed_factor: 0.5, label: 'standard' },
    { spoons: 4, speed_factor: 0.75, label: 'calm' },
    { spoons: 5, speed_factor: 1, label: 'brisk' },
  ];

  // Resolve animation tokens
  const animationTokens = {};
  if (tokens.animation) {
    const anim = tokens.animation;
    if (anim.duration) {
      animationTokens.duration = {};
      for (const [k, v] of Object.entries(anim.duration)) {
        if (v.$value) animationTokens.duration[k] = resolveValue(String(v.$value), tokens);
      }
    }
    if (anim.easing) {
      animationTokens.easing = {};
      for (const [k, v] of Object.entries(anim.easing)) {
        if (v.$value) animationTokens.easing[k] = resolveValue(String(v.$value), tokens);
      }
    }
    if (anim.speed_factor) {
      animationTokens.speed_factor_css = 'var(--p31-speed-factor)';
      animationTokens.speed_factor_default = resolveValue(String(anim.speed_factor.$value), tokens);
    }
  }

  // Brand overrides — resolve all $value references in tree
  const brandOverrides = {};
  if (tokens['property-overrides']) {
    function resolveOverrides(obj, visited = new Set()) {
      if (obj == null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(item => resolveOverrides(item, new Set(visited)));
      if ('$value' in obj) {
        return resolveValue(obj.$value, tokens, new Set(visited));
      }
      const result = {};
      for (const [k, v] of Object.entries(obj)) {
        if (k.startsWith('$')) continue;
        const resolved = resolveOverrides(v, new Set(visited));
        if (resolved !== undefined) result[k] = resolved;
      }
      return Object.keys(result).length > 0 ? result : undefined;
    }
    for (const [brand, overrides] of Object.entries(tokens['property-overrides'])) {
      if (brand.startsWith('$')) continue;
      brandOverrides[brand] = resolveOverrides(overrides);
    }
  }

  return {
    $schema: 'https://p31.ca/schemas/semantic-token-manifest.json',
    version: tokens.version,
    metadata: {
      name: tokens.metadata?.name || 'p31-quantum',
      generated_at: new Date().toISOString(),
    },
    toolTokenBindings,
    interactive: {
      speedFactorMapping,
      variable: '--p31-speed-factor',
      motionPreference: {
        css: '@media (prefers-reduced-motion: reduce)',
        behavior: 'All --p31-duration-* multiplied by 0 via speed_factor',
        crisisMode: 'data-spoons="0": speed_factor = 0, CrisisOverlay rendered',
      },
    },
    animationTokens,
    brandOverrides,
    references: {
      designSystem: 'design-system.json',
      tokensCss: 'packages/design-core/src/css/tokens.css',
      componentsJson: 'packages/design-core/registry.json',
      tokensYml: 'cli/tokens/tokens.yml',
    },
  };
}

main();
