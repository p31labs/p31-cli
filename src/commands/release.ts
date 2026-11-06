/**
 * P31 Release Command — Ported from production/cli/commands/release.mjs
 * Semantic versioning release tool
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface ReleaseOptions {
  dryRun?: boolean;
  force?: boolean;
}

export interface ReleaseResult {
  success: boolean;
  version: string;
  changelog: string;
  errors: string[];
}

export function release(options: ReleaseOptions = {}): ReleaseResult {
  const errors: string[] = [];
  const dryRun = options.dryRun ?? true;

  try {
    // Read current version
    const pkgPath = path.resolve('package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const currentVersion = pkg.version || '0.0.0';

    // Parse semver
    const [major, minor, patch] = currentVersion.split('.').map(Number);

    // Determine next version (patch bump by default)
    const nextVersion = `${major}.${minor}.${patch + 1}`;

    // Generate changelog
    const changelog = generateChangelog(currentVersion, nextVersion);

    if (!dryRun) {
      // Update package.json
      pkg.version = nextVersion;
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

      // Create git tag
      execSync(`git tag -a v${nextVersion} -m "Release v${nextVersion}"`);
    }

    return {
      success: true,
      version: nextVersion,
      changelog,
      errors,
    };
  } catch (e: any) {
    errors.push(e.message);
    return {
      success: false,
      version: '0.0.0',
      changelog: '',
      errors,
    };
  }
}

function generateChangelog(currentVersion: string, nextVersion: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `# Changelog\n\n## [${nextVersion}] - ${date}\n\n### Changed\n- Version bump from ${currentVersion} to ${nextVersion}\n`;
}
