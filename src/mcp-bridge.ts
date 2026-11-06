/**
 * P31 Unified MCP Bridge — Single source of truth for all MCP tools
 * Combines 10 MCP server modules into one unified tool surface.
 *
 * Categories: oasis, love, cognitive, spaceship, ground-truth,
 *             marge, soulsafe, bob, component, design
 *
 * Total tools: 132+
 */

import { ALL_TOOLS, executeUnifiedTool, TOOL_CATEGORIES, TOTAL_TOOL_COUNT, getAvailableTools, isToolAllowed, computeFingerprint, generateFingerprintManifest, verifyFingerprints, computeSkillFingerprint, generateSkillFingerprints, emitGuardDecision, verifyGuardChain, readAuditLog, getPublicKey, markRetrievedSources, traceContext, exportCOSE, verifyCOSE, verifyProofFile } from './mcp-servers/index.js';
import { getAvailableTools as spoonGetAvailable } from './safety/spoon-gating.js';

// Re-export for convenience
export { ALL_TOOLS, executeUnifiedTool, TOOL_CATEGORIES, TOTAL_TOOL_COUNT, getAvailableTools, isToolAllowed, computeFingerprint, generateFingerprintManifest, verifyFingerprints, computeSkillFingerprint, generateSkillFingerprints, emitGuardDecision, verifyGuardChain, readAuditLog, getPublicKey, markRetrievedSources, traceContext, exportCOSE, verifyCOSE, verifyProofFile };

// Backward compatibility alias
export const TOOLS = ALL_TOOLS;

export const SERVER_INFO = {
  name: 'p31-unified-mcp',
  version: '3.1.3',
  description: 'Unified MCP bridge for the P31 sovereign AI ecosystem',
  categories: TOOL_CATEGORIES,
  totalTools: TOTAL_TOOL_COUNT,
  spoonTier: 3,
};

export function listTools() {
  return ALL_TOOLS;
}

export function callTool(name: string, args: any) {
  return executeUnifiedTool(name, args);
}

export function getToolInfo(name: string) {
  return ALL_TOOLS.find(t => t.name === name);
}

export function getToolsByCategory(category: string) {
  return ALL_TOOLS.filter(t => t.category === category);
}

export function getCategories() {
  return TOOL_CATEGORIES;
}

export function getSpoonTier() {
  return SERVER_INFO.spoonTier;
}

export function setSpoonTier(tier: number) {
  SERVER_INFO.spoonTier = tier;
  return { tier, availableTools: spoonGetAvailable(tier as any, ALL_TOOLS).length };
}

export function getSpoonAvailableTools(tier?: number) {
  return spoonGetAvailable((tier ?? SERVER_INFO.spoonTier) as any, ALL_TOOLS);
}
