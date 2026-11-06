#!/usr/bin/env node
/**
 * src/index.ts
 * P31 Sovereign CLI v3 — OpenCode face, P31 guts.
 * Entry point with session management, provider routing, and Spoon-aware UI.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import dotenv from 'dotenv';

import { loadConfig, saveConfig, type P31Config, type SpoonLevel, SPOON_LEVELS, detectProvider } from './lib/config.js';
import { getSessionStore, createSessionStore } from './session-store.js';
import { createProvider } from './providers/index.js';
import { createPhosCommand } from './commands/phos.js';
import { createShellCommand } from './commands/shell.js';
import { createServeCommand } from './commands/serve.js';
import { createSyncCommand } from './commands/sync.js';
import { createAuditCommand } from './commands/audit.js';
import { createVerifyCommand } from './commands/verify.js';
import { createThemesCommand } from './commands/themes.js';

dotenv.config();

const VERSION = '3.1.3';

const program = new Command();

let state: P31Config;
let sessionStore = getSessionStore();

function spoonEmoji(level: SpoonLevel): string {
  return '\uD83E\uDD44'.repeat(level / 2);
}

program
  .name('p31')
  .description('Sovereign AI agent for neurodivergent families — OpenCode face, P31 guts')
  .version(VERSION);

// ── Spoons ────────────────────────────────────────────────────────────────

program
  .command('spoons [level]')
  .description('Set or view spoon level (1=minimal, 3=standard, 5=full)')
  .action(async (level?: string) => {
    state = await loadConfig();
    if (!level) {
      const levels = [
        { level: 1 as SpoonLevel, label: 'Minimal' },
        { level: 3 as SpoonLevel, label: 'Standard' },
        { level: 5 as SpoonLevel, label: 'Full' },
      ];
      for (const { level, label } of levels) {
        const active = state.spoonLevel === level;
        const line = active
          ? chalk.bgCyan.black(` ${spoonEmoji(level)} ${label} `)
          : chalk.gray(` ${spoonEmoji(level)} ${label} `);
        console.log(line);
      }
      console.log(chalk.gray(`\n  Current: ${state.spoonLevel}`));
      return;
    }
    const num = parseInt(level, 10) as SpoonLevel;
    if (![1, 3, 5].includes(num)) {
      console.error(chalk.red('\u2717 Spoons must be 1, 3, or 5'));
      process.exit(1);
    }
    state.spoonLevel = num;
    await saveConfig(state);
    console.log(chalk.green(`\u2713 Spoons set to ${num} ${spoonEmoji(num)}`));
  });

// ── Session Management ────────────────────────────────────────────────────

program
  .command('session')
  .description('Session management')
  .addCommand(
    new Command('list')
      .description('List all sessions')
      .action(async () => {
        const sessions = sessionStore.listSessions();
        console.log(chalk.cyan('\n\u{1F4CB} Sessions\n'));
        for (const s of sessions) {
          const title = s.title || chalk.gray('(untitled)');
          const model = chalk.dim(s.model);
          const spoons = spoonEmoji(s.spoonLevel);
          console.log(`  ${chalk.green('●')} ${chalk.bold(s.id.slice(0, 8))}  ${title}  ${model}  ${spoons}`);
        }
        console.log(chalk.gray(`\n  ${sessions.length} sessions`));
      })
  )
  .addCommand(
    new Command('new [parentId]')
      .description('Create a new session')
      .action(async (parentId?: string) => {
        const session = sessionStore.createSession(parentId);
        state = await loadConfig();
        state.sessionId = session.id;
        await saveConfig(state);
        console.log(chalk.green(`\u2713 Created session ${session.id}`));
        if (parentId) console.log(chalk.gray(`  Parent: ${parentId}`));
      })
  )
  .addCommand(
    new Command('info [id]')
      .description('Show session info')
      .action(async (id?: string) => {
        const sessionId = id || (await loadConfig()).sessionId;
        const session = sessionStore.getSession(sessionId);
        if (!session) {
          console.error(chalk.red(`\u2717 Session not found: ${sessionId}`));
          process.exit(1);
        }
        console.log(chalk.cyan(`\n\u{1F4CB} Session: ${session.id}\n`));
        console.log(`  Title:    ${session.title || chalk.gray('(untitled)')}`);
        console.log(`  Model:    ${session.model}`);
        console.log(`  Spoons:   ${spoonEmoji(session.spoonLevel)} (${session.spoonLevel})`);
        console.log(`  Status:   ${session.status}`);
        console.log(`  Created:  ${session.createdAt}`);
        console.log(`  Updated:  ${session.updatedAt}`);
        console.log(`  Messages: ${session.messages.length}`);
      })
  );

// ── Chat ──────────────────────────────────────────────────────────────────

program
  .command('chat')
  .description('Start interactive chat session (OpenCode-compatible)')
  .option('--model <model>', 'LLM model to use')
  .option('--session <id>', 'Existing session ID to resume')
  .action(async (opts) => {
    state = await loadConfig();
    const provider = state.providers.find((p) => p.id === state.activeProvider) || state.providers[0];
    const model = opts.model || state.model || provider.defaultModel;

    console.log(chalk.cyan(`\n\u26A1 P31 Sovereign Chat`));
    console.log(chalk.gray(`  Provider: ${provider.name}`));
    console.log(chalk.gray(`  Model: ${model}`));
    console.log(chalk.gray(`  Spoons: ${spoonEmoji(state.spoonLevel)} (${state.spoonLevel})`));
    console.log(chalk.gray(`  Type /help for commands, Ctrl+C to exit\n`));

    const adapter = createProvider(provider);
    const messages: Array<{ role: string; content: string }> = [];

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const rl = {
      question: (prompt: string): Promise<string> => {
        return new Promise((resolve) => {
          process.stdout.write(prompt);
          const handler = (buf: Buffer) => {
            if (buf.toString() === '\u0003') {
              process.stdin.setRawMode(false);
              process.stdin.pause();
              resolve('/exit');
              return;
            }
            if (buf.toString() === '\r') {
              process.stdout.write('\n');
              process.stdin.setRawMode(false);
              process.stdin.pause();
              resolve(line);
              return;
            }
            line += buf.toString();
            process.stdout.write(buf.toString());
          };
          let line = '';
          process.stdin.on('data', handler);
        });
      },
    };

    while (true) {
      const input: string = await rl.question(chalk.cyan('you> '));
      if (input === '/exit' || input === '/quit') break;
      if (input === '/help') {
        console.log(chalk.gray('  Commands: /exit /clear /spoons /model /session /tools'));
        continue;
      }
      if (input === '/clear') { messages.length = 0; console.log(chalk.gray('  Cleared.')); continue; }
      if (input === '/spoons') {
        console.log(`  Current spoons: ${state.spoonLevel}`);
        continue;
      }
      if (input === '/tools') {
        console.log(chalk.gray('  MCP tools: use `p31 mcp --list`'));
        continue;
      }

      messages.push({ role: 'user', content: input });

      try {
        console.log(chalk.gray('  ...thinking'));
        const result = await adapter.chat({
          model,
          messages,
          temperature: 0.7,
          maxTokens: 4096,
        });
        messages.push({ role: 'assistant', content: result.content });
        console.log(chalk.green('p31> ') + result.content);
      } catch (error) {
        console.error(chalk.red(`\u2717 Error: ${error}`));
      }
    }
  });

// ── Agent ─────────────────────────────────────────────────────────────────

program
  .command('agent <task>')
  .description('Run autonomous agent (OpenCode-compatible)')
  .option('--model <model>', 'LLM model to use')
  .option('--iterations <n>', 'Max iterations', '10')
  .option('--spoons <level>', 'Spoon level for this run')
  .action(async (task, opts) => {
    state = await loadConfig();
    const spoonLevel = opts.spoons ? parseInt(opts.spoons) as SpoonLevel : state.spoonLevel;
    const provider = state.providers.find((p) => p.id === state.activeProvider) || state.providers[0];
    const model = opts.model || state.model || provider.defaultModel;

    const session = sessionStore.createSession();
    state.sessionId = session.id;
    await saveConfig(state);

    console.log(chalk.cyan(`\n\u26A1 P31 Sovereign Agent`));
    console.log(chalk.gray(`  Session: ${session.id}`));
    console.log(chalk.gray(`  Model: ${model}`));
    console.log(chalk.gray(`  Spoons: ${spoonEmoji(spoonLevel)} (${spoonLevel})`));
    console.log(chalk.gray(`  Task: ${task}\n`));

    const adapter = createProvider(provider);
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: 'You are the P31 Sovereign Agent. You have access to 187+ sovereign tools. Respect spoon levels. Never expose secrets. Use honest labels for contested science. Be direct, specific, and unfiltered.' },
      { role: 'user', content: task },
    ];

    const maxIterations = parseInt(opts.iterations, 10);

    for (let i = 0; i < maxIterations; i++) {
      try {
        const result = await adapter.chat({
          model,
          messages,
          temperature: 0.7,
          maxTokens: 4096,
        });

        messages.push({ role: 'assistant', content: result.content });
        sessionStore.appendMessage(session.id, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.content,
          timestamp: new Date().toISOString(),
        });

        console.log(chalk.green(`\u2713 Agent output:\n`));
        console.log(result.content);
        console.log(chalk.gray(`\n  Tokens: ${result.usage.totalTokens} | Model: ${result.model}`));
        break;
      } catch (error) {
        console.error(chalk.red(`\u2717 Agent error: ${error}`));
        process.exit(1);
      }
    }
  });

// ── MCP ───────────────────────────────────────────────────────────────────

program
  .command('mcp')
  .description('MCP tool management (OpenCode-compatible)')
  .addCommand(
    new Command('list')
      .description('List available MCP servers')
      .action(async () => {
        const ocConfig = await loadConfig();
        const mcpServers = [
          { id: 'phos-forge', type: 'local', tools: 32, status: 'ready' },
          { id: 'p31-crypto-mcp', type: 'remote', tools: 12, status: 'live' },
          { id: 'p31-justice-hub', type: 'remote', tools: 8, status: 'live' },
          { id: 'bros', type: 'remote', tools: 8, status: 'live' },
          { id: 'dads', type: 'remote', tools: 7, status: 'live' },
          { id: 'x402-gateway', type: 'remote', tools: 187, status: 'live' },
          { id: 'federation-bridge', type: 'remote', tools: 12, status: 'live' },
          { id: 'ledger-bridge', type: 'remote', tools: 8, status: 'live' },
          { id: 'care-mesh', type: 'remote', tools: 6, status: 'live' },
        ];
        console.log(chalk.cyan('\n\u{1F4E6} MCP Servers\n'));
        for (const s of mcpServers) {
          const typeColor = s.type === 'local' ? chalk.yellow : chalk.green;
          console.log(`  ${typeColor(s.type.padEnd(6))} ${chalk.bold(s.id)}  ${s.tools} tools  ${s.status}`);
        }
        console.log(chalk.gray(`\n  ${mcpServers.reduce((a, s) => a + s.tools, 0)} total tools across ${mcpServers.length} servers`));
      })
  )
  .addCommand(
    new Command('call <tool>')
      .description('Call an MCP tool')
      .option('--args <json>', 'Tool arguments as JSON', '{}')
      .action(async (tool, opts) => {
        state = await loadConfig();
        console.log(chalk.cyan(`\n\u{1F527} Calling: ${tool}\n`));
        console.log(chalk.gray('  MCP bridge integration — use p31 chat for agent-driven tool calls'));
        console.log(chalk.yellow(`\n  Tool: ${tool}`));
        console.log(chalk.yellow(`  Args: ${opts.args}`));
      })
  )
  .addCommand(
    new Command('serve')
      .description('Start MCP HTTP server (OpenCode-compatible)')
      .option('--port <port>', 'Server port', '3000')
      .action(async (opts) => {
        const { createMcpHttpServer } = await import('./mcp-http.js');
        createMcpHttpServer(parseInt(opts.port, 10));
      })
  );

// ── Models ────────────────────────────────────────────────────────────────

program
  .command('models')
  .description('List available LLM models')
  .action(async () => {
    state = await loadConfig();
    console.log(chalk.cyan('\n\u{1F4DA} Available Models\n'));
    for (const provider of state.providers) {
      console.log(chalk.bold(`  ${provider.name}:`));
      for (const model of provider.models) {
        const active = model === (state.model || provider.defaultModel);
        const prefix = active ? chalk.green('\u25CF') : chalk.gray('\u25CB');
        console.log(`    ${prefix} ${model}${active ? chalk.green(' (active)') : ''}`);
      }
    }
  });

// ── Init ──────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialize P31 CLI in the current directory')
  .action(async () => {
    state = await loadConfig();
    console.log(chalk.cyan('\n\u{1F680} Initializing P31 Sovereign CLI v3...\n'));

    // Check for API keys
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const hasGoogle = !!process.env.GOOGLE_API_KEY;
    const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;

    console.log(chalk.green(`\u2713 Session: ${state.sessionId}`));
    console.log(chalk.green(`\u2713 Project root: ${state.projectRoot}`));
    console.log(chalk.green(`\u2713 Spoon level: ${state.spoonLevel} ${spoonEmoji(state.spoonLevel)}`));
    console.log(chalk.green(`\u2713 Session store: ${state.sessionDir}`));

    if (!hasAnthropic && !hasGoogle && !hasOpenRouter) {
      console.log(chalk.yellow('\n\u26A0  No API keys detected. Set one of:'));
      console.log(chalk.gray('   ANTHROPIC_API_KEY, GOOGLE_API_KEY, OPENROUTER_API_KEY'));
    } else {
      const providers: string[] = [];
      if (hasAnthropic) providers.push('Anthropic');
      if (hasGoogle) providers.push('Google Gemini');
      if (hasOpenRouter) providers.push('OpenRouter');
      console.log(chalk.green(`\u2713 Providers: ${providers.join(', ')}`));
    }

    console.log(chalk.gray('\n   Configuration saved to ~/.p31/config.json\n'));
    console.log(chalk.gray('   Next: p31 chat --model deepseek-v4-flash\n'));
  });

// ── Phos-forge ─────────────────────────────────────────────────────────────

program.addCommand(createPhosCommand());
program.addCommand(createShellCommand());
program.addCommand(createServeCommand());
program.addCommand(createSyncCommand());
program.addCommand(createAuditCommand());
program.addCommand(createVerifyCommand());
program.addCommand(createThemesCommand());

// ── TUI ───────────────────────────────────────────────────────────────────

program
  .command('tui')
  .description('Launch the spoon-aware TUI (OpenCode face)')
  .action(async () => {
    const { launchTUI } = await import('./tui/index.js');
    launchTUI();
  });

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const hasArgs = process.argv.slice(2).length > 0;

  if (!hasArgs) {
    state = await loadConfig();
    const header = boxen(
      chalk.cyan('\u26A1 P31 Sovereign CLI ') + chalk.gray(`v${VERSION}`) + '\n' +
      chalk.gray(`  OpenCode face \u00B7 P31 guts` + '\n') +
      chalk.gray(`  Session: ${state.sessionId}  \u00B7  Spoons: ${spoonEmoji(state.spoonLevel)}  \u00B7  ${state.projectRoot}`),
      { padding: 1, borderStyle: 'round', borderColor: 'cyan', dimBorder: true }
    );
    console.log(header);
    console.log(chalk.gray('\n  Commands:'));
    console.log(chalk.gray('    spoons     Set/view cognitive load level'));
    console.log(chalk.gray('    session    Session management (list, new, info)'));
    console.log(chalk.gray('    chat       Start interactive chat'));
    console.log(chalk.gray('    agent      Run autonomous agent'));
    console.log(chalk.gray('    models     List available LLM models'));
    console.log(chalk.gray('    mcp        MCP tool management'));
    console.log(chalk.gray('    phos        Phos-forge file classification'));
    console.log(chalk.gray('    shell       Connect to P31 production shell'));
    console.log(chalk.gray('    sync        Cross-app state sync'));
    console.log(chalk.gray('    audit       Guard audit/provenance verification'));
    console.log(chalk.gray('    verify      Verify bundle integrity (SHA-256/signature)'));
    console.log(chalk.gray('    tui        Launch spoon-aware TUI'));
    console.log(chalk.gray('    init       Initialize CLI'));
    console.log(chalk.gray('\n  Example:'));
    console.log(chalk.cyan('    p31 chat --model deepseek-v4-flash\n'));
    process.exit(0);
  }

  program.exitOverride();
  try {
    program.parse(process.argv);
  } catch (err: any) {
    if (err.code === 'commander.help' || err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
      process.exit(0);
    }
    throw err;
  }
}

main().catch((error) => {
  console.error(chalk.red(`\u2717 Fatal error: ${error instanceof Error ? error.message : String(error)}`));
  process.exit(1);
});
