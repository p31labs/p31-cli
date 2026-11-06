import { validateThemeContrast } from '../../src/design/contrast-validator';

const passingTheme = {
  tokens: {
    accent: '#00ff00',
    background: '#000000',
    foreground: '#ffffff',
    surface: '#000000',
    border: '#333333',
    muted: '#666666',
    error: '#ff0000',
    success: '#00ff00',
    warning: '#fbbf24',
  },
};

const report = validateThemeContrast(passingTheme);
console.log('Validation result:', report);
console.log('valid:', report.valid);
console.log('failures:', report.failures);
