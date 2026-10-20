/**
 * Progressive Tool Discovery — Meta-tools for context economics
 *
 * Implements the MCP spec's client best practices for progressive discovery:
 * Layer 1: search_tools (names + one-line descriptions only)
 * Layer 2: get_tool_details (full schema for one tool)
 * Layer 3: execute (normal tool call)
 *
 * Activates when tool definitions consume 1-5% of the context window.
 */

import { ALL_TOOLS } from './index.js';

export const DISCOVERY_TOOLS = [
  {
    name: 'search_tools',
    description: 'Search available P31 tools by natural-language query. Returns tool names and one-line descriptions only. Use this first when you are unsure which tool to call.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language description of the task' },
        category: { type: 'string', description: 'Optional category filter (oasis, cognitive, soulsafe, love, spaceship, ground-truth, marge, bob, component, design)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_tool_details',
    description: 'Fetch the full input schema and output schema for a single P31 tool. Use after search_tools to inspect a candidate before calling it.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Exact tool name from search_tools' },
      },
      required: ['name'],
    },
  },
];

function matchesQuery(tool: any, query: string): boolean {
  const q = query.toLowerCase();
  const name = (tool.name || '').toLowerCase();
  const desc = (tool.description || '').toLowerCase();
  const cat = (tool.category || '').toLowerCase();

  // Keyword match in name, description, or category
  const words = q.split(/\s+/).filter(Boolean);
  let score = 0;
  for (const word of words) {
    if (name.includes(word)) score += 3;
    if (desc.includes(word)) score += 2;
    if (cat.includes(word)) score += 1;
  }
  return score > 0;
}

export function executeDiscoveryTool(name: string, args: any): any {
  if (name === 'search_tools') {
    const query = args.query || '';
    const category = args.category || '';

    let results = ALL_TOOLS.filter(t => {
      if (category && t.category !== category) return false;
      return matchesQuery(t, query);
    });

    // Sort by relevance (simple: name match first)
    results = results.sort((a: any, b: any) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      const q = query.toLowerCase();
      if (aName.includes(q) && !bName.includes(q)) return -1;
      if (!aName.includes(q) && bName.includes(q)) return 1;
      return 0;
    });

    // Return only name + one-line description (Layer 1)
    return {
      status: 'ok',
      total: results.length,
      tools: results.map((t: any) => ({
        name: t.name,
        category: t.category,
        description: (t.description || '').split('.')[0] + '.',
      })),
    };
  }

  if (name === 'get_tool_details') {
    const toolName = args.name;
    const tool = ALL_TOOLS.find((t: any) => t.name === toolName);
    if (!tool) {
      return { status: 'error', error: `Tool not found: ${toolName}` };
    }
    // Return full schema (Layer 2)
    return {
      status: 'ok',
      tool: {
        name: tool.name,
        category: tool.category,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
    };
  }

  return { status: 'error', error: `Unknown discovery tool: ${name}` };
}
