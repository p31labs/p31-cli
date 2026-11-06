#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function sha256(s){return createHash('sha256').update(s,'utf8').digest('hex');}
function canonicalize(s){return s.replace(/\r\n/g,'\n').trimEnd()+'\n';}

function loadInstructionSet(agentId) {
  const candidates = [
    { level: 1, path: path.join(root,'src/safety/guard-policy.json') },
    { level: 2, path: '/home/p31/production/AGENTS.md' },
    { level: 3, path: path.join(root,'AGENTS.md') },
    { level: 4, path: path.join(root,`agents/${agentId}.json`) },
    { level: 5, path: path.join(process.env.HOME||'/home/p31','.p31/cli-session.json') },
  ];
  let selected = null;
  for (const c of candidates) {
    if (selected && c.level >= selected.level) continue;
    if (fs.existsSync(c.path)) selected = { ...c, content: fs.readFileSync(c.path,'utf8') };
  }
  if (!selected) return { source:'builtin:fallback', hash: sha256(`agent:${agentId}`), precedenceLevel:5, agentId };
  return { agentId, source: selected.path, precedenceLevel: selected.level, hash: sha256(canonicalize(selected.content)), loadedAt: new Date().toISOString() };
}

const agents = ['build','plan','scout'];
console.log('=== Instruction Dry-Run (L3) ===\n');
const sets = agents.map(a => loadInstructionSet(a));
for (const s of sets) console.log(JSON.stringify(s, null, 2));

// model-name check in manifests
const agentsDir = path.join(root,'agents');
const manifests = fs.readdirSync(agentsDir).filter(f=>f.endsWith('.json') && f!=='manifest-schema.json');
let modelNameFound = false;
const forbidden = /"model"\s*:|"modelName"\s*:|claude-|gpt-|gemini-2|deepseek-v4|llama-3/i;
for (const m of manifests) {
  const txt = fs.readFileSync(path.join(agentsDir,m),'utf8');
  if (forbidden.test(txt)) { console.log(`FAIL: model name found in ${m}`); modelNameFound = true; }
}
console.log(`\nModel names in agent manifests: ${modelNameFound ? 'FOUND (FAIL)' : 'NONE (PASS)'}`);

// same bucket equivalence demo
const bucketOf = (a)=>JSON.parse(fs.readFileSync(path.join(agentsDir,`${a}.json`),'utf8')).bucket;
console.log(`\nbuild bucket=${bucketOf('build')} scout bucket=${bucketOf('scout')} plan bucket=${bucketOf('plan')}`);
console.log('Agents sharing a bucket resolve via the same capability contract under model churn (router resolves model).');
