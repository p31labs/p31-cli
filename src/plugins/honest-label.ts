/**
 * src/plugins/honest-label.ts
 * Honest label plugin — flags contested science in tool outputs.
 */

import type { Plugin } from '@opencode-ai/plugin';

const CONTESTED_TOPICS: Record<string, { status: string; note: string }> = {
  'sic-povm': { status: 'contested', note: 'SIC-POVM quantum geometry applications remain theoretical; no peer-reviewed experimental verification in care contexts.' },
  'k4-mesh-rigidity': { status: 'verified', note: 'K4 isostatic rigidity verified via computational graph analysis (CWP-2026-015).' },
  'love-hash-chain': { status: 'verified', note: 'SHA-256 hash chain implemented in production (love-ledger migration 002).' },
  'posner-molecule': { status: 'contested', note: 'Posner molecule quantum coherence in neural calcium signaling is a hypothesis; see QF1_CONTESTED_SCIENCE.md.' },
  'quantum-biology': { status: 'contested', note: 'Quantum effects in biological systems remain an active research area with limited experimental evidence.' },
};

export const HonestLabelPlugin: Plugin = async () => {
  return {
    'tool.execute.after': async (input: any, output: any) => {
      if (!output || !output.content) return output;
      const text = output.content.map((c: any) => c.text || '').join(' ').toLowerCase();
      const labels: string[] = [];
      for (const [topic, info] of Object.entries(CONTESTED_TOPICS)) {
        if (text.includes(topic.replace('-', ' ')) || text.includes(topic)) {
          labels.push(`[${info.status.toUpperCase()}] ${topic}: ${info.note}`);
        }
      }
      if (labels.length > 0) {
        const warning = { type: 'text', text: '\n\n⚠️ HONEST LABELS:\n' + labels.map((l) => `  • ${l}`).join('\n') };
        return { ...output, content: [...(output.content || []), warning] } as any;
      }
      return output;
    },
  } as any;
};
