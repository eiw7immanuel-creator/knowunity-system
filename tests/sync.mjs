/* ==========================================================================
   Live-sync test: two browsers, one shared board, the REAL team server.
   Starts server/server.js on a random port with a temporary data file,
   serves the app, and drives two browsers: A is Immanuel (creator, desktop),
   B is the editor on a phone, joining through the invite link A copied.
   Checks that what one person does shows up for the other within seconds
   (Server-Sent Events), in both directions, that the data survives a server
   restart, and that no runtime errors occur.

   Run:  node tests/sync.mjs
   ========================================================================== */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync, spawn } from 'node:child_process';
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ku-sync-'));
const dataFile = path.join(tmp, 'items.json');
const KEY = 'test-team-key-0123456789';

/* ---- static app server ---- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const web = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(root, p));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => web.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + web.address().port + '/';

/* ---- the real team server ---- */
const apiPort = 20000 + Math.floor(Math.random() * 20000);
const apiUrl = 'http://127.0.0.1:' + apiPort;
let api = null;
async function startApi() {
  api = spawn(process.execPath, [path.join(root, 'server', 'server.js')], { env: { ...process.env, KU_KEY: KEY, KU_PORT: String(apiPort), KU_HOST: '127.0.0.1', KU_DATA: dataFile }, stdio: ['ignore', 'pipe', 'pipe'] });
  api.stderr.on('data', (d) => process.stderr.write('[server] ' + d));
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(apiUrl + '/api/health'); if (r.ok) return; } catch (e) { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('team server did not start');
}
async function stopApi() {
  if (!api) return;
  const done = new Promise((r) => api.once('exit', r));
  api.kill('SIGTERM');
  await done;
  api = null;
}
await startApi();

/* ---- helpers ---- */
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log((cond ? '  ok   ' : '  FAIL ') + msg); };
const errors = [];
const WAIT = 15000;
const wire = (page, tag) => {
  page.on('pageerror', (e) => errors.push(tag + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|net::ERR|Failed to load resource/.test(m.text())) errors.push(tag + ' console: ' + m.text()); });
};
const items = (page, kind) => page.evaluate((k) => Array.from(window.KU.state.items.values()).filter((i) => i.kind === k).map((i) => i.data), kind);
const shot = async (page, name) => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(outDir, name + '.png') }); };
const secs = (t) => Math.round((Date.now() - t) / 100) / 10 + ' s';
/* Polls a page-side condition, surviving the page reloading itself in the middle. */
async function until(page, fn, timeout) {
  const end = Date.now() + (timeout || WAIT);
  while (Date.now() < end) {
    try { if (await page.evaluate(fn)) return true; } catch (e) { /* navigating */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

const browser = await chromium.launch();
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-GB' });
await ctxA.grantPermissions(['clipboard-read', 'clipboard-write']);
const A = await ctxA.newPage(); wire(A, 'A');
const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-GB' });
const B = await ctxB.newPage(); wire(B, 'B');

console.log('\nA: opens the app (device only) and connects it to the team server');
await A.goto(base);
await A.waitForSelector('#main h1');
await A.click('.who-btn:has-text("Immanuel")');
await A.waitForSelector('.sheet', { state: 'detached' });
await A.goto(base + '#settings');
await A.waitForSelector('#srvUrl');
await A.fill('#srvUrl', apiUrl);
await A.fill('#srvKey', 'wrong-key');
await A.click('form[data-submit="connectServer"] button[type="submit"]');
await A.waitForSelector('.toast:has-text("not accepted")');
check(true, 'a wrong team key is refused with a clear message');
await A.fill('#srvKey', KEY);
const uploadBox = A.locator('form[data-submit="connectServer"] input[name="upload"]');
if (await uploadBox.count()) await uploadBox.uncheck();
await A.click('form[data-submit="connectServer"] button[type="submit"]');
check(await until(A, () => window.KU && window.KU.store() && window.KU.store().mode === 'api' && window.KU.state.sync.live === 'live' && document.querySelector('#main') && document.querySelector('#main').textContent.includes('Live')), 'connected: page reloaded into team-server mode and Settings shows "Live"');
for (let i = 0; i < 30 && !fs.existsSync(dataFile); i++) await new Promise((r) => setTimeout(r, 100));
const serverItems = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, 'utf8')).items.length : 0;
check(serverItems === 4, 'server file holds settings + 3 members after connecting (' + serverItems + ')');
check(await A.locator('.banner').count() === 0, 'shared board starts without example data');

console.log('\nA: copies the invite for the editor');
await A.click('[data-action="copyInvite"][data-id="member_editor1"]');
await A.waitForSelector('.toast:has-text("Invite copied")');
const invite = await A.evaluate(() => navigator.clipboard.readText()).catch(() => '');
const link = (invite.match(/https?:\/\/\S+#join-[A-Za-z0-9_-]+/) || [''])[0];
check(link.length > 0 && invite.includes('Deliver'), 'invite has a #join- link with the connection inside, plus the two steps');

console.log('\nB: editor opens the invite link on a phone');
await B.goto(link);
check(await until(B, () => window.KU && window.KU.store() && window.KU.store().mode === 'api' && window.KU.state.items.size > 0 && !document.querySelector('.sheet')), 'invite link reloads the phone into team-server mode');
check(((await B.getAttribute('#meBtn', 'title')) || '').includes('Editor 1'), 'device connected and signed in as Editor 1, no questions asked');
check((await B.textContent('#main')).includes('Welcome, Editor'), 'editor sees the welcome card');
await B.click('[data-action="dismissWelcome"]');
await B.waitForFunction(() => !document.querySelector('.welcome'));
await B.waitForFunction(() => window.KU.state.sync.live === 'live', null, { timeout: WAIT }).then(() => check(true, 'editor phone has the live connection'), () => check(false, 'editor phone has the live connection'));

console.log('\nA: sends a drop → B sees it appear');
await A.goto(base + '#home');
await A.waitForSelector('[data-action="newDrop"]');
await A.click('[data-action="newDrop"]');
await A.fill('#dTitle', 'Live sync drop');
await A.fill('#dLink', 'https://drive.google.com/drive/folders/live-raw');
await A.fill('#dBrief', 'Subtitles on everything please.');
await A.click('.sheet button[type="submit"]');
await A.waitForSelector('.sheet .eyebrow:has-text("D01")');
await A.keyboard.press('Escape');
const t0 = Date.now();
await B.waitForSelector('.btn-lg[data-action="dropStart"]', { timeout: WAIT }).then(
  () => check(true, 'drop appeared on the editor phone after ' + secs(t0) + ', no reload'),
  () => check(false, 'drop appeared on the editor phone without reload'));
const homeB = await B.textContent('#main');
check(homeB.includes('Live sync drop') && homeB.includes('Subtitles on everything') && /Deadline:/.test(homeB), 'editor sees title, notes and deadline');
await shot(B, 'sync-02-editor-drop-phone');

console.log('\nB: starts editing and delivers');
await B.click('.btn-lg[data-action="dropStart"]');
await B.waitForSelector('.btn-lg[data-action="openDeliver"]');
await B.click('.btn-lg[data-action="openDeliver"]');
await B.waitForSelector('#dlLink');
await B.fill('#dlLink', 'https://drive.google.com/drive/folders/live-edits');
await B.fill('#dlTitles', 'Exam trick fast cut\nExam trick with subtitles');
await B.click('.sheet button[type="submit"]');
await B.waitForSelector('.toast:has-text("delivered")');
await B.keyboard.press('Escape');
await B.waitForSelector('.sheet', { state: 'detached' });

console.log('\nA: sees the delivery and reviews');
const t1 = Date.now();
await A.waitForFunction(() => Array.from(window.KU.state.items.values()).filter((i) => i.kind === 'video' && i.data.status === 'delivered').length === 2, null, { timeout: WAIT }).then(
  () => check(true, 'both delivered videos reached the creator after ' + secs(t1)),
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

console.log('\nB: sees the note and re-delivers');
const t2 = Date.now();
await B.waitForFunction(() => document.querySelector('#main').textContent.includes('Make the subtitles bigger'), null, { timeout: WAIT }).then(
  () => check(true, 'editor sees the change note after ' + secs(t2)),
  () => check(false, 'editor sees the change note'));
await shot(B, 'sync-04-editor-changes-phone');
await B.click('[data-action="videoStatus"][data-status="delivered"][data-id="' + changesId + '"]');
await B.waitForFunction((id) => window.KU.state.items.get(id).data.status === 'delivered', changesId);
const t3 = Date.now();
await A.waitForFunction((id) => window.KU.state.items.get(id).data.status === 'delivered', changesId, { timeout: WAIT }).then(
  () => check(true, 'creator sees it back in review after ' + secs(t3)),
  () => check(false, 'creator sees it back in review'));

console.log('\nA: renames the editor → B sees the new name');
await A.goto(base + '#settings');
await A.click('.item[data-action="openMember"][data-id="member_editor1"]');
await A.waitForSelector('#mName');
await A.fill('#mName', 'Lena');
await A.click('.sheet button[type="submit"]');
await A.waitForFunction(() => window.KU.state.items.get('member_editor1').data.name === 'Lena');
const t4 = Date.now();
await B.waitForFunction(() => document.querySelector('#main h1').textContent.includes('Lena'), null, { timeout: WAIT }).then(
  () => check(true, 'editor greeting updated to Lena after ' + secs(t4)),
  () => check(false, 'editor greeting updated to Lena'));

console.log('\nServer restart: data survives, clients reconnect');
await stopApi();
const saved = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
check(saved.items.length === 7, 'data file has 7 records after the server stopped (' + saved.items.length + ')');
await B.waitForFunction(() => window.KU.state.sync.live === 'reconnecting', null, { timeout: WAIT }).then(() => check(true, 'phone notices the server is gone'), () => check(false, 'phone notices the server is gone'));
await startApi();
await B.waitForFunction(() => window.KU.state.sync.live === 'live', null, { timeout: WAIT }).then(() => check(true, 'phone reconnects by itself'), () => check(false, 'phone reconnects by itself'));
await B.reload();
check(await until(B, () => window.KU && window.KU.state.items.size > 0), 'phone reloads and gets the board again');
check(await B.locator('.sheet').count() === 0 && ((await B.getAttribute('#meBtn', 'title')) || '').includes('Lena'), 'editor stays signed in after a reload');
check((await items(B, 'video')).length === 2 && (await items(B, 'drop')).length === 1, 'the same board comes back from the restarted server');

console.log('\nBackup round trip');
const backupJson = await A.evaluate(() => JSON.stringify({ items: Array.from(window.KU.state.items.values()) }));
check(JSON.parse(backupJson).items.length === 7, 'app-side backup contains the 7 records');

await browser.close();
await stopApi();
web.close();
fs.rmSync(tmp, { recursive: true, force: true });

console.log('\nRuntime errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
console.log('Result: ' + (failures.length || errors.length ? 'FAILED (' + (failures.length + errors.length) + ')' : 'PASSED'));
process.exit(failures.length || errors.length ? 1 : 0);
