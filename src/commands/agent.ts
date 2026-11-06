import chalk from 'chalk';
import { loadConfig } from '../lib/config.js';

export interface AgentOptions {
  task: string;
  model?: string;
  maxIterations?: number;
}

export async function runAgent(opts: AgentOptions): Promise<void> {
  const state = await loadConfig();
  const model = opts.model || state.model || 'deepseek-v4-flash';
  const maxIterations = opts.maxIterations || 10;

  console.log(chalk.cyan(`\n\u{1F916} Agent: ${model}`));
  console.log(chalk.gray(`   Task: ${opts.task}`));
  console.log(chalk.gray(`   Max iterations: ${maxIterations}\n`));

  console.log(chalk.yellow('\u26A0\uFE0F  Agent execution requires LLM API configuration'));
  console.log(chalk.gray('   Set P31_API_KEY or configure provider in ~/.p31/config.json'));
}
