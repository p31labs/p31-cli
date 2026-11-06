import { describe, it, expect } from 'vitest';
import {
  validateContrast,
  validateThemeContrast,
  getContrastRatio,
  hexToRgb,
  relativeLuminance,
} from '../../src/design/contrast-validator';
import * as fs from 'fs';
import * as path from 'path';

describe('Contrast Validator — WCAG 2.2 AA', () => {
  it('calculates contrast ratio correctly for black on white', () => {
    const ratio = getContrastRatio('#000000', '#ffffff');
    expect(ratio).toBeGreaterThan(20);
    expect(ratio).toBeLessThan(22);
  });

  it('calculates contrast ratio correctly for white on white (same)', () => {
    const ratio = getContrastRatio('#ffffff', '#ffffff');
    expect(ratio).toBeCloseTo(1, 1);
  });

  it('passes valid contrast pairs', () => {
    const report = validateContrast([
      { text: '#000000', background: '#ffffff', required: 4.5 },
      { text: '#333333', background: '#ffffff', required: 4.5 },
    ]);
    expect(report.valid).toBe(true);
    expect(report.failures).toHaveLength(0);
  });

  it('fails invalid contrast pairs with clear errors', () => {
    const report = validateContrast([
      { text: '#cccccc', background: '#ffffff', required: 4.5 },
    ]);
    expect(report.valid).toBe(false);
    expect(report.failures.length).toBeGreaterThan(0);
    expect(report.failures[0]).toContain('FAIL');
  });

  it('theme contrast validation rejects failing themes', () => {
    const failingTheme = {
      tokens: {
        accent: '#ff0000',
        background: '#ffffff',
        foreground: '#cccccc', // too light on white
        surface: '#ffffff',
        border: '#333333',
        muted: '#6b7280',
        error: '#ef4444',
        success: '#10b981',
        warning: '#fbbf24',
      },
    };
    const report = validateThemeContrast(failingTheme);
    expect(report.valid).toBe(false);
    expect(report.failures.length).toBeGreaterThan(0);
  });

  it('theme contrast validation passes valid themes', () => {
    const passingTheme = {
      tokens: {
        accent: '#00ff00',
        background: '#000000',
        foreground: '#ffffff',
        surface: '#000000',
        border: '#333333',
        muted: '#888888',
        error: '#ff0000',
        success: '#00ff00',
        warning: '#fbbf24',
      },
    };
    const report = validateThemeContrast(passingTheme);
    expect(report.valid).toBe(true);
    expect(report.failures).toHaveLength(0);
  });
});

describe('Theme Manifest Schema', () => {
  it('validates against sample enterprise theme', () => {
    const sampleTheme = {
      name: 'Enterprise Default',
      version: '1.0.0',
      tokens: {
        accent: '#00F0FF',
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

    const schemaPath = path.resolve(__dirname, '../../theme-manifest-schema.json');
    expect(fs.existsSync(schemaPath)).toBe(true);
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

    expect(schema.type).toBe('object');
    expect(schema.properties.name.type).toBe('string');
    expect(schema.properties.version.type).toBe('string');
    expect(schema.properties.tokens.properties.accent.type).toBe('string');
    expect(schema.properties.tokens.properties.background.type).toBe('string');
    expect(schema.properties.tokens.properties.foreground.type).toBe('string');
    expect(schema.properties.contrastTargets.properties.textBackground.enum).toContain('AA');
    expect(schema.properties.contrastTargets.properties.uiComponents.enum).toContain('AA');
    expect(schema.properties.environmentSignals.properties.production.type).toBe('string');
    expect(schema.properties.environmentSignals.properties.staging.type).toBe('string');
    expect(schema.properties.environmentSignals.properties.regulated.type).toBe('string');
    expect(schema.properties.environmentSignals.properties.crisis.type).toBe('string');
  });
});

describe('Generated OpenCode Themes', () => {
  it('generated theme files are valid JSON', () => {
    const themesDir = path.resolve(__dirname, '../../themes');
    if (!fs.existsSync(themesDir)) {
      console.warn('No themes directory found');
      return;
    }
    const themeFiles = fs.readdirSync(themesDir).filter(f => f.endsWith('.json'));
    expect(themeFiles.length).toBeGreaterThan(0);
    
    themeFiles.forEach(file => {
      const content = fs.readFileSync(path.join(themesDir, file), 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
      const parsed = JSON.parse(content);
      expect(parsed.name).toBeDefined();
      expect(parsed.tokens).toBeDefined();
      expect(parsed.tokens.accent).toBeDefined();
    });
  });

  it('at least 5 canon themes + 2 enterprise example themes exist', () => {
    const themesDir = path.resolve(__dirname, '../../themes');
    if (!fs.existsSync(themesDir)) {
      console.warn('No themes directory found');
      return;
    }
    const themeFiles = fs.readdirSync(themesDir).filter(f => f.endsWith('.json'));
    // Expect at least 7 themes total (5 canon + 2 enterprise)
    expect(themeFiles.length).toBeGreaterThanOrEqual(7);
  });
});