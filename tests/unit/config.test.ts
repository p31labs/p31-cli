import { describe, it, expect } from 'vitest';
import { defaultConfig, SPOON_LEVELS } from '../../src/lib/config.js';

describe('config', () => {
  it('should return default config with spoon level STANDARD', () => {
    const config = defaultConfig();
    expect(config.spoonLevel).toBe(SPOON_LEVELS.STANDARD);
    expect(config.sessionId).toBeDefined();
    expect(config.sessionId.length).toBe(8);
    expect(config.projectRoot).toBeDefined();
    expect(config.mcpServerUrl).toBe('http://localhost:3000/mcp');
    expect(config.websocketPort).toBe(3001);
    expect(config.model).toBe('deepseek-v4-flash');
  });

  it('should have correct spoon level constants', () => {
    expect(SPOON_LEVELS.MINIMAL).toBe(1);
    expect(SPOON_LEVELS.STANDARD).toBe(3);
    expect(SPOON_LEVELS.FULL).toBe(5);
  });
});
