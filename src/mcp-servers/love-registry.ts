/**
 * P31 LOVE Ledger MCP Server — Ported from production/cli/love-registry.js
 * Exposes LOVE ledger state via MCP for agent consumption.
 */

import { execFileSync } from 'child_process';

const LOVE_LEDGER_URL = process.env.LOVE_LEDGER_URL || 'https://love-ledger.p31ca.org';

function fetchJSON(url: string) {
  const script = [
    'const https=require("https"),http=require("http");',
    'const u=new URL(process.argv[1]);',
    'const mod=u.protocol==="https:"?https:http;',
    'mod.get(u,{timeout:8000},r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>process.stdout.write(d)})',
    '.on("error",()=>process.exit(1))'
  ].join('');
  try {
    const raw = execFileSync('node', ['-e', script, url], { timeout: 10000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    return JSON.parse(raw);
  } catch (e: any) {
    return { _error: `HTTP error: ${e.message}` };
  }
}

export const LOVE_TOOLS = [
  {
    name: 'love_status',
    description: 'Get LOVE ledger status — total LOVE, care_score, pools, vesting',
    inputSchema: { type: 'object', properties: { userId: { type: 'string', description: 'DID key or device ID' } } }
  },
  {
    name: 'love_balance',
    description: 'Get LOVE balance for a user',
    inputSchema: { type: 'object', properties: { userId: { type: 'string' } } }
  },
  {
    name: 'love_sync',
    description: 'Sync local LOVE state with the cloud ledger',
    inputSchema: { type: 'object', properties: { userId: { type: 'string' } } }
  },
  {
    name: 'love_anchor',
    description: 'Anchor a LOVE ledger entry hash on-chain via P31TransparencyAnchor (Base Sepolia). Returns the broadcast tx hash.',
    inputSchema: {
      type: 'object',
      properties: {
        entryHash: { type: 'string', description: '0x-prefixed 32-byte hash of the ledger entry' },
        uri: { type: 'string', description: 'Manifest URI' }
      },
      required: ['entryHash']
    }
  }
];

export function executeLoveTool(name: string, args: any) {
  const userId = args.userId || process.env.P31_USER_ID || 'guest';
  switch (name) {
    case 'love_status': {
      const url = `${LOVE_LEDGER_URL}/status?did=${encodeURIComponent(userId)}`;
      const result = fetchJSON(url);
      return result._error ? { error: result._error, status: 'error' } : { ...result, status: 'ok' };
    }
    case 'love_balance': {
      const url = `${LOVE_LEDGER_URL}/balance?did=${encodeURIComponent(userId)}`;
      const result = fetchJSON(url);
      return result._error ? { error: result._error, status: 'error' } : { balance: result, status: 'ok' };
    }
    case 'love_sync': {
      const url = `${LOVE_LEDGER_URL}/chain?did=${encodeURIComponent(userId)}`;
      const result = fetchJSON(url);
      return result._error ? { error: result._error, status: 'error' } : { synced: true, chain: result, status: 'ok' };
    }
    case 'love_anchor': {
      const entryHash = args.entryHash;
      if (!entryHash || !/^0x[0-9a-fA-F]{64}$/.test(entryHash)) {
        return { error: 'entryHash must be a 0x-prefixed 64-char hex string', status: 'error' };
      }
      const uri = args.uri || `https://love-ledger.p31ca.org/chain?did=${encodeURIComponent(userId)}`;
      const bridgeUrl = process.env.LEDGER_BRIDGE_URL || 'https://ledger-bridge.trimtab-signal.workers.dev';
      const script = [
        'const https=require("https");',
        'const d=JSON.stringify({entryHash:process.argv[1],uri:process.argv[2]});',
        'const o={hostname:new URL(process.argv[3]).hostname,path:"/anchor",method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(d)}};',
        'const r=https.request(o,res=>{let b="";res.on("data",c=>b+=c);res.on("end",()=>process.stdout.write(b))});',
        'r.on("error",e=>{process.stdout.write(JSON.stringify({error:String(e.message),status:"error"}))});',
        'r.write(d);r.end();'
      ].join('');
      try {
        const raw = execFileSync('node', ['-e', script, entryHash, uri, bridgeUrl], { timeout: 15000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
        const parsed = JSON.parse(raw);
        return { ...parsed, status: parsed.ok ? 'ok' : 'error', explorer: `https://sepolia.basescan.org/tx/${parsed.txHash}` };
      } catch (e: any) {
        return { error: `Bridge error: ${e.message}`, status: 'error' };
      }
    }
    default:
      return { error: `Unknown tool: ${name}`, status: 'error' };
  }
}
