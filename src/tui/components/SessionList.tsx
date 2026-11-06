/**
 * src/tui/components/SessionList.tsx
 * Session tree sidebar for the TUI.
 */

import React, { useState } from 'react';
import { Text, Box } from 'ink';
import type { Session } from '../../types.js';
import type { P31Theme } from '../themes.js';

interface SessionListProps {
  sessions: Session[];
  activeId: string;
  theme: P31Theme;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function SessionList({ sessions, activeId, theme, onSelect, onNew }: SessionListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const items = [
    { id: '__new__', title: '+ New Session', isAction: true },
    ...sessions.map((s) => ({
      id: s.id,
      title: s.title || `Session ${s.id.slice(0, 8)}`,
      isAction: false,
      status: s.status,
    })),
  ];

  return (
    <Box
      width={30}
      borderStyle="single"
      borderColor={theme.colors.border}
      flexDirection="column"
      paddingRight={0}
    >
      <Box paddingX={1} marginBottom={1}>
        <Text color={theme.colors.accent} bold>
          ♛ SESSIONS
        </Text>
      </Box>

      {items.map((item, i) => {
        const isActive = item.id === activeId;
        const isSelected = i === selectedIndex;

        if (item.isAction) {
          return (
            <Box key={item.id} paddingX={1}>
              <Text
                color={theme.colors.accent}
                dimColor={!isSelected}
              >
                {isSelected ? '▶ ' : '  '}
                {item.title}
              </Text>
            </Box>
          );
        }

        return (
          <Box
            key={item.id}
            paddingX={1}
            {...(isActive ? { backgroundColor: theme.colors.accent + '10' } : {})}
          >
            <Text
              color={isActive ? theme.colors.accent : theme.colors.fg}
              bold={isActive}
              dimColor={!isActive && !isSelected}
            >
              {isSelected ? '▶ ' : '  '}
              {item.title.slice(0, 20)}
            </Text>
            {'status' in item && item.status === 'compacted' && (
              <Text color={theme.colors.muted}> 📦</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
