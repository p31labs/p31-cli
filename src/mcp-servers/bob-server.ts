/**
 * P31 BOB MCP Server — Ported from production/cli/bob-server.js
 * Building Ontology Bridge — Structural expert agent
 */

import fs from 'fs';
import path from 'path';

function readFileSafe(filePath: string) {
  try { return fs.readFileSync(path.resolve(filePath), 'utf-8'); } catch { return null; }
}

function findWranglerTOMLs() {
  const results: string[] = [];
  function walk(dir: string) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
        if (entry.isDirectory()) walk(full);
        else if (entry.name === 'wrangler.toml') results.push(full);
      }
    } catch {}
  }
  walk('.');
  return results;
}

function parseWranglerTOML(content: string) {
  const config: any = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const kvMatch = trimmed.match(/^(\w[\w-]*)\s*=\s*(.+)$/);
    if (kvMatch) {
      let [, key, value] = kvMatch;
      value = value.replace(/"/g, '').replace(/'/g, '');
      config[key] = value;
    }
  }
  config._services = [];
  const svcBlocks = content.match(/\[\[services\]\][\s\S]*?(?=\n\[|\n$|$)/g) || [];
  for (const block of svcBlocks) {
    const binding = block.match(/binding\s*=\s*"([^"]+)"/);
    const service = block.match(/service\s*=\s*"([^"]+)"/);
    if (binding && service) config._services.push({ binding: binding[1], service: service[1] });
  }
  config._d1 = [];
  const d1Blocks = content.match(/\[\[d1_databases\]\][\s\S]*?(?=\n\[|\n$|$)/g) || [];
  for (const block of d1Blocks) {
    const binding = block.match(/binding\s*=\s*"([^"]+)"/);
    const databaseName = block.match(/database_name\s*=\s*"([^"]+)"/);
    if (binding) config._d1.push({ binding: binding[1], database: databaseName ? databaseName[1] : 'unknown' });
  }
  return config;
}

function findAllMigrations() {
  const migrations: string[] = [];
  function walk(dir: string) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.sql') && /migrat/i.test(full)) migrations.push(full);
      }
    } catch {}
  }
  walk('.');
  return migrations;
}

function findAllMCPServers() {
  const servers: string[] = [];
  const known = ['cli/mcp-server.js', 'cli/component-registry.js', 'cli/love-registry.js', 'cli/cognitive-prosthetic.js', 'cli/cognitive-comms.js', 'cli/marge-server.js', 'tools/phos-forge/mcp-server.mjs'];
  for (const f of known) {
    if (fs.existsSync(path.resolve(f))) servers.push(f);
  }
  return servers;
}

export const BOB_TOOLS = [
  { name: 'structural_entropy_audit', description: 'Compute structural entropy, coupling, cohesion, and detect cycles.', inputSchema: { type: 'object', properties: { workers: { type: 'array', items: { type: 'string' } }, severity: { type: 'string', enum: ['warning', 'hard-fail'] } } } },
  { name: 'service_call_graph_visualise', description: 'Generate a Mermaid/DOT visualisation of the service call graph.', inputSchema: { type: 'object', properties: { format: { type: 'string', enum: ['mermaid', 'dot'] } } } },
  { name: 'schema_drift_detect', description: 'Detect schema drift between D1 migrations and codebase data models.', inputSchema: { type: 'object', properties: { database: { type: 'string' } } } },
  { name: 'contract_surface_audit', description: 'Audit all MCP server tool definitions for consistency.', inputSchema: { type: 'object', properties: { servers: { type: 'array', items: { type: 'string' } } } } },
  { name: 'state_machine_validate', description: 'Validate state machine definitions against implementation.', inputSchema: { type: 'object', properties: { state_machine: { type: 'string' } } } },
  { name: 'configuration_topology_audit', description: 'Audit wrangler.toml files for configuration drift.', inputSchema: { type: 'object', properties: {} } },
  { name: 'structural_suggest_fix', description: 'Suggest a fix for a structural violation.', inputSchema: { type: 'object', properties: { violation_id: { type: 'string' }, file: { type: 'string' } }, required: ['violation_id'] } },
  { name: 'structural_reshape', description: 'Apply structural fixes (dry-run by default).', inputSchema: { type: 'object', properties: { file: { type: 'string' }, dryRun: { type: 'boolean' } }, required: ['file'] } },
  { name: 'dependency_bump_detect', description: 'Detect outdated dependencies across workers.', inputSchema: { type: 'object', properties: { package: { type: 'string' } } } },
  { name: 'structural_report_generate', description: 'Generate a comprehensive structural health report.', inputSchema: { type: 'object', properties: { format: { type: 'string', enum: ['markdown', 'json'] } } } },
];

export function executeBobTool(name: string, args: any) {
  switch (name) {
    case 'structural_entropy_audit': {
      const tomls = findWranglerTOMLs();
      const configs: Record<string, any> = {};
      const allServices: any[] = [];
      const allD1: any[] = [];
      const graph: Record<string, string[]> = {};

      for (const toml of tomls) {
        const content = readFileSafe(toml);
        if (!content) continue;
        const workerName = path.dirname(toml).split("/").pop() || "unknown";
        if (args.workers && !args.workers.includes(workerName)) continue;
        const config = parseWranglerTOML(content);
        configs[workerName] = config;
        graph[workerName] = config._services.map((s: any) => s.service);
        allServices.push(...config._services);
        allD1.push(...config._d1.map((d: any) => ({ ...d, worker: workerName })));
      }

      const cycles: string[][] = [];
      const visited = new Set<string>();
      const inStack = new Set<string>();
      function dfs(node: string, path: string[]) {
        if (inStack.has(node)) { const cycleStart = path.indexOf(node); cycles.push(path.slice(cycleStart)); return; }
        if (visited.has(node)) return;
        visited.add(node);
        inStack.add(node);
        for (const next of (graph[node] || [])) dfs(next, [...path, next]);
        inStack.delete(node);
      }
      for (const node of Object.keys(graph)) dfs(node, [node]);

      const couplingScores: Record<string, number> = {};
      for (const [w, deps] of Object.entries(graph)) couplingScores[w] = deps.length;
      const avgCoupling = Object.values(couplingScores).length ? Object.values(couplingScores).reduce((a, b) => a + b, 0) / Object.values(couplingScores).length : 0;

      const cohesionScores: Record<string, number> = {};
      for (const [w, config] of Object.entries(configs)) cohesionScores[w] = (config._services || []).length + (config._d1 || []).length;
      const avgCohesion = Object.values(cohesionScores).length ? Object.values(cohesionScores).reduce((a, b) => a + b, 0) / Object.values(cohesionScores).length : 0;

      const depCounts: Record<string, number> = {};
      for (const deps of Object.values(graph)) for (const d of deps) depCounts[d] = (depCounts[d] || 0) + 1;
      const total = Object.values(depCounts).reduce((a, b) => a + b, 0) || 1;
      let entropy = 0;
      for (const count of Object.values(depCounts)) { const p = count / total; if (p > 0) entropy -= p * Math.log2(p); }
      const maxEntropy = Math.log2(Math.max(Object.keys(depCounts).length, 1));
      const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

      const inbound = new Set<string>();
      for (const deps of Object.values(graph)) for (const d of deps) inbound.add(d);
      const isolated = Object.keys(graph).filter(w => !graph[w]?.length && !inbound.has(w));

      const d1Shares: Record<string, string[]> = {};
      for (const d of allD1) { if (!d1Shares[d.database]) d1Shares[d.database] = []; d1Shares[d.database].push(d.worker); }
      const sharedD1 = Object.entries(d1Shares).filter(([_, workers]) => workers.length > 1);

      return { status: 'ok', workers: Object.keys(configs).length, entropy: Math.round(normalizedEntropy * 100) / 100, coupling: Math.round(avgCoupling * 100) / 100, cohesion: Math.round(avgCohesion * 100) / 100, cycles, isolated: isolated.map(w => ({ worker: w, reason: 'no inbound or outbound calls' })), sharedD1: sharedD1.map(([db, workers]) => ({ database: db, workers })) };
    }
    case 'service_call_graph_visualise': {
      const tomls = findWranglerTOMLs();
      const edges: any[] = [];
      for (const toml of tomls) {
        const content = readFileSafe(toml);
        if (!content) continue;
        const workerName = path.dirname(toml).split("/").pop() || "unknown";
        const config = parseWranglerTOML(content);
        for (const svc of config._services) edges.push({ from: workerName, to: svc.service, binding: svc.binding });
      }
      if (args.format === 'mermaid') {
        let mermaid = 'graph TD\n';
        for (const edge of edges) mermaid += `    ${edge.from} -->|${edge.binding}| ${edge.to}\n`;
        return { status: 'ok', format: 'mermaid', graph: mermaid, edges: edges.length };
      } else {
        let dot = 'digraph ServiceGraph {\n';
        for (const edge of edges) dot += `    "${edge.from}" -> "${edge.to}" [label="${edge.binding}"];\n`;
        dot += '}\n';
        return { status: 'ok', format: 'dot', graph: dot, edges: edges.length };
      }
    }
    case 'schema_drift_detect': {
      const migrations = findAllMigrations();
      const tables: Record<string, any> = {};
      const drift: any[] = [];
      for (const migration of migrations) {
        const content = readFileSafe(migration);
        if (!content) continue;
        const createMatches = content.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?\s*\(([\s\S]*?)\)/gi) || [];
        for (const match of createMatches) {
          const nameMatch = match.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?/i);
          if (nameMatch) {
            const tableName = nameMatch[1];
            const columns = match.match(/`?(\w+)`?\s+\w+/gi) || [];
            tables[tableName] = { columns: columns.map(c => c.split(/\s+/)[0].replace(/[`"]/g, '')), source: migration };
          }
        }
        if (/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i.test(content)) drift.push({ file: migration, type: 'non_idempotent', message: 'CREATE TABLE without IF NOT EXISTS', severity: 'warning' });
      }
      for (const [name, table] of Object.entries(tables)) {
        if (!table.columns.some((c: string) => /id|key|pk|primary/i.test(c))) drift.push({ table: name, type: 'missing_primary_key', message: `Table "${name}" has no obvious primary key`, severity: 'warning' });
        if (table.columns.length > 15) drift.push({ table: name, type: 'too_many_columns', message: `Table "${name}" has ${table.columns.length} columns`, severity: 'info' });
      }
      return { status: 'ok', tables: Object.keys(tables).length, drift };
    }
    case 'contract_surface_audit': {
      const mcpServers = args.servers || findAllMCPServers();
      const results: any[] = [];
      let totalTools = 0;
      let compliantTools = 0;
      for (const server of mcpServers) {
        const content = readFileSafe(server);
        if (!content) continue;
        const toolsMatch = content.match(/const TOOLS\s*=\s*\[([\s\S]*?)\];/);
        const toolsContent = toolsMatch ? toolsMatch[1] : '';
        const toolNameMatches = toolsContent.match(/name:\s*['"]([^'"]+)['"]/g) || [];
        const toolNames = toolNameMatches.map(m => m.match(/name:\s*['"]([^'"]+)['"]/)![1]);
        const nonSnakeCase = toolNames.filter(t => !/^[a-z][a-z0-9_]*$/.test(t));
        const hasSchemaCount = (toolsContent.match(/inputSchema/g) || []).length;
        const hasStatus = /status:\s*['"](?:ok|error)['"]/.test(content);
        const hasErrorHandling = /catch\s*\(|error.*response|isError/.test(content);
        const violations: any[] = [];
        if (nonSnakeCase.length > 0) violations.push({ rule: 'C-204', message: `Non snake_case tool names: ${nonSnakeCase.slice(0, 5).join(', ')}` });
        if (toolNames.length > 0 && hasSchemaCount < toolNames.length) violations.push({ rule: 'C-201', message: `Not all tools have inputSchema (${hasSchemaCount}/${toolNames.length})` });
        if (!hasStatus && toolNames.length > 0) violations.push({ rule: 'C-202', message: 'Missing status response pattern' });
        if (!hasErrorHandling && toolNames.length > 0) violations.push({ rule: 'C-203', message: 'Missing error handling' });
        totalTools += toolNames.length;
        compliantTools += toolNames.length - nonSnakeCase.length;
        results.push({ name: path.basename(server), file: server, tools: toolNames.length, nonSnakeCase, violations: violations.length, details: violations });
      }
      return { status: 'ok', servers: results.length, tools: totalTools, compliantTools, violations: totalTools - compliantTools, details: results };
    }
    case 'state_machine_validate': {
      const knownMachines: Record<string, any> = {
        care_contract: { states: ['proposed', 'active', 'settled', 'closed'], transitions: [{ from: 'proposed', to: 'active' }, { from: 'active', to: 'settled' }, { from: 'active', to: 'closed' }] },
        love_withdrawal: { states: ['requested', 'pending', 'completed', 'failed'], transitions: [{ from: 'requested', to: 'pending' }, { from: 'pending', to: 'completed' }, { from: 'pending', to: 'failed' }] },
        pilot_onboarding: { states: ['invited', 'enrolled', 'active', 'graduated'], transitions: [{ from: 'invited', to: 'enrolled' }, { from: 'enrolled', to: 'active' }, { from: 'active', to: 'graduated' }] },
      };
      if (args.state_machine && knownMachines[args.state_machine]) {
        const machine = knownMachines[args.state_machine];
        const terminalStates = machine.states.filter((s: string) => !machine.transitions.some((t: any) => t.from === s));
        const invalidTransitions = machine.transitions.filter((t: any) => !machine.states.includes(t.from) || !machine.states.includes(t.to));
        return { status: 'ok', state_machine: args.state_machine, states: machine.states, transitions: machine.transitions, terminalStates, invalidTransitions, valid: invalidTransitions.length === 0 };
      }
      const summary = Object.entries(knownMachines).map(([name, m]) => ({ name, states: m.states.length, transitions: m.transitions.length }));
      return { status: 'ok', known_machines: summary };
    }
    case 'configuration_topology_audit': {
      const tomls = findWranglerTOMLs();
      const workers: string[] = [];
      const allVars: Record<string, string[]> = {};
      const allSecrets: Record<string, string[]> = {};
      const d1Bindings: Record<string, string[]> = {};
      const crons: any[] = [];
      for (const toml of tomls) {
        const content = readFileSafe(toml);
        if (!content) continue;
        const workerName = path.dirname(toml).split("/").pop() || "unknown";
        const config = parseWranglerTOML(content);
        workers.push(workerName);
        for (const [k, v] of Object.entries(config._vars || {})) { if (!allVars[k]) allVars[k] = []; allVars[k].push(workerName); }
        const secretMatches = content.match(/secret_name\s*=\s*"([^"]+)"/g) || [];
        for (const m of secretMatches) { const name = m.match(/"([^"]+)"/)![1]; if (!allSecrets[name]) allSecrets[name] = []; allSecrets[name].push(workerName); }
        for (const d of (config._d1 || [])) { const dbName = d.database || "unknown"; if (!d1Bindings[dbName]) d1Bindings[dbName] = []; d1Bindings[dbName].push(workerName); }
        const cronMatch = content.match(/\[triggers\][\s\S]*?cron\s*=\s*"([^"]+)"/);
        if (cronMatch && cronMatch[1]) crons.push({ worker: workerName, cron: cronMatch[1] });
      }
      const sharedVars = Object.entries(allVars).filter(([_, workers]) => workers.length > 3).map(([name, workers]) => ({ name, workers }));
      const sharedD1 = Object.entries(d1Bindings).filter(([_, workers]) => workers.length > 5).map(([database, workers]) => ({ database, workers }));
      return { status: 'ok', workers: workers.length, d1Databases: Object.keys(d1Bindings).length, cronTriggers: crons.length, sharedVars, sharedD1, crons };
    }
    case 'structural_suggest_fix': {
      const fixes: Record<string, string> = {
        'S-001': 'Extract the cross-service call to an event bus or queue worker to break the cycle.',
        'S-002': 'Reduce call depth by caching results or using service bindings directly.',
        'S-003': 'Split into fewer service bindings; use D1 or KV for shared data.',
        'S-004': 'Add a GET /health endpoint to the target worker.',
        'S-005': 'Consider splitting the D1 database if >5 workers share it.',
        'S-006': 'Route cross-worker D1 reads through the owning worker\'s API.',
        'S-007': 'Add the worker to pnpm-workspace.yaml.',
        'S-008': 'Document the cron trigger in AGENTS.md.',
        'C-201': 'Add inputSchema to all tool definitions.',
        'C-202': 'Return { status: "ok" } or { status: "error" } from all tool handlers.',
        'C-203': 'Include an error string field in error responses.',
        'C-204': 'Rename tools to snake_case convention.',
        'C-205': 'Add a non-empty description to all tools.',
      };
      return { status: 'ok', violation_id: args.violation_id, suggestion: fixes[args.violation_id] || `No specific fix for ${args.violation_id}` };
    }
    case 'structural_reshape': {
      const content = readFileSafe(args.file);
      if (!content) return { status: 'error', error: `File not found: ${args.file}` };
      return { status: 'ok', file: args.file, changes: [], applied: false, note: 'Structural reshaping not yet implemented. Use suggest_fix for guidance.' };
    }
    case 'dependency_bump_detect': {
      const packageJsons: string[] = [];
      function walk(dir: string) {
        try {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.name === 'node_modules' || entry.name === '.git') continue;
            if (entry.isDirectory()) walk(full);
            else if (entry.name === 'package.json') packageJsons.push(full);
          }
        } catch {}
      }
      walk('.');
      const affected: any[] = [];
      for (const pj of packageJsons) {
        const content = readFileSafe(pj);
        if (!content) continue;
        try {
          const pkgJson = JSON.parse(content);
          const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
          if (args.package && allDeps[args.package]) affected.push({ worker: path.dirname(pj).split('/').pop(), file: pj, current: allDeps[args.package] });
        } catch {}
      }
      return { status: 'ok', package: args.package || '(all)', affected };
    }
    case 'structural_report_generate': {
      const entropy: any = executeBobTool('structural_entropy_audit', {});
      const contracts: any = executeBobTool('contract_surface_audit', {});
      const config: any = executeBobTool('configuration_topology_audit', {});
      const drift: any = executeBobTool('schema_drift_detect', {});
      if (args.format === 'markdown') {
        let md = '# Structural Health Report\n\n';
        md += `**Workers:** ${entropy.workers} | **MCP Tools:** ${contracts.tools} | **D1 Databases:** ${config.d1Databases}\n\n`;
        md += `## Service Graph\n- Entropy: ${entropy.entropy}\n- Avg Coupling: ${entropy.coupling}\n- Cycles: ${entropy.cycles.length}\n- Isolated Workers: ${entropy.isolated.length}\n\n`;
        md += `## Contracts\n- Tools: ${contracts.tools} (${contracts.compliantTools} compliant)\n- Violations: ${contracts.violations}\n\n`;
        md += `## Configuration\n- Cron Triggers: ${config.cronTriggers}\n- Shared D1: ${config.sharedD1.length}\n- Shared Vars: ${config.sharedVars.length}\n\n`;
        md += `## Schema Drift\n- Tables: ${drift.tables}\n- Drift Issues: ${drift.drift.length}\n`;
        return { status: 'ok', format: 'markdown', report: md };
      }
      return { status: 'ok', format: 'json', entropy, contracts, config, drift };
    }
    default:
      return { status: 'error', error: `Unknown tool: ${name}` };
  }
}
