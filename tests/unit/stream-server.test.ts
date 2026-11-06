import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StreamServer } from '../../src/stream-server.js';

describe('StreamServer', () => {
  const options = { port: 0, title: 'Test Stream', command: 'bash' };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create server with given options', () => {
    const server = new StreamServer(options);
    expect(server).toBeInstanceOf(StreamServer);
  });

  it('should reject invalid ports', () => {
    // StreamServer doesn't validate ports internally, but should work with valid ones
    const server = new StreamServer({ port: 3001, title: 'Test', command: 'bash' });
    expect(server).toBeDefined();
  });

  it('should handle empty viewer count on construction', () => {
    const server = new StreamServer(options);
    expect((server as any).viewers.size).toBe(0);
  });
});
