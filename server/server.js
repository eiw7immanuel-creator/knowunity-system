#!/usr/bin/env node
/* ==========================================================================
   Knowunity Content OS — team server
   Runs on your own VM (Oracle Cloud). Zero dependencies, one JSON file.
   The app talks to it with a team key; every change is pushed to all open
   tabs instantly through Server-Sent Events, so the board is live.

   Environment:
     KU_KEY   the team key (required). The installer generates one.
     KU_PORT  port to listen on (default 8787)
     KU_HOST  interface (default 127.0.0.1; Caddy sits in front for HTTPS)
     KU_DATA  data file (default ./data/items.json)

   API (all under /api, "Authorization: Bearer <key>"):
     GET    /api/health                 { ok, items, version }
     GET    /api/items                  { version, items: [...] }
     GET    /api/items?fields=meta      { version, items: [{ id, updated_at }] }
     PUT    /api/items                  [items]  upsert
     DELETE /api/items                  { ids: [...] } or { all: true }
     POST   /api/items/replace          [items]  replace everything (restore)
     GET    /api/events?key=<key>       Server-Sent Events: a message per change
   ========================================================================== */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.KU_PORT || 8787);
const HOST = process.env.KU_HOST || '127.0.0.1';
const KEY = String(process.env.KU_KEY || '').trim();
const DATA = process.env.KU_DATA || path.join(__dirname, 'data', 'items.json');
const MAX_BODY = 5 * 1024 * 1024;
const MAX_ITEMS = 50000;

if (KEY.length < 8) {
  console.error('KU_KEY is missing or too short. Refusing to start without a team key.');
  process.exit(1);
}

/* ---- storage: in-memory map, saved to one JSON file (atomic write) ---- */
const items = new Map();
let version = 0;
let saveTimer = null;

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA, 'utf8'));
    const list = Array.isArray(raw) ? raw : (raw.items || []);
    list.forEach((it) => { if (it && it.id) items.set(it.id, it); });
    version = Number(raw.version) || 0;
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('Could not read the data file:', e.message);
  }
}
function writeNow() {
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  const tmp = DATA + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ savedAt: new Date().toISOString(), version: version, items: Array.from(items.values()) }));
  fs.renameSync(tmp, DATA);
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { writeNow(); } catch (e) { console.error('Could not save:', e.message); } }, 150);
}
function backup() {
  try {
    if (!fs.existsSync(DATA)) return;
    const dir = path.join(path.dirname(DATA), 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, 'items-' + new Date().toISOString().slice(0, 10) + '.json');
    if (!fs.existsSync(target)) fs.copyFileSync(DATA, target);
    const old = fs.readdirSync(dir).filter((f) => /^items-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    while (old.length > 14) fs.unlinkSync(path.join(dir, old.shift()));
  } catch (e) { console.error('Backup failed:', e.message); }
}

/* ---- live updates ---- */
const clients = new Set();
function broadcast() {
  const msg = 'data: ' + JSON.stringify({ version: version, at: Date.now() }) + '\n\n';
  clients.forEach((res) => { try { res.write(msg); } catch (e) { clients.delete(res); } });
}
function changed() { version++; save(); broadcast(); }

/* ---- http helpers ---- */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400'
};
function send(res, status, body) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, CORS));
  res.end(body === undefined ? '' : JSON.stringify(body));
}
function authorized(req, url) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : (url.searchParams.get('key') || '');
  if (!token || token.length !== KEY.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(KEY));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
const validItem = (it) => !!it && typeof it.id === 'string' && it.id.length > 0 && it.id.length <= 120 && typeof it.kind === 'string' && !!it.data && typeof it.data === 'object';
const normalize = (it) => ({ id: it.id, kind: it.kind, data: it.data, updated_at: typeof it.updated_at === 'string' ? it.updated_at : new Date().toISOString() });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
  if (url.pathname === '/' || url.pathname === '/api' || url.pathname === '/api/') {
    send(res, 200, { ok: true, service: 'knowunity-content-os', hint: 'This is the team server. Open the app and connect it under Settings → Data.' });
    return;
  }
  if (!url.pathname.startsWith('/api/')) { send(res, 404, { message: 'not found' }); return; }
  const authed = authorized(req, url);
  if (url.pathname === '/api/health') { send(res, 200, authed ? { ok: true, items: items.size, version: version } : { ok: true }); return; }
  if (!authed) { send(res, 401, { message: 'Team key not accepted' }); return; }
  try {
    if (url.pathname === '/api/events' && req.method === 'GET') {
      res.writeHead(200, Object.assign({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' }, CORS));
      res.write('retry: 3000\n\ndata: ' + JSON.stringify({ hello: true, version: version, at: Date.now() }) + '\n\n');
      clients.add(res);
      const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) { clearInterval(ping); } }, 25000);
      req.on('close', () => { clients.delete(res); clearInterval(ping); });
      return;
    }
    if (url.pathname === '/api/items') {
      if (req.method === 'GET') {
        const list = Array.from(items.values());
        if (url.searchParams.get('fields') === 'meta') { send(res, 200, { version: version, items: list.map((it) => ({ id: it.id, updated_at: it.updated_at })) }); return; }
        send(res, 200, { version: version, items: list });
        return;
      }
      if (req.method === 'PUT' || req.method === 'POST') {
        const body = JSON.parse((await readBody(req)) || '[]');
        const list = Array.isArray(body) ? body : body.items;
        if (!Array.isArray(list) || !list.every(validItem)) { send(res, 400, { message: 'expected an array of items' }); return; }
        if (items.size + list.length > MAX_ITEMS) { send(res, 413, { message: 'too many items' }); return; }
        list.forEach((it) => items.set(it.id, normalize(it)));
        changed();
        send(res, 200, { ok: true, version: version });
        return;
      }
      if (req.method === 'DELETE') {
        const body = JSON.parse((await readBody(req)) || '{}');
        if (body.all === true) items.clear();
        else if (Array.isArray(body.ids)) body.ids.forEach((id) => items.delete(String(id)));
        else { send(res, 400, { message: 'expected { ids: [...] } or { all: true }' }); return; }
        changed();
        send(res, 200, { ok: true, version: version });
        return;
      }
    }
    if (url.pathname === '/api/items/replace' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '[]');
      const list = Array.isArray(body) ? body : body.items;
      if (!Array.isArray(list) || !list.every(validItem) || list.length > MAX_ITEMS) { send(res, 400, { message: 'expected an array of items' }); return; }
      items.clear();
      list.forEach((it) => items.set(it.id, normalize(it)));
      changed();
      send(res, 200, { ok: true, version: version });
      return;
    }
    send(res, 404, { message: 'not found' });
  } catch (e) {
    send(res, e.message === 'body too large' ? 413 : 400, { message: e.message });
  }
});

load();
backup();
server.listen(PORT, HOST, () => {
  console.log('Knowunity team server listening on http://' + HOST + ':' + PORT + ' · ' + items.size + ' items · data file ' + DATA);
});
function shutdown() {
  clearTimeout(saveTimer);
  try { writeNow(); } catch (e) { console.error('Could not save on shutdown:', e.message); }
  clients.forEach((res) => { try { res.end(); } catch (e) { /* ignore */ } });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
