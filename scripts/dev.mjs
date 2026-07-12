import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const distDir = path.join(projectRoot, 'dist');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const serveOnly = process.argv.includes('--serve-only');

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function getContentType(filePath) {
  return contentTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
}

async function startStaticServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = decodeURIComponent(requestUrl.pathname);
      const safePath = pathname === '/' ? '/index.html' : pathname;
      const filePath = path.normalize(path.join(distDir, safePath));
      const withinDist = filePath.startsWith(distDir);
      const exists = withinDist
        ? await fs.access(filePath).then(() => true).catch(() => false)
        : false;

      const assetPath = exists ? filePath : path.join(distDir, 'index.html');
      const body = await fs.readFile(assetPath);
      res.writeHead(200, { 'Content-Type': getContentType(assetPath) });
      res.end(body);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Failed to serve app: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(undefined));
  });

  console.log(`[fallback] Serving built app from ${distDir}`);
  console.log(`[fallback] Open http://localhost:${port}/`);
}

async function startViteServer() {
  const { createServer } = await import('vite');
  const server = await createServer({
    server: { host, port, strictPort: true },
  });
  await server.listen();
  server.printUrls();
  return server;
}

async function main() {
  if (serveOnly) {
    await startStaticServer();
    return;
  }

  try {
    await startViteServer();
  } catch (error) {
    console.warn('[dev] Vite startup failed, falling back to the built app.');
    console.warn(error instanceof Error ? error.stack || error.message : String(error));
    await startStaticServer();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
