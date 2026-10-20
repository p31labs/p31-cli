/**
 * src/plugins/index.ts
 * Barrel export for all P31 opencode plugins.
 */

export { SpoonMonitorPlugin } from './spoon-monitor.js';
export { SovereignIdPlugin } from './sovereign-id.js';
export { CareAttestPlugin } from './care-attest.js';
export { PQCToolsPlugin } from './pqc-tools.js';
export { MeshVisualizePlugin } from './mesh-visualize.js';
export { HonestLabelPlugin } from './honest-label.js';
export { PermissionSyncPlugin } from './permission-sync.js';

export const P31_PLUGINS = [
  'spoon-monitor',
  'sovereign-id',
  'care-attest',
  'pqc-tools',
  'mesh-visualize',
  'honest-label',
  'permission-sync',
] as const;
