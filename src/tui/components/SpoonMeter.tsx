/**
 * src/tui/components/SpoonMeter.tsx
 * Visual spoon level indicator for the TUI.
 */

import React from 'react';
import { Text, Box } from 'ink';
import type { P31Theme } from '../themes.js';

interface SpoonMeterProps {
  level: number;
  theme: P31Theme;
  compact?: boolean;
}

export function SpoonMeter({ level, theme, compact = false }: SpoonMeterProps) {
  const emoji = '🥄'.repeat(Math.max(1, level / 2));
  const label = level <= 1 ? 'MIN' : level === 3 ? 'STD' : 'FULL';
  const color = level <= 1 ? theme.colors.error : level === 3 ? theme.colors.warning : theme.colors.success;

  if (compact) {
    return (
      <Text color={color}>
        {emoji} {label}
      </Text>
    );
  }

  return (
    <Box borderStyle="round" borderColor={theme.colors.border} paddingX={1}>
      <Text color={theme.colors.muted} bold>
        SPOONS
      </Text>
      <Text color={theme.colors.accent}> {' '}</Text>
      <Text color={color} bold>
        {emoji}
      </Text>
      <Text color={color}> {label}</Text>
    </Box>
  );
}
