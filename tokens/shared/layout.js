// ═══════════════════════════════════════════════════════════════════════════
// P31 Layout Generator — Shared Module
// Used by: cli/design-mcp-server.js, workers/design-mcp/src/index.ts
// ═══════════════════════════════════════════════════════════════════════════

// ─── Colour mapping ──────────────────────────────────────────────────────────

const COLOR_TO_VAR = {
  accent: 'var(--p31-accent)',
  violet: 'var(--p31-accent-violet)',
  gold: 'var(--p31-accent-gold)',
  green: 'var(--p31-accent-green)',
  red: 'var(--p31-accent-red)',
  iris: 'var(--p31-accent-iris)',
};

// ─── Component renderers ────────────────────────────────────────────────────

const COMPONENT_RENDERERS = {
  GlassCard: (props) => {
    const { color, title, description, href, subtitle } = props;
    const borderColor = color ? `border-left:2px solid ${COLOR_TO_VAR[color] || COLOR_TO_VAR.accent};` : '';
    const parts = [];
    if (title) parts.push(`<h3 style="color:var(--p31-text);font-size:14px;font-weight:700;margin-bottom:${description ? '4px' : '0'};">${h(title)}</h3>`);
    if (subtitle) parts.push(`<p style="font-size:10px;font-family:var(--p31-font-mono);color:var(--p31-text-tertiary);margin-bottom:4px;">${h(subtitle)}</p>`);
    if (description) parts.push(`<p style="color:var(--p31-text-secondary);font-size:12px;line-height:1.5;">${h(description)}</p>`);
    const inner = parts.join('\n');

    if (href && href !== '#') {
      return `<a href="${h(href)}" class="glass-card" style="${borderColor}text-decoration:none;display:block;">${inner}</a>`;
    }
    return `<div class="glass-card" style="${borderColor}">${inner}</div>`;
  },

  GlassPanel: (props) => {
    const { padding, content } = props;
    const padMap = { sm: 'padding:16px;', md: 'padding:24px;', lg: 'padding:32px;' };
    const pad = padMap[padding] || padMap.md;
    return `<div class="glass-panel" style="${pad}">${content || ''}</div>`;
  },

  GlassStrong: (props) => {
    return `<div class="glass-strong" style="${props.padding ? `padding:${props.padding};` : ''}">${props.content || ''}</div>`;
  },

  GlassSubtle: (props) => {
    return `<div class="glass-subtle" style="${props.padding ? `padding:${props.padding};` : ''}">${props.content || ''}</div>`;
  },

  Button: (props) => {
    const { variant, label, href } = props;
    const cls = variant === 'secondary' ? 'btn-secondary' : variant === 'ghost' ? 'btn-ghost' : 'btn-primary';
    return `<a href="${h(href || '#')}" class="${cls}" style="display:inline-flex;align-items:center;gap:8px;">${h(label || 'Button')}</a>`;
  },

  StatusBadge: (props) => {
    const { status, text } = props;
    const cls = status === 'beta' ? 'status-badge status-badge-beta' : status === 'research' ? 'status-badge status-badge-research' : 'status-badge status-badge-live';
    return `<span class="${cls}">${h(text || status || 'Live')}</span>`;
  },

  HonestLabel: (props) => {
    return `<div class="honest-label">${h(props.text || props.content || '')}</div>`;
  },

  StatCard: (props) => {
    return `<div class="glass-subtle" style="padding:12px 16px;text-align:center;min-width:80px;">
  <div style="font-size:20px;font-weight:700;color:var(--p31-text);">${h(String(props.value))}</div>
  <div style="font-size:10px;color:var(--p31-text-tertiary);text-transform:uppercase;letter-spacing:0.05em;">${h(props.label || '')}</div>
</div>`;
  },
};

// ─── HTML-safe string ───────────────────────────────────────────────────────

function h(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Layout templates ──────────────────────────────────────────────────────

/**
 * Hero section — title, subtitle, CTAs, stats, badge.
 */
function renderHero(props) {
  const { title, subtitle, ctas, stats, badge } = props;
  const badgeHtml = badge ? `<div style="display:inline-flex;align-items:center;gap:8px;padding:6px 16px;border-radius:32px;margin-bottom:20px;" class="glass-subtle">${h(badge)}</div>` : '';
  const ctasHtml = (ctas || []).map(c => COMPONENT_RENDERERS.Button(c)).join('');
  const statsHtml = (stats || []).map(s => COMPONENT_RENDERERS.StatCard(s)).join('');

  return `<section style="text-align:center;padding:60px 0 40px;max-width:1280px;margin:0 auto;padding-left:24px;padding-right:24px;">
  ${badgeHtml}
  <h1 style="font-size:clamp(2.5rem,6vw,4rem);font-weight:800;color:var(--p31-text);margin-bottom:16px;line-height:1.15;">${h(title || '')}</h1>
  ${subtitle ? `<p style="font-size:1.125rem;color:var(--p31-text-secondary);max-width:650px;margin:0 auto 32px;line-height:1.6;">${h(subtitle)}</p>` : ''}
  ${ctasHtml ? `<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:${statsHtml ? '32px' : '0'};">${ctasHtml}</div>` : ''}
  ${statsHtml ? `<div style="display:flex;gap:24px;justify-content:center;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;">${statsHtml}</div>` : ''}
</section>`;
}

/**
 * 4-column tetra grid — exactly 4 items, colour-coded.
 */
function renderTetraGrid(props) {
  const { items } = props;
  if (!items || items.length !== 4) return `<p style="color:var(--p31-text-secondary);padding:16px;">Error: tetra-grid requires exactly 4 items (K4 topology).</p>`;

  const cards = items.map((item, i) => {
    const p = item.props || {};
    const color = p.color || ['accent', 'violet', 'gold', 'green'][i];
    return COMPONENT_RENDERERS.GlassCard({ ...p, color, subtitle: '' });
  }).join('');

  return `<div class="tetra-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:16px 0;">${cards}</div>`;
}

/**
 * Grid of GlassCards — N columns, optional heading.
 */
function renderCardGrid(props) {
  const { columns, heading, description, items } = props;
  const headingHtml = heading ? `<h2 style="font-size:clamp(1.5rem,3vw,2.25rem);font-weight:700;color:var(--p31-text);margin-bottom:8px;text-align:center;">${h(heading)}</h2>` : '';
  const descHtml = description ? `<p style="color:var(--p31-text-secondary);text-align:center;max-width:650px;margin:0 auto 24px;">${h(description)}</p>` : '';
  const colCount = Math.min(columns || 3, 4);

  const cards = (items || []).map(item => {
    const p = item.props || {};
    if ((item.component || '').toLowerCase() === 'glasscard') return COMPONENT_RENDERERS.GlassCard(p);
    if ((item.component || '').toLowerCase() === 'statusbadge') return COMPONENT_RENDERERS.StatusBadge(p);
    return `<div class="glass-card"><p style="color:var(--p31-text-secondary);">${h(p.title || '')}</p></div>`;
  }).join('');

  return `<div style="max-width:1280px;margin:0 auto;padding:24px;">
  ${headingHtml}
  ${descHtml}
  <div style="display:grid;grid-template-columns:repeat(${colCount},1fr);gap:16px;">${cards}</div>
</div>`;
}

/**
 * Generic content section — heading, description, freeform content.
 */
function renderSection(props) {
  const { heading, description, content } = props;
  return `<section style="padding:48px 24px;max-width:1280px;margin:0 auto;">
  ${heading ? `<h2 style="font-size:clamp(1.5rem,3vw,2.25rem);font-weight:700;color:var(--p31-text);margin-bottom:8px;text-align:center;">${h(heading)}</h2>` : ''}
  ${description ? `<p style="color:var(--p31-text-secondary);text-align:center;max-width:650px;margin:0 auto 24px;">${h(description)}</p>` : ''}
  ${content || ''}
</section>`;
}

/**
 * CTA block — heading, description, buttons in a glass-strong wrapper.
 */
function renderCTA(props) {
  const { heading, description, buttons } = props;
  const btnHtml = (buttons || []).map(b => COMPONENT_RENDERERS.Button(b)).join('');
  return `<div class="glass-strong" style="padding:48px 24px;text-align:center;max-width:720px;margin:0 auto;border-radius:var(--p31-radius-xl);">
  <h2 style="font-size:clamp(1.5rem,3vw,2rem);font-weight:700;color:var(--p31-text);margin-bottom:12px;">${h(heading || '')}</h2>
  ${description ? `<p style="color:var(--p31-text-secondary);margin-bottom:24px;max-width:550px;margin-left:auto;margin-right:auto;">${h(description)}</p>` : ''}
  ${btnHtml ? `<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">${btnHtml}</div>` : ''}
</div>`;
}

const LAYOUT_TEMPLATES = {
  hero: renderHero,
  'tetra-grid': renderTetraGrid,
  'card-grid': renderCardGrid,
  section: renderSection,
  cta: renderCTA,
};

// ─── A2UI renderers (return JSON objects) ──────────────────────────────────

function a2Hero(props) {
  const children = [];
  if (props.badge) children.push({ component: 'Label', properties: { text: props.badge, variant: 'badge' } });
  children.push({ component: 'Heading', properties: { text: props.title || '', level: 1 } });
  if (props.subtitle) children.push({ component: 'Text', properties: { text: props.subtitle, variant: 'subtitle' } });
  if (props.ctas) children.push({ component: 'ButtonRow', properties: { buttons: (props.ctas || []).map(c => ({ label: c.label, href: c.href, variant: c.variant || 'primary' })) } });
  if (props.stats) children.push({ component: 'StatRow', properties: { stats: (props.stats || []).map(s => ({ value: s.value, label: s.label })) } });
  return { component: 'Hero', properties: {}, children };
}

function a2TetraGrid(props) {
  return {
    component: 'TetraGrid',
    properties: {},
    children: (props.items || []).map((item, i) => {
      const p = item.props || {};
      return { component: 'GlassCard', properties: { title: p.title || '', description: p.description || '', color: p.color || ['accent', 'violet', 'gold', 'green'][i], href: p.href || '' } };
    }),
  };
}

function a2CardGrid(props) {
  const children = [];
  if (props.heading) children.push({ component: 'Heading', properties: { text: props.heading, level: 2 } });
  if (props.description) children.push({ component: 'Text', properties: { text: props.description, variant: 'description' } });
  children.push({
    component: 'Grid',
    properties: { columns: props.columns || 3 },
    children: (props.items || []).map(item => {
      const p = item.props || {};
      return { component: 'GlassCard', properties: { title: p.title || '', description: p.description || '', color: p.color || 'accent', href: p.href || '' } };
    }),
  });
  return { component: 'Section', properties: { variant: 'grid' }, children };
}

function a2Section(props) {
  const children = [];
  if (props.heading) children.push({ component: 'Heading', properties: { text: props.heading, level: 2 } });
  if (props.description) children.push({ component: 'Text', properties: { text: props.description, variant: 'description' } });
  if (props.content) children.push({ component: 'HtmlBlock', properties: { html: props.content } });
  return { component: 'Section', properties: {}, children };
}

function a2CTA(props) {
  return {
    component: 'CTABlock',
    properties: {
      heading: props.heading || '',
      description: props.description || '',
      buttons: (props.buttons || []).map(b => ({ label: b.label, href: b.href || '#', variant: b.variant || 'primary' })),
    },
    children: [],
  };
}

const A2UI_TEMPLATES = {
  hero: a2Hero,
  'tetra-grid': a2TetraGrid,
  'card-grid': a2CardGrid,
  section: a2Section,
  cta: a2CTA,
};

function renderA2UI(input) {
  if (!input || !input.type) return { error: 'Missing type field', components: A2UI_TEMPLATES_KEYS };
  const { type, ...props } = input;
  const template = A2UI_TEMPLATES[type];
  if (!template) return { error: `Unknown layout type: ${type}`, supported: Object.keys(A2UI_TEMPLATES) };
  try {
    const tree = template(props);
    return { version: 'p31-a2ui-0.9', layout: type, root: tree };
  } catch (e) {
    return { error: e.message };
  }
}

// ─── Main dispatcher (HTML + A2UI) ──────────────────────────────────────────

function renderLayout(input) {
  if (!input || !input.type) {
    return `<p style="color:var(--p31-text-secondary);padding:16px;">Error: missing required field "type". Supported: ${Object.keys(LAYOUT_TEMPLATES).join(', ')}.</p>`;
  }

  const format = input.format || 'html';
  const { format: _, ...cleanInput } = input;

  if (format === 'a2ui') return renderA2UI(cleanInput);

  if (format !== 'html') {
    return `<p style="color:var(--p31-accent-red);padding:16px;">Error: unknown format "${h(format)}". Supported: html, a2ui.</p>`;
  }

  const { type, ...props } = cleanInput;
  const template = LAYOUT_TEMPLATES[type];
  if (!template) {
    return `<p style="color:var(--p31-text-secondary);padding:16px;">Error: unknown layout type "${h(type)}". Supported: ${Object.keys(LAYOUT_TEMPLATES).join(', ')}.</p>`;
  }

  try {
    return template(props);
  } catch (e) {
    return `<p style="color:var(--p31-accent-red);padding:16px;">Error rendering layout: ${h(e.message)}</p>`;
  }
}

module.exports = { renderLayout, COMPONENT_RENDERERS, LAYOUT_TEMPLATES, COLOR_TO_VAR };
