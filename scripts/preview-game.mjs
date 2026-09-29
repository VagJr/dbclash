import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PREVIEW_PORT || 5173);
const allowedRoots = new Set(['assets', 'js', 'styles', 'music', 'imagens', 'UI_PACK']);
const allowedFiles = new Set(['index.html', 'manifest.json', 'sw.js']);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.gif': 'image/gif', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const segments = rel.split(/[\\/]/);
    if (segments.includes('..') || segments.some(p => p.startsWith('.')) ||
      (!allowedRoots.has(segments[0]) && !allowedFiles.has(rel))) { res.writeHead(404); res.end(); return; }
    const target = path.resolve(root, rel);
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(target).pipe(res);
  } catch { res.writeHead(400); res.end(); }
}).listen(port, '127.0.0.1', () => console.log(`DBClash preview http://127.0.0.1:${port}`));
