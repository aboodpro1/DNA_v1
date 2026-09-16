/**
 * Production Web Server for Railway Deployment
 *
 * Lightweight, zero-dependency Node.js HTTP server optimized for Railway.
 * Serves static assets, handles SPA/file routing, sets security headers,
 * and dynamically binds to Railway's assigned process.env.PORT.
 *
 * Route:    All application routes
 * Trigger:  Railway start command: node server.js
 * Auth:     Static file delivery
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Port configuration: Railway sets process.env.PORT dynamically
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
const BASE_DIR = __dirname;

// MIME type dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  // Parse and normalize path
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Default root to index.html
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  // Prevent directory traversal attacks
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(BASE_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Check if file without extension exists with .html (clean URLs)
      const htmlCandidate = filePath + '.html';
      if (fs.existsSync(htmlCandidate)) {
        filePath = htmlCandidate;
      } else {
        // Fallback 404
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<!DOCTYPE html><html><head><title>404 Not Found</title></head><body style="background:#0b0f19;color:#fff;font-family:sans-serif;text-align:center;padding:100px;"><h1>404 Not Found</h1><p>The requested file does not exist.</p><a href="/index.html" style="color:#ff6b4a;">Return to Home</a></body></html>');
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Cache control policy
    let cacheControl = 'public, max-age=3600'; // 1 hour for assets
    if (ext === '.html') {
      cacheControl = 'no-cache, no-store, must-revalidate'; // Always fresh HTML
    }

    const headers = {
      'Content-Type': contentType,
      'Cache-Control': cacheControl
    };

    // Support Gzip compression if client accepts
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const canGzip = /\bgzip\b/.test(acceptEncoding) && (
      contentType.startsWith('text/') ||
      contentType.includes('javascript') ||
      contentType.includes('json') ||
      contentType.includes('svg')
    );

    if (canGzip) {
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      const rawStream = fs.createReadStream(filePath);
      const gzipStream = zlib.createGzip();
      rawStream.pipe(gzipStream).pipe(res);
    } else {
      res.writeHead(200, headers);
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[Railway Server] Running on http://${HOST}:${PORT}`);
});
