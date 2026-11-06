/**
 * src/commands/phos.ts
 * Phos-forge command group — bridges to phos-forge MCP server + local CLI.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { spawn } from 'child_process';

const PHOS_CLI = '/home/p31/P31-local-workspace/tools/phos-forge/cli.mjs';

function runPhos(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [PHOS_CLI, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`phos ${args.join(' ')} failed (${code}): ${stderr.trim()}`));
    });
    child.on('error', reject);
  });
}

export function createPhosCommand(): Command {
  const phos = new Command('phos');
  phos.description('Phos-forge file classification and cognitive tools');

  // ── File classification ──────────────────────────────────────────────────

  phos
    .command('adopt [path]')
    .description('Classify and move unclassified files to canonical locations')
    .option('--dry-run', 'Preview without executing')
    .action(async (path, opts) => {
      try {
        const args = ['adopt'];
        if (opts.dryRun) args.push('--dry-run');
        if (path) args.push(path);
        const out = await runPhos(args);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  phos
    .command('status')
    .description('Show manifest stats, recent activity, and unclassified files')
    .action(async () => {
      try {
        const out = await runPhos(['status']);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  phos
    .command('classify <path>')
    .description('Classify a single file and show its canonical destination')
    .action(async (path) => {
      try {
        const out = await runPhos(['classify', path]);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  phos
    .command('learn [dir]')
    .description('Infer a draft canonical map for a project by scanning its structure')
    .action(async (dir = '.') => {
      try {
        const out = await runPhos(['learn', dir]);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  phos
    .command('rollback [count]')
    .description('Roll back the last N file moves')
    .action(async (count = '1') => {
      try {
        const out = await runPhos(['rollback', count]);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  phos
    .command('watch')
    .description('Start the background file watcher (vibe mode)')
    .action(async () => {
      try {
        const out = await runPhos(['watch']);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  phos
    .command('deploy <target>')
    .description('Deploy a Cloudflare Pages or Worker project with spoon-aware gating')
    .option('--force', 'Override cognitive safety gate')
    .action(async (target, opts) => {
      try {
        const args = ['deploy', target];
        if (opts.force) args.push('--force');
        const out = await runPhos(args);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  phos
    .command('dashboard')
    .description('Show convergence dashboard')
    .action(async () => {
      try {
        const out = await runPhos(['dashboard']);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  // ── Cognitive tools ──────────────────────────────────────────────────────

  phos
    .command('state')
    .description('Show estimated cognitive state (5-dimensional vector)')
    .action(async () => {
      try {
        const out = await runPhos(['state']);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  phos
    .command('estimate')
    .description('Run a fresh cognitive state estimate')
    .action(async () => {
      try {
        const out = await runPhos(['state', 'estimate']);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  phos
    .command('calibrate')
    .description('Self-report spoon level')
    .action(async () => {
      try {
        const out = await runPhos(['calibrate']);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  // ── Self-healer ──────────────────────────────────────────────────────────

  phos
    .command('remediate')
    .description('Run self-healer remediation cycle')
    .action(async () => {
      try {
        const out = await runPhos(['remediate']);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  phos
    .command('healer-log')
    .description('Show recent self-healer activity log')
    .action(async () => {
      try {
        const out = await runPhos(['remediate', 'log']);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  phos
    .command('healer-diag')
    .description('Show current metrics and matching diagnostics')
    .action(async () => {
      try {
        const out = await runPhos(['remediate', 'diag']);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  // ── Monitoring tools ─────────────────────────────────────────────────────

  phos
    .command('reflex [history]')
    .description('Show Reflex Arc status, pattern cooldowns, and recent firings')
    .action(async (history = '5') => {
      try {
        const out = await runPhos(['reflex', 'history', history]);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  phos
    .command('tide')
    .description('Show Tide temporal pattern learning model')
    .action(async () => {
      try {
        const out = await runPhos(['tide', 'status']);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  phos
    .command('kappa')
    .description('Show Kappa outcome-aware weights and adjusted diagnostic thresholds')
    .action(async () => {
      try {
        const out = await runPhos(['kappa', 'diagnostics']);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  phos
    .command('logbook')
    .description('Show Logbook session memory state')
    .action(async () => {
      try {
        const out = await runPhos(['logbook', 'status']);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  // ── Cartographer ─────────────────────────────────────────────────────────

  phos
    .command('cartographer <query>')
    .description('Semantic codebase search via TF-IDF')
    .action(async (query) => {
      try {
        const out = await runPhos(['cartographer', 'query', query]);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  phos
    .command('trace <symbol>')
    .description('Find all files that reference a symbol')
    .action(async (symbol) => {
      try {
        const out = await runPhos(['cartographer', 'trace', symbol]);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  phos
    .command('related <path>')
    .description('Find files semantically related to a given file')
    .action(async (path) => {
      try {
        const out = await runPhos(['cartographer', 'related', path]);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  // ── Brain dump ───────────────────────────────────────────────────────────

  phos
    .command('brain-dump <text>')
    .description('Process a quantum brain dump')
    .option('--quick', 'Quick mode: elaborate + organize')
    .option('--deep', 'Deep mode: + Jitterbug research')
    .option('--full', 'Full mode: + Cartographer + Tide')
    .action(async (text, opts) => {
      try {
        const args = ['brain', text];
        if (opts.quick) args.push('--quick');
        if (opts.deep) args.push('--deep');
        if (opts.full) args.push('--full');
        const out = await runPhos(args);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  phos
    .command('brain-sessions [count]')
    .description('Show recent brain dump sessions')
    .action(async (count = '5') => {
      try {
        const out = await runPhos(['brain', 'sessions', count]);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  // ── Jitterbug ────────────────────────────────────────────────────────────

  phos
    .command('jitterbug <problem>')
    .description('Run the fractal research workflow')
    .option('--factor <n>', 'Branch factor (default: 4, spoon-gated)', '4')
    .option('--depth <n>', 'Convergence depth (default: 3, spoon-gated)', '3')
    .option('--dry-run', 'Preview without executing LLM calls')
    .action(async (problem, opts) => {
      try {
        const args = ['jitterbug', `"${problem}"`];
        if (opts.factor) args.push('--factor', opts.factor);
        if (opts.depth) args.push('--depth', opts.depth);
        if (opts.dryRun) args.push('--dry-run');
        const out = await runPhos(args);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  // ── Aura ─────────────────────────────────────────────────────────────────

  phos
    .command('aura')
    .description('Terminal particle visualization of cognitive state')
    .option('--once', 'Single frame output')
    .option('--verbose', 'Show labels and bars overlay')
    .option('--compact', 'Use compact 5-char bar display')
    .option('--share', 'Save to file')
    .action(async (opts) => {
      try {
        const args = ['aura'];
        if (opts.once) args.push('--once');
        if (opts.verbose) args.push('--verbose');
        if (opts.compact) args.push('--compact');
        if (opts.share) args.push('--share');
        const out = await runPhos(args);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  // ── Bus ──────────────────────────────────────────────────────────────────

  phos
    .command('bus-emit <type> <payload>')
    .description('Emit an event to the PHOS Forge event bus')
    .action(async (type, payload) => {
      try {
        const out = await runPhos(['bus', 'emit', type, payload]);
        console.log(chalk.green(out));
      } catch (err: any) {
        console.error(chalk.red(`✗ ${err.message}`));
        process.exit(1);
      }
    });

  return phos;
}
