/**
 * P31 Spaceship MCP Server — Ported from production/cli/spaceship-server.js
 * DUNA / System Health / Dome Structure / NeoPixel Expert
 */

import fs from 'fs';
import path from 'path';

const AGENTS_ROOT = path.resolve(process.env.HOME || '/home/p31', 'p31-agents');
const STATE_PATH = path.join(AGENTS_ROOT, 'spaceship-state.json');

const DOME_RADIUS = 12;
const PORT_COUNT = 120;
const SEGMENTS_PER_EDGE = 20;
const LAYERS = 4;
const TETRA_FRAME = 6;

// ─── Geodesic subdivision ───────────────────────────────────────────────────

const BASE = [
  [-1, 1.618034, 0], [1, 1.618034, 0], [-1, -1.618034, 0], [1, -1.618034, 0],
  [0, -1, 1.618034], [0, 1, 1.618034], [0, -1, -1.618034], [0, 1, -1.618034],
  [1.618034, 0, -1], [1.618034, 0, 1], [-1.618034, 0, -1], [-1.618034, 0, 1],
];

const BASE_FACES = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

const KEY_PRECISION = 8;
const pkey = (p: number[]) => p.map(n => n.toFixed(KEY_PRECISION)).join(',');

function normalize(p: number[], radius: number) {
  const len = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
  const s = len > 0 ? radius / len : 1;
  return [p[0] * s, p[1] * s, p[2] * s];
}

function midpoint(a: number[], b: number[], radius: number) {
  return normalize([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], radius);
}

function geodesicEdgeCount(radius: number, detail: number) {
  const verts = BASE.map(p => normalize(p, radius));
  const index = new Map<string, number>();
  verts.forEach((v, i) => index.set(pkey(v), i));
  const point = (p: number[]) => {
    const k = pkey(p);
    const hit = index.get(k);
    if (hit !== undefined) return hit;
    const id = verts.length;
    verts.push(p);
    index.set(k, id);
    return id;
  };

  let faces = BASE_FACES.slice();
  for (let d = 0; d < detail; d++) {
    const next: number[][] = [];
    for (const [a, b, c] of faces) {
      const ab = point(midpoint(verts[a], verts[b], radius));
      const bc = point(midpoint(verts[b], verts[c], radius));
      const ca = point(midpoint(verts[c], verts[a], radius));
      next.push([a, ab, ca]);
      next.push([b, bc, ab]);
      next.push([c, ca, bc]);
      next.push([ab, bc, ca]);
    }
    faces = next;
  }

  const edgeSet = new Set<string>();
  for (const [a, b, c] of faces) {
    for (const [x, y] of [[a, b], [b, c], [c, a]]) {
      const k = x < y ? `${x},${y}` : `${y},${x}`;
      if (!edgeSet.has(k)) edgeSet.add(k);
    }
  }
  return edgeSet.size;
}

const OUTER_EDGES = geodesicEdgeCount(DOME_RADIUS, 2);

// ─── State helpers ──────────────────────────────────────────────────────────

const DEFAULT_STATE = {
  spoons: 4,
  coherence: 0.8,
  engagement: 5,
  memberCount: 0,
  dunaTarget: 100,
  dockedPorts: 0,
  led: { mode: 'rainbow', speed: 5, color: '#22d3ee', brightness: 80 },
};

function readFileSafe(filePath: string) {
  try { return fs.readFileSync(path.resolve(filePath), 'utf-8'); } catch { return null; }
}

function readJsonSafe(filePath: string) {
  const content = readFileSafe(filePath);
  if (!content) return null;
  try { return JSON.parse(content); } catch { return null; }
}

function loadState(file?: string) {
  const target = file || STATE_PATH;
  const saved = readJsonSafe(target);
  return { target, state: deepMerge({ ...DEFAULT_STATE }, saved || {}) };
}

function deepMerge(base: any, patch: any) {
  for (const k of Object.keys(patch)) {
    if (patch[k] !== null && typeof patch[k] === 'object' && !Array.isArray(patch[k])) {
      base[k] = deepMerge(base[k] && typeof base[k] === 'object' ? { ...base[k] } : {}, patch[k]);
    } else {
      base[k] = patch[k];
    }
  }
  return base;
}

function writeJsonAtomic(filePath: string, data: any) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, filePath);
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

const LED_MODES = ['rainbow', 'chase', 'solid', 'breath', 'gradient', 'dual-chase', 'off'];

export const SPACESHIP_TOOLS = [
  {
    name: 'duna_status',
    description: 'Get DUNA readiness: member count vs target, progress bar, readiness label, and active ships.',
    inputSchema: { type: 'object', properties: { file: { type: 'string' } } },
  },
  {
    name: 'system_health',
    description: 'Get system health: coherence, spoons, engagement, docked ports, and mesh status.',
    inputSchema: { type: 'object', properties: { file: { type: 'string' } } },
  },
  {
    name: 'dome_structure',
    description: 'Get the docking-dome geometry facts: layers, mode, radius, outer edges, ports, NeoPixel segments.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'neo_pixel_control',
    description: 'Set the NeoPixel LED controller state (mode, speed, color, brightness).',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: LED_MODES },
        speed: { type: 'number' },
        color: { type: 'string' },
        brightness: { type: 'number' },
        file: { type: 'string' },
      },
    },
  },
];

// ─── Tool Implementations ───────────────────────────────────────────────────

function readinessLabel(dunaReady: number) {
  if (dunaReady >= 1) return 'READY';
  if (dunaReady >= 0.75) return 'near-ready';
  if (dunaReady >= 0.5) return 'deploying';
  if (dunaReady >= 0.25) return 'assembling';
  return 'initializing';
}

function meshStatus(coherence: number, dockedPorts: number) {
  if (dockedPorts === 0) return 'idle';
  if (coherence >= 0.7) return 'stable';
  if (coherence >= 0.4) return 'forming';
  return 'critical';
}

export function executeSpaceshipTool(name: string, args: any) {
  switch (name) {
    case 'duna_status': {
      const { target, state } = loadState(args.file);
      const members = Number(state.memberCount) || 0;
      const targetCount = Number(state.dunaTarget) || DEFAULT_STATE.dunaTarget;
      const dunaReady = Math.min(1, members / targetCount);
      return {
        status: 'ok', members, target: targetCount, active_ships: members,
        progress: Math.round(dunaReady * 100), readiness: readinessLabel(dunaReady),
        duna_ready: dunaReady, state_file: target,
      };
    }
    case 'system_health': {
      const { target, state } = loadState(args.file);
      const coherence = Math.min(1, Math.max(0, Number(state.coherence) ?? DEFAULT_STATE.coherence));
      const spoons = Math.min(5, Math.max(0, Number(state.spoons) ?? DEFAULT_STATE.spoons));
      const engagement = Math.min(10, Math.max(0, Number(state.engagement) ?? DEFAULT_STATE.engagement));
      const dockedPorts = Number(state.dockedPorts) || 0;
      return {
        status: 'ok', coherence, spoons, engagement, docked_ports: dockedPorts,
        mesh: meshStatus(coherence, dockedPorts), state_file: target,
      };
    }
    case 'dome_structure': {
      return {
        status: 'ok',
        dome: {
          layers: LAYERS, mode: 'docking-dome', radius: DOME_RADIUS,
          outerEdges: OUTER_EDGES, ports: PORT_COUNT,
          neoPixelSegments: OUTER_EDGES * SEGMENTS_PER_EDGE,
          tetraFrame: TETRA_FRAME, innerDome: true,
        },
      };
    }
    case 'neo_pixel_control': {
      const { target, state } = loadState(args.file);
      const led = { ...(state.led || {}), ...DEFAULT_STATE.led };
      const errors: string[] = [];

      if (args.mode !== undefined) {
        if (!LED_MODES.includes(args.mode)) errors.push(`mode must be one of: ${LED_MODES.join(', ')}`);
        else led.mode = args.mode;
      }
      if (args.speed !== undefined) {
        if (typeof args.speed !== 'number' || Number.isNaN(args.speed) || args.speed < 0 || args.speed > 10) errors.push('speed must be a number 0-10');
        else led.speed = args.speed;
      }
      if (args.color !== undefined) {
        if (typeof args.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(args.color)) errors.push('color must be a hex string like #22d3ee');
        else led.color = args.color.toLowerCase();
      }
      if (args.brightness !== undefined) {
        if (typeof args.brightness !== 'number' || Number.isNaN(args.brightness) || args.brightness < 0 || args.brightness > 100) errors.push('brightness must be a number 0-100');
        else led.brightness = args.brightness;
      }

      if (errors.length > 0) return { status: 'error', errors, message: errors.join('; ') };

      state.led = led;
      try { writeJsonAtomic(target, state); } catch (e: any) { return { status: 'error', error: e.message }; }

      return { status: 'ok', persisted: true, file: target, led };
    }
    default:
      return { status: 'error', error: `Unknown tool: ${name}` };
  }
}
