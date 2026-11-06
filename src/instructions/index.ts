export type InstructionPrecedenceLevel = 1 | 2 | 3 | 4 | 5;
export interface InstructionSet {
  source: string;
  hash: string;
  precedenceLevel: InstructionPrecedenceLevel;
  loadedAt: string;
  content?: string;
}
export { loadInstructionSet } from './load.js';
