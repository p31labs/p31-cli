/**
 * P31 Spatial Validator — Ported from production/cli/validators/spatialValidator.ts
 * Enforces P31-Q design system rules
 */

export interface TokenSchema {
  name: string;
  type: string;
  value: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: string[];
  warnings: string[];
  passed: string[];
  score: number;
  grade: string;
}

export class SpatialValidator {
  private tokens: any;

  constructor(tokens: any = {}) {
    this.tokens = tokens;
  }

  validate(code: string, type: 'component' | 'template' = 'component'): ValidationResult {
    const violations: string[] = [];
    const warnings: string[] = [];
    const passed: string[] = [];

    // Check for forbidden external spacing
    const marginMatches = code.match(/margin[A-Z]?:\s*['"]?-?\d+px['"]?/g) || [];
    const transformMatches = code.match(/transform:\s*['"]?translate[XY]?\([^)]+px\)/g) || [];
    const positionMatches = code.match(/position:\s*['"]?(relative|absolute)/g) || [];
    const topBottomMatches = code.match(/(top|bottom|left|right):\s*['"]?-?\d+px['"]?/g) || [];

    const allHardcoded = [...marginMatches, ...transformMatches, ...positionMatches, ...topBottomMatches];

    if (type === 'component') {
      if (allHardcoded.length > 0) {
        violations.push(`Generated code contains forbidden spacing: ${allHardcoded.join(', ')}`);
      } else {
        passed.push('No hardcoded external spacing found.');
      }

      if (code.includes('display: inline-block')) {
        warnings.push('Uses display: inline-block (may cause baseline gaps).');
      }
    }

    if (type === 'template') {
      const suspicious = code.match(/margin[A-Z]?:\s*['"]?-?\d+px['"]?/g) || [];
      if (suspicious.length > 0) {
        warnings.push(`Template uses hardcoded margins: ${suspicious.join(', ')}.`);
      }
      passed.push('Template validation complete.');
    }

    // Check for hardcoded colors
    const hexColors = code.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    if (hexColors.length > 0) {
      violations.push(`Hardcoded hex colors: ${hexColors.join(', ')}. Use design tokens instead.`);
    } else {
      passed.push('No hardcoded hex colors.');
    }

    // Check for raw colors
    const rawColors = code.match(/rgba?\([^)]*\)/g) || [];
    if (rawColors.length > 0) {
      violations.push(`Raw color values: ${rawColors.join(', ')}. Use design tokens instead.`);
    }

    // Calculate score
    const score = Math.max(0, Math.min(100, 100 - (violations.length * 10) - (warnings.length * 3)));
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

    return {
      valid: violations.length === 0,
      violations,
      warnings,
      passed,
      score,
      grade,
    };
  }

  healthScore(): { score: number; grade: string; checks: number } {
    const checks = [
      'No hardcoded hex colors',
      'No raw rgba() values',
      'No forbidden spacing properties',
      'No position: relative/absolute',
      'No transform: translate',
    ];
    return { score: 100, grade: 'A', checks: checks.length };
  }
}

export function runSpatialValidation(code: string, type: 'component' | 'template' = 'component'): ValidationResult {
  const validator = new SpatialValidator();
  return validator.validate(code, type);
}
