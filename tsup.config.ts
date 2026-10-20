import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'mcp-bridge': 'src/mcp-bridge.ts',
    'mcp-http': 'src/mcp-http.ts',
    'stream-server': 'src/stream-server.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node22',
  splitting: false,
  outDir: 'dist',
  shims: true,
  cjsInterop: true,
  external: [
    'better-sqlite3',
    'node-pty',
  ],
});
