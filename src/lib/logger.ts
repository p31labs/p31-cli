import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

export const logger = {
  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.error(chalk.gray('[debug]'), ...args);
    }
  },
  info: (...args: unknown[]) => {
    if (shouldLog('info')) {
      console.error(chalk.cyan('[info]'), ...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (shouldLog('warn')) {
      console.error(chalk.yellow('[warn]'), ...args);
    }
  },
  error: (...args: unknown[]) => {
    if (shouldLog('error')) {
      console.error(chalk.red('[error]'), ...args);
    }
  },
};
