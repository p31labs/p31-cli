/**
 * P31 SVG Processor — Ported from production/cli/processors/svgoProcessor.ts
 * Normalizes SVGs with bounding box validation
 */

import fs from 'fs';
import path from 'path';

export interface SVGValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class SVGProcessor {
  private tokens: any;

  constructor(tokens: any = {}) {
    this.tokens = tokens;
  }

  normalize(svg: string): string {
    let result = svg;

    // Remove doctype
    result = result.replace(/<!DOCTYPE[^>]*>/gi, '');

    // Remove empty text elements
    result = result.replace(/<text[^>]*>\s*<\/text>/gi, '');

    // Remove empty containers
    result = result.replace(/<g[^>]*>\s*<\/g>/gi, '');

    // Remove xmlns
    result = result.replace(/\sxmlns="[^"]*"/g, '');

    // Remove IDs
    result = result.replace(/\sid="[^"]*"/g, '');

    // Collapse groups
    result = result.replace(/<g[^>]*>\s*<g[^>]*>/g, '<g>');

    // Sort attributes
    result = result.replace(/<([a-z]+)\s+([^>]+)>/gi, (match, tag, attrs) => {
      const sorted = attrs.split(/\s+/).sort().join(' ');
      return `<${tag} ${sorted}>`;
    });

    return result.trim();
  }

  validateBoundingBox(svg: string): SVGValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for viewBox
    if (!svg.includes('viewBox')) {
      warnings.push('SVG missing viewBox attribute');
    }

    // Check for width/height
    if (!svg.includes('width') || !svg.includes('height')) {
      warnings.push('SVG missing explicit width/height');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  processDirectory(dir: string): { processed: number; errors: number } {
    let processed = 0;
    let errors = 0;

    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (!file.endsWith('.svg')) continue;
        const filePath = path.join(dir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const normalized = this.normalize(content);
          fs.writeFileSync(filePath, normalized);
          processed++;
        } catch (e) {
          errors++;
        }
      }
    } catch (e) {
      errors++;
    }

    return { processed, errors };
  }
}

export function runSVGONormalization(dir: string): { processed: number; errors: number } {
  const processor = new SVGProcessor();
  return processor.processDirectory(dir);
}
