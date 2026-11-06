/**
 * P31 Cognitive Prosthetic MCP Server — Ported from production/cli/cognitive-prosthetic.js
 * Neurodivergent cognitive-domain tools (temporal grounding, executive function,
 * sensory adaptation, cognitive load, crisis detection). Pure Node built-ins.
 */

export const COGNITIVE_TOOLS = [
  { name: 'time_estimate', description: 'Estimate minutes to complete a task from complexity and current spoon level.', inputSchema: { type: 'object', properties: { task: { type: 'string' }, complexity: { type: 'string', enum: ['low', 'medium', 'high'] }, spoons: { type: 'number' } }, required: ['task'] } },
  { name: 'schedule_chunk', description: 'Break a total time budget into spoon-aware chunks with rest breaks.', inputSchema: { type: 'object', properties: { total_minutes: { type: 'number' }, spoons: { type: 'number' }, label: { type: 'string' } }, required: ['total_minutes'] } },
  { name: 'task_breakdown', description: 'Decompose a goal into an ordered list of subtasks.', inputSchema: { type: 'object', properties: { goal: { type: 'string' }, max_subtasks: { type: 'number' } }, required: ['goal'] } },
  { name: 'prioritize', description: 'Rank tasks by urgency, importance, and energy cost.', inputSchema: { type: 'object', properties: { tasks: { type: 'array' } }, required: ['tasks'] } },
  { name: 'decision_tree', description: 'Generate a structured decision aid for a hard choice.', inputSchema: { type: 'object', properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } }, required: ['question'] } },
  { name: 'motion_reduce', description: 'Return CSS + data-spoons guidance to reduce UI motion.', inputSchema: { type: 'object', properties: { spoons: { type: 'number' } } } },
  { name: 'contrast_scale', description: 'Check WCAG contrast between bg/fg and suggest AAA-safe adjustments.', inputSchema: { type: 'object', properties: { bg: { type: 'string' }, fg: { type: 'string' } }, required: ['bg'] } },
  { name: 'summarize', description: 'Extractive summary: reduce a long text to the N most salient sentences.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, points: { type: 'number' } }, required: ['text'] } },
  { name: 'chunk_text', description: 'Split a long text into cognitively digestible chunks.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, max_words: { type: 'number' } }, required: ['text'] } },
  { name: 'crisis_check', description: 'Scan a message for rumination, hyperfocus, or distress signals.', inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] } },
  { name: 'deadline_guard', description: 'Flag clustered or overlapping deadlines.', inputSchema: { type: 'object', properties: { deadlines: { type: 'array' } }, required: ['deadlines'] } },
  { name: 'timebox', description: 'Define a focused work block with a hard stop and break.', inputSchema: { type: 'object', properties: { task: { type: 'string' }, minutes: { type: 'number' } }, required: ['task'] } },
  { name: 'rhythm_detect', description: 'From a productivity log, suggest your best-focus hours.', inputSchema: { type: 'object', properties: { log: { type: 'array' } }, required: ['log'] } },
  { name: 'wait_estimate', description: 'Estimate how long until a reply or approval arrives.', inputSchema: { type: 'object', properties: { avg_reply_hours: { type: 'number' } }, required: ['avg_reply_hours'] } },
  { name: 'next_action', description: 'Pick the single best next action from a list.', inputSchema: { type: 'object', properties: { tasks: { type: 'array', items: { type: 'string' } } }, required: ['tasks'] } },
  { name: 'dependency_map', description: 'Order items respecting their dependencies.', inputSchema: { type: 'object', properties: { items: { type: 'array' } }, required: ['items'] } },
  { name: 'energy_match', description: 'Match a task to your current spoon/energy level.', inputSchema: { type: 'object', properties: { tasks: { type: 'array' }, spoons: { type: 'number' } }, required: ['tasks'] } },
  { name: 'habit_stack', description: 'Attach a new habit to an existing anchor routine.', inputSchema: { type: 'object', properties: { habit: { type: 'string' }, anchor: { type: 'string' } }, required: ['habit', 'anchor'] } },
  { name: 'stall_diagnose', description: 'Name why a task is stuck and suggest a nudge.', inputSchema: { type: 'object', properties: { stuck_on: { type: 'string' } }, required: ['stuck_on'] } },
  { name: 'font_tune', description: 'Recommend readable font settings for a spoon level.', inputSchema: { type: 'object', properties: { spoons: { type: 'number' }, dyslexia: { type: 'boolean' } } } },
  { name: 'noise_profile', description: 'Suggest a focus-sound profile for a task type.', inputSchema: { type: 'object', properties: { task_type: { type: 'string', enum: ['deep', 'admin', 'creative', 'rest'] } } } },
  { name: 'light_advice', description: 'Suggest lighting for a time of day and spoon level.', inputSchema: { type: 'object', properties: { spoons: { type: 'number' }, time_of_day: { type: 'string', enum: ['morning', 'midday', 'evening', 'night'] } } } },
  { name: 'density_scale', description: 'Recommend UI information density for a spoon level.', inputSchema: { type: 'object', properties: { spoons: { type: 'number' } } } },
  { name: 'simplify', description: 'Rewrite dense text into plainer language.', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
  { name: 'outline', description: 'Extract the heading/section structure from text.', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
  { name: 'glossary', description: 'Surface likely jargon terms to define.', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
  { name: 'progress_track', description: 'Report progress percentage with encouragement.', inputSchema: { type: 'object', properties: { done: { type: 'number' }, total: { type: 'number' } }, required: ['done', 'total'] } },
  { name: 'question_reframe', description: 'Turn a vague question into a sharper, answerable one.', inputSchema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] } },
  { name: 'tone_shift', description: 'Suggest tone adjustments for a message.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, target: { type: 'string', enum: ['calm', 'firm', 'warm', 'neutral'] } }, required: ['text'] } },
  { name: 'draft_reply', description: 'Draft a reply template from a received message.', inputSchema: { type: 'object', properties: { message: { type: 'string' }, stance: { type: 'string', enum: ['accept', 'decline', 'clarify', 'thank'] } }, required: ['message'] } },
  { name: 'meeting_notes', description: 'Structure a transcript into decisions and actions.', inputSchema: { type: 'object', properties: { transcript: { type: 'string' } }, required: ['transcript'] } },
  { name: 'assertive_reframe', description: 'Reframe an over-apologetic sentence.', inputSchema: { type: 'object', properties: { sentence: { type: 'string' } }, required: ['sentence'] } },
  { name: 'status_update', description: 'Compose a concise status update.', inputSchema: { type: 'object', properties: { done: { type: 'array', items: { type: 'string' } }, blockers: { type: 'array', items: { type: 'string' } } }, required: ['done'] } },
  { name: 'meltdown_plan', description: 'Build a pre-emptive de-escalation plan.', inputSchema: { type: 'object', properties: { triggers: { type: 'array', items: { type: 'string' } }, comforts: { type: 'array', items: { type: 'string' } } } } },
  { name: 'shutdown_routine', description: 'Suggest a wind-down routine scaled to spoons.', inputSchema: { type: 'object', properties: { spoons: { type: 'number' } } } },
  { name: 'grounding_54321', description: 'Lead the 5-4-3-2-1 grounding exercise.', inputSchema: { type: 'object', properties: {} } },
  { name: 'support_ping', description: 'Draft a message to a supporter.', inputSchema: { type: 'object', properties: { who: { type: 'string' }, why: { type: 'string' } }, required: ['who'] } },
  { name: 'spaced_repetition', description: 'Schedule spaced-review intervals.', inputSchema: { type: 'object', properties: { fact: { type: 'string' }, difficulty: { type: 'number' } }, required: ['fact'] } },
  { name: 'note_retrieve', description: 'Find saved notes by keyword overlap.', inputSchema: { type: 'object', properties: { notes: { type: 'array' }, query: { type: 'string' } }, required: ['notes', 'query'] } },
  { name: 'memory_remind', description: 'Compute a due date for a future reminder.', inputSchema: { type: 'object', properties: { label: { type: 'string' }, in_days: { type: 'number' } }, required: ['label'] } },
  { name: 'recall_prompt', description: 'Generate a self-test prompt.', inputSchema: { type: 'object', properties: { topic: { type: 'string' }, facts: { type: 'array', items: { type: 'string' } } }, required: ['topic'] } },
  { name: 'external_memory', description: 'Store a note in an in-process memory stub.', inputSchema: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] } },
  { name: 'chunk_recall', description: 'Split a list into smaller memorization chunks.', inputSchema: { type: 'object', properties: { items: { type: 'array', items: { type: 'string' } }, per_chunk: { type: 'number' } }, required: ['items'] } },
  { name: 'memory_encoding', description: 'Suggest a mnemonic strategy.', inputSchema: { type: 'object', properties: { fact: { type: 'string' }, strategy: { type: 'string', enum: ['acronym', 'imagery', 'story', 'rhyme'] } }, required: ['fact'] } },
  { name: 'retrieval_practice', description: 'Generate a quiz question.', inputSchema: { type: 'object', properties: { snippet: { type: 'string' } }, required: ['snippet'] } },
  { name: 'memory_cue', description: 'Suggest a sensory cue.', inputSchema: { type: 'object', properties: { routine: { type: 'string' }, cue_type: { type: 'string', enum: ['sight', 'sound', 'place', 'smell'] } }, required: ['routine'] } },
  { name: 'forget_track', description: 'Flag reminders not reviewed in 30+ days.', inputSchema: { type: 'object', properties: { items: { type: 'array' } }, required: ['items'] } },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function splitSentences(text: string) {
  if (!text) return [];
  const m = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*/g);
  return m ? m.map(s => s.trim()).filter(Boolean) : [];
}

function hexToRgb(hex: string) {
  if (!hex) return null;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return null;
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

function srgbToLinear(c: number) {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance([r, g, b]: number[]) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(rgb1: number[], rgb2: number[]) {
  const L1 = luminance(rgb1);
  const L2 = luminance(rgb2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

const memoryStore = new Map<string, string>();

// ─── Handlers ───────────────────────────────────────────────────────────────

const HANDLERS: Record<string, (args: any) => any> = {
  time_estimate({ task, complexity = 'medium', spoons = 3 }) {
    const base = 25;
    const cf = ({ low: 0.5, medium: 1, high: 2.2 } as Record<string, number>)[complexity] ?? 1;
    const sf = 0.5 + Math.max(0, Math.min(5, spoons)) * 0.12;
    const minutes = Math.max(5, Math.round((base * cf) / sf));
    return { task, estimate_minutes: minutes, estimate_human: `~${minutes} min`, complexity, spoons };
  },

  schedule_chunk({ total_minutes, spoons = 3, label = 'session' }) {
    const n = spoons <= 1 ? 6 : spoons <= 3 ? 4 : spoons <= 4 ? 3 : 2;
    const per = total_minutes / n;
    const chunks = Array.from({ length: n }, (_, i) => ({
      label: `${label} ${i + 1}`, start_min: Math.round(i * per), end_min: Math.round((i + 1) * per),
      duration_min: Math.round(per), break_after: i < n - 1,
    }));
    return { total_minutes, chunk_count: n, chunks };
  },

  task_breakdown({ goal, max_subtasks = 6 }) {
    const parts = goal.split(/,|;| then | and then | followed by /i).map((s: string) => s.trim()).filter(Boolean);
    let subtasks = parts.length > 1 ? parts : ['Clarify the outcome', 'Plan the steps', 'Execute the first action', 'Verify the result', 'Reflect & adjust'];
    subtasks = subtasks.slice(0, max_subtasks);
    return { goal, subtasks: subtasks.map((title: string, i: number) => ({ order: i + 1, title })) };
  },

  prioritize({ tasks }) {
    if (!Array.isArray(tasks) || tasks.length === 0) return { ranked: [], note: 'No tasks provided.' };
    const ranked = tasks.map((t: any) => {
      const u = Number(t.urgency) || 1;
      const im = Number(t.importance) || 1;
      const en = Number(t.energy) || 3;
      const score = Math.round(((u * 2 + im * 3) / (en + 1)) * 10) / 10;
      return { name: t.name, score, energy_cost: en };
    }).sort((a: any, b: any) => b.score - a.score).map((t: any, i: number) => ({ rank: i + 1, ...t }));
    return { ranked };
  },

  decision_tree({ question, options }) {
    const opts = Array.isArray(options) && options.length ? options : ['Yes', 'No'];
    return { root: question, branches: opts.map(o => ({ option: o, next: `If "${o}": …` })) };
  },

  motion_reduce({ spoons = 3 }) {
    const s = Math.max(0, Math.min(5, spoons));
    let css: string;
    if (s <= 1) css = '* { transition: none !important; animation: none !important; scroll-behavior: auto !important; }';
    else if (s <= 3) css = '* { transition-duration: 150ms !important; animation-duration: 150ms !important; }';
    else css = '* { transition-duration: 200ms !important; }';
    return { spoons: s, data_spoons_attr: `data-spoons="${s}"`, css };
  },

  contrast_scale({ bg = '#0b0e14', fg = '#e5e7eb' }) {
    const bgRgb = hexToRgb(bg);
    const fgRgb = hexToRgb(fg);
    if (!bgRgb || !fgRgb) return { error: 'Provide valid hex colors.' };
    const ratio = Math.round(contrastRatio(bgRgb, fgRgb) * 100) / 100;
    const level = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'FAIL';
    return { bg, fg, ratio, level };
  },

  summarize({ text, points = 3 }) {
    const sentences = splitSentences(text);
    if (sentences.length === 0) return { summary: [], points };
    const words = sentences.join(' ').toLowerCase().match(/\w+/g) || [];
    const freq: Record<string, number> = {};
    for (const w of words) if (w.length > 3) freq[w] = (freq[w] || 0) + 1;
    const scored = sentences.map((s, i) => {
      const w = (s.toLowerCase().match(/\w+/g) || []).length || 1;
      const kw = (s.toLowerCase().match(/\w+/g) || []).reduce((a, t) => a + (freq[t] || 0), 0);
      const position = i === 0 || i === sentences.length - 1 ? 1.5 : 1;
      return { s, score: (kw / w) * position };
    });
    scored.sort((a, b) => b.score - a.score);
    return { summary: scored.slice(0, points).map(x => x.s), points };
  },

  chunk_text({ text, max_words = 60 }) {
    const sentences = splitSentences(text);
    const chunks: string[] = [];
    let cur: string[] = [];
    let count = 0;
    for (const s of sentences) {
      const wc = (s.match(/\w+/g) || []).length;
      if (count + wc > max_words && cur.length) { chunks.push(cur.join(' ')); cur = []; count = 0; }
      cur.push(s); count += wc;
    }
    if (cur.length) chunks.push(cur.join(' '));
    return { chunks, chunk_count: chunks.length };
  },

  crisis_check({ message }) {
    const m = (message || '').toLowerCase();
    const sets: Record<string, string[]> = {
      rumination: ['always', 'never', "what's wrong with me", 'cant stop thinking', 'over and over', 'pointless'],
      hyperfocus: ['lost track of time', 'hours passed', 'forgot to eat', 'forgot to drink', 'just one more'],
      distress: ['overwhelmed', 'too much', "can't cope", 'falling apart', "can't do this"],
    };
    const flags: any[] = [];
    for (const [cat, terms] of Object.entries(sets)) {
      const hit = terms.filter(t => m.includes(t));
      if (hit.length) flags.push({ category: cat, matched: hit });
    }
    return { flags, severity: flags.length, safe_to_continue: flags.length === 0 };
  },

  deadline_guard({ deadlines = [] }) {
    const sorted = [...deadlines].sort((a, b) => a.in_days - b.in_days);
    const clusters: any[] = [];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].in_days - sorted[i - 1].in_days <= 2) {
        clusters.push({ around_day: sorted[i - 1].in_days, items: [sorted[i - 1].label, sorted[i].label] });
      }
    }
    return { deadlines: sorted, clusters };
  },

  timebox({ task, minutes = 25 }) {
    return { task, start: 'now', end_in_min: minutes, break_after: Math.min(10, Math.round(minutes / 5)) };
  },

  rhythm_detect({ log = [] }) {
    const freq: Record<number, number> = {};
    for (const d of log) for (const h of d.productive_hours || []) freq[h] = (freq[h] || 0) + 1;
    const best = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h]) => Number(h));
    return { best_focus_hours: best };
  },

  wait_estimate({ avg_reply_hours = 24 }) {
    const ms = avg_reply_hours * 3600 * 1000;
    return { expected_hours: Math.round(avg_reply_hours), expected_by: new Date(Date.now() + ms).toISOString() };
  },

  next_action({ tasks = [] }) {
    if (!tasks.length) return { next: null };
    const list = tasks.map((t: any, i: number) => typeof t === 'string' ? { name: t, score: tasks.length - i } : { name: t.name, score: t.score ?? tasks.length - i });
    list.sort((a: any, b: any) => b.score - a.score);
    return { next: list[0].name, remaining: list.length - 1 };
  },

  dependency_map({ items = [] }) {
    const done = new Set<string>();
    const order: string[] = [];
    const remaining = [...items];
    let guard = 0;
    while (remaining.length && guard++ < 100) {
      const ready = remaining.filter((it: any) => (it.depends_on || []).every((d: string) => done.has(d)));
      if (!ready.length) break;
      for (const r of ready) { order.push(r.name); done.add(r.name); }
      for (let i = remaining.length - 1; i >= 0; i--) if (done.has(remaining[i].name)) remaining.splice(i, 1);
    }
    return { order, blocked: remaining.map(r => r.name) };
  },

  energy_match({ tasks = [], spoons = 3 }) {
    const ranked = [...tasks].sort((a, b) => Math.abs(a.energy - spoons) - Math.abs(b.energy - spoons));
    return { best_match: ranked[0]?.name };
  },

  habit_stack({ habit, anchor }) {
    return { stack: `After ${anchor}, I will ${habit}.` };
  },

  stall_diagnose({ stuck_on }) {
    const reasons = ['Unclear first step', 'Too big to start', 'Low spoons right now', 'Fear of doing it wrong', 'No clear deadline'];
    const nudge = ['Name the tiniest first action.', 'Split it into a 5-min version.', 'Lower the bar; done beats perfect.', 'Write the worst possible attempt, then improve.', 'Set a 10-min timer and start.'];
    return { stuck_on, likely_reasons: reasons, nudge: nudge[Math.floor(Math.random() * nudge.length)] };
  },

  font_tune({ spoons = 3, dyslexia = false }) {
    const base = dyslexia ? 'Use a dyslexia-friendly font (e.g. OpenDyslexic/Atkinson).' : 'Use a humanist sans (e.g. Inter/Source Sans).';
    const size = spoons <= 1 ? '18–20px, generous line-height.' : spoons <= 3 ? '16–18px.' : '14–16px ok.';
    return { font: base, size, weight: spoons <= 1 ? 'medium (avoid thin)' : 'regular' };
  },

  noise_profile({ task_type = 'deep' }) {
    const map: Record<string, string> = { deep: 'Brown/white noise or lo-fi', admin: 'Light instrumental', creative: 'Lyric-free ambient', rest: 'Silence or nature sounds' };
    return { profile: map[task_type] || map.deep };
  },

  light_advice({ spoons = 3, time_of_day = 'midday' }) {
    const map: Record<string, string> = { morning: 'Cool bright light', midday: 'Natural daylight', evening: 'Warm dim', night: 'Very dim warm, blue-light off' };
    return { light: map[time_of_day] || map.midday };
  },

  density_scale({ spoons = 3 }) {
    const d = spoons <= 1 ? 'minimal' : spoons <= 3 ? 'moderate' : 'detailed';
    return { density: d };
  },

  simplify({ text }) {
    const swap: Record<string, string> = { utilize: 'use', facilitate: 'help', leverage: 'use', commence: 'start', 'in order to': 'to', 'prior to': 'before', 'subsequent to': 'after' };
    const sentences = splitSentences(text);
    const out = sentences.map(s => s.replace(/\b(utilize|facilitate|leverage|commence|in order to|prior to|subsequent to)\b/gi, m => swap[m.toLowerCase()] || m).replace(/\s{2,}/g, ' ')).join(' ');
    return { simplified: out };
  },

  outline({ text }) {
    const lines = (text || '').split(/\n/).map((l: string) => l.trim()).filter(Boolean);
    const heads = lines.filter((l: string) => /^(\d+\.|#|\*|-)\s/.test(l) || /^[A-Z][^.!?]{3,40}$/.test(l));
    return { outline: heads.length ? heads : lines.slice(0, 5) };
  },

  glossary({ text }) {
    const terms = (text || '').match(/\b([A-Z][a-z]{3,})\b/g) || [];
    const uniq = [...new Set(terms)].slice(0, 12);
    return { terms: uniq };
  },

  progress_track({ done = 0, total = 1 }) {
    const pct = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
    return { percent: pct };
  },

  question_reframe({ question }) {
    const q = (question || '').trim();
    const vague = /\b(thing|stuff|everything|something|better|good|fix it)\b/i.test(q);
    const sharper = vague ? q.replace(/\b(thing|stuff|something)\b/gi, 'the specific outcome') + ' — what does success look like?' : q + ' — what is the first concrete step?';
    return { original: q, reframed: sharper };
  },

  tone_shift({ text, target = 'neutral' }) {
    const recs: Record<string, string> = { calm: 'Slow pace, soft words, acknowledge feelings.', firm: 'Direct, short sentences, clear boundary.', warm: 'Friendlier openings, inclusive "we".', neutral: 'Fact-first, drop filler.' };
    return { target, suggestion: recs[target] || recs.neutral };
  },

  draft_reply({ message, stance = 'thank' }) {
    const tmpl: Record<string, string> = {
      accept: 'Thanks — yes, that works. I will proceed and confirm by <date>.',
      decline: 'Thank you for the offer. I am not able to take this on right now.',
      clarify: 'Thanks for this. Could you clarify <specific point> so I respond well?',
      thank: 'Thank you — I appreciate it.',
    };
    return { stance, draft: tmpl[stance] || tmpl.thank };
  },

  meeting_notes({ transcript }) {
    const lines = (transcript || '').split(/\n/).map((l: string) => l.trim()).filter(Boolean);
    return {
      decisions: lines.filter((l: string) => /decid|agreed|we will|action/i.test(l)),
      actions: lines.filter((l: string) => /todo|assign|follow.?up|by <|owner/i.test(l)),
    };
  },

  assertive_reframe({ sentence }) {
    const cleaned = (sentence || '').replace(/^(i'?m )?sorry( for|about|if)?/i, '').replace(/i (just|was wondering if|feel like)/i, 'I').replace(/\s{2,}/g, ' ').trim();
    return { original: sentence, reframed: cleaned || sentence };
  },

  status_update({ done = [], blockers = [] }) {
    const body = (done.length ? 'Done: ' + done.join('; ') + '. ' : '') + (blockers.length ? 'Blocked: ' + blockers.join('; ') + '.' : 'No blockers.');
    return { update: body, length: body.length };
  },

  meltdown_plan({ triggers = [], comforts = [] }) {
    return { triggers: triggers.length ? triggers : ['unknown — log next time'], plan: ['Notice early signs.', 'Use a comfort: ' + ((comforts && comforts[0]) || 'quiet space'), 'Lower spoons: dim, slow, step back.', 'Re-engage only when steady.'] };
  },

  shutdown_routine({ spoons = 3 }) {
    const steps = spoons <= 1 ? ['Stop screens.', 'Dim lights.', 'Slow breathing 2 min.', 'Rest.'] : ['Close open tabs.', 'Write tomorrow\'s one next action.', 'Set a stop time.', 'Wind down.'];
    return { spoons, steps };
  },

  grounding_54321() {
    return { steps: ['5 things you can SEE', '4 things you can TOUCH', '3 things you can HEAR', '2 things you can SMELL', '1 thing you can TASTE'] };
  },

  support_ping({ who, why }) {
    const first = (who || '').split(' ')[0] || who;
    return { to: who, draft: `Hey ${first}, I am having a hard moment${why ? ' (' + why + ')' : ''}. Can we talk soon? No fix needed — just company.` };
  },

  spaced_repetition({ fact, difficulty = 3 }) {
    const base = [1, 3, 7, 14, 30];
    const scale = difficulty <= 1 ? 1.6 : difficulty >= 5 ? 0.6 : 1;
    const sched = base.map(d => Math.max(1, Math.round(d * scale)));
    return { fact, difficulty, schedule_days: sched };
  },

  note_retrieve({ notes = [], query }) {
    const q = (query || '').toLowerCase().split(/\W+/).filter(Boolean);
    const scored = notes.map((n: any) => {
      const text = (n.text || '').toLowerCase();
      const score = q.reduce((a: number, t: string) => a + (text.includes(t) ? 1 : 0), 0);
      return { id: n.id, score };
    }).filter((s: any) => s.score > 0).sort((a: any, b: any) => b.score - a.score);
    return { matches: scored.slice(0, 5) };
  },

  memory_remind({ label, in_days = 1 }) {
    const due = new Date(Date.now() + in_days * 86400000).toISOString().slice(0, 10);
    return { label, due };
  },

  recall_prompt({ topic, facts = [] }) {
    return { prompt: `Without looking, what do you remember about ${topic}?`, test_facts: facts };
  },

  external_memory({ key, value }) {
    if (!memoryStore.has(key)) memoryStore.set(key, value);
    return { stored: key };
  },

  chunk_recall({ items = [], per_chunk = 5 }) {
    const chunks = [];
    for (let i = 0; i < items.length; i += per_chunk) chunks.push(items.slice(i, i + per_chunk));
    return { chunks, count: chunks.length };
  },

  memory_encoding({ fact, strategy }) {
    const pick = strategy || (fact.length > 40 ? 'story' : 'imagery');
    const map: Record<string, string> = { acronym: 'Take first letters to form a word.', imagery: 'Attach a vivid absurd image to the fact.', story: 'Weave the fact into a tiny story.', rhyme: 'Pair it with a rhyming word.' };
    return { fact, strategy: pick, suggestion: map[pick] || map.imagery };
  },

  retrieval_practice({ snippet }) {
    const first = splitSentences(snippet || '')[0] || '';
    const topic = first.replace(/^[^a-z]*the /i, '').slice(0, 60);
    return { question: `What was stated about "${topic}..."?` };
  },

  memory_cue({ routine, cue_type = 'sight' }) {
    const cues: Record<string, string> = { sight: `Put a visible object by where you do "${routine}".`, sound: `Use a specific chime before "${routine}".`, place: `Always do "${routine}" in the same spot.`, smell: `Keep a scent nearby that means "${routine}".` };
    return { routine, cue_type, cue: cues[cue_type] || cues.sight };
  },

  forget_track({ items = [] }) {
    const now = Date.now();
    const flagged = items.map((it: any) => {
      const last = it.last_reviewed ? new Date(it.last_reviewed).getTime() : 0;
      const days = last ? Math.round((now - last) / 86400000) : 999;
      return { label: it.label, days_since: days, stale: days > 30 };
    }).filter((x: any) => x.stale);
    return { stale: flagged };
  },
};

export function executeCognitiveTool(name: string, args: any) {
  const handler = HANDLERS[name];
  if (!handler) return { error: `Unknown tool: ${name}`, status: 'error' };
  return { result: handler(args || {}), status: 'ok' };
}
