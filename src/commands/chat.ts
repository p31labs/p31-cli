import { createInterface } from 'readline';
import chalk from 'chalk';
import boxen from 'boxen';
import type { P31Config } from '../lib/config.js';

interface ChatOptions {
  model: string;
  state: P31Config;
}

export async function startChat(opts: ChatOptions): Promise<void> {
  const { model } = opts;
  const spoonEmoji = '\uD83E\uDD44'.repeat(opts.state.spoonLevel);

  console.clear();
  console.log(
    boxen(
      chalk.cyan('\u26A1 P31 Sovereign CLI') + '\n' +
      chalk.gray(`  Spoons: ${spoonEmoji}  \u00B7  Model: ${model}`),
      { padding: 1, borderStyle: 'round', borderColor: 'cyan', dimBorder: true }
    )
  );
  console.log(chalk.gray(`\n\u{1F4AC} Chat session: ${model}`));
  console.log(chalk.gray('   Type /help for commands, /exit to quit\n'));

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan(opts.state.spoonLevel === 1 ? '> ' : opts.state.spoonLevel === 3 ? '>> ' : '>>> '),
  });

  rl.prompt();

  rl.on('line', async (line: string) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    switch (input) {
      case '/exit':
        console.log(chalk.gray('\nGoodbye.'));
        rl.close();
        process.exit(0);
        return;

      case '/help':
        console.log(chalk.cyan('\n\u{1F4D6} Commands:'));
        console.log('  /exit      Exit chat');
        console.log('  /spoons    Show spoon level');
        console.log('  /model     Show current model');
        console.log('  /clear     Clear screen\n');
        rl.prompt();
        return;

      case '/spoons':
        console.log(chalk.gray(`  Current spoons: ${spoonEmoji} (${opts.state.spoonLevel})\n`));
        rl.prompt();
        return;

      case '/model':
        console.log(chalk.gray(`  Current model: ${model}\n`));
        rl.prompt();
        return;

      case '/clear':
        console.clear();
        rl.prompt();
        return;
    }

    console.log(chalk.gray(`\n[${model}] `) + chalk.white(`Processing: "${input}"`));
    console.log(chalk.gray('   (LLM integration coming soon)\n'));
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.gray('\nSession ended.'));
    process.exit(0);
  });
}
