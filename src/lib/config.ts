import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export const SPOON_LEVELS = {
  MINIMAL: 1,
  STANDARD: 3,
  FULL: 5,
} as const;

export type SpoonLevel = 1 | 3 | 5;

export interface P31Config {
  spoonLevel: SpoonLevel;
  sessionId: string;
  projectRoot: string;
  mcpServerUrl?: string;
  websocketPort?: number;
  model?: string;
}

export function defaultConfig(): P31Config {
  return {
    spoonLevel: SPOON_LEVELS.FULL,
    sessionId: crypto.randomUUID().slice(0, 8),
    projectRoot: process.cwd(),
    mcpServerUrl: process.env.P31_MCP_URL || 'http://localhost:3000/mcp',
    websocketPort: 3001,
    model: 'deepseek-v4-flash',
  };
}

export async function loadConfig(): Promise<P31Config> {
  const configPath = path.join(os.homedir(), '.p31', 'config.json');
  try {
    const data = await fs.readFile(configPath, 'utf-8');
    return { ...defaultConfig(), ...JSON.parse(data) };
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      console.warn(`Warning: Failed to load config from ${configPath}: ${err.message}`);
    }
    return defaultConfig();
  }
}

export async function saveConfig(config: P31Config): Promise<void> {
  const configDir = path.join(os.homedir(), '.p31');
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(
    path.join(configDir, 'config.json'),
    JSON.stringify(config, null, 2),
    'utf-8'
  );
}
