#!/usr/bin/env node
/**
 * L6 bundle builder — packs the frozen MCPB-style bundle.
 * REBUILD-2 (2026-11-05): artifact renamed to `p31-mcp-governed-agent-cli-<version>.mcpb`
 * so the registry asset identifier satisfies the MCP-in-path rule (see L9-L audit).
 *
 * Payload (at archive root): manifest.json, server.json, package.json, README.md, dist/**
 * Output: bundle/dist/p31-mcp-governed-agent-cli-<version>.mcpb (+ .sha256, dist.sha256sum, build-info.json)
 *
 * Determinism: files are staged in sorted order with a fixed mtime (2020-01-01T00:00:00Z)
 * and zipped with `zip -X -9`, so repeated builds from identical inputs produce
 * byte-identical archives. No timestamps or run IDs are written inside the archive.
 *
 * The canonical bundle/manifest.json is updated with integrity.bundle.sha256 after packaging.
 * The embedded manifest is generated from the canonical one; its artifact paths are
 * bundle-root-relative and include every shipped dist/ file.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const bundleDir = path.join(root, 'bundle');
const distDir = path.join(root, 'dist');
const stage = path.join(bundleDir, '.stage');
const outDir = path.join(bundleDir, 'dist');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const artifactName = `p31-mcp-governed-agent-cli-${version}.mcpb`;
const artifactPath = path.join(outDir, artifactName);

const FIXED_MTIME = new Date('2020-01-01T00:00:00Z');

function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function walk(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs, base));
    else if (entry.isFile()) out.push(path.relative(base, abs).split(path.sep).join('/'));
  }
  return out.sort();
}

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyTree(s, d);
    else if (entry.isFile()) {
      fs.copyFileSync(s, d);
      fs.chmodSync(d, fs.statSync(s).mode & 0o777);
    }
  }
}

function sourceInventory() {
  const inputs = [
    ...walk(path.join(root, 'src')).map((rel) => `src/${rel}`),
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'tsup.config.ts',
  ].filter((rel) => fs.existsSync(path.join(root, rel)));
  const lines = inputs.sort().map((rel) => `${sha256File(path.join(root, rel))}  ${rel}`);
  return {
    sha256: createHash('sha256').update(lines.join('\n')).digest('hex'),
    files: inputs.length,
  };
}

function roleFor(rel) {
  if (rel === 'server.json') return 'mcp-registry-metadata-frozen';
  if (rel === 'package.json') return 'npm-package-manifest';
  if (rel === 'README.md') return 'documentation';
  return 'build-output';
}

/**
 * Build an MCPB-schema-compliant manifest for embedding in the .mcpb archive.
 * The mpak scanner (MTF) validates against the MCPB schema: required
 * name/version/description + server.type + server.mcp_config; allowed
 * display_name, author, license, homepage, repository, keywords, user_config,
 * permissions. P31-specific governance metadata is moved under _meta.p31 so
 * the embedded manifest remains schema-valid while preserving provenance.
 */
function buildEmbeddedManifest(canonical, payloadFiles, stageDir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const serverJson = JSON.parse(fs.readFileSync(path.join(root, 'server.json'), 'utf8'));
  const repoUrl = serverJson.repository?.url || pkg.repository?.url || 'https://github.com/p31labs/p31-cli';
  const embedded = {
    $schema: 'https://cdn.mpak.dev/schemas/2025-10-19/mpak.json',
    name: '@p31ca/cli',
    version: canonical.version || pkg.version,
    description: (canonical.description || pkg.description || '').slice(0, 200),
    display_name: canonical.displayName || canonical.name || 'P31 Governed Agent CLI',
    author: {
      name: 'P31 Labs, Inc.',
      email: 'security@p31ca.org',
      url: 'https://p31ca.org',
    },
    license: pkg.license || 'MIT',
    homepage: 'https://p31ca.org',
    repository: {
      type: 'git',
      url: repoUrl,
    },
    keywords: Array.isArray(serverJson.tags) ? serverJson.tags.slice(0, 12) : (pkg.keywords || []),
    server: {
      type: 'node',
      entry_point: 'dist/index.js',
      mcp_config: {
        command: 'node',
        args: [
          '${__dirname}/dist/index.js',
          '--',
          '${__dirname}/dist/index.cjs',
          '${__dirname}/dist/index.d.ts',
          '${__dirname}/dist/mcp-bridge.js',
          '${__dirname}/dist/mcp-bridge.cjs',
          '${__dirname}/dist/mcp-bridge.d.ts',
          '${__dirname}/dist/mcp-http.js',
          '${__dirname}/dist/mcp-http.cjs',
          '${__dirname}/dist/mcp-http.d.ts',
          '${__dirname}/dist/stream-server.js',
          '${__dirname}/dist/stream-server.cjs',
          '${__dirname}/dist/stream-server.d.ts',
        ],
        env: {
          NODE_ENV: 'production',
          ANTHROPIC_API_KEY: '${user_config.anthropic_api_key}',
          GOOGLE_API_KEY: '${user_config.google_api_key}',
          OPENROUTER_API_KEY: '${user_config.openrouter_api_key}',
        },
      },
    },
    permissions: {
      filesystem: 'full',
      network: 'outbound',
      environment: 'read',
      subprocess: 'full',
      native: 'none',
    },
    user_config: {
      anthropic_api_key: { type: 'string', title: 'Anthropic API Key', description: 'Optional Anthropic API key', sensitive: true, required: false },
      google_api_key: { type: 'string', title: 'Google API Key', description: 'Optional Google API key', sensitive: true, required: false },
      openrouter_api_key: { type: 'string', title: 'OpenRouter API Key', description: 'Optional OpenRouter API key', sensitive: true, required: false },
    },
    _meta: {
      'org.mpaktrust': {
        schema: 'mcpb-p31-embedded-v1',
        level: 'L1-target',
        notes: 'Permissions and server entry declared for mpak L1 remediation (L6-J). Bundle signing/SLSA/Scorecard/behavioral sandbox remain L3/L4 gaps.',
        permissions: {
          filesystem: 'full',
          network: 'outbound',
          environment: 'read',
          subprocess: 'full',
          native: 'none',
        },
      },
      p31: {
        status: canonical.status,
        g5: canonical.g5,
        xP31: canonical['x-p31'],
        capabilitiesSummary: canonical.capabilitiesSummary,
        toolsSummary: canonical.toolsSummary,
        nonClaims: canonical.nonClaims,
        trust: canonical.trust,
        integrity: {
          pathBase: 'bundleRoot',
          algorithm: 'sha256',
          artifacts: payloadFiles.map((rel) => ({
            path: rel,
            sha256: sha256File(path.join(stageDir, rel)),
            role: roleFor(rel),
          })),
          notes:
            'P31 governance overlay moved to _meta.p31 for MCPB schema compliance (L6-J). ' +
            'Archive hash is recorded in canonical bundle/manifest.json and .mcpb.sha256 sidecar.',
        },
      },
    },
  };
  return embedded;
}

if (!fs.existsSync(distDir)) {
  console.error(`✗ ${path.relative(root, distDir)}/ is missing. Run: npm run build`);
  process.exit(1);
}

// 1. Fresh staging directory.
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
for (const file of ['package.json', 'README.md']) {
  fs.copyFileSync(path.join(root, file), path.join(stage, file));
}
// Stage server.json without fileSha256 fields to keep the bundle payload stable
// (fileSha256 is recorded in root server.json + canonical manifest, not inside the bundle).
{
  const sj = JSON.parse(fs.readFileSync(path.join(root, 'server.json'), 'utf8'));
  if (Array.isArray(sj.packages)) {
    for (const p of sj.packages) delete p.fileSha256;
  }
  fs.writeFileSync(path.join(stage, 'server.json'), `${JSON.stringify(sj, null, 2)}\n`);
}
copyTree(distDir, path.join(stage, 'dist'));

// 2. Generate the embedded manifest from the canonical manifest.
const source = sourceInventory();
const canonical = JSON.parse(fs.readFileSync(path.join(bundleDir, 'manifest.json'), 'utf8'));
canonical.build = canonical.build || {};
canonical.build.sourceInventorySha256 = source.sha256;
canonical.build.sourceInventoryFiles = source.files;

const payloadFiles = [
  'server.json',
  'package.json',
  'README.md',
  ...walk(path.join(stage, 'dist')).map((rel) => `dist/${rel}`),
];

// MCPB-schema-compliant embedded manifest (L6-J remediation: AI-01, CD-02, PR-02).
// P31 governance metadata is preserved under _meta.p31 in the embedded manifest.
const shipped = buildEmbeddedManifest(canonical, payloadFiles, stage);

fs.writeFileSync(path.join(stage, 'manifest.json'), `${JSON.stringify(shipped, null, 2)}\n`);

// 3. Normalize timestamps so the archive is reproducible.
for (const rel of walk(stage)) {
  const abs = path.join(stage, rel);
  fs.utimesSync(abs, FIXED_MTIME, FIXED_MTIME);
}

// 4. Zip (sorted file list, no extra attributes).
fs.mkdirSync(outDir, { recursive: true });
fs.rmSync(artifactPath, { force: true });
const zipList = walk(stage); // includes manifest.json
execFileSync('zip', ['-X', '-q', '-9', artifactPath, '-@'], {
  cwd: stage,
  input: `${zipList.join('\n')}\n`,
  env: { ...process.env, TZ: 'UTC' },
  stdio: ['pipe', 'inherit', 'inherit'],
});

// 5. Hashes + inventories beside the artifact (outside the archive).
const bundleSha256 = sha256File(artifactPath);
const bundleSize = fs.statSync(artifactPath).size;

const payloadInventory = walk(distDir)
  .map((rel) => `${sha256File(path.join(distDir, rel))}  dist/${rel}`)
  .join('\n');
fs.writeFileSync(path.join(outDir, 'dist.sha256sum'), `${payloadInventory}\n`);
fs.writeFileSync(path.join(outDir, `${artifactName}.sha256`), `${bundleSha256}  ${artifactName}\n`);

let lockfile = { present: fs.existsSync(path.join(root, 'package-lock.json')) };
if (lockfile.present) {
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  lockfile.lockfileVersion = lock.lockfileVersion;
  lockfile.rootPackageVersion = lock.packages?.['']?.version ?? null;
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', 'package-lock.json'], { cwd: root, stdio: 'ignore' });
    lockfile.trackedInGit = true;
  } catch {
    lockfile.trackedInGit = false;
  }
}

const gitSha = (() => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
})();

const buildInfo = {
  artifact: artifactName,
  bundleSha256,
  bundleSize,
  builtAt: new Date().toISOString(),
  sourceInventorySha256: source.sha256,
  sourceInventoryFiles: source.files,
  distInventorySha256: createHash('sha256').update(`${payloadInventory}\n`).digest('hex'),
  gitSha,
  gitDirty: (() => {
    try {
      return execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0;
    } catch {
      return null;
    }
  })(),
  node: process.version,
  npm: (() => {
    try {
      return execFileSync('npm', ['-v'], { encoding: 'utf8' }).trim();
    } catch {
      return null;
    }
  })(),
  os: `${os.type()} ${os.release()} ${os.arch()}`,
  platform: process.platform,
  lockfile,
  payload: {
    files: payloadFiles.length + 1,
    distFiles: payloadFiles.length - 3,
    bytes: walk(stage).reduce((sum, rel) => sum + fs.statSync(path.join(stage, rel)).size, 0),
  },
};
fs.writeFileSync(path.join(outDir, 'build-info.json'), `${JSON.stringify(buildInfo, null, 2)}\n`);

// 6. Record the archive hash in the canonical manifest.
canonical.integrity.bundle = {
  path: `dist/${artifactName}`,
  algorithm: 'sha256',
  sha256: bundleSha256,
  size: bundleSize,
};
fs.writeFileSync(path.join(bundleDir, 'manifest.json'), `${JSON.stringify(canonical, null, 2)}\n`);

// 7. Clean staging.
fs.rmSync(stage, { recursive: true, force: true });

console.log(`✓ Built ${path.relative(root, artifactPath)}`);
console.log(`  sha256 ${bundleSha256}`);
console.log(`  payload ${buildInfo.payload.files} files (${buildInfo.payload.distFiles} from dist/)`);
