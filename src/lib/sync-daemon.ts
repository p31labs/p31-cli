/**
 * src/lib/sync-daemon.ts
 * Cross-app state sync daemon — keeps CLI config in sync with the shell's state.
 */

import { ShellBridge, type CrossAppState } from './shell-bridge.js';
import { loadConfig, saveConfig } from './config.js';
import type { P31Config, SpoonLevel } from '../types.js';
import { logger } from './logger.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SyncStatus {
  running: boolean;
  lastSync: number | null;
  direction: 'idle' | 'pushing' | 'pulling';
  errors: number;
}

export interface SyncEvent {
  timestamp: number;
  direction: 'local→shell' | 'shell→local';
  field: string;
  oldValue: any;
  newValue: any;
}

interface SyncFields {
  spoonLevel: SpoonLevel;
  theme: string;
}

// ── SyncDaemon ───────────────────────────────────────────────────────────────

const MAX_HISTORY = 100;

export class SyncDaemon {
  private bridge: ShellBridge;
  private running = false;
  private lastSync: number | null = null;
  private direction: SyncStatus['direction'] = 'idle';
  private errors = 0;
  private history: SyncEvent[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private unsubWs: (() => void) | null = null;
  private lastLocalSnapshot: SyncFields | null = null;

  constructor(baseUrl: string) {
    this.bridge = new ShellBridge(baseUrl);
  }

  // ── Public API ──────────────────────────────────────────────────────────

  start(): void {
    if (this.running) return;
    this.running = true;

    this.unsubWs = this.bridge.watchState((remote) => {
      this.applyRemoteState(remote);
    });

    this.pollTimer = setInterval(() => {
      this.pollLocalConfig();
    }, 2000);

    logger.info('sync-daemon: started');
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.unsubWs) {
      this.unsubWs();
      this.unsubWs = null;
    }
    this.direction = 'idle';
    logger.info('sync-daemon: stopped');
  }

  getStatus(): SyncStatus {
    return {
      running: this.running,
      lastSync: this.lastSync,
      direction: this.direction,
      errors: this.errors,
    };
  }

  getHistory(): SyncEvent[] {
    return [...this.history];
  }

  async pushLocal(): Promise<void> {
    this.direction = 'pushing';
    try {
      const config = await loadConfig();
      const state = this.configToState(config);
      const remote = await this.bridge.getState();
      if (remote) {
        this.recordEvents(remote, state, 'local→shell');
      }
      const delta: Partial<CrossAppState> = { spoons: state.spoonLevel };
      await this.bridge.setState(delta as any);
      this.lastSync = Date.now();
    } catch (err) {
      this.errors++;
      logger.error('sync-daemon: pushLocal failed', err);
    } finally {
      this.direction = 'idle';
    }
  }

  async pullRemote(): Promise<void> {
    this.direction = 'pulling';
    try {
      const remote = await this.bridge.getState();
      if (!remote) return;

      const config = await loadConfig();
      const localState = this.configToState(config);
      this.recordEvents(localState, remote, 'shell→local');

      await this.applyRemoteToConfig(config, remote);
      this.lastSync = Date.now();
    } catch (err) {
      this.errors++;
      logger.error('sync-daemon: pullRemote failed', err);
    } finally {
      this.direction = 'idle';
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private configToState(config: P31Config): SyncFields {
    return {
      spoonLevel: config.spoonLevel,
      theme: (config as any).theme || 'default',
    };
  }

  private async pollLocalConfig(): Promise<void> {
    try {
      const config = await loadConfig();
      const snapshot = this.configToState(config);

      if (this.lastLocalSnapshot) {
        const changes = this.diffFields(this.lastLocalSnapshot, snapshot);
        if (changes.length > 0) {
          this.direction = 'pushing';
          const delta: Partial<CrossAppState> = {};
          for (const field of changes) {
            const key = field as keyof CrossAppState;
            (delta as any)[key] = (snapshot as any)[field];
          }
          await this.bridge.setState(delta);
          this.lastSync = Date.now();
          this.direction = 'idle';
        }
      }

      this.lastLocalSnapshot = snapshot;
    } catch (err) {
      this.errors++;
      this.direction = 'idle';
      logger.error('sync-daemon: pollLocal failed', err);
    }
  }

  private applyRemoteState(remote: CrossAppState): void {
    this.direction = 'pulling';
    this.direction = 'idle';
  }

  private async applyRemoteToConfig(config: P31Config, remote: CrossAppState): Promise<void> {
    let dirty = false;

    if (remote.spoons !== undefined && remote.spoons !== config.spoonLevel) {
      this.history.push({
        timestamp: Date.now(),
        direction: 'shell→local',
        field: 'spoonLevel',
        oldValue: config.spoonLevel,
        newValue: remote.spoons,
      });
      config.spoonLevel = remote.spoons as SpoonLevel;
      dirty = true;
    }

    if (dirty) {
      await saveConfig(config);
    }
  }

  private diffFields(a: SyncFields, b: SyncFields): string[] {
    const changes: string[] = [];
    for (const key of Object.keys(a) as (keyof SyncFields)[]) {
      if (a[key] !== b[key]) {
        changes.push(key);
      }
    }
    return changes;
  }

  private recordEvents(
    oldState: { [k: string]: any },
    newState: { [k: string]: any },
    direction: SyncEvent['direction'],
  ): void {
    for (const key of Object.keys(newState)) {
      if (oldState[key] !== newState[key]) {
        this.pushEvent({
          timestamp: Date.now(),
          direction,
          field: key,
          oldValue: oldState[key],
          newValue: newState[key],
        });
      }
    }
  }

  private pushEvent(event: SyncEvent): void {
    this.history.push(event);
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY);
    }
  }
}
