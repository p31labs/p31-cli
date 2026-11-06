/**
 * src/tui/components/ChatView.tsx
 * Main chat interface for the TUI with slash command support.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Text, Box, useInput, useApp } from 'ink';
import type { Session, Message } from '../../types.js';
import type { P31Theme } from '../themes.js';
import { SpoonMeter } from './SpoonMeter.js';

interface ChatViewProps {
  session: Session;
  theme: P31Theme;
  onSend: (content: string) => void;
  onBack: () => void;
}

const SLASH_COMMANDS = [
  { cmd: '/phos status', desc: 'Phos-forge status' },
  { cmd: '/phos state', desc: 'Cognitive state' },
  { cmd: '/phos tide', desc: 'Tide temporal patterns' },
  { cmd: '/phos kappa', desc: 'Kappa weights' },
  { cmd: '/phos logbook', desc: 'Logbook status' },
  { cmd: '/phos reflex', desc: 'Reflex arc status' },
  { cmd: '/help', desc: 'Show slash commands' },
];

async function runSlashCommand(cmd: string): Promise<string> {
  const args = cmd.slice(1).split(' ');
  const [command, ...rest] = args;

  if (command === 'help') {
    return SLASH_COMMANDS.map((c) => `  ${c.cmd.padEnd(20)} ${c.desc}`).join('\n');
  }

  if (command === 'phos') {
    const phosCmd = rest[0];
    const phosArgs = rest.slice(1);
    const { spawn } = await import('child_process');
    const PHOS_CLI = '/home/p31/P31-local-workspace/tools/phos-forge/cli.mjs';
    return new Promise((resolve, reject) => {
      const child = spawn('node', [PHOS_CLI, phosCmd, ...phosArgs], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0' },
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));
      child.on('close', (code) => {
        if (code === 0) resolve(stdout.trim());
        else reject(new Error(stderr.trim() || `phos ${phosCmd} failed (${code})`));
      });
      child.on('error', reject);
    });
  }

  return `Unknown command: ${cmd}. Type /help for available commands.`;
}

export function ChatView({ session, theme, onSend, onBack }: ChatViewProps) {
  const [input, setInput] = useState('');
  const [slashOutput, setSlashOutput] = useState<string | null>(null);
  const [slashLoading, setSlashLoading] = useState(false);
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.escape) {
      onBack();
    }
    if (key.return && input.trim()) {
      const trimmed = input.trim();
      if (trimmed.startsWith('/')) {
        setSlashLoading(true);
        setSlashOutput(null);
        runSlashCommand(trimmed)
          .then((result) => {
            setSlashOutput(result);
            setSlashLoading(false);
          })
          .catch((err) => {
            setSlashOutput(`Error: ${err}`);
            setSlashLoading(false);
          });
      } else {
        onSend(trimmed);
      }
      setInput('');
    }
    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
    }
    if (input && !key.return && !key.backspace && !key.delete && !key.ctrl && !key.meta) {
      setInput((prev) => prev + input);
    }
  });

  return (
    <Box flexDirection="column" paddingRight={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Box>
          <Text color={theme.colors.accent} bold>
            ♛ {session.title || 'New Session'}
          </Text>
          <Text color={theme.colors.muted}> {' '}</Text>
          <Text color={theme.colors.muted} dimColor>
            {session.model}
          </Text>
        </Box>
        <SpoonMeter level={session.spoonLevel} theme={theme} compact />
      </Box>

      <Box
        flexDirection="column"
        paddingRight={1}
        marginBottom={1}
        height={20}
      >
        {session.messages.length === 0 && !slashOutput && !slashLoading && (
          <Box justifyContent="center" alignItems="center" height={20}>
            <Text color={theme.colors.muted} italic>
              Type /help for slash commands, or start a conversation...
            </Text>
          </Box>
        )}
        {session.messages.slice(-10).map((msg) => (
          <Box key={msg.id} marginBottom={1}>
            <Text color={theme.colors.accent} bold>
              {msg.role === 'user' ? '▸ ' : msg.role === 'assistant' ? '◆ ' : '○ '}
            </Text>
            <Text
              color={
                msg.role === 'user'
                  ? theme.colors.fg
                  : msg.role === 'assistant'
                    ? theme.colors.accent
                    : theme.colors.muted
              }
            >
              {msg.content.slice(0, 80)}
            </Text>
          </Box>
        ))}
        {slashLoading && (
          <Box marginBottom={1}>
            <Text color={theme.colors.muted}>◐ Running command...</Text>
          </Box>
        )}
        {slashOutput && (
          <Box flexDirection="column" marginBottom={1}>
            <Text color={theme.colors.accent} bold>
              ◈ Command Output
            </Text>
            <Text color={theme.colors.fg}>
              {slashOutput.split('\n').slice(0, 15).join('\n')}
            </Text>
          </Box>
        )}
      </Box>

      <Box borderStyle="round" borderColor={theme.colors.border} paddingX={1}>
        <Text color={theme.colors.accent}>▸ </Text>
        <Text color={theme.colors.fg}>{input}</Text>
        <Text color={theme.colors.muted}>█</Text>
      </Box>
    </Box>
  );
}
