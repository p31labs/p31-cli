/**
 * Compound Orchestrator Tools — Programmatic tool calling
 *
 * Reduces context pressure by running multi-tool chains internally
 * and returning compact verdicts instead of intermediate results.
 */

import { executeOasisTool } from './oasis-server.js';
import { executeCognitiveTool } from './cognitive-prosthetic.js';

export const COMPOUND_TOOLS = [
  {
    name: 'assess_capacity',
    description: 'Combines spoon state, time estimation, and crisis-signal scanning into a single capacity verdict. Returns a recommended work mode (full, reduced, or rest) with a time box. Use instead of calling oasis_status, time_estimate, and crisis_check separately.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'What you are about to work on' },
        complexity: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Task complexity' },
      },
      required: ['task'],
    },
  },
  {
    name: 'plan_next_block',
    description: 'Plans the next work block by combining next_action, time_estimate, and schedule_chunk into a single time-boxed recommendation. Use instead of chaining those three tools.',
    inputSchema: {
      type: 'object',
      properties: {
        tasks: { type: 'array', items: { type: 'string' }, description: 'List of pending tasks' },
        complexity: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Task complexity' },
      },
      required: ['tasks'],
    },
  },
];

export function executeCompoundTool(name: string, args: any): any {
  if (name === 'assess_capacity') {
    const status: any = executeOasisTool('oasis_status', {});
    const estimate: any = executeCognitiveTool('time_estimate', {
      task: args.task,
      complexity: args.complexity || 'medium',
      spoons: status.spoons ?? 3,
    });
    const crisis: any = executeCognitiveTool('crisis_check', { message: args.task });
    const crisisFlags = crisis?.result?.flags || [];
    const mode = crisisFlags.length > 0 ? 'rest' : (status.spoons ?? 3) <= 2 ? 'reduced' : 'full';
    return {
      status: 'ok',
      verdict: {
        mode,
        estimated_minutes: estimate?.result?.estimate_minutes ?? 15,
        crisis_flags: crisisFlags,
        spoons: status.spoons ?? 3,
      },
      recommended_block: mode === 'rest' ? null : {
        task: args.task,
        minutes: Math.min(25, estimate?.result?.estimate_minutes ?? 15),
      },
    };
  }

  if (name === 'plan_next_block') {
    const next: any = executeCognitiveTool('next_action', { tasks: args.tasks || [] });
    const estimate: any = executeCognitiveTool('time_estimate', {
      task: next?.next || 'next task',
      complexity: args.complexity || 'medium',
      spoons: 3,
    });
    const chunk: any = executeCognitiveTool('schedule_chunk', {
      task: next?.next || 'next task',
      minutes: Math.min(25, estimate?.result?.estimate_minutes ?? 15),
    });
    return {
      status: 'ok',
      next_action: next?.next,
      remaining: next?.remaining ?? 0,
      time_estimate: estimate?.result?.estimate_minutes ?? 15,
      recommended_block: chunk?.result || chunk,
    };
  }

  return { status: 'error', error: `Unknown compound tool: ${name}` };
}
