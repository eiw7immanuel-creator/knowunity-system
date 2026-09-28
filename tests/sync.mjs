/* ==========================================================================
   Live-sync test: two browsers, one shared board.
   A tiny in-process server imitates Supabase's REST API (the same three
   calls the app makes: select, upsert, delete) and serves the app with a
   config.js that points at it. Browser A is Immanuel (creator, desktop),
   browser B is the editor on a phone, signed in through the invite link.
   The test checks that what one person does shows up for the other without
   a reload, in both directions, and that no runtime errors occur.

   Run:  node tests/sync.mjs
   ========================================================================== */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* try the global install */ }
  return require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}
const { chromium } = loadPlaywright();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'tests', 'output');
fs.mkdirSync(outDir, { recursive: true });

/* ---- mock Supabase (PostgREST) ---- */
const rows = new Map();
const requests = { get: 0, fingerprint: 0, post: 0, del: 0 };
const readBody = (req) => new Promise((resolve) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => resolve(b)); });
function matches(row, f) {
  if (!f) return true;
  if (f.startsWith('eq.')) return row.id === f.slice(3);
  if (f.startsWith('neq.')) return row.id !== f.slice(4);
  if (f.startsWith('in.(') && f.endsWith(')')) return f.slice(4, -1).split(',').includes(row.id);
  return true;
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
let base = '';
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/mock/rest/v1/items') {
    if (req.headers.apikey !== 'test-key' || req.headers.authorization !== 'Bearer test-key') { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"message":"Invalid API key"}'); return; }
    const f = url.searchParams.get('id');
    if (req.method === 'GET') {
      const select = (url.searchParams.get('select') || '*').split(',');
      if (select.length === 2 && select.includes('id') && select.includes('updated_at')) requests.fingerprint++; else requests.get++;
      const list = Array.from(rows.values()).filter((r) => matches(r, f)).sort((a, b) => (a.updated_at < b.updated_at ? -1 : 1))
        .map((r) => (select[0] === '*' ? r : Object.fromEntries(select.map((k) => [k, r[k]]))));
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(list)); return;
    }
    if (req.method === 'POST') {
      requests.post++;
      const body = JSON.parse((await readBody(req)) || '[]');
      (Array.isArray(body) ? body : [body]).forEach((r) => rows.set(r.id, r));
      res.writeHead(201); res.end(); return;
    }
    if (req.method === 'DELETE') {
      requests.del++;
      Array.from(rows.values()).forEach((r) => { if (matches(r, f)) rows.delete(r.id); });
      res.writeHead(204); res.end(); return;
    }
    res.writeHead(405); res.end(); return;
  }
  if (url.pathname === '/config.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end("window.KU_CONFIG = { teamName: 'Knowunity Content', supabase: { url: '" + base + "mock', anonKey: 'test-key', table: 'items' } };");
    return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(root, p));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
base = 'http://127.0.0.1:' + server.address().port + '/';

/* ---- helpers ---- */
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log((cond ? '  ok   ' : '  FAIL ') + msg); };
const errors = [];
const WAIT = 25000; // propagation budget: polling runs every 8 s
const wire = (page, tag) => {
  page.on('pageerror', (e) => errors.push(tag + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|net::ERR|Failed to load resource/.test(m.text())) errors.push(tag + ' console: ' + m.text()); });
};
const items = (page, kind) => page.evaluate((k) => Array.from(window.KU.state.items.values()).filter((i) => i.kind === k).map((i) => i.data), kind);
const shot = async (page, name) => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(outDir, name + '.png') }); };

const browser = await chromium.launch();
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-GB' });
await ctxA.grantPermissions(['clipboard-read', 'clipboard-write']);
const A = await ctxA.newPage(); wire(A, 'A');
const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-GB' });
const B = await ctxB.newPage(); wire(B, 'B');

console.log('\nA: creator opens the shared (empty) board');
await A.goto(base);
await A.waitForSelector('#main h1');
await A.click('.who-btn:has-text("Immanuel")');
await A.waitForSelector('.sheet', { state: 'detached' });
check(await A.locator('.banner').count() === 0, 'shared board starts empty, no example data');
check(rows.size === 4, 'server holds settings + 3 members after first open (' + rows.size + ' rows)');
check((await A.textContent('#main')).includes('Welcome, Immanuel'), 'creator sees the welcome card once');
await A.click('[data-action="dismissWelcome"]');
await A.waitForFunction(() => !document.querySelector('.welcome'));

console.log('\nA: copies the invite for the editor');
await A.goto(base + '#settings');
await A.waitForSelector('[data-action="copyInvite"][data-id="member_editor1"]');
await A.click('[data-action="copyInvite"][data-id="member_editor1"]');
await A.waitForSelector('.toast:has-text("Invite copied")');
const invite = await A.evaluate(() => navigator.clipboard.readText()).catch(() => '');
check(invite.includes('#as-member_editor1') && invite.includes('Deliver'), 'invite text has the personal link and the two steps');

console.log('\nB: editor opens the invite link on a phone');
await B.goto(base + '#as-member_editor1');
await B.waitForSelector('#main h1');
await B.waitForTimeout(500);
check(await B.locator('.sheet').count() === 0, 'no "who are you" question for the editor');
check(((await B.getAttribute('#meBtn', 'title')) || '').includes('Editor 1'), 'device signed in as Editor 1 through the link');
check((await B.textContent('#main')).includes('Welcome, Editor'), 'editor sees the welcome card with the two steps');
await shot(B, 'sync-01-editor-welcome-phone');
await B.click('[data-action="dismissWelcome"]');
await B.waitForFunction(() => !document.querySelector('.welcome'));
check((await B.textContent('#main')).includes('No drops to edit'), 'editor home is calm when nothing is assigned');

console.log('\nA: sends a drop → B sees it appear without reloading');
await A.goto(base + '#home');
await A.waitForSelector('[data-action="newDrop"]');
await A.click('[data-action="newDrop"]');
await A.fill('#dTitle', 'Live sync drop');
await A.fill('#dLink', 'https://drive.google.com/drive/folders/live-raw');
await A.fill('#dBrief', 'Subtitles on everything please.');
await A.click('.sheet button[type="submit"]');
await A.waitForSelector('.sheet .eyebrow:has-text("D01")');
check((await A.textContent('.sheet')).includes('does not send notifications'), 'A is told to send the copied message to the editor');
await A.keyboard.press('Escape');
const t0 = Date.now();
await B.waitForSelector('.btn-lg[data-action="dropStart"]', { timeout: WAIT }).then(
  () => check(true, 'drop appeared on the editor phone after ' + Math.round((Date.now() - t0) / 1000) + ' s, no reload'),
  () => check(false, 'drop appeared on the editor phone without reload'));
const homeB = await B.textContent('#main');
check(homeB.includes('Live sync drop') && homeB.includes('Subtitles on everything') && /Deadline:/.test(homeB), 'editor sees title, notes and deadline');
check(await B.locator('a:has-text("Open footage")').count() === 1, 'editor has the Open footage button');
await shot(B, 'sync-02-editor-drop-phone');

console.log('\nB: starts editing and delivers');
await B.click('.btn-lg[data-action="dropStart"]');
await B.waitForSelector('.btn-lg[data-action="openDeliver"]');
await B.click('.btn-lg[data-action="openDeliver"]');
await B.waitForSelector('#dlLink');
await B.fill('#dlLink', 'https://drive.google.com/drive/folders/live-edits');
await B.fill('#dlTitles', 'Exam trick fast cut\nExam trick with subtitles');
await shot(B, 'sync-03-editor-deliver-phone');
await B.click('.sheet button[type="submit"]');
await B.waitForSelector('.toast:has-text("delivered")');
await B.keyboard.press('Escape');
await B.waitForSelector('.sheet', { state: 'detached' });
check((await B.textContent('#main')).includes('Waiting for review'), 'editor home now shows the drop as waiting for review');

console.log('\nA: sees the delivery live and approves one video');
const t1 = Date.now();
await A.waitForFunction(() => Array.from(window.KU.state.items.values()).filter((i) => i.kind === 'video' && i.data.status === 'delivered').length === 2, null, { timeout: WAIT }).then(
  () => check(true, 'both delivered videos reached the creator after ' + Math.round((Date.now() - t1) / 1000) + ' s'),
  () => check(false, 'delivered videos reached the creator'));
await A.waitForSelector('[data-action="videoStatus"][data-status="approved"]');
const vidsA = await items(A, 'video');
const approveId = vidsA[0].id, changesId = vidsA[1].id;
await A.click('[data-action="videoStatus"][data-status="approved"][data-id="' + approveId + '"]');
await A.waitForFunction((id) => window.KU.state.items.get(id).data.status === 'approved', approveId);
await A.click('[data-action="openChanges"][data-id="' + changesId + '"]');
await A.fill('#chNote', 'Make the subtitles bigger');
await A.click('.sheet button[type="submit"]');
await A.waitForFunction((id) => window.KU.state.items.get(id).data.status === 'changes', changesId);
check(true, 'A approved one video and sent the other back with a note');

console.log('\nB: sees the note live and re-delivers');
const t2 = Date.now();
await B.waitForFunction(() => document.querySelector('#main') && document.querySelector('#main').textContent.includes('Make the subtitles bigger'), null, { timeout: WAIT }).then(
  () => check(true, 'editor sees the change note after ' + Math.round((Date.now() - t2) / 1000) + ' s'),
  () => check(false, 'editor sees the change note'));
await shot(B, 'sync-04-editor-changes-phone');
await B.click('[data-action="videoStatus"][data-status="delivered"][data-id="' + changesId + '"]');
await B.waitForFunction((id) => window.KU.state.items.get(id).data.status === 'delivered', changesId);
const t3 = Date.now();
await A.waitForFunction((id) => window.KU.state.items.get(id).data.status === 'delivered', changesId, { timeout: WAIT }).then(
  () => check(true, 'creator sees it back in review after ' + Math.round((Date.now() - t3) / 1000) + ' s'),
  () => check(false, 'creator sees it back in review'));

console.log('\nA: renames the editor → B sees the new name');
await A.goto(base + '#settings');
await A.click('.item[data-action="openMember"][data-id="member_editor1"]');
await A.waitForSelector('#mName');
await A.fill('#mName', 'Lena');
await A.click('.sheet button[type="submit"]');
await A.waitForFunction(() => window.KU.state.items.get('member_editor1').data.name === 'Lena');
const t4 = Date.now();
await B.waitForFunction(() => document.querySelector('#main h1') && document.querySelector('#main h1').textContent.includes('Lena'), null, { timeout: WAIT }).then(
  () => check(true, 'editor greeting updated to Lena after ' + Math.round((Date.now() - t4) / 1000) + ' s'),
  () => check(false, 'editor greeting updated to Lena'));

console.log('\nB: reloads and everything is still there');
await B.reload();
await B.waitForSelector('#main h1');
check(await B.locator('.sheet').count() === 0 && ((await B.getAttribute('#meBtn', 'title')) || '').includes('Lena'), 'editor stays signed in after a reload');
check((await items(B, 'video')).length === 2 && (await items(B, 'drop')).length === 1, 'editor loads the same board from the server');
const dataA = await (async () => { await A.goto(base + '#settings'); await A.waitForSelector('#main'); return A.textContent('#main'); })();
check(dataA.includes('Shared board') && dataA.includes('Last synced'), 'Settings shows "Shared board" and the last sync time');

await browser.close();
server.close();

console.log('\nServer requests: ' + JSON.stringify(requests));
console.log('Runtime errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
console.log('Result: ' + (failures.length || errors.length ? 'FAILED (' + (failures.length + errors.length) + ')' : 'PASSED'));
process.exit(failures.length || errors.length ? 1 : 0);
