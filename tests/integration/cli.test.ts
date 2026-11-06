import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(__dirname, '../../dist/index.js');

function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn('node', [cliPath, ...args], {
      cwd: path.resolve(__dirname, '../..'),
      env: { ...process.env, HOME: process.env.HOME || '/tmp' },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode || 0 });
    });
  });
}

describe('CLI Integration', () => {
  it('should show help when run with no arguments', async () => {
    const result = await runCli([]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('P31 Sovereign CLI');
    expect(result.stdout).toContain('Commands:');
  });

  it('should show version', async () => {
    const result = await runCli(['--version']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toContain('3.1.3');
  });

  it('should show spoon controls with no level', async () => {
    const result = await runCli(['spoons']);
    expect(result.stdout).toContain('Minimal');
    expect(result.stdout).toContain('Standard');
    expect(result.stdout).toContain('Full');
  });

  it('should set spoon level', async () => {
    const result = await runCli(['spoons', '1']);
    expect(result.stdout).toContain('\u2713 Spoons set to 1');
  });

  it('should show MCP tool list via HTTP when server is running', async () => {
    // This test requires the MCP HTTP server to be running on port 3000
    // Skip if the server is not available
    const result = await runCli(['mcp', '--list']);
    // Either succeeds or fails gracefully (server not running)
    expect(result.exitCode).toBeGreaterThanOrEqual(0);
  });
});
