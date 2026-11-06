/**
 * src/tui/themes.ts
 * P31 brand themes for the TUI.
 * Cyan cockpit (p31ca) and warm garden (phosphorus31).
 * Deployment mode (airgap/onprem) can imply regulated environment signaling (L8.4, G6).
 */

import { getDeploymentThemeEnv } from '../lib/deployment.js';

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
  /** Optional environment signal — maps to accent color for the given env */
  environment?: 'production' | 'staging' | 'regulated' | 'crisis';
}

const envAccentMap: Record<'production' | 'staging' | 'regulated' | 'crisis', string> = {
  production: '#ff0000',
  staging: '#ffa500',
  regulated: '#ffff00',
  crisis: '#ff00ff',
};

export function getTheme(brand: 'p31ca' | 'phosphorus31', spoonLevel: number, env?: 'production' | 'staging' | 'regulated' | 'crisis'): P31Theme {
  const effectiveEnv = env ?? getDeploymentThemeEnv();
  if (spoonLevel <= 1) {
    const theme = { ...crisisTheme, environment: effectiveEnv };
    return effectiveEnv ? { ...theme, colors: { ...theme.colors, accent: envAccentMap[effectiveEnv] } } : theme;
  }
  if (brand === 'phosphorus31') {
    const theme = { ...gardenTheme, environment: effectiveEnv };
    return effectiveEnv ? { ...theme, colors: { ...theme.colors, accent: envAccentMap[effectiveEnv] } } : theme;
  }
  const theme = { ...p31caTheme, environment: effectiveEnv };
  return effectiveEnv ? { ...theme, colors: { ...theme.colors, accent: envAccentMap[effectiveEnv] } } : theme;
}

export function getThemeForEnvironment(theme: P31Theme, env: 'production' | 'staging' | 'regulated' | 'crisis'): P31Theme {
  const accent = envAccentMap[env];
  return {
    ...theme,
    environment: env,
    colors: {
      ...theme.colors,
      accent,
      accentDim: theme.colors.accentDim || `${accent}80`,
    },
  };
}

export function getSpoonLabel(level: number): string {
  if (level <= 1) return 'MINIMAL';
  if (level === 3) return 'STANDARD';
  return 'FULL';
}

export function getSpoonEmoji(level: number): string {
  return '🥄'.repeat(Math.max(1, level / 2));
}

// Default export for environment-aware theme resolution
export function resolveThemeForEnv(brand: 'p31ca' | 'phosphorus31', spoonLevel: number, env: 'production' | 'staging' | 'regulated' | 'crisis'): P31Theme {
  return getTheme(brand, spoonLevel, env);
}

/** Resolve theme using deployment mode defaults when explicit env is omitted (L8.4). */
export function resolveThemeForDeployment(brand: 'p31ca' | 'phosphorus31', spoonLevel: number, env?: 'production' | 'staging' | 'regulated' | 'crisis'): P31Theme {
  return getTheme(brand, spoonLevel, env ?? getDeploymentThemeEnv());
}