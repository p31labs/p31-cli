#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { loadConfig, saveConfig, type P31Config, type SpoonLevel, SPOON_LEVELS } from './lib/config.js';
import { runAgent } from './commands/agent.js';

const VERSION = '2.0.0';

const program = new Command();

let state: P31Config;

program
  .name('p31')
  .description('Sovereign AI agent for neurodivergent families')
  .version(VERSION);

program
  .command('spoons [level]')
  .description('Set spoon level (1, 3, or 5)')
  .action(async (level?: string) => {
    state = await loadConfig();
    if (!level) {
      const levels = [
        { level: 1, label: 'Low', emoji: '\uD83E\uDD44' },
        { level: 3, label: 'Med', emoji: '\uD83E\uDD44\uD83E\uDD44\uD83E\uDD44' },
        { level: 5, label: 'High', emoji: '\uD83E\uDD44\uD83E\uDD44\uD83E\uDD44\uD83E\uDD44\uD83E\uDD44' },
      ];
      for (const { level, label, emoji } of levels) {
        const active = state.spoonLevel === level;
        const line = active
          ? chalk.bgCyan.black(` ${emoji} ${label} `)
          : chalk.gray(` ${emoji} ${label} `);
        console.log(line);
      }
      return;
    }
    const num = parseInt(level, 10);
    if (![1, 3, 5].includes(num)) {
      console.error(chalk.red('\u2717 Spoons must be 1, 3, or 5'));
      process.exit(1);
    }
    state.spoonLevel = num as SpoonLevel;
    await saveConfig(state);
    console.log(chalk.green(`\u2713 Spoons set to ${num}`));
  });

const mcpCommand = program
  .command('mcp')
  .description('MCP tool management');

mcpCommand
  .option('--server <url>', 'MCP server URL')
  .option('--list', 'List available tools')
  .option('--call <tool>', 'Call a specific tool')
  .option('--args <json>', 'Tool arguments as JSON')
  .action(async (opts) => {
    state = await loadConfig();
    if (opts.server) {
      state.mcpServerUrl = opts.server;
      await saveConfig(state);
      console.log(chalk.green(`\u2713 MCP server set to ${opts.server}`));
      return;
    }
    if (opts.list) {
      await listMcpTools(state.mcpServerUrl!);
      return;
    }
    if (opts.call) {
      await callMcpTool(state.mcpServerUrl!, opts.call, opts.args ? JSON.parse(opts.args) : {});
      return;
    }
    console.log(chalk.yellow('Usage: p31 mcp --list | --call <tool> --args <json>'));
  });

mcpCommand
  .command('serve')
  .description('Start the MCP HTTP server')
  .option('--port <port>', 'Server port', '3000')
  .action(async (opts) => {
    const { createMcpHttpServer } = await import('./mcp-http.js');
    createMcpHttpServer(parseInt(opts.port, 10));
  });

program
  .command('stream')
  .description('Stream terminal output via WebSocket')
  .option('--port <port>', 'WebSocket port', '3001')
  .option('--title <title>', 'Stream title', 'P31 Agent Session')
  .option('--command <cmd>', 'Command to stream', 'bash')
  .action(async (opts) => {
    const { StreamServer } = await import('./stream-server.js');
    const server = new StreamServer({
      port: parseInt(opts.port, 10),
      title: opts.title,
      command: opts.command,
    });
    await server.start();
  });

program
  .command('agent')
  .description('Run autonomous agent')
  .argument('<task>', 'Task to execute')
  .option('--model <model>', 'LLM model to use')
  .option('--iterations <n>', 'Max iterations', '10')
  .action(async (task, opts) => {
    await runAgent({
      task,
      model: opts.model,
      maxIterations: parseInt(opts.iterations, 10),
    });
  });

program
  .command('chat')
  .description('Start interactive chat session')
  .option('--model <model>', 'LLM model')
  .action(async (opts) => {
    state = await loadConfig();
    const { startChat } = await import('./commands/chat.js');
    await startChat({ model: opts.model || state.model || 'deepseek-v4-flash', state });
  });

program
  .command('ui')
  .description('Open the web interface')
  .action(async () => {
    const { startWebUI } = await import('./commands/ui.js');
    await startWebUI();
  });

program
  .command('init')
  .description('Initialize P31 CLI in the current directory')
  .action(async () => {
    state = await loadConfig();
    console.log(chalk.cyan('\n\u{1F680} Initializing P31 CLI...\n'));
    console.log(chalk.green(`\u2713 Session: ${state.sessionId}`));
    console.log(chalk.green(`\u2713 Project root: ${state.projectRoot}`));
    console.log(chalk.green(`\u2713 Spoon level: ${state.spoonLevel}`));
    console.log(chalk.gray('\n   Configuration saved to ~/.p31/config.json\n'));
  });

async function listMcpTools(mcpUrl: string): Promise<void> {
  try {
    const response = await fetch(`${mcpUrl}/tools`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as { tools?: Array<{ name: string; description?: string }> };
    console.log(chalk.cyan('\n\u{1F4E6} Available MCP Tools\n'));
    const tools = data.tools || [];
    for (const tool of tools) {
      console.log(`  ${chalk.green('\u25CF')} ${chalk.bold(tool.name)}`);
      if (tool.description) {
        console.log(`    ${chalk.gray(tool.description)}`);
      }
    }
    console.log(chalk.gray(`\n  ${tools.length} tools available`));
  } catch (error) {
    console.error(chalk.red(`\u2717 Failed to list MCP tools: ${error}`));
  }
}

async function callMcpTool(mcpUrl: string, name: string, args: Record<string, unknown>): Promise<void> {
  try {
    console.log(chalk.cyan(`\n\u{1F527} Calling tool: ${name}\n`));
    const response = await fetch(`${mcpUrl}/tools/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    console.log(chalk.green('\u2713 Result:'));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(chalk.red(`\u2717 Tool call failed: ${error}`));
  }
}

async function main() {
  const hasArgs = process.argv.slice(2).length > 0;

  if (!hasArgs) {
    state = await loadConfig();
    const header = boxen(
      chalk.cyan('\u26A1 P31 Sovereign CLI ') + chalk.gray(`v${VERSION}`) + '\n' +
      chalk.gray(`  Session: ${state.sessionId}  \u00B7  Spoons: \uD83E\uDD44`.repeat(state.spoonLevel) + `  \u00B7  ${state.projectRoot}`),
      { padding: 1, borderStyle: 'round', borderColor: 'cyan', dimBorder: true }
    );
    console.log(header);
    console.log(chalk.gray('\n  ' + chalk.bold('Commands:') + '  spoons  mcp  stream  agent  chat  ui  init'));
    console.log(chalk.gray('  ' + chalk.bold('Example:') + '  p31 chat --model deepseek-v4-flash\n'));
    process.exit(0);
  }

  program.exitOverride();
  try {
    program.parse(process.argv);
  } catch (err: any) {
    if (err.code === 'commander.help' || err.code === 'commander.version') {
      process.exit(0);
    }
    throw err;
  }
}

main().catch((error) => {
  console.error(chalk.red(`\u2717 Fatal error: ${error instanceof Error ? error.message : String(error)}`));
  process.exit(1);
});
