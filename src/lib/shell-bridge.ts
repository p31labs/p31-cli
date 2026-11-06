/**
 * src/lib/shell-bridge.ts
 * HTTP/WebSocket client for the P31 production shell MCP ecosystem.
 * Uses native fetch — zero external dependencies.
 */

import { logger } from './logger.js';

// ── Types ────────────────────────────────────────────────────────────────────

type PartialDeep<T> = {
  [K in keyof T]?: T[K] extends object ? PartialDeep<T[K]> : T[K];
};

export interface CrossAppState {
  spoons: number;
  sensory: {
    muted: boolean;
    calm: boolean;
    warmLight: boolean;
    font: string;
    textScale: number;
  };
  dataset?: string;
  source?: string;
  timestamp?: number;
}

// ── ShellBridge ──────────────────────────────────────────────────────────────

export class ShellBridge {
  private baseUrl: string;
  private ws: WebSocket | null = null;
  private wsCallbacks = new Set<(state: CrossAppState) => void>();
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  // ── HTTP methods ─────────────────────────────────────────────────────────

  async getState(): Promise<CrossAppState | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/shell-state`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as CrossAppState;
    } catch (err) {
      logger.error('shell-bridge: getState failed', err);
      return null;
    }
  }

  async setState(delta: PartialDeep<CrossAppState>): Promise<CrossAppState | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/shell-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(delta),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as CrossAppState;
    } catch (err) {
      logger.error('shell-bridge: setState failed', err);
      return null;
    }
  }

  async health(): Promise<{ status: string } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as { status: string };
    } catch (err) {
      logger.error('shell-bridge: health check failed', err);
      return null;
    }
  }

  // ── WebSocket subscription ───────────────────────────────────────────────

  watchState(callback: (state: CrossAppState) => void): () => void {
    this.wsCallbacks.add(callback);
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.connectWs();
    }
    return () => {
      this.wsCallbacks.delete(callback);
      if (this.wsCallbacks.size === 0) {
        this.disconnectWs();
      }
    };
  }

  private connectWs(): void {
    if (this.closed) return;
    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/ws/state';
    try {
      this.ws = new WebSocket(wsUrl);
    } catch (err) {
      logger.error('shell-bridge: WebSocket connect failed', err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      logger.info('shell-bridge: WebSocket connected');
      this.reconnectDelay = 1000;
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.type === 'state' && msg.state) {
          for (const cb of this.wsCallbacks) cb(msg.state);
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onerror = (event: Event) => {
      logger.error('shell-bridge: WebSocket error', event);
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (!this.closed && this.wsCallbacks.size > 0) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    logger.debug(`shell-bridge: reconnecting in ${this.reconnectDelay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWs();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  private disconnectWs(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  close(): void {
    this.closed = true;
    this.disconnectWs();
    this.wsCallbacks.clear();
  }
}
