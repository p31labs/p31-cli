/**
 * src/tui/index.tsx
 * Main TUI app for @p31/cli v3.
 * Spoon-aware, P31-branded terminal interface.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import { getSessionStore } from '../session-store.js';
import { loadConfig, saveConfig } from '../lib/config.js';
import type { P31Config, Session } from '../types.js';
import { getTheme, getSpoonEmoji, getSpoonLabel } from './themes.js';
import { SpoonMeter } from './components/SpoonMeter.js';
import { SessionList } from './components/SessionList.js';
import { ChatView } from './components/ChatView.js';

type View = 'sessions' | 'chat';

export function launchTUI() {
  const App = () => {
    const [config, setConfig] = useState<P31Config | null>(null);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeSession, setActiveSession] = useState<Session | null>(null);
    const [view, setView] = useState<View>('sessions');
    const [status, setStatus] = useState('');
    const { exit } = useApp();

    const store = getSessionStore();

    const load = useCallback(async () => {
      const cfg = await loadConfig();
      setConfig(cfg);
      const all = store.listSessions();
      setSessions(all);
      if (all.length > 0 && !activeSession) {
        setActiveSession(all[0]);
      }
    }, [store, activeSession]);

    useEffect(() => {
      load();
    }, [load]);

    useInput((input, key) => {
      if (key.escape) {
        if (view === 'chat') {
          setView('sessions');
        } else {
          exit();
        }
      }
      if (view === 'sessions') {
        if (input === 'n') {
          const s = store.createSession();
          setActiveSession(s);
          setView('chat');
          setStatus(`Created session ${s.id.slice(0, 8)}`);
        }
        if (input === 'q') {
          exit();
        }
      }
    });

    if (!config) {
      return <Text color="gray">Loading...</Text>;
    }

    const theme = getTheme('p31ca', config.spoonLevel);

    return (
      <Box flexDirection="column" padding={1}>
        <Box justifyContent="space-between" marginBottom={1}>
          <Box>
            <Text color={theme.colors.accent} bold>
              ♛ P31 Sovereign CLI
            </Text>
            <Text color={theme.colors.muted}> v3.1.3 </Text>
            <Text color={theme.colors.muted} dimColor>
              OpenCode face · P31 guts
            </Text>
          </Box>
          <Box gap={1}>
            <SpoonMeter level={config.spoonLevel} theme={theme} />
          </Box>
        </Box>

        <Box flexDirection="row" gap={1}>
          {view === 'sessions' ? (
            <SessionList
              sessions={sessions}
              activeId={activeSession?.id || ''}
              theme={theme}
              onSelect={(id) => {
                const s = store.getSession(id);
                if (s) {
                  setActiveSession(s);
                  setView('chat');
                }
              }}
              onNew={() => {
                const s = store.createSession();
                setActiveSession(s);
                setView('chat');
                setStatus(`Created session ${s.id.slice(0, 8)}`);
              }}
            />
          ) : (
            activeSession && (
              <ChatView
                session={activeSession}
                theme={theme}
                onSend={(content) => {
                  store.appendMessage(activeSession.id, {
                    id: crypto.randomUUID(),
                    role: 'user',
                    content,
                    timestamp: new Date().toISOString(),
                  });
                  setActiveSession({
                    ...activeSession,
                    messages: [...activeSession.messages, { id: crypto.randomUUID(), role: 'user', content, timestamp: new Date().toISOString() }],
                  });
                  setStatus('Sent');
                }}
                onBack={() => setView('sessions')}
              />
            )
          )}

          <Box flexDirection="column" marginLeft={1} width={40}>
            <Box
              borderStyle="round"
              borderColor={theme.colors.border}
              paddingX={1}
              marginBottom={1}
            >
              <Text color={theme.colors.accent} bold>
                ♛ MESH
              </Text>
            </Box>
            <Box flexDirection="column" gap={1}>
              <Box>
                <Text color={theme.colors.muted}>p31-crypto-mcp</Text>
                <Text color={theme.colors.success}> live</Text>
              </Box>
              <Box>
                <Text color={theme.colors.muted}>p31-justice-hub</Text>
                <Text color={theme.colors.success}> live</Text>
              </Box>
              <Box>
                <Text color={theme.colors.muted}>bros</Text>
                <Text color={theme.colors.success}> live</Text>
              </Box>
              <Box>
                <Text color={theme.colors.muted}>dads</Text>
                <Text color={theme.colors.success}> live</Text>
              </Box>
              <Box>
                <Text color={theme.colors.muted}>x402-gateway</Text>
                <Text color={theme.colors.success}> live</Text>
              </Box>
            </Box>

            <Box
              borderStyle="round"
              borderColor={theme.colors.border}
              paddingX={1}
              marginTop={1}
              marginBottom={1}
            >
              <Text color={theme.colors.accent} bold>
                ♛ PROVIDERS
              </Text>
            </Box>
            <Box flexDirection="column" gap={1}>
              {config.providers.map((p) => (
                <Box key={p.id}>
                  <Text
                    color={p.id === config.activeProvider ? theme.colors.accent : theme.colors.muted}
                    bold={p.id === config.activeProvider}
                  >
                    {p.id}
                  </Text>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {status && (
          <Box marginTop={1}>
            <Text color={theme.colors.success} dimColor>
              ✓ {status}
            </Text>
          </Box>
        )}

        <Box marginTop={1}>
          <Text color={theme.colors.muted} dimColor>
            [n]ew session  [q]uit  [Esc] back  [Tab] switch view
          </Text>
        </Box>
      </Box>
    );
  };

  render(<App />);
}
