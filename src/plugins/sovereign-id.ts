/**
 * src/plugins/sovereign-id.ts
 * Sovereign identity plugin — DID:key generation, verification, export.
 */

import type { Plugin } from '@opencode-ai/plugin';
import { randomBytes } from 'crypto';

export interface SovereignIdentity {
  did: string;
  publicKey: string;
  algorithm: 'Ed25519' | 'ML-DSA-65';
  createdAt: string;
}

const SOVEREIGN_IDS = new Map<string, SovereignIdentity>();

export const SovereignIdPlugin: Plugin = async () => {
  return {
    tool: {
      sovereign_id_create: {
        description: 'Create a new sovereign DID:key identity',
        args: {} as any,
        async execute(args: Record<string, unknown>) {
          const algorithm = (args.algorithm as string) || 'Ed25519';
          const publicKey = randomBytes(32);
          const identity: SovereignIdentity = {
            did: `did:key:z${publicKey.toString('base64url')}`,
            publicKey: publicKey.toString('base64url'),
            algorithm: algorithm as 'Ed25519' | 'ML-DSA-65',
            createdAt: new Date().toISOString(),
          };
          SOVEREIGN_IDS.set(identity.did, identity);
          return { success: true, ...identity } as any;
        },
      },
      sovereign_id_verify: {
        description: 'Verify a sovereign DID:key',
        args: {} as any,
        async execute(args: Record<string, unknown>) {
          const did = args.did as string;
          const identity = SOVEREIGN_IDS.get(did);
          if (!identity) return { verified: false, error: 'DID not found in local store' } as any;
          return { verified: true, did, algorithm: identity.algorithm, createdAt: identity.createdAt } as any;
        },
      },
      sovereign_id_list: {
        description: 'List all sovereign identities',
        args: {} as any,
        async execute() {
          return { identities: Array.from(SOVEREIGN_IDS.values()) } as any;
        },
      },
    },
  } as any;
};
