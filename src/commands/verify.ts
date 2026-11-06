import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

type Artifact = { path: string; sha256: string; role?: string; size?: number };

type Manifest = {
  integrity?: {
    algorithm?: string;
    pathBase?: string;
    artifacts?: Artifact[];
    signedDigest?: string;
    rootManifestDigest?: string;
  };
  _meta?: {
    p31?: {
      // REBUILD-2: the shipped MCPB-schema manifest carries P31 governance metadata here.
      integrity?: { algorithm?: string; pathBase?: string; artifacts?: Artifact[] };
    };
  };
  trust?: {
    signatures?: null | {
      ed25519?: {
        present?: boolean;
        algorithm?: string;
        publicKey?: string; // PEM (SPKI) or base64 raw — best-effort
        signature?: string; // base64
        signedDigest?: string; // hex sha256 (preferred) or utf8 payload reference
        keyId?: string;
      };
    };
    ed25519?: { present?: boolean };
  };
  signatures?: {
    ed25519?: {
      publicKey?: string;
      signature?: string;
      signedDigest?: string;
      algorithm?: string;
      keyId?: string;
    };
  };
};

function sha256File(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function loadManifestFromPath(manifestPath: string): { manifest: Manifest; baseDir: string } {
  const abs = path.resolve(manifestPath);
  const raw = fs.readFileSync(abs, 'utf-8');
  const manifest = JSON.parse(raw) as Manifest;
  return { manifest, baseDir: path.dirname(abs) };
}

function loadManifestFromBundle(bundlePath: string): { manifest: Manifest; baseDir: string } {
  const abs = path.resolve(bundlePath);
  const stat = fs.statSync(abs);
  if (stat.isDirectory()) {
    const candidate = path.join(abs, 'manifest.json');
    const mcpb = path.join(abs, 'mcpb.manifest.json');
    if (fs.existsSync(candidate)) return loadManifestFromPath(candidate);
    if (fs.existsSync(mcpb)) return loadManifestFromPath(mcpb);
    throw new Error(`Bundle directory missing manifest.json/mcpb.manifest.json: ${abs}`);
  }
  if (abs.endsWith('.mcpb') || abs.endsWith('.zip')) {
    // Best-effort: try unzip -p (no npm deps). Factual limitation if unavailable.
    const r = spawnSync('unzip', ['-p', abs, 'manifest.json'], { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    if (r.status === 0 && r.stdout) {
      const manifest = JSON.parse(r.stdout) as Manifest;
      // For zip bundles, file hashes cannot be verified without extraction; report clearly.
      return { manifest, baseDir: `zip:${abs}` };
    }
    const r2 = spawnSync('unzip', ['-p', abs, 'mcpb.manifest.json'], { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    if (r2.status === 0 && r2.stdout) {
      return { manifest: JSON.parse(r2.stdout) as Manifest, baseDir: `zip:${abs}` };
    }
    throw new Error(
      `Cannot read manifest from archive (needs 'unzip' or extract first): ${abs}. ` +
        `Use: unzip -d <dir> ${path.basename(abs)} && p31 verify --bundle <dir>`
    );
  }
  // Treat as manifest file
  return loadManifestFromPath(abs);
}

function getEd25519Sig(manifest: Manifest): { publicKey: string; signature: string; signedDigest?: string } | null {
  const fromTrust = manifest.trust?.signatures && typeof manifest.trust.signatures === 'object'
    ? (manifest.trust.signatures as any).ed25519
    : null;
  const sig = fromTrust || manifest.signatures?.ed25519;
  if (!sig || !sig.publicKey || !sig.signature) return null;
  if (sig.present === false) return null;
  return { publicKey: sig.publicKey, signature: sig.signature, signedDigest: sig.signedDigest || manifest.integrity?.signedDigest || manifest.integrity?.rootManifestDigest };
}

function verifyEd25519(sig: { publicKey: string; signature: string; signedDigest?: string }): { ok: boolean; detail: string } {
  if (!sig.signedDigest) {
    return { ok: false, detail: 'signature present but no signedDigest/rootManifestDigest to verify against' };
  }
  try {
    const keyObj = crypto.createPublicKey(sig.publicKey);
    const data = /^[0-9a-f]{64}$/i.test(sig.signedDigest)
      ? Buffer.from(sig.signedDigest, 'hex')
      : Buffer.from(sig.signedDigest, 'utf-8');
    const signature = Buffer.from(sig.signature, 'base64');
    const ok = crypto.verify(null, data, keyObj, signature);
    return { ok, detail: ok ? 'Ed25519 signature valid' : 'Ed25519 signature INVALID' };
  } catch (e: any) {
    return { ok: false, detail: `Ed25519 verification error: ${e.message}` };
  }
}

export function createVerifyCommand(): Command {
  const cmd = new Command('verify')
    .description('Verify MCPB/bundle integrity (SHA-256) and optional Ed25519 signature')
    .option('--bundle <path>', 'Bundle directory, .mcpb archive (best-effort), or manifest path')
    .option('--manifest <path>', 'Path to bundle manifest JSON')
    .action(async (opts: { bundle?: string; manifest?: string }) => {
      try {
        if (!opts.bundle && !opts.manifest) {
          console.error(chalk.red('✗ Provide --bundle <path> or --manifest <path>'));
          process.exit(1);
        }
        const { manifest, baseDir } = opts.manifest
          ? loadManifestFromPath(opts.manifest)
          : loadManifestFromBundle(opts.bundle!);

        const alg = (manifest.integrity?.algorithm || manifest._meta?.p31?.integrity?.algorithm || 'sha256').toLowerCase();
        if (alg !== 'sha256') {
          console.error(chalk.red(`✗ Unsupported integrity algorithm: ${alg} (expected sha256)`));
          process.exit(1);
        }

        const fromRoot = manifest.integrity?.artifacts || [];
        const fromMeta = manifest._meta?.p31?.integrity?.artifacts || [];
        const artifacts = fromRoot.length > 0 ? fromRoot : fromMeta;
        if (fromRoot.length === 0 && fromMeta.length > 0) {
          console.log(chalk.gray('  (integrity.artifacts resolved from _meta.p31.integrity for MCPB-schema embedded manifest)'));
        }
        if (artifacts.length === 0) {
          console.error(chalk.red('✗ Manifest has no integrity.artifacts to verify'));
          process.exit(1);
        }

        let failures = 0;
        let checked = 0;
        console.log(chalk.cyan('P31 bundle verify'));
        console.log(chalk.gray(`  base: ${baseDir}`));
        console.log(chalk.gray(`  artifacts: ${artifacts.length}`));

        if (baseDir.startsWith('zip:')) {
          console.log(chalk.yellow('  ⚠ Archive bundle: manifest loaded but artifact file hashes require extraction. Extract and re-run --bundle <dir> for full verification.'));
        }

        for (const a of artifacts) {
          if (!a.path || !a.sha256) {
            console.error(chalk.red(`  ✗ malformed artifact entry: ${JSON.stringify(a)}`));
            failures++;
            continue;
          }
          if (baseDir.startsWith('zip:')) {
            console.log(chalk.gray(`  - ${a.path}  (skipped: archive not extracted)  expected ${a.sha256}`));
            continue;
          }
          const filePath = path.isAbsolute(a.path) ? a.path : path.resolve(baseDir, a.path);
          if (!fs.existsSync(filePath)) {
            console.error(chalk.red(`  ✗ missing: ${a.path} (${filePath})`));
            failures++;
            continue;
          }
          const actual = sha256File(filePath);
          checked++;
          if (actual.toLowerCase() === a.sha256.toLowerCase()) {
            console.log(chalk.green(`  ✓ ${a.path}`));
            console.log(chalk.gray(`    sha256 ${actual}`));
          } else {
            console.error(chalk.red(`  ✗ hash mismatch: ${a.path}`));
            console.error(chalk.red(`    expected ${a.sha256}`));
            console.error(chalk.red(`    actual   ${actual}`));
            failures++;
          }
        }

        // Ed25519 (graceful if absent)
        const sig = getEd25519Sig(manifest);
        if (!sig) {
          console.log(chalk.gray('  signature: not present (graceful skip)'));
        } else {
          console.log(chalk.cyan('  signature: Ed25519 present, verifying...'));
          const v = verifyEd25519(sig);
          if (v.ok) {
            console.log(chalk.green(`  ✓ ${v.detail}`));
          } else {
            console.error(chalk.red(`  ✗ ${v.detail}`));
            failures++;
          }
        }

        if (failures > 0) {
          console.error(chalk.red(`\n✗ Verify failed (${failures} issue(s), ${checked} file hash(es) checked).`));
          process.exit(1);
        }
        if (baseDir.startsWith('zip:')) {
          console.log(chalk.yellow('\n⚠ Partial verify: archive manifest parsed; extract bundle for full file hash verification.'));
          process.exit(1);
        }
        console.log(chalk.green(`\n✓ Verify passed (${checked} artifact hash(es) OK${sig ? ', signature OK' : ', no signature'}).`));
        process.exit(0);
      } catch (err: any) {
        console.error(chalk.red(`✗ Verify error: ${err.message}`));
        process.exit(1);
      }
    });

  return cmd;
}
