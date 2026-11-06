import { Command } from 'commander';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { emitGuardDecision, verifyGuardChain, readAuditLog, getPublicKey, exportProvJSONLD, exportJSONL, exportSCITT, exportCOSE, exportPermit, toAATCompatible, traceContext, verifyProofFile, computeMerkleRoot } from '../safety/guard-audit.js';
import chalk from 'chalk';

export function createAuditCommand(): Command {
  const audit = new Command('audit')
    .description('Guard audit and provenance verification commands');

  // ── audit verify ────────────────────────────────────────────────

  audit
    .command('verify')
    .description('Verify the hash chain and Ed25519 signatures offline')
    .action(async () => {
      try {
        const entries = readAuditLog();
        const publicKey = getPublicKey();

        if (entries.length === 0) {
          console.log(chalk.yellow('⚡ No audit entries found. Chain is empty (valid).'));
          process.exit(0);
        }

        const result = verifyGuardChain(entries, publicKey);

        if (result.valid) {
          console.log(chalk.green('✓ Guard audit chain is valid.'));
          console.log(`  Last valid seq: ${result.lastValidSeq}`);
          process.exit(0);
        } else {
          console.error(chalk.red(`✗ Chain break at seq ${result.lastValidSeq}: ${result.error}`));
          process.exit(1);
        }
      } catch (err: any) {
        console.error(chalk.red(`✗ Verification error: ${err.message}`));
        process.exit(1);
      }
    });

  // ── audit export ────────────────────────────────────────────────

  audit
    .command('export <format>')
    .description('Export the audit log. Format: jsonl, prov, scitt, cose, permit, or aat')
    .option('-o, --output <file>', 'Output file path')
    .option('-d, --decisions <file>', 'JSON file with Permit decisions array (for format=permit); if omitted, exports a sample')
    .option('--cose', 'For format=scitt, emit binary COSE_Sign1 (.cose) instead of JSON')
    .action(async (format: string, opts: { output?: string; decisions?: string; cose?: boolean }) => {
      try {
        const entries = readAuditLog();
        let outputFile = opts.output;
        const emitCOSE = format === 'cose' || (format === 'scitt' && opts.cose === true);

        // Default output file if not specified
        if (!outputFile) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          outputFile = emitCOSE
            ? `/tmp/p31-guard-audit.cose.${timestamp}.cose`
            : `/tmp/p31-guard-audit.${format}.${timestamp}.json`;
        }

        if (emitCOSE) {
          const hash = exportCOSE(outputFile, entries, getPublicKey());
          console.log(chalk.green(`✓ Exported ${entries.length} entries as COSE_Sign1 (RFC 9052, CBOR tag 18)`));
          console.log(`  COSE file SHA-256: ${hash}`);
          console.log(`  Output: ${outputFile}`);
        } else if (format === 'jsonl') {
          const hash = exportJSONL(outputFile, entries);
          console.log(chalk.green(`✓ Exported ${entries.length} entries as JSONL`));
          console.log(`  SHA-256: ${hash}`);
          console.log(`  Output: ${outputFile}`);
        } else if (format === 'prov') {
          const hash = exportProvJSONLD(outputFile, entries);
          console.log(chalk.green(`✓ Exported ${entries.length} entries as PROV-JSONLD`));
          console.log(`  Merkle root: ${hash}`);
          console.log(`  Output: ${outputFile}`);
        } else if (format === 'scitt') {
          const hash = exportSCITT(outputFile, entries, getPublicKey());
          console.log(chalk.green(`✓ Exported ${entries.length} entries as SCITT-adapter (draft-aligned)`));
          console.log(`  Merkle root: ${hash}`);
          console.log(`  Output: ${outputFile}`);
        } else if (format === 'permit') {
          if (!outputFile || outputFile.includes('p31-guard-audit.permit.')) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            outputFile = opts.output || `/tmp/p31-permit-adapter.${timestamp}.json`;
          }
          let decisions: Array<{request: any; decision: 'allow'|'block'|'elicit'; policyId: string; reason?: string; timestamp?: string}>;
          if (opts.decisions) {
            const raw = JSON.parse(fs.readFileSync(opts.decisions, 'utf-8'));
            decisions = Array.isArray(raw) ? raw : (raw.permits || raw.decisions || []);
            if (!Array.isArray(decisions)) throw new Error('Decisions file must contain a JSON array or {decisions|permits: [...]}');
          } else {
            decisions = [
              { request: { tool: 'shell', args: { cmd: 'ls' } }, decision: 'allow', policyId: 'guard-v2', reason: 'sample safe action' },
              { request: { tool: 'write', args: { path: '/etc/passwd' } }, decision: 'block', policyId: 'guard-v2', reason: 'sample protected path' },
            ];
            console.log(chalk.gray('No --decisions file provided; exporting sample Permit decisions.'));
          }
          const hash = exportPermit(outputFile, decisions);
          console.log(chalk.green(`✓ Exported ${decisions.length} Permit decision(s) as p31-permit-adapter`));
          console.log(`  Export SHA-256: ${hash}`);
          console.log(`  Output: ${outputFile}`);
        } else if (format === 'aat') {
          if (!outputFile || outputFile.includes('p31-guard-audit.aat.')) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            outputFile = opts.output || `/tmp/p31-guard-audit.aat.${timestamp}.jsonl`;
          }
          const lines = entries.map(e => JSON.stringify(toAATCompatible(e))).join('\n') + (entries.length ? '\n' : '');
          fs.mkdirSync(dirname(outputFile), { recursive: true });
          fs.writeFileSync(outputFile, lines);
          console.log(chalk.green(`✓ Exported ${entries.length} entries as AAT-compatible JSONL (adapter aliases)`));
          console.log(`  Output: ${outputFile}`);
        } else {
          console.error(chalk.red(`✗ Unknown format: ${format}. Use 'jsonl', 'prov', 'scitt', 'cose', 'permit', or 'aat'`));
          process.exit(1);
        }
      } catch (err: any) {
        console.error(chalk.red(`✗ Export error: ${err.message}`));
        process.exit(1);
      }
    });

  // ── audit verify-proof (offline third-party verifier) ───────────

  audit
    .command('verify-proof <file>')
    .description('Third-party offline verifier: reads an exported proof file + public key')
    .option('-k, --key <keyfile>', 'Path to public key PEM file')
    .action(async (file: string, opts: { key?: string }) => {
      try {
        let pubKeyPem = '';

        if (opts.key) {
          pubKeyPem = fs.readFileSync(opts.key, 'utf-8');
        } else {
          // Third-party convenience: a sidecar key next to the proof file,
          // then the default P31 audit directory.
          const candidates = [
            `${file}.pub.pem`,
            join(dirname(file), 'cose-public-key.pem'),
            '/home/p31/.p31/guard-pub.pem',
          ];
          const keyPath = candidates.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
          if (!keyPath) {
            console.error(chalk.red('✗ Public key not found (looked for <file>.pub.pem, sidecar cose-public-key.pem, ~/.p31/guard-pub.pem)'));
            console.error('   Use --key to provide the public key PEM file path.');
            process.exit(1);
          }
          pubKeyPem = fs.readFileSync(keyPath, 'utf-8');
        }

        const result = verifyProofFile(file, pubKeyPem);

        if (result.valid) {
          console.log(chalk.green('✓ Proof verification passed.'));
          if (result.diagnostics?.verified) console.log(`  Verified: ${result.diagnostics.verified}`);
          else console.log('  The provenance chain/signatures were verified.');
          if (result.diagnostics?.format) console.log(`  Format: ${result.diagnostics.format}${result.diagnostics.spec_version ? ` (${result.diagnostics.spec_version})` : ''}`);
          if (result.diagnostics?.merkle_root_claimed) console.log(`  Merkle root: ${result.diagnostics.merkle_root_claimed}`);
          if (result.diagnostics?.note) console.log(`  Note: ${result.diagnostics.note}`);
          process.exit(0);
        } else {
          console.error(chalk.red(`✗ Proof verification failed: ${result.error}`));
          if (result.diagnostics) {
            console.error(chalk.gray('  Diagnostics: ' + JSON.stringify(result.diagnostics, null, 2).replace(/\n/g, '\n  ')));
          }
          process.exit(1);
        }
      } catch (err: any) {
        console.error(chalk.red(`✗ Verification error: ${err.message}`));
        process.exit(1);
      }
    });

  audit
    .command('trace')
    .description('L7 context lineage trace from audit log')
    .option('-s, --session <id>', 'Session ID filter (best-effort)')
    .option('-o, --output <file>', 'Write trace JSON to file')
    .action(async (opts: any) => {
      const entries = readAuditLog();
      const trace = traceContext(entries, opts.session);
      const out = JSON.stringify(trace, null, 2);
      if (opts.output) { fs.writeFileSync(opts.output, out); console.log(chalk.green('Trace written: '+opts.output)); }
      else console.log(out);
    });

  return audit;
}