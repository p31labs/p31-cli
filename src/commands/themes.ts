import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import { validateThemeContrast } from '../design/contrast-validator.js';

/**
 * Theme dir resolution (L9 polish): module-relative when running from source
 * (`src/commands/themes.ts` -> `<root>/themes`) and bundle-aware when running
 * compiled (`dist/index.js` -> `<root>/themes`).
 */
function resolveThemesDir(): string {
  const fromModule = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../themes');
  if (fs.existsSync(fromModule)) return fromModule;
  const fromDist = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../themes');
  if (fs.existsSync(fromDist)) return fromDist;
  return fromModule;
}

const THEMES_DIR = resolveThemesDir();

function getAvailableThemes(): string[] {
  if (!fs.existsSync(THEMES_DIR)) return [];
  return fs.readdirSync(THEMES_DIR).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')).sort();
}

export function createThemesCommand(): Command {
  const themes = new Command('themes').description('Theme management (OpenCode + TUI)');

  themes.command('list').description('List available and installed themes').action(() => {
    const available = getAvailableThemes();
    const installedDir = path.join(homedir(), '.config', 'opencode', 'themes');
    const installed = fs.existsSync(installedDir) ? fs.readdirSync(installedDir).filter(f=>f.endsWith('.json')).map(f=>f.replace(/\.json$/,'')) : [];
    console.log(chalk.bold('Available themes:'));
    for (const t of available) console.log(`  ${installed.includes(t)?chalk.green('✓'): ' '} ${t}`);
    console.log(chalk.bold(`\nInstalled (${installedDir}):`));
    if (!installed.length) console.log('  (none)'); else for (const t of installed) console.log(`  ${chalk.green('✓')} ${t}`);
  });

  themes.command('install <theme>').description('Install a theme to ~/.config/opencode/themes/').action((theme: string) => {
    const src = path.join(THEMES_DIR, `${theme}.json`);
    if (!fs.existsSync(src)) { console.error(chalk.red(`Theme not found: ${theme}`)); process.exit(1); }
    const destDir = path.join(homedir(), '.config', 'opencode', 'themes');
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, path.join(destDir, `${theme}.json`));
    console.log(chalk.green(`Installed ${theme} -> ${destDir}`));
  });

  themes.command('validate <file>').description('Validate theme JSON against WCAG 2.2 AA contrast').action((file: string) => {
    const p = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
    if (!fs.existsSync(p)) { console.error(chalk.red(`File not found: ${p}`)); process.exit(1); }
    const theme = JSON.parse(fs.readFileSync(p, 'utf8'));
    const tokens = theme.tokens || theme.colors || theme;
    const report = validateThemeContrast({ tokens });
    if (report.valid) { console.log(chalk.green('✓ WCAG 2.2 AA contrast validation passed')); process.exit(0); }
    console.error(chalk.red('✗ Contrast validation failed:'));
    for (const f of report.failures) console.error('  - ' + f);
    process.exit(1);
  });

  themes.command('export <theme>').description('Export a theme').option('--format <fmt>', 'opencode|tui', 'opencode').action((theme: string, opts: { format: string }) => {
    const src = path.join(THEMES_DIR, `${theme}.json`);
    if (!fs.existsSync(src)) { console.error(chalk.red(`Theme not found: ${theme}`)); process.exit(1); }
    if (opts.format === 'opencode') { process.stdout.write(fs.readFileSync(src, 'utf8')); }
    else if (opts.format === 'tui') {
      const t = JSON.parse(fs.readFileSync(src,'utf8')); const c = t.tokens || {};
      console.log(`/* ${theme} TUI */\nexport const theme = ${JSON.stringify({bg:c.background,fg:c.foreground,accent:c.accent,accentDim:c.muted,surface:c.surface,border:c.border,muted:c.muted,error:c.error,success:c.success,warning:c.warning}, null, 2)} as const;`);
    } else { console.error(chalk.red(`Unknown format: ${opts.format}`)); process.exit(1); }
  });

  return themes;
}
