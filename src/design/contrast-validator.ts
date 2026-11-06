/**
 * P31 Contrast Validator — WCAG 2.2 AA contrast ratio calculation
 * Validates text/background pairs against WCAG 2.2 AA thresholds.
 */

export interface ContrastReport {
  valid: boolean;
  pairs: ContrastPair[];
  failures: string[];
}

export interface ContrastPair {
  text: string;
  background: string;
  ratio: number;
  required: number;
  passes: boolean;
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  if (clean.length === 8) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return null;
}

export function relativeLuminance(r: number, g: number, b: number): number {
  const srgb = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}

export function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getContrastRatio(text: string, background: string): number {
  const t = hexToRgb(text);
  const b = hexToRgb(background);
  if (!t || !b) return 0;
  return contrastRatio(relativeLuminance(t[0], t[1], t[2]), relativeLuminance(b[0], b[1], b[2]));
}

export function validateContrast(
  pairs: Array<{ text: string; background: string; required?: number; label?: string }>,
): ContrastReport {
  const failures: string[] = [];
  const results: ContrastPair[] = [];

  for (const p of pairs) {
    const required = p.required ?? 4.5;
    const ratio = getContrastRatio(p.text, p.background);
    const passes = ratio >= required;
    const label = p.label || `${p.text} on ${p.background}`;
    results.push({ text: p.text, background: p.background, ratio, required, passes });
    if (!passes) {
      failures.push(`FAIL: ${label} — contrast ratio ${ratio.toFixed(2)}:1 < required ${required}:1`);
    }
  }

  return { valid: failures.length === 0, pairs: results, failures };
}

export function validateThemeContrast(theme: {
  tokens: {
    accent: string;
    background: string;
    foreground: string;
    surface: string;
    border: string;
    muted: string;
    error: string;
    success: string;
    warning: string;
  };
  contrastTargets?: {
    textBackground?: string;
    uiComponents?: string;
  };
}): ContrastReport {
  const t = theme.tokens;
  const pairs = [
    { text: t.foreground, background: t.background, required: 4.5, label: 'foreground on background' },
    { text: t.foreground, background: t.surface, required: 4.5, label: 'foreground on surface' },
    { text: t.muted, background: t.background, required: 4.5, label: 'muted on background' },
    { text: t.accent, background: t.background, required: 3, label: 'accent on background (UI)' },
    { text: t.accent, background: t.surface, required: 3, label: 'accent on surface (UI)' },
    { text: t.error, background: t.background, required: 3, label: 'error on background (UI)' },
    { text: t.success, background: t.background, required: 3, label: 'success on background (UI)' },
    { text: t.warning, background: t.background, required: 3, label: 'warning on background (UI)' },
  ];
  return validateContrast(pairs);
}