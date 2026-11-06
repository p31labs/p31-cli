/**
 * Family Safety Guardrails — P31 Sovereign Family
 *
 * Built from the @gonzih/parental-control blueprint.
 * Intercepts every message with check_message, classifies (regex first, LLM second),
 * and returns allow / notify / hold_for_approval / block.
 *
 * Three-pillar frame:
 *   Protect  — tool allowlists per age profile, content classification
 *   Connect  — parent notification, dashboard, consent notice
 *   Resist   — parasocial guard, spiral detection, curfew enforcement
 */

// ─── Age Profiles ────────────────────────────────────────────────────────────

export type AgeProfile = 'child' | 'teen' | 'adult';

export interface ProfileConfig {
  label: string;
  maxAge: number;
  toolAllowlist: string[];
  contentThreshold: 'strict' | 'moderate' | 'permissive';
  curfewStart: number; // hour (0-23)
  curfewEnd: number;   // hour (0-23)
  dailyTurnCap: number;
}

export const AGE_PROFILES: Record<AgeProfile, ProfileConfig> = {
  child: {
    label: 'Child (5-12)',
    maxAge: 12,
    toolAllowlist: ['phos_learn', 'phos_watch', 'bus_emit'],
    contentThreshold: 'strict',
    curfewStart: 20,
    curfewEnd: 7,
    dailyTurnCap: 50,
  },
  teen: {
    label: 'Teen (13-17)',
    maxAge: 17,
    toolAllowlist: ['phos_learn', 'phos_watch', 'bus_emit', 'jitterbug_run', 'phos_adopt'],
    contentThreshold: 'moderate',
    curfewStart: 22,
    curfewEnd: 6,
    dailyTurnCap: 100,
  },
  adult: {
    label: 'Adult (18+)',
    maxAge: 999,
    toolAllowlist: ['oasis_execute', 'phos_adopt', 'jitterbug_run', 'phos_learn', 'phos_deploy', 'phos_watch', 'healer_remediate', 'bus_emit', 'phos_rollback'],
    contentThreshold: 'permissive',
    curfewStart: 0,
    curfewEnd: 0,
    dailyTurnCap: 500,
  },
};

// ─── Classification ─────────────────────────────────────────────────────────

export type Decision = 'allow' | 'notify' | 'hold_for_approval' | 'block';

export interface ClassificationResult {
  decision: Decision;
  category: string;
  confidence: number;
  reason: string;
}

// Regex-first classification patterns
const CRISIS_PATTERNS = [
  /\b(suicid|self.harm|kill myself|end my life|want to die)\b/i,
  /\b(cut myself|hurt myself|self.injur)\b/i,
];

const PARASOCIAL_PATTERNS = [
  /\b(you're my only friend|you're the only one who understands|I love you|marry me)\b/i,
  /\b(don't tell (my )?(parents|mom|dad)|our secret)\b/i,
];

const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/i, // email
  /\b\d{10,}\b/, // phone number (10+ digits)
];

export function checkMessage(content: string, role: 'user' | 'assistant', profile: AgeProfile): ClassificationResult {
  // 1. Crisis check (always hold, regardless of age)
  for (const pattern of CRISIS_PATTERNS) {
    if (pattern.test(content)) {
      return {
        decision: 'hold_for_approval',
        category: 'crisis',
        confidence: 0.95,
        reason: 'Crisis content detected — held for parent approval',
      };
    }
  }

  // 2. Parasocial guard
  for (const pattern of PARASOCIAL_PATTERNS) {
    if (pattern.test(content)) {
      return {
        decision: 'notify',
        category: 'parasocial',
        confidence: 0.85,
        reason: 'Parasocial boundary detected — parent notified',
      };
    }
  }

  // 3. PII detection
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(content)) {
      return {
        decision: 'notify',
        category: 'pii',
        confidence: 0.9,
        reason: 'PII detected — parent notified, classification routed locally',
      };
    }
  }

  // 4. Age-appropriate content check (simplified)
  const config = AGE_PROFILES[profile];
  if (config.contentThreshold === 'strict') {
    // Additional strict checks for children
    if (/\b(violence|weapon|drug|alcohol|gambling)\b/i.test(content)) {
      return {
        decision: 'block',
        category: 'age_inappropriate',
        confidence: 0.8,
        reason: 'Content not appropriate for child profile',
      };
    }
  }

  return {
    decision: 'allow',
    category: 'safe',
    confidence: 0.95,
    reason: 'Message classified as safe',
  };
}

// ─── Spiral Detection ────────────────────────────────────────────────────────

export interface SpiralState {
  consecutiveNegative: number;
  lastEscalation: number | null;
}

export function updateSpiralState(state: SpiralState, content: string): SpiralState {
  const negativePatterns = /\b(sad|depressed|hopeless|worthless|alone|scared|anxious|panic)\b/i;
  if (negativePatterns.test(content)) {
    return {
      consecutiveNegative: state.consecutiveNegative + 1,
      lastEscalation: state.lastEscalation,
    };
  }
  return { consecutiveNegative: 0, lastEscalation: state.lastEscalation };
}

export function shouldEscalate(state: SpiralState, threshold: number = 3): boolean {
  return state.consecutiveNegative >= threshold;
}

// ─── Curfew & Daily Limits ───────────────────────────────────────────────────

export interface SessionTracker {
  profile: AgeProfile;
  turnsToday: number;
  lastReset: number; // epoch ms
  curfewActive: boolean;
}

export function isCurfewActive(tracker: SessionTracker): boolean {
  const config = AGE_PROFILES[tracker.profile];
  if (config.curfewStart === 0 && config.curfewEnd === 0) return false; // no curfew for adults
  const hour = new Date().getHours();
  if (config.curfewStart > config.curfewEnd) {
    // Overnight curfew (e.g., 20:00 - 07:00)
    return hour >= config.curfewStart || hour < config.curfewEnd;
  }
  // Daytime curfew (unlikely but supported)
  return hour >= config.curfewStart && hour < config.curfewEnd;
}

export function isDailyLimitExceeded(tracker: SessionTracker): boolean {
  const config = AGE_PROFILES[tracker.profile];
  return tracker.turnsToday >= config.dailyTurnCap;
}

// ─── Tool Allowlist ──────────────────────────────────────────────────────────

export function isToolAllowed(toolName: string, profile: AgeProfile): boolean {
  return AGE_PROFILES[profile].toolAllowlist.includes(toolName);
}

// ─── Consent Notice ──────────────────────────────────────────────────────────

export function getConsentNotice(profile: AgeProfile): string {
  const notices: Record<AgeProfile, string> = {
    child: 'Your parent can see this conversation to help keep you safe. If something feels wrong, tell a trusted adult.',
    teen: 'A parent or guardian may review this conversation for safety. You can ask them to stop monitoring at any time.',
    adult: 'This conversation is private. No monitoring is enabled.',
  };
  return notices[profile];
}

// ─── Parent Notification ────────────────────────────────────────────────────

export interface ParentAlert {
  timestamp: string;
  category: string;
  decision: Decision;
  summary: string;
  childProfile: AgeProfile;
}

export function createParentAlert(result: ClassificationResult, profile: AgeProfile): ParentAlert {
  return {
    timestamp: new Date().toISOString(),
    category: result.category,
    decision: result.decision,
    summary: result.reason,
    childProfile: profile,
  };
}

// ─── Safe Deflection ─────────────────────────────────────────────────────────

export function getSafeDeflection(category: string): string {
  const deflections: Record<string, string> = {
    crisis: "I'm here to help, but I think this is something a trusted adult should know about. Would you like me to help you reach someone?",
    age_inappropriate: "That's not something I can help with. Let's talk about something else!",
    parasocial: "I'm an AI assistant, and I want to make sure you have real people in your life to talk to. Have you spoken with a parent or friend about this?",
  };
  return deflections[category] ?? "I can't help with that. Let's try something else.";
}
