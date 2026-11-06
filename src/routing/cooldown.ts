/**
 * src/routing/cooldown.ts — CooldownManager with failure-type-aware cooldown taxonomy.
 *
 * L1.2 — Cooldown taxonomy:
 *   429 (rate limit) → 30 seconds
 *   timeout/hang → 15 minutes
 *   daily quota exhausted → 1 hour
 *   401/403 (rejected key) → 6 hours
 *   repeated failures → exponential backoff (double each time)
 */

export type ErrorClass = '429' | 'timeout' | 'quota' | '401' | '403' | 'none';

const BASE_SECONDS: Record<Exclude<ErrorClass, 'none'>, number> = {
  '429': 30,
  timeout: 60 * 15,   // 15 minutes
  quota: 60 * 60,     // 1 hour
  '401': 6 * 60 * 60, // 6 hours
  '403': 6 * 60 * 60, // 6 hours
} as const;

export interface HealthState {
  lastCheckMs: number;
  failures: number;
  lastFailureAtMs: number;
  cooldownUntilMs: number;
}

export interface CooldownRecord {
  modelKey: string;
  errorClass: Exclude<ErrorClass, 'none'>;
  failureCount: number;
  untilMs: number;
}

export class CooldownManager {
  private records = new Map<string, CooldownRecord>();

  private now(): number {
    return Date.now();
  }

  /**
   * Returns true if the model key is currently cooling down from any failure type.
   */
  isCoolingDown(modelKey: string): boolean {
    const rec = this.records.get(modelKey);
    if (!rec) return false;
    if (this.now() < rec.untilMs) return true;
    this.records.delete(modelKey);
    return false;
  }

  /**
   * Returns true if the model key is cooling down specifically for this error class.
   */
  isCoolingDownFor(modelKey: string, errorClass: ErrorClass): boolean {
    if (errorClass === 'none') return false;
    const rec = this.records.get(modelKey);
    if (!rec) return false;
    if (rec.errorClass !== errorClass) return false;
    if (this.now() < rec.untilMs) return true;
    this.records.delete(modelKey);
    return false;
  }

  /**
   * Seconds to wait for a given error class on a first occurrence.
   */
  getCooldownSeconds(errorClass: ErrorClass): number {
    if (errorClass === 'none') return 0;
    return BASE_SECONDS[errorClass];
  }

  /**
   * Record a failure for a model key. If the same error class recurs, double
   * cooldown (exponential backoff). Returns the next cooldown until timestamp.
   */
  recordFailure(modelKey: string, errorClass: Exclude<ErrorClass, 'none'>): number {
    const existing = this.records.get(modelKey);
    const baseSeconds = BASE_SECONDS[errorClass];

    let seconds: number;
    if (existing && existing.errorClass === errorClass) {
      // Exponential backoff: double previous cooldown
      const prevSeconds = Math.max(existing.untilMs - this.now(), baseSeconds) / 1000;
      seconds = Math.ceil(prevSeconds * 2);
    } else {
      seconds = baseSeconds;
    }

    const untilMs = this.now() + seconds * 1000;
    this.records.set(modelKey, {
      modelKey,
      errorClass,
      failureCount: (existing?.failureCount ?? 0) + 1,
      untilMs,
    });

    return untilMs;
  }

  recordSuccess(modelKey: string): void {
    this.records.delete(modelKey);
  }

  getHealthState(modelKey: string): HealthState {
    const rec = this.records.get(modelKey);
    if (!rec) {
      return {
        lastCheckMs: this.now(),
        failures: 0,
        lastFailureAtMs: 0,
        cooldownUntilMs: 0,
      };
    }
    return {
      lastCheckMs: this.now(),
      failures: rec.failureCount,
      lastFailureAtMs: rec.untilMs - (this.getCooldownSeconds(rec.errorClass) * 1000),
      cooldownUntilMs: rec.untilMs,
    };
  }

  clearAll(): void {
    this.records.clear();
  }
}

export function classifyError(err: Error): ErrorClass | null {
  const msg = err.message.toLowerCase();
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) {
    return '429';
  }
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('hang')) {
    return 'timeout';
  }
  if (msg.includes('quota') || msg.includes('exhausted') || msg.includes('daily limit')) {
    return 'quota';
  }
  if (msg.includes('401') || msg.includes('invalid api key') || msg.includes('unauthorized')) {
    return '401';
  }
  if (msg.includes('403') || msg.includes('permission denied') || msg.includes('forbidden')) {
    return '403';
  }
  return null;
}
