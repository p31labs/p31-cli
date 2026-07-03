import WebSocket from 'ws';
import { createServer, type Server as HTTPServer } from 'http';
import { randomUUID } from 'crypto';
import { type IPty } from 'node-pty';

const WSServer = (WebSocket as any).Server as new (opts: any) => any;

interface Viewer {
  id: string;
  ws: WebSocket;
  name: string;
}

interface StreamServerOptions {
  port: number;
  title: string;
  command: string;
}

export class StreamServer {
  private viewers: Map<string, Viewer> = new Map();
  private httpServer: HTTPServer | null = null;
  private wss: InstanceType<typeof WSServer> | null = null;
  private pty: IPty | null = null;
  private readonly options: StreamServerOptions;

  constructor(options: StreamServerOptions) {
    this.options = options;
  }

  async start(): Promise<void> {
    const { port, title, command } = this.options;

    this.httpServer = createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);

      if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          viewers: this.viewers.size,
          title,
          started: (this.httpServer as any).startTime,
        }));
        return;
      }

      if (url.pathname === '/stats') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          viewers: this.viewers.size,
          title,
          started: (this.httpServer as any).startTime,
        }));
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    (this.httpServer as any).startTime = new Date().toISOString();

    this.wss = new WSServer({ server: this.httpServer });

    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = randomUUID().slice(0, 8);
      const clientName = `viewer-${clientId}`;

      this.viewers.set(clientId, { ws, name: clientName, id: clientId });
      const viewerCount = this.viewers.size;

      console.log(`[${new Date().toISOString()}] ${clientName} connected (${viewerCount} viewers)`);

      ws.send(JSON.stringify({
        type: 'system',
        message: `Connected to ${title}`,
        viewers: viewerCount,
        clientId,
      }));

      this.broadcastStats();

      ws.on('message', (data: Buffer) => {
        const payload = data.toString();
        if (this.pty) {
          this.pty.write(payload);
        }
        for (const [id, viewer] of this.viewers) {
          if (id !== clientId && viewer.ws.readyState === WebSocket.OPEN) {
            viewer.ws.send(payload);
          }
        }
      });

      ws.on('close', () => {
        this.viewers.delete(clientId);
        console.log(`[${new Date().toISOString()}] ${clientName} disconnected (${this.viewers.size} viewers)`);
        this.broadcastStats();
      });

      ws.on('error', (err: Error) => {
        console.error(`[${new Date().toISOString()}] WebSocket error: ${err.message}`);
      });
    });

    // Spawn PTY for the given command
    try {
      const ptyModule = await import('node-pty');
      const shell = ptyModule.spawn(command, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd: process.cwd(),
        env: process.env as Record<string, string>,
      });

      this.pty = shell;

      shell.onData((data: string) => {
        this.broadcast(data);
      });

      shell.onExit(({ exitCode, signal }) => {
        const msg = JSON.stringify({
          type: 'system',
          message: `Process exited (code: ${exitCode}, signal: ${signal})`,
        });
        this.broadcast(msg);
      });

      console.log(`   PTY spawned: ${command}`);
    } catch (err) {
      console.log(`   PTY unavailable (node-pty not compiled): ${command}`);
      console.log('   Stream relay running in viewer-only mode');
    }

    this.httpServer.listen(port, () => {
      console.log(`\uD83D\uDCE1 P31 Stream Relay`);
      console.log(`   Port: ${port}`);
      console.log(`   Title: ${title}`);
      console.log(`   WebSocket: ws://localhost:${port}`);
      console.log(`   Health: http://localhost:${port}/health\n`);
    });

    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  private broadcast(data: string): void {
    for (const [, viewer] of this.viewers) {
      if (viewer.ws.readyState === WebSocket.OPEN) {
        viewer.ws.send(data);
      }
    }
  }

  private broadcastStats(): void {
    const stats = JSON.stringify({
      type: 'stats',
      viewers: this.viewers.size,
      timestamp: new Date().toISOString(),
    });
    this.broadcast(stats);
  }

  private shutdown(): void {
    console.log('\nShutting down stream relay...');
    if (this.pty) {
      this.pty.kill();
    }
    for (const [, viewer] of this.viewers) {
      if (viewer.ws.readyState === WebSocket.OPEN) {
        viewer.ws.close();
      }
    }
    this.wss?.close(() => {
      this.httpServer?.close(() => {
        process.exit(0);
      });
    });
  }
}
