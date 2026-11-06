#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tokensPath = path.resolve(__dirname, '../tokens/tokens.yml');
const themesDir = path.resolve(__dirname, '../themes');

let tokensYml;
try {
  tokensYml = fs.readFileSync(tokensPath, 'utf-8');
} catch (err) {
  console.error('Failed to read tokens.yml:', err);
  process.exit(1);
}

// Line-based parser: find "themes:" sections and the theme keys that follow,
// then capture the OKLCH components from the next three list items.
const lines = tokensYml.split('\n');
const themeNames = new Set();
const colorMap = {};

for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === 'themes:') {
    // The following non-empty lines define theme keys
    let j = i + 1;
    let currentTheme = null;
    const entries = [];
    while (j < lines.length) {
      const line = lines[j];
      const trimmed = line.trim();
      const indent = line.length - line.trimStart().length;
      if (trimmed === '' ) { j++; continue; }
      if (trimmed.endsWith(':') && !trimmed.startsWith('-') && indent <= 10) {
        break; // dedent past this themes block
      }
      const keyMatch = trimmed.match(/^([a-z0-9_]+):$/);
      if (keyMatch && indent > (lines[i].length - lines[i].trimStart().length) + 2) {
        currentTheme = keyMatch[1];
        entries.push({ theme: currentTheme, line: j });
        break;
      }
      j++;
    }
    // For simplicity, capture all theme-like keys until dedent
    let k = i + 1;
    while (k < lines.length) {
      const line = lines[k];
      const trimmed = line.trim();
      const indent = line.length - line.trimStart().length;
      if (trimmed === '') { k++; continue; }
      const keyMatch = trimmed.match(/^([a-z0-9_]+):$/);
      if (keyMatch) {
        const themeName = keyMatch[1];
        if (['cipher','garden','retro','sunset','mono','aurora','zen','volt','family','sunlight','ocean','dome','willow','starfield','star'].includes(themeName)) {
          // capture following OKLCH components
          let m = k + 1;
          let found = false;
          while (m < lines.length) {
            const t = lines[m].trim();
            const ind2 = lines[m].length - lines[m].trimStart().length;
            if (t === 'colorSpace:' && lines[m].includes('oklch')) { found = true; }
            if (found && t.startsWith('- ') && !t.startsWith('- ')) {
              const num = parseFloat(t.replace(/^-\s+/, ''));
              if (!isNaN(num) && !found) { /* first number */ }
              if (found && entries2 === undefined) {}
              break;
            }
            m++;
          }
        }
      }
      k++;
    }
  }
  i++;
}

// Simpler robust approach: scan all lines for the theme-name patterns and
// capture OKLCH components arrays that follow within a theme context.
function extractThemes(y) {
  const found = [];
  const seen = new Set();
  const lines = y.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;
    const themeMatch = trimmed.match(/^([a-z][a-z0-9_]*):$/);
    if (themeMatch && indent > 8) {
      const themeName = themeMatch[1];
      if (['cipher','garden','retro','sunset','mono','aurora','zen','volt','family','sunlight'].includes(themeName)) {
        // Look ahead for components list
        for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
          const t = lines[j].trim();
          const ind2 = lines[j].length - lines[j].trimStart().length;
          const compMatch = t.match(/^components:\s*$/);
          if (compMatch && ind2 > indent) {
            // collect next three list items
            const nums = [];
            for (let k = j + 1; k < Math.min(j + 6, lines.length); k++) {
              const t2 = lines[k].trim();
              const ind3 = lines[k].length - lines[k].trimStart().length;
              const itemMatch = t2.match(/^-\s+([\d.]+)$/);
              if (itemMatch) {
                nums.push(parseFloat(itemMatch[1]));
              } else {
                break;
              }
            }
            if (nums.length >= 3) {
              found.push({ theme: themeName, components: nums });
              break;
            }
          }
        }
      }
    }
  }
  return found;
}

const themes = extractThemes(tokensYml);
console.log('Found themes:', themes.map(t => t.theme));

if (themes.length === 0) {
  console.error('No themes found in tokens.yml');
  process.exit(1);
}

if (!fs.existsSync(themesDir)) {
  fs.mkdirSync(themesDir, { recursive: true });
}

for (const t of themes) {
  const [l, c, h] = t.components;
  const accent = `oklch(${l} ${c} ${h})`;
  const theme = {
    name: t.theme,
    version: '1.0.0',
    tokens: {
      accent,
      background: '#0a0a0f',
      foreground: '#f5f5f7',
      surface: '#1e1e2e',
      border: '#333333',
      muted: '#6b7280',
      error: '#ef4444',
      success: '#10b981',
      warning: '#fbbf24',
    },
    contrastTargets: {
      textBackground: 'AA',
      uiComponents: 'AA',
    },
    environmentSignals: {
      production: '#ff0000',
      staging: '#ffa500',
      regulated: '#ffff00',
      crisis: '#ff00ff',
    },
  };
  const outPath = path.join(themesDir, `${t.theme}.json`);
  fs.writeFileSync(outPath, JSON.stringify(theme, null, 2));
  console.log(`Generated theme: ${outPath}`);
}
