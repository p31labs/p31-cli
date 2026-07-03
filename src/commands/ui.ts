import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

async function open(url: string): Promise<void> {
  const { default: openModule } = await import('open');
  openModule(url);
}

export async function startWebUI(): Promise<void> {
  const webDir = path.resolve(__dirname, '../../dist/web');

  if (!existsSync(webDir)) {
    console.error(chalk.red('\u2717 Web UI not built. Run `npm run build:web` first.'));
    process.exit(1);
  }

  const port = 3000;
  const server = createServer((req, res) => {
    let filePath = path.join(webDir, req.url === '/' ? 'index.html' : req.url || 'index.html');
    if (!existsSync(filePath)) {
      filePath = path.join(webDir, 'index.html');
    }
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    try {
      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(port, () => {
    console.log(chalk.cyan(`\n\u{1F310} P31 Web UI running at http://localhost:${port}`));
    open(`http://localhost:${port}`);
  });
}
