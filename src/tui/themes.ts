/**
 * src/tui/themes.ts
 * P31 brand themes for the TUI.
 * Cyan cockpit (p31ca) and warm garden (phosphorus31).
 */

export interface P31Theme {
  name: string;
  brand: 'p31ca' | 'phosphorus31';
  colors: {
    bg: string;
    fg: string;
    accent: string;
    accentDim: string;
    surface: string;
    border: string;
    muted: string;
    error: string;
    success: string;
    warning: string;
  };
  symbols: {
    crown: string;
    spoon: string;
    mesh: string;
    care: string;
    sovereign: string;
  };
}

export const p31caTheme: P31Theme = {
  name: 'Cyan Cockpit',
  brand: 'p31ca',
  colors: {
    bg: '#030712',
    fg: '#F5F5F7',
    accent: '#00F0FF',
    accentDim: '#00F0FF80',
    surface: '#0A0A0F',
    border: '#1E1E2E',
    muted: '#6B7280',
    error: '#EF4444',
    success: '#10B981',
    warning: '#FBBF24',
  },
  symbols: {
    crown: '♛',
    spoon: '🥄',
    mesh: '◇',
    care: '♥',
    sovereign: '⚡',
  },
};

export const gardenTheme: P31Theme = {
  name: 'Warm Garden',
  brand: 'phosphorus31',
  colors: {
    bg: '#FAF9F6',
    fg: '#1A1A1A',
    accent: '#10B981',
    accentDim: '#10B98180',
    surface: '#FFFFFF',
    border: '#E5E7EB',
    muted: '#6B7280',
    error: '#EF4444',
    success: '#059669',
    warning: '#D97706',
  },
  symbols: {
    crown: '♛',
    spoon: '🥄',
    mesh: '◇',
    care: '♥',
    sovereign: '⚡',
  },
};

export const crisisTheme: P31Theme = {
  name: 'Crisis Minimal',
  brand: 'p31ca',
  colors: {
    bg: '#000000',
    fg: '#FFFFFF',
    accent: '#FFFFFF',
    accentDim: '#FFFFFF80',
    surface: '#000000',
    border: '#333333',
    muted: '#666666',
    error: '#FF0000',
    success: '#00FF00',
    warning: '#FFFF00',
  },
  symbols: {
    crown: '♛',
    spoon: '🥄',
    mesh: '◇',
    care: '♥',
    sovereign: '⚡',
  },
};

export function getTheme(brand: 'p31ca' | 'phosphorus31', spoonLevel: number): P31Theme {
  if (spoonLevel <= 1) return crisisTheme;
  if (brand === 'phosphorus31') return gardenTheme;
  return p31caTheme;
}

export function getSpoonLabel(level: number): string {
  if (level <= 1) return 'MINIMAL';
  if (level === 3) return 'STANDARD';
  return 'FULL';
}

export function getSpoonEmoji(level: number): string {
  return '🥄'.repeat(Math.max(1, level / 2));
}
