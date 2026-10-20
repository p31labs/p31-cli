/**
 * src/plugins/spoon-monitor.ts
 * Spoon-monitor plugin — tracks cognitive state, adjusts UI.
 */

import type { Plugin } from '@opencode-ai/plugin';

export const SpoonMonitorPlugin: Plugin = async () => {
  return {
    'session.created': async (event: any) => {
      const spoonLevel = event?.session?.metadata?.spoonLevel || 3;
      if (spoonLevel <= 1) {
        console.log('[spoon-monitor] Crisis mode active — minimal UI enabled');
      }
    },
    'tool.execute.before': async (input: any) => input,
    'session.updated': async (event: any) => {
      const level = event?.session?.metadata?.spoonLevel || 3;
      const displayMode = level <= 1 ? 'crisis' : level === 3 ? 'minimal' : 'full';
      console.log(`[spoon-monitor] Display mode: ${displayMode}`);
    },
  } as any;
};
