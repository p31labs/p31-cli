/**
 * Spoon-Level Tool Surface Gating
 *
 * Ties tool availability to cognitive state (spoon level).
 * No other agentic CLI has a cognitive-state model.
 *
 * Spoon level 5: Full 135-tool surface + progressive discovery
 * Spoon level 3-4: Compound tools + progressive discovery only
 * Spoon level 1-2: Read-only tools only
 * Spoon level 0: No tools except grounding_54321 and support_ping
 */

const READ_ONLY_TOOLS = [
  'oasis_status', 'truth_lookup', 'truth_facts', 'love_balance',
  'dome_structure', 'design_expert_check_contrast', 'truth_health',
  'soulsafe_protocol_info', 'component_list', 'component_get',
  'component_props', 'component_tokens', 'search_tools', 'get_tool_details',
];

const CRISIS_TOOLS = ['grounding_54321', 'support_ping'];

const COMPOUND_TOOL_NAMES = ['assess_capacity', 'plan_next_block'];

export type SpoonLevel = 0 | 1 | 2 | 3 | 4 | 5;

export function getAvailableTools(spoonLevel: SpoonLevel, allTools: any[]): any[] {
  if (spoonLevel === 0) {
    return allTools.filter(t => CRISIS_TOOLS.includes(t.name));
  }
  if (spoonLevel <= 2) {
    return allTools.filter(t => READ_ONLY_TOOLS.includes(t.name));
  }
  if (spoonLevel <= 4) {
    return allTools.filter(t =>
      READ_ONLY_TOOLS.includes(t.name) ||
      COMPOUND_TOOL_NAMES.includes(t.name) ||
      t.category === 'discovery' ||
      t.category === 'compound'
    );
  }
  // Spoon level 5: full surface
  return allTools;
}

export function isToolAllowed(toolName: string, spoonLevel: SpoonLevel): boolean {
  if (spoonLevel === 0) return CRISIS_TOOLS.includes(toolName);
  if (spoonLevel <= 2) return READ_ONLY_TOOLS.includes(toolName);
  if (spoonLevel <= 4) {
    return READ_ONLY_TOOLS.includes(toolName) ||
           COMPOUND_TOOL_NAMES.includes(toolName);
  }
  return true;
}
