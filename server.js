/**
 * Production Web Server for Railway Deployment
 *
 * Lightweight, zero-dependency Node.js HTTP server with built-in API proxy.
 * Serves static assets, handles clean routing, sets security headers,
 * provides CORS-free proxying to n8n Cloud webhooks,
 * and dynamically binds to Railway assigned process.env.PORT.
 *
 * Route:    All application routes and /api/webhook proxy
 * Trigger:  Railway start command: node server.js
 * Auth:     Static file delivery and server-to-server n8n proxying
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Port configuration: Railway sets process.env.PORT dynamically
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
const BASE_DIR = __dirname;
const DEFAULT_TARGET_WEBHOOK = process.env.N8N_WEBHOOK_URL || 'https://aboodjallab.app.n8n.cloud/webhook-test/sign_both';

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

/**
 * Forward HTTP/HTTPS request to target n8n webhook server-to-server.
 * Completely eliminates browser CORS preflight and loopback permission issues.
 */
function forwardToWebhook(targetUrlStr, method, incomingHeaders, bodyBuffer, forwardParams, clientRes) {
  let parsedTarget;
  try {
    parsedTarget = new URL(targetUrlStr);
  } catch (err) {
    clientRes.writeHead(400, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    clientRes.end(JSON.stringify({
      success: false,
      approved: false,
      message: 'Invalid target webhook URL: ' + err.message
    }));
    return;
  }

  // Merge incoming query parameters into target URL for GET / query requests
  if (forwardParams) {
    forwardParams.forEach((value, key) => {
      parsedTarget.searchParams.set(key, value);
    });
  }

  const transport = parsedTarget.protocol === 'https:' ? https : http;
  const isHttps = parsedTarget.protocol === 'https:';
  const defaultPort = isHttps ? 443 : 80;

  const outgoingHeaders = {
    'Accept': incomingHeaders['accept'] || 'application/json, text/plain, */*',
    'User-Agent': 'Railway-Node-Proxy/1.0'
  };

  const isPostOrPut = method === 'POST' || method === 'PUT' || method === 'PATCH';
  if (isPostOrPut && bodyBuffer && bodyBuffer.length > 0) {
    outgoingHeaders['Content-Type'] = incomingHeaders['content-type'] || 'application/json';
    outgoingHeaders['Content-Length'] = Buffer.byteLength(bodyBuffer);
  }

  const options = {
    hostname: parsedTarget.hostname,
    port: parsedTarget.port || defaultPort,
    path: parsedTarget.pathname + parsedTarget.search,
    method: method || 'GET',
    headers: outgoingHeaders,
    timeout: 30000
  };

  console.log(`[Proxy] Forwarding ${method} to ${parsedTarget.toString()} (${bodyBuffer ? bodyBuffer.length : 0} body bytes)`);

  const proxyReq = transport.request(options, (proxyRes) => {
    const resChunks = [];
    proxyRes.on('data', (chunk) => resChunks.push(chunk));
    proxyRes.on('end', () => {
      const responseData = Buffer.concat(resChunks);
      const resContentType = proxyRes.headers['content-type'] || 'application/json; charset=utf-8';

      clientRes.writeHead(proxyRes.statusCode || 200, {
        'Content-Type': resContentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-target-url, Accept',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      clientRes.end(responseData);
      console.log(`[Proxy Response] ${proxyRes.statusCode} from ${parsedTarget.toString()}`);
    });
  });

  proxyReq.on('error', (err) => {
    console.error(`[Proxy Error] Failed connecting to ${parsedTarget.toString()}:`, err.message);
    clientRes.writeHead(502, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    clientRes.end(JSON.stringify({
      success: false,
      approved: false,
      message: 'Proxy error reaching n8n webhook: ' + err.message,
      error: err.message
    }));
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    clientRes.writeHead(504, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    clientRes.end(JSON.stringify({
      success: false,
      approved: false,
      message: 'Proxy timed out waiting for n8n response (30s limit)'
    }));
  });

  if (isPostOrPut && bodyBuffer && bodyBuffer.length > 0) {
    proxyReq.write(bodyBuffer);
  }
  proxyReq.end();
}

const server = http.createServer((req, res) => {
  // Global CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-target-url, Accept');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Handle preflight OPTIONS requests immediately
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-target-url, Accept',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  // Parse and normalize path
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Handle API Proxy endpoint (/api/webhook or /api/proxy)
  if (pathname.startsWith('/api/webhook') || pathname.startsWith('/api/proxy')) {
    const targetQuery = parsedUrl.searchParams.get('url') || parsedUrl.searchParams.get('target');
    const targetHeader = req.headers['x-target-url'];
    const targetWebhookUrl = (targetHeader || targetQuery || DEFAULT_TARGET_WEBHOOK).trim();

    // Collect query params to forward
    const forwardParams = new URLSearchParams();
    parsedUrl.searchParams.forEach((val, key) => {
      if (key !== 'url' && key !== 'target') {
        forwardParams.append(key, val);
      }
    });

    const bodyChunks = [];
    req.on('data', (chunk) => bodyChunks.push(chunk));
    req.on('end', () => {
      const requestBody = Buffer.concat(bodyChunks);
      forwardToWebhook(targetWebhookUrl, req.method, req.headers, requestBody, forwardParams, res);
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

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

    // Cache control policy: disable caching on code files so updates apply immediately
    let cacheControl = 'no-cache, no-store, must-revalidate';
    if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.svg' || ext === '.woff2') {
      cacheControl = 'public, max-age=86400';
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
  console.log(`[Railway Server] Default webhook proxy target: ${DEFAULT_TARGET_WEBHOOK}`);
});
