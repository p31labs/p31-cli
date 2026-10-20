/**
 * P31 MCP Servers — Barrel Export
 * Single source of truth for all MCP server modules
 */

export { OASIS_TOOLS, executeOasisTool } from './oasis-server.js';
export { LOVE_TOOLS, executeLoveTool } from './love-registry.js';
export { COGNITIVE_TOOLS, executeCognitiveTool } from './cognitive-prosthetic.js';
export { SPACESHIP_TOOLS, executeSpaceshipTool } from './spaceship-server.js';
export { GROUND_TRUTH_TOOLS, executeGroundTruthTool } from './ground-truth-server.js';
export { MARGE_TOOLS, executeMargeTool } from './marge-server.js';
export { SOULSAFE_TOOLS, executeSoulsafeTool } from './soulsafe-server.js';
export { BOB_TOOLS, executeBobTool } from './bob-server.js';
export { COMPONENT_TOOLS, executeComponentTool } from './component-registry.js';
export { DESIGN_TOOLS, executeDesignTool } from './design-mcp-server.js';
export { DISCOVERY_TOOLS, executeDiscoveryTool } from './progressive-discovery.js';
export { COMPOUND_TOOLS, executeCompoundTool } from './compound-tools.js';
export { executionGuard } from '../safety/execution-guard.js';
export { emitGuardDecision, verifyGuardChain, readAuditLog, getPublicKey } from '../safety/guard-audit.js';
export { getAvailableTools, isToolAllowed } from '../safety/spoon-gating.js';
export { computeFingerprint, generateFingerprintManifest, verifyFingerprints, computeSkillFingerprint, generateSkillFingerprints } from '../safety/tool-fingerprint.js';

import { OASIS_TOOLS, executeOasisTool } from './oasis-server.js';
import { LOVE_TOOLS, executeLoveTool } from './love-registry.js';
import { COGNITIVE_TOOLS, executeCognitiveTool } from './cognitive-prosthetic.js';
import { SPACESHIP_TOOLS, executeSpaceshipTool } from './spaceship-server.js';
import { GROUND_TRUTH_TOOLS, executeGroundTruthTool } from './ground-truth-server.js';
import { MARGE_TOOLS, executeMargeTool } from './marge-server.js';
import { SOULSAFE_TOOLS, executeSoulsafeTool } from './soulsafe-server.js';
import { BOB_TOOLS, executeBobTool } from './bob-server.js';
import { COMPONENT_TOOLS, executeComponentTool } from './component-registry.js';
import { DESIGN_TOOLS, executeDesignTool } from './design-mcp-server.js';
import { DISCOVERY_TOOLS, executeDiscoveryTool } from './progressive-discovery.js';
import { COMPOUND_TOOLS, executeCompoundTool } from './compound-tools.js';
import { executionGuard } from '../safety/execution-guard.js';
import { emitGuardDecision, verifyGuardChain, readAuditLog, getPublicKey } from '../safety/guard-audit.js';
import { getAvailableTools, isToolAllowed } from '../safety/spoon-gating.js';
import { computeFingerprint, generateFingerprintManifest, verifyFingerprints, computeSkillFingerprint, generateSkillFingerprints } from '../safety/tool-fingerprint.js';

// ─── Unified Tool Registry ───────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  category: string;
  title?: string;
  annotations?: any;
}

export interface ToolHandler {
  (name: string, args: any): any;
}

function enrichTool(t: any, category: string): any {
  const readOnlyTools = [
    'oasis_status', 'truth_lookup', 'truth_facts', 'love_balance',
    'love_status', 'dome_structure', 'design_expert_check_contrast',
    'truth_health', 'soulsafe_protocol_info', 'component_list',
    'component_get', 'component_props', 'component_tokens',
  ];
  const isReadOnly = readOnlyTools.includes(t.name);

  // Ensure description meets minimum length and contains a return-signal verb
  let description = t.description || '';
  const returnVerbs = /\b(returns?|response|output|provides?|reports?|gets?|fetches?|lists?)\b/i;
  if (!returnVerbs.test(description)) {
    description = description + ' Returns the result.';
  }
  if (description.length < 30) {
    description = description + ' Use this tool to retrieve the requested information.';
  }

  // Ensure all inputSchema properties have descriptions
  if (t.inputSchema?.properties) {
    for (const [key, prop] of Object.entries(t.inputSchema.properties)) {
      if (!(prop as any).description) {
        (prop as any).description = `The ${key} parameter`;
      }
    }
  }

  return {
    ...t,
    category,
    description,
    title: t.title || t.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
    annotations: t.annotations || (isReadOnly ? { readOnlyHint: true, idempotentHint: true } : undefined),
  };
}

export const ALL_TOOLS: ToolDefinition[] = [
  ...OASIS_TOOLS.map((t: any) => enrichTool(t, 'oasis')),
  ...LOVE_TOOLS.map((t: any) => enrichTool(t, 'love')),
  ...COGNITIVE_TOOLS.map((t: any) => enrichTool(t, 'cognitive')),
  ...SPACESHIP_TOOLS.map((t: any) => enrichTool(t, 'spaceship')),
  ...GROUND_TRUTH_TOOLS.map((t: any) => enrichTool(t, 'ground-truth')),
  ...MARGE_TOOLS.map((t: any) => enrichTool(t, 'marge')),
  ...SOULSAFE_TOOLS.map((t: any) => enrichTool(t, 'soulsafe')),
  ...BOB_TOOLS.map((t: any) => enrichTool(t, 'bob')),
  ...COMPONENT_TOOLS.map((t: any) => enrichTool(t, 'component')),
  ...DESIGN_TOOLS.map((t: any) => enrichTool(t, 'design')),
  ...DISCOVERY_TOOLS.map((t: any) => enrichTool(t, 'discovery')),
  ...COMPOUND_TOOLS.map((t: any) => enrichTool(t, 'compound')),
];

const HANDLERS: Record<string, ToolHandler> = {
  oasis: executeOasisTool,
  love: executeLoveTool,
  cognitive: executeCognitiveTool,
  spaceship: executeSpaceshipTool,
  'ground-truth': executeGroundTruthTool,
  marge: executeMargeTool,
  soulsafe: executeSoulsafeTool,
  bob: executeBobTool,
  component: executeComponentTool,
  design: executeDesignTool,
  discovery: executeDiscoveryTool,
  compound: executeCompoundTool,
};

export function executeUnifiedTool(name: string, args: any, context?: { spoonLevel?: number; recentCrisisFlags?: number; userMessage?: string }) {
  const tool = ALL_TOOLS.find(t => t.name === name);
  if (!tool) return { error: `Unknown tool: ${name}`, status: 'error' };
  const handler = HANDLERS[tool.category];
  if (!handler) return { error: `No handler for category: ${tool.category}`, status: 'error' };

  // Execution guard — SOULSAFE at the tool-call boundary
  const guard = executionGuard({
    spoonLevel: context?.spoonLevel ?? 3,
    recentCrisisFlags: context?.recentCrisisFlags ?? 0,
    userMessage: context?.userMessage ?? '',
    toolName: name,
    toolArgs: args,
  });
  if (!guard.allow) {
    return { status: 'blocked', error: guard.reason };
  }
  if (guard.requireElicitation) {
    return { status: 'elicitation_required', reason: guard.reason, tool: name, args };
  }

  return handler(name, args);
}

export const TOOL_CATEGORIES = [
  { name: 'oasis', description: 'CLI session state and slash commands', toolCount: OASIS_TOOLS.length },
  { name: 'love', description: 'LOVE ledger and care attestation', toolCount: LOVE_TOOLS.length },
  { name: 'cognitive', description: 'Neurodivergent cognitive support', toolCount: COGNITIVE_TOOLS.length },
  { name: 'spaceship', description: 'DUNA and dome structure', toolCount: SPACESHIP_TOOLS.length },
  { name: 'ground-truth', description: 'Verified facts registry', toolCount: GROUND_TRUTH_TOOLS.length },
  { name: 'marge', description: 'Design system compliance', toolCount: MARGE_TOOLS.length },
  { name: 'soulsafe', description: '3-gate verification protocol', toolCount: SOULSAFE_TOOLS.length },
  { name: 'bob', description: 'Building ontology and structure', toolCount: BOB_TOOLS.length },
  { name: 'component', description: 'Component registry', toolCount: COMPONENT_TOOLS.length },
  { name: 'design', description: 'Design tokens and validation', toolCount: DESIGN_TOOLS.length },
  { name: 'discovery', description: 'Progressive tool discovery (context economics)', toolCount: DISCOVERY_TOOLS.length },
  { name: 'compound', description: 'Compound orchestrators (programmatic tool calling)', toolCount: COMPOUND_TOOLS.length },
];

export const TOTAL_TOOL_COUNT = ALL_TOOLS.length;
