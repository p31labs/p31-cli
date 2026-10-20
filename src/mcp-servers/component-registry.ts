/**
 * P31 Component Registry MCP Server — Ported from production/cli/component-registry.js
 * DEPRECATED catalog (legacy PHOS-era MCP surface) — kept alive for backward compatibility.
 * Canonical component source: packages/design-core/registry.json
 */

export const COMPONENT_TOOLS = [
  { name: 'component_list', description: 'List all components in the registry.', inputSchema: { type: 'object', properties: { category: { type: 'string' } } } },
  { name: 'component_get', description: 'Get a specific component by name.', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'component_props', description: 'Get the props for a specific component.', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'component_tokens', description: 'Get the design tokens used by a specific component.', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'component_search', description: 'Search components by keyword.', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
];

// Minimal component data — in production this loads from packages/design-core/registry.json
const COMPONENTS = [
  { name: 'GlassPanel', description: 'Elevated glassmorphic surface with backdrop blur.', css_class: 'glass-panel', category: 'surface', tokens: ['p31.glass.background', 'p31.glass.border', 'p31.glass.radius'], props: { children: { type: 'ReactNode' }, padding: { type: '"sm" | "md" | "lg"', default: 'md' }, className: { type: 'string' } }, slots: ['default'], variants: ['default', 'hover'] },
  { name: 'GlassCard', description: 'Padded glassmorphic card for content grouping.', css_class: 'glass-card', category: 'surface', tokens: ['p31.glass.background', 'p31.glass.border', 'p31.glass.radius', 'p31.layout.spacing.lg'], props: { children: { type: 'ReactNode' }, strong: { type: 'boolean', default: false }, className: { type: 'string' } }, slots: ['default'], variants: ['default', 'strong'] },
  { name: 'Button', description: 'Primary action button with variants.', css_class: 'btn-primary', category: 'action', tokens: ['p31.color.accent', 'p31.radius.full'], props: { children: { type: 'ReactNode' }, variant: { type: '"primary" | "secondary" | "ghost"', default: 'primary' }, disabled: { type: 'boolean', default: false } }, slots: ['default'], variants: ['primary', 'secondary', 'ghost'] },
  { name: 'StatusBadge', description: 'Status indicator badge.', css_class: 'status-badge', category: 'indicator', tokens: ['p31.color.success', 'p31.color.warning', 'p31.color.error'], props: { status: { type: '"success" | "warning" | "error" | "info"' }, label: { type: 'string' } }, slots: ['default'], variants: ['success', 'warning', 'error', 'info'] },
  { name: 'CrisisOverlay', description: 'Full-screen crisis mode overlay.', css_class: 'crisis-overlay', category: 'overlay', tokens: ['p31.color.crisis', 'p31.glass.background'], props: { active: { type: 'boolean' }, message: { type: 'string' } }, slots: ['default'], variants: ['active', 'inactive'] },
  { name: 'Starfield', description: 'Animated starfield background.', css_class: 'starfield-container', category: 'background', tokens: ['p31.color.star', 'p31.animation.duration'], props: { density: { type: 'number', default: 100 }, animated: { type: 'boolean', default: true } }, slots: ['default'], variants: ['animated', 'static'] },
  { name: 'SpoonMeter', description: 'Visual spoon level indicator.', css_class: 'spoon-meter', category: 'indicator', tokens: ['p31.color.spoon', 'p31.radius.full'], props: { level: { type: 'number' }, maxLevel: { type: 'number', default: 5 } }, slots: ['default'], variants: ['low', 'medium', 'high'] },
  { name: 'HonestLabel', description: 'Contested science flagging label.', css_class: 'honest-label', category: 'indicator', tokens: ['p31.color.warning'], props: { status: { type: '"verified" | "contested" | "unknown"' }, label: { type: 'string' } }, slots: ['default'], variants: ['verified', 'contested', 'unknown'] },
];

export function executeComponentTool(name: string, args: any) {
  switch (name) {
    case 'component_list': {
      let comps = COMPONENTS;
      if (args.category) comps = COMPONENTS.filter(c => c.category === args.category);
      return { status: 'ok', components: comps.map(c => ({ name: c.name, description: c.description, category: c.category, css_class: c.css_class })), total: comps.length };
    }
    case 'component_get': {
      const comp = COMPONENTS.find(c => c.name.toLowerCase() === (args.name || '').toLowerCase());
      if (!comp) return { status: 'error', error: `Unknown component: ${args.name}. Available: ${COMPONENTS.map(c => c.name).join(', ')}` };
      return { status: 'ok', component: comp };
    }
    case 'component_props': {
      const comp = COMPONENTS.find(c => c.name.toLowerCase() === (args.name || '').toLowerCase());
      if (!comp) return { status: 'error', error: `Unknown component: ${args.name}` };
      return { status: 'ok', component: comp.name, props: comp.props };
    }
    case 'component_tokens': {
      const comp = COMPONENTS.find(c => c.name.toLowerCase() === (args.name || '').toLowerCase());
      if (!comp) return { status: 'error', error: `Unknown component: ${args.name}` };
      return { status: 'ok', component: comp.name, tokens: comp.tokens };
    }
    case 'component_search': {
      const q = (args.query || '').toLowerCase();
      const matches = COMPONENTS.filter(c => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
      return { status: 'ok', query: args.query, matches: matches.map(c => ({ name: c.name, description: c.description, category: c.category })), total: matches.length };
    }
    default:
      return { status: 'error', error: `Unknown tool: ${name}` };
  }
}
