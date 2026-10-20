/**
 * src/commands/sync.ts
 * `p31 sync` — Cross-app state sync between CLI and shell.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { SyncDaemon } from '../lib/sync-daemon.js';

let daemon: SyncDaemon | null = null;

function getDaemon(): SyncDaemon {
  if (!daemon) {
    const url = process.env.P31_SHELL_URL || 'http://localhost:8080';
    daemon = new SyncDaemon(url);
  }
  return daemon;
}

export function createSyncCommand(): Command {
  const sync = new Command('sync')
    .description('Cross-app state sync between CLI and shell')
    .addCommand(
      new Command('start')
        .description('Start background sync daemon')
        .action(() => {
          const d = getDaemon();
          if (d.getStatus().running) {
            console.log(chalk.yellow('⚠ Sync daemon already running'));
            return;
          }
          d.start();
          console.log(chalk.green('✓ Sync daemon started'));
        }),
    )
    .addCommand(
      new Command('stop')
        .description('Stop sync daemon')
        .action(() => {
          const d = getDaemon();
          if (!d.getStatus().running) {
            console.log(chalk.yellow('⚠ Sync daemon not running'));
            return;
          }
          d.stop();
          console.log(chalk.green('✓ Sync daemon stopped'));
        }),
    )
    .addCommand(
      new Command('status')
        .description('Show sync status')
        .action(() => {
          const status = getDaemon().getStatus();
          console.log(chalk.cyan('\n🔄 Sync Status\n'));
          console.log(`  Running:   ${status.running ? chalk.green('yes') : chalk.gray('no')}`);
          console.log(`  Last sync: ${status.lastSync ? new Date(status.lastSync).toLocaleTimeString() : chalk.gray('never')}`);
          console.log(`  Direction: ${status.direction}`);
          console.log(`  Errors:    ${status.errors}\n`);
        }),
    )
    .addCommand(
      new Command('history')
        .description('Show recent sync events')
        .action(() => {
          const events = getDaemon().getHistory();
          if (events.length === 0) {
            console.log(chalk.gray('\n  No sync events yet\n'));
            return;
          }
          console.log(chalk.cyan('\n🔄 Sync History\n'));
          for (const e of events.slice(-20)) {
            const arrow = e.direction === 'local→shell' ? chalk.blue('→') : chalk.green('←');
            const time = new Date(e.timestamp).toLocaleTimeString();
            console.log(`  ${chalk.gray(time)} ${arrow} ${chalk.bold(e.field)}  ${e.oldValue} → ${e.newValue}`);
          }
          console.log(chalk.gray(`\n  ${events.length} events total\n`));
        }),
    )
    .addCommand(
      new Command('push')
        .description('Force push local config → shell')
        .action(async () => {
          console.log(chalk.gray('  Pushing local config to shell...'));
          await getDaemon().pushLocal();
          console.log(chalk.green('✓ Pushed'));
        }),
    )
    .addCommand(
      new Command('pull')
        .description('Force pull shell config → local')
        .action(async () => {
          console.log(chalk.gray('  Pulling shell config to local...'));
          await getDaemon().pullRemote();
          console.log(chalk.green('✓ Pulled'));
        }),
    );

  return sync;
}
