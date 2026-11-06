/**
 * P31 Oasis MCP Server — Ported from production/cli/mcp-server.js
 * Exposes session state, design tokens, and slash-command execution via JSON-RPC
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const SESSION_DIR = path.join(os.homedir(), '.p31');
const SESSION_FILE = path.join(SESSION_DIR, 'cli-session.json');
const DESIGN_PATH = path.join(__dirname, '..', 'DESIGN.md');

// ─── Session I/O ─────────────────────────────────────────────────────────────

function loadSession() {
  const defaults = { theme: 'warm', todos: [], log: [], mode: 'BUILD', sandboxCwd: process.cwd() };
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
      const saved = JSON.parse(raw);
      return { ...defaults, ...saved };
    }
  } catch (_) { /* corrupt → fresh */ }
  return defaults;
}

function saveSession(data: any) {
  try {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ ...data, savedAt: new Date().toISOString() }, null, 2));
    return true;
  } catch (_) { return false; }
}

// ─── Design Tokens ───────────────────────────────────────────────────────────

function loadDesign() {
  try {
    const raw = fs.readFileSync(DESIGN_PATH, 'utf8');
    const match = raw.match(/^---\n([\s\S]*?)\n---/);
    if (match) return JSON.parse(match[1]) || {};
  } catch (_) { /* ignore */ }
  return {};
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

export const OASIS_TOOLS = [
  {
    name: 'oasis_status',
    description: 'Get current CLI session state, design tokens, and capabilities. Equivalent to `p31 --agent`.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'oasis_save',
    description: 'Persist the current session state (theme, todos, log, mode) to ~/.p31/cli-session.json.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'oasis_theme',
    description: 'Switch the CLI theme. Persists to session.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', enum: ['cyberpunk', 'nord', 'dracula', 'catppuccin', 'warm'], description: 'Theme name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'oasis_mode',
    description: 'Set the CLI working mode. Persists to session.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', enum: ['BUILD', 'PLAN', 'REVIEW', 'DEBUG'], description: 'Mode name (auto-uppercased)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'oasis_clear',
    description: 'Clear the in-memory log buffer.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'oasis_export_log',
    description: 'Export the session log to a timestamped text file in the current directory.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'oasis_sandbox_clear',
    description: 'Clear the sandbox pane content (in-memory).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'oasis_notify',
    description: 'Queue a test notification message.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Notification text' },
        type: { type: 'string', enum: ['info', 'ok', 'warn', 'err'], description: 'Notification severity' },
      },
    },
  },
  {
    name: 'oasis_add_todo',
    description: 'Add a todo item to the session.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Todo description' },
      },
      required: ['text'],
    },
  },
  {
    name: 'oasis_toggle_todo',
    description: 'Toggle a todo item\'s done state by index (0-based).',
    inputSchema: {
      type: 'object',
      properties: {
        index: { type: 'number', description: '0-based index of the todo to toggle' },
      },
      required: ['index'],
    },
  },
  {
    name: 'oasis_execute',
    description: 'Execute a shell command in the session sandbox directory. Returns stdout, stderr, and exit code.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
      },
      required: ['command'],
    },
  },
];

// ─── Tool Execution ──────────────────────────────────────────────────────────

export function executeOasisTool(name: string, args: any) {
  const session = loadSession();

  switch (name) {
    case 'oasis_status': {
      const design = loadDesign();
      return {
        version: '3.1.3',
        mode: session.mode,
        theme: session.theme,
        todos: session.todos.map((t: any) => ({ text: t.text || t, done: t.done || false })),
        sandboxCwd: session.sandboxCwd,
        design: {
          colors: design.colors || {},
          typography: design.typography || {},
          rounded: design.rounded || {},
          spacing: design.spacing || {},
          components: design.components || {},
        },
        capabilities: {
          slashCommands: ['/exit', '/clear', '/sandbox clear', '/export log', '/save', '/notify test', '/help', '/theme <name>', '/mode <name>'],
          themes: ['cyberpunk', 'nord', 'dracula', 'catppuccin', 'warm'],
          modes: ['BUILD', 'PLAN', 'REVIEW', 'DEBUG'],
        },
        status: 'ok',
      };
    }

    case 'oasis_save': {
      const ok = saveSession(session);
      return { saved: ok, path: SESSION_FILE, status: ok ? 'ok' : 'error' };
    }

    case 'oasis_theme': {
      const themes = ['cyberpunk', 'nord', 'dracula', 'catppuccin', 'warm'];
      const name = (args.name || '').toLowerCase();
      if (!themes.includes(name)) {
        return { error: `Unknown theme "${name}". Options: ${themes.join(', ')}`, status: 'error' };
      }
      session.theme = name;
      saveSession(session);
      return { theme: name, saved: true, status: 'ok' };
    }

    case 'oasis_mode': {
      const name = (args.name || 'BUILD').toUpperCase();
      session.mode = name;
      saveSession(session);
      return { mode: name, saved: true, status: 'ok' };
    }

    case 'oasis_clear': {
      session.log = [];
      saveSession(session);
      return { cleared: true, status: 'ok' };
    }

    case 'oasis_export_log': {
      const ts = Date.now();
      const filename = `p31-oasis-log-${ts}.txt`;
      const clean = (session.log || []).join('\n');
      try {
        fs.writeFileSync(filename, clean);
        return { file: filename, lines: session.log.length, status: 'ok' };
      } catch (e: any) {
        return { error: e.message, status: 'error' };
      }
    }

    case 'oasis_sandbox_clear': {
      return { cleared: true, note: 'Sandbox output cleared (in-memory). Next command refreshes it.', status: 'ok' };
    }

    case 'oasis_notify': {
      return {
        queued: true,
        message: args.message || 'Test notification',
        type: args.type || 'info',
        status: 'ok',
      };
    }

    case 'oasis_add_todo': {
      if (!args.text) return { error: 'text is required', status: 'error' };
      session.todos.push({ text: args.text, done: false });
      saveSession(session);
      return { todo: { text: args.text, done: false }, total: session.todos.length, status: 'ok' };
    }

    case 'oasis_toggle_todo': {
      const idx = args.index;
      if (typeof idx !== 'number' || idx < 0 || idx >= session.todos.length) {
        return { error: `Invalid index ${idx}. Range: 0–${session.todos.length - 1}`, status: 'error' };
      }
      session.todos[idx].done = !session.todos[idx].done;
      saveSession(session);
      return { todo: session.todos[idx], index: idx, status: 'ok' };
    }

    case 'oasis_execute': {
      if (!args.command) return { error: 'command is required', status: 'error' };
      const cwd = session.sandboxCwd || process.cwd();
      const timeout = args.timeout || 30000;
      try {
        const stdout = execSync(args.command, {
          cwd,
          timeout,
          maxBuffer: 1024 * 1024,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return { stdout: stdout.trim(), exitCode: 0, cwd, status: 'ok' };
      } catch (e: any) {
        return {
          stdout: (e.stdout || '').trim(),
          stderr: (e.stderr || '').trim(),
          exitCode: e.status || 1,
          cwd,
          status: e.status === 0 ? 'ok' : 'error',
        };
      }
    }

    default:
      return { error: `Unknown tool: ${name}`, status: 'error' };
  }
}
