#!/usr/bin/env node
/**
 * L9 demo helper: print deployment-mode summary (mode, policy, theme env default).
 * Run: P31_DEPLOYMENT_MODE=airgap npx tsx scripts/l9-demo-deployment.ts
 */
import { formatDeploymentSummary, getDeploymentSummary } from '../src/lib/deployment.js';

console.log(formatDeploymentSummary(getDeploymentSummary()));
