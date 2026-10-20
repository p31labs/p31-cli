/**
 * src/commands/shell.ts
 * Shell bridge commands — connects the CLI to the P31 production shell.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { ShellBridge, type CrossAppState } from '../lib/shell-bridge.js';
import { loadConfig, saveConfig } from '../lib/config.js';
import { getRBAC } from '../lib/rbac.js';

const DEFAULT_SHELL_URL = 'https://p31-shell.trimtab-signal.workers.dev';

function resolveShell(): ShellBridge {
  const url = process.env.P31_SHELL_URL || DEFAULT_SHELL_URL;
  return new ShellBridge(url);
}

function printState(state: CrossAppState | null): void {
  if (!state) {
    console.log(chalk.red('\u2717 No state returned'));
    return;
  }
  const spoons = '\uD83E\uDD44'.repeat(Math.max(0, Math.floor(state.spoons / 2)));
  console.log(chalk.cyan('\n\u{1F4CB} Shell State\n'));
  console.log(`  ${chalk.bold('Spoons:')}    ${spoons} ${state.spoons}`);
  if (state.sensory) {
    const s = state.sensory;
    console.log(`  ${chalk.bold('Muted:')}     ${s.muted ? chalk.green('on') : chalk.gray('off')}`);
    console.log(`  ${chalk.bold('Calm:')}      ${s.calm ? chalk.green('on') : chalk.gray('off')}`);
    console.log(`  ${chalk.bold('Warm Light:')} ${s.warmLight ? chalk.green('on') : chalk.gray('off')}`);
    console.log(`  ${chalk.bold('Font:')}      ${s.font}`);
    console.log(`  ${chalk.bold('Text Scale:')} ${s.textScale}`);
  }
  if (state.dataset) console.log(`  ${chalk.bold('Dataset:')}   ${state.dataset}`);
  if (state.source) console.log(`  ${chalk.bold('Source:')}    ${state.source}`);
  if (state.timestamp) console.log(`  ${chalk.bold('Updated:')}   ${new Date(state.timestamp).toISOString()}`);
  console.log();
}

function sensoryModeMap(mode: string): Partial<CrossAppState['sensory']> {
  switch (mode) {
    case 'muted':   return { muted: true, calm: false, warmLight: false };
    case 'warm':    return { muted: false, calm: false, warmLight: true };
    case 'calm':    return { muted: false, calm: true, warmLight: false };
    case 'focus':   return { muted: true, calm: true, warmLight: false, font: 'mono', textScale: 0.9 };
    case 'simple':  return { muted: true, calm: true, warmLight: false, font: 'sans', textScale: 1.0 };
    case 'task':    return { muted: true, calm: false, warmLight: false, font: 'mono', textScale: 0.85 };
    default:        return {};
  }
}

export function createShellCommand(): Command {
  const shell = new Command('shell');
  shell.description('Connect to the P31 production shell');

  // ── Status ────────────────────────────────────────────────────────────────

  shell
    .command('status')
    .description('Show current shell state')
    .action(async () => {
      const bridge = resolveShell();
      const health = await bridge.health();
      if (!health) {
        console.log(chalk.red('\u2717 Shell unreachable'));
        bridge.close();
        return;
      }
      console.log(chalk.green(`\u2713 Shell healthy: ${health.status}`));
      const state = await bridge.getState();
      printState(state);
      bridge.close();
    });

  // ── Spoons ────────────────────────────────────────────────────────────────

  shell
    .command('spoons [level]')
    .description('Set energy level (0\u20135)')
    .action(async (level?: string) => {
      const rbac = getRBAC();
      if (level && !rbac.can('shell', 'write')) {
        console.error(chalk.red(`\u2717 Permission denied: role "${rbac.getRole()}" cannot set spoons`));
        process.exit(1);
      }
      const bridge = resolveShell();
      if (!level) {
        const state = await bridge.getState();
        printState(state);
        bridge.close();
        return;
      }
      const num = parseInt(level, 10);
      if (isNaN(num) || num < 0 || num > 5) {
        console.error(chalk.red('\u2717 Spoons must be 0\u20135'));
        bridge.close();
        process.exit(1);
      }
      const state = await bridge.setState({ spoons: num });
      if (state) {
        console.log(chalk.green(`\u2713 Spoons set to ${num} ${'\uD83E\uDD44'.repeat(Math.floor(num / 2))}`));
      }
      bridge.close();
    });

  // ── Sensory ───────────────────────────────────────────────────────────────

  shell
    .command('sensory [mode]')
    .description('Set sensory mode (muted|warm|calm|focus|simple|task)')
    .action(async (mode?: string) => {
      const rbac = getRBAC();
      if (mode && !rbac.can('shell', 'write')) {
        console.error(chalk.red(`\u2717 Permission denied: role "${rbac.getRole()}" cannot set sensory mode`));
        process.exit(1);
      }
      const bridge = resolveShell();
      if (!mode) {
        const state = await bridge.getState();
        printState(state);
        bridge.close();
        return;
      }
      const validModes = ['muted', 'warm', 'calm', 'focus', 'simple', 'task'];
      if (!validModes.includes(mode)) {
        console.error(chalk.red(`\u2717 Unknown mode: ${mode}`));
        console.log(chalk.gray(`  Valid: ${validModes.join(', ')}`));
        bridge.close();
        process.exit(1);
      }
      const state = await bridge.setState({ sensory: sensoryModeMap(mode) });
      if (state) {
        console.log(chalk.green(`\u2713 Sensory mode set to ${mode}`));
      }
      bridge.close();
    });

  // ── Watch ─────────────────────────────────────────────────────────────────

  shell
    .command('watch')
    .description('Live monitor shell state via WebSocket')
    .action(async () => {
      const bridge = resolveShell();
      const health = await bridge.health();
      if (!health) {
        console.log(chalk.red('\u2717 Shell unreachable'));
        bridge.close();
        return;
      }
      console.log(chalk.cyan('\u{1F310} Watching shell state\u2026'));
      console.log(chalk.gray('  Press Ctrl+C to stop\n'));

      const unsub = bridge.watchState((state) => {
        const ts = state.timestamp ? new Date(state.timestamp).toLocaleTimeString() : '?';
        const spoons = '\uD83E\uDD44'.repeat(Math.floor(state.spoons / 2));
        process.stdout.write(
          `\r${chalk.gray(ts)}  Spoons: ${spoons}${state.spoons}  ` +
          `Muted:${state.sensory?.muted ? chalk.green('on') : chalk.gray('-')} ` +
          `Calm:${state.sensory?.calm ? chalk.green('on') : chalk.gray('-')} ` +
          `Warm:${state.sensory?.warmLight ? chalk.green('on') : chalk.gray('-')}    `
        );
      });

      process.on('SIGINT', () => {
        unsub();
        bridge.close();
        process.stdout.write('\n');
        process.exit(0);
      });
    });

  // ── Sync ──────────────────────────────────────────────────────────────────

  shell
    .command('sync')
    .description('Bidirectional sync between CLI config and shell')
    .option('--to-shell', 'Push CLI config spoons to shell')
    .option('--from-shell', 'Pull shell state spoons into CLI config')
    .action(async (opts) => {
      const bridge = resolveShell();
      const cliConfig = await loadConfig();
      const shellState = await bridge.getState();

      if (!shellState) {
        console.log(chalk.red('\u2717 Could not reach shell'));
        bridge.close();
        return;
      }

      if (opts.fromShell) {
        const num = Math.max(1, Math.min(5, shellState.spoons)) as 1 | 3 | 5;
        const rounded = num <= 2 ? 1 : num <= 4 ? 3 : 5;
        cliConfig.spoonLevel = rounded;
        await saveConfig(cliConfig);
        console.log(chalk.green(`\u2713 Pulled shell spoons (${shellState.spoons}) \u2192 CLI (${rounded})`));
        bridge.close();
        return;
      }

      if (opts.toShell) {
        const state = await bridge.setState({ spoons: cliConfig.spoonLevel });
        if (state) {
          console.log(chalk.green(`\u2713 Pushed CLI spoons (${cliConfig.spoonLevel}) \u2192 shell (${state.spoons})`));
        }
        bridge.close();
        return;
      }

      const diff = cliConfig.spoonLevel !== shellState.spoons;
      console.log(chalk.cyan('\n\u{1F504} Sync Status\n'));
      console.log(`  CLI spoons:   ${cliConfig.spoonLevel}`);
      console.log(`  Shell spoons: ${shellState.spoons}`);
      console.log(`  ${diff ? chalk.yellow('  \u26A0  Mismatch \u2014 use --to-shell or --from-shell') : chalk.green('  \u2713 In sync')}`);
      console.log();
      bridge.close();
    });

  return shell;
}
