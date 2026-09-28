/* ==========================================================================
   Smoke test: boots the app in headless Chromium and walks the real flow
   (new drop → start editing → deliver → approve → schedule → post), checks
   persistence across a reload, drag & drop on the board, settings, and that
   no page or console errors occur. Also saves screenshots to tests/output/.

   Run:  node tests/smoke.mjs
   Needs Playwright (npm i -D playwright, or a global install) and Chromium.
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
  const globalRoot = execSync('npm root -g').toString().trim();
  return require(path.join(globalRoot, 'playwright'));
}
const { chromium } = loadPlaywright();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'tests', 'output');
fs.mkdirSync(outDir, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.md': 'text/plain' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(root, p));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port + '/';

const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log((cond ? '  ok   ' : '  FAIL ') + msg); };
const errors = [];
const today = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
const addDays = (k, n) => { const p = k.split('-').map(Number); const d = new Date(p[0], p[1] - 1, p[2] + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: 'en-GB' });
await context.grantPermissions(['clipboard-read', 'clipboard-write']);
const page = await context.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|net::ERR|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });

const snap = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(outDir, name + '.png'), fullPage: false }); };
/* Opens the calendar on the month that contains `date` and returns once its cell is rendered. */
async function gotoCalendarDay(date) {
  await page.goto(base + '#calendar');
  await page.waitForSelector('.cal');
  await page.click('[data-action="calMonth"][data-dir="0"]');
  let month = today.slice(0, 7);
  const want = date.slice(0, 7);
  for (let i = 0; i < 12 && month !== want; i++) {
    await page.click('[data-action="calMonth"][data-dir="' + (want > month ? 1 : -1) + '"]');
    month = await page.evaluate(() => window.KU.state.month);
  }
  await page.waitForSelector('.cal-cell[data-date="' + date + '"]');
}
const count = (kind) => page.evaluate((k) => Array.from(window.KU.state.items.values()).filter((i) => i.kind === k).length, kind);
const getVideos = (dropId) => page.evaluate((id) => Array.from(window.KU.state.items.values()).filter((i) => i.kind === 'video' && i.data.dropId === id).map((i) => i.data), dropId);
const toastText = async () => (await page.locator('.toast').last().textContent().catch(() => '')) || '';

console.log('\nBoot + example data');
await page.goto(base);
await page.waitForSelector('#main .page-head h1');
check(await page.locator('.modal .who-btn').count() === 3, 'identity chooser shows the 3 default team members');
await page.click('.who-btn:has-text("Immanuel")');
check((await page.textContent('#meBtn')).includes('Immanuel'), 'identity saved on the device');
check(await page.locator('.banner:has-text("Example data")').count() === 1, 'example data banner shown on first visit');
check(await count('drop') === 4 && await count('video') === 65, 'example data seeded: 4 drops, 65 videos');
const heroNum = Number(await page.textContent('.hero-num'));
check(heroNum > 0, 'hero shows posts this month (' + heroNum + ')');
check(await page.locator('.slot').count() === 2, 'today has 2 posting slots');
await snap('01-today-desktop');

console.log('\nNavigation');
for (const [route, h1] of [['drops', 'Drops'], ['videos', 'Videos'], ['calendar', 'Calendar'], ['team', 'Team & settings'], ['playbook', 'Playbook'], ['today', 'Today']]) {
  await page.goto(base + '#' + route);
  await page.waitForFunction((t) => document.querySelector('#main h1') && document.querySelector('#main h1').textContent === t, h1);
  check(true, 'route #' + route + ' renders "' + h1 + '"');
  if (route === 'calendar') await snap('02-calendar-desktop');
  if (route === 'videos') await snap('03-videos-desktop');
}

console.log('\nDrop flow: create → start → deliver → approve → schedule → post');
await page.click('[data-action="newDrop"]');
await page.fill('#dTitle', 'Smoke test drop');
await page.fill('#dLink', 'https://drive.google.com/drive/folders/smoke-raw');
await page.fill('#dClips', 'Desk hook\nWhiteboard');
await page.fill('#dBrief', 'Two variations per clip.');
await page.click('.drawer button[type="submit"]');
await page.waitForSelector('.drawer .eyebrow:has-text("D05")');
check(await count('drop') === 5, 'drop created with the next number (D05)');
check((await toastText()).includes('deadline'), 'toast announces the 24h deadline');
const dropId = await page.evaluate(() => Array.from(window.KU.state.items.values()).find((i) => i.kind === 'drop' && i.data.title === 'Smoke test drop').data.id);
const drop = await page.evaluate((id) => window.KU.state.items.get(id).data, dropId);
check(Math.round((new Date(drop.dueAt) - new Date(drop.sentAt)) / 3600000) === 24, 'deadline = sent + 24h');
check(drop.clips.length === 2, 'clip list parsed into 2 clips');
check(await page.locator('.drawer .timeline .tl').count() === 4, 'timeline shows the 4 stages');

await page.click('[data-action="copyHandoff"]');
await page.waitForSelector('.toast:has-text("copied")', { timeout: 5000 }).then(() => check(true, 'handoff message copied'), () => check(false, 'handoff message copied'));
const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
check(clip.includes('Drop D05') && clip.includes('Deadline'), 'handoff message names the drop and the deadline');
await page.click('[data-action="dropStart"]');
await page.waitForSelector('[data-action="openDeliver"]');
check((await page.evaluate((id) => window.KU.state.items.get(id).data.status, dropId)) === 'editing', 'drop moves to editing');
await page.click('[data-action="openDeliver"]');
await page.fill('#dlLink', 'https://drive.google.com/drive/folders/smoke-edits');
await page.fill('#dlTitles', 'C1: Desk hook fast cut\nC1: Desk hook with subtitles\nC2: Whiteboard explainer\nBonus clip');
await page.click('.drawer button[type="submit"]');
await page.waitForSelector('[data-action="dropApproveAll"]');
let vids = await getVideos(dropId);
check(vids.length === 4 && vids.every((v) => v.status === 'delivered'), '4 videos logged as delivered');
check(vids.map((v) => v.code).sort().join(',') === 'D05-C01-v1,D05-C01-v2,D05-C02-v1,D05-v1', 'codes trace variations to clips: ' + vids.map((v) => v.code).join(' '));
check((await page.evaluate((id) => window.KU.state.items.get(id).data.status, dropId)) === 'delivered', 'drop marked delivered');
await snap('04-drop-drawer');
await page.click('[data-action="dropApproveAll"]');
await page.waitForFunction((id) => Array.from(window.KU.state.items.values()).filter((i) => i.kind === 'video' && i.data.dropId === id).every((i) => i.data.status === 'approved'), dropId);
check(true, 'approve all → every video is ready to post');

const target = addDays(today, 6);
const firstId = (await getVideos(dropId))[0].id;
await page.click('.drawer .row[data-id="' + firstId + '"]');
await page.waitForSelector('#vDate');
await page.fill('#vDate', target);
await page.selectOption('#vSlot', '1');
await page.click('[data-action="videoSchedule"]');
await page.waitForFunction((id) => window.KU.state.items.get(id).data.status === 'scheduled', firstId);
const scheduled = await page.evaluate((id) => window.KU.state.items.get(id).data, firstId);
check(scheduled.scheduledDate === target && scheduled.slot === 1, 'video scheduled for ' + target + ' slot 1');
await page.keyboard.press('Escape');
await page.waitForSelector('.drawer', { state: 'detached' });

await gotoCalendarDay(target);
const cellText = await page.textContent('.cal-cell[data-date="' + target + '"]');
check(cellText.includes('Desk hook fast cut'), 'calendar shows the scheduled video on its day');
await page.click('.cal-cell[data-date="' + target + '"]');
await page.waitForSelector('.drawer .slot');
await page.check('.drawer input[data-platform="instagram"][data-id="' + firstId + '"]');
await page.waitForFunction((id) => window.KU.state.items.get(id).data.platforms.instagram.posted === true, firstId);
check((await page.evaluate((id) => window.KU.state.items.get(id).data.status, firstId)) === 'scheduled', 'one platform ticked → still scheduled (partial)');
await page.check('.drawer input[data-platform="tiktok"][data-id="' + firstId + '"]');
await page.waitForFunction((id) => window.KU.state.items.get(id).data.status === 'posted', firstId);
const posted = await page.evaluate((id) => window.KU.state.items.get(id).data, firstId);
check(posted.postedDate === target, 'both ticked → posted, counted on ' + target);
await snap('05-day-drawer');
await page.keyboard.press('Escape');

console.log('\nDay override (swap poster)');
await gotoCalendarDay(addDays(today, 8));
await page.click('.cal-cell[data-date="' + addDays(today, 8) + '"]');
await page.waitForSelector('#ovPoster');
await page.selectOption('#ovPoster', { label: 'Adam' });
await page.fill('#ovNote', 'Immanuel travelling');
await page.click('[data-action="saveOverride"]');
await page.waitForFunction((k) => { const p = window.KU.posterFor(k); return p && p.source === 'override'; }, addDays(today, 8));
check(true, 'poster swapped for one day');
await page.click('[data-action="clearOverride"]');
await page.waitForFunction((k) => window.KU.posterFor(k).source === 'rota', addDays(today, 8));
check(true, 'swap removed → back to rota');
await page.keyboard.press('Escape');

console.log('\nBoard: drag & drop + filters');
await page.goto(base + '#videos');
await page.waitForSelector('.kanban');
const dragId = (await getVideos(dropId)).find((v) => v.status === 'approved').id;
await page.dragAndDrop('.kcard[data-id="' + dragId + '"]', '.kcol[data-drop-status="delivered"]');
await page.waitForFunction((id) => window.KU.state.items.get(id).data.status === 'delivered', dragId).then(() => check(true, 'drag card Ready → Delivered updates its status'), () => check(false, 'drag card Ready → Delivered updates its status'));
await page.selectOption('#f-drop', dropId);
await page.waitForFunction((n) => document.querySelectorAll('.kcard').length === n, 4);
check(true, 'drop filter narrows the board to 4 cards');
await page.fill('#f-q', 'whiteboard');
await page.waitForFunction(() => document.querySelectorAll('.kcard').length === 1);
check((await page.evaluate(() => document.activeElement && document.activeElement.id)) === 'f-q', 'search keeps focus while typing');
await page.click('[data-action="clearFilters"]');
await page.waitForFunction(() => document.querySelectorAll('.kcard').length > 4);

console.log('\nAuto-fill + Today checkboxes');
await page.goto(base + '#today');
await page.waitForSelector('.hero-num');
const readyBefore = await page.evaluate(() => window.KU.monthStats(new Date().toISOString().slice(0, 7)).ready);
if (readyBefore > 0 && await page.locator('[data-action="autoFill"]').count()) {
  await page.click('[data-action="autoFill"]');
  await page.waitForFunction((n) => window.KU.monthStats(new Date().toISOString().slice(0, 7)).ready < n, readyBefore);
  check(true, 'auto-fill scheduled ready videos into empty slots');
} else check(true, 'auto-fill skipped (no ready videos or no gaps)');
const todaySlot = await page.locator('.slot input[data-platform="tiktok"]').first();
if (await todaySlot.count()) {
  const id = await todaySlot.getAttribute('data-id');
  const before = await page.evaluate((i) => window.KU.state.items.get(i).data.platforms.tiktok.posted, id);
  await todaySlot.click();
  await page.waitForFunction(([i, b]) => window.KU.state.items.get(i).data.platforms.tiktok.posted === !b, [id, before]);
  check(true, 'today checkbox toggles the platform state');
  await page.locator('.slot input[data-platform="tiktok"][data-id="' + id + '"]').click();
  await page.waitForFunction(([i, b]) => window.KU.state.items.get(i).data.platforms.tiktok.posted === b, [id, before]);
}

console.log('\nSettings');
await page.goto(base + '#team');
await page.waitForSelector('#postsPerDay');
await page.fill('#postsPerDay', '3');
await page.click('form[data-submit="saveTargets"] button[type="submit"]');
await page.waitForFunction(() => window.KU.slotsFor(new Date().toISOString().slice(0, 10)).length === 3);
check(true, 'posts per day = 3 → 3 slots per day');
await page.fill('#postsPerDay', '2');
await page.click('form[data-submit="saveTargets"] button[type="submit"]');
await page.waitForFunction(() => window.KU.slotsFor(new Date().toISOString().slice(0, 10)).length === 2);
await page.check('input[name="rotaMode"][value="weeks"]');
await page.click('form[data-submit="saveRota"] button[type="submit"]');
await page.waitForFunction(() => window.KU.state.items.get('settings_main').data.rotaMode === 'weeks');
check(true, 'rota mode saved');
await page.check('input[name="rotaMode"][value="days"]');
await page.click('form[data-submit="saveRota"] button[type="submit"]');
await page.waitForFunction(() => window.KU.state.items.get('settings_main').data.rotaMode === 'days');
await page.click('[data-action="openMember"]:not([data-id])');
await page.fill('#mName', 'Lena');
await page.check('input[name="role"][value="editor"]');
await page.click('.drawer button[type="submit"]');
await page.waitForFunction(() => Array.from(window.KU.state.items.values()).some((i) => i.kind === 'member' && i.data.name === 'Lena'));
check(true, 'new editor added to the team');
await snap('06-team-desktop');

console.log('\nPersistence across reload');
const before = { drops: await count('drop'), videos: await count('video'), members: await count('member') };
await page.reload();
await page.waitForSelector('#main .page-head h1');
const after = { drops: await count('drop'), videos: await count('video'), members: await count('member') };
check(JSON.stringify(before) === JSON.stringify(after), 'all records survive a reload (' + JSON.stringify(after) + ')');
check(await page.locator('.modal').count() === 0, 'identity remembered, no chooser on reload');

console.log('\nClear example data');
await page.goto(base + '#today');
await page.waitForSelector('[data-action="clearExample"]');
await page.click('[data-action="clearExample"]');
await page.click('[data-action="clearExample"].is-armed');
await page.waitForFunction(() => !window.KU.state.items.get('settings_main').data.exampleData);
check(await count('drop') === 0 && await count('video') === 0, 'board empty after clearing example data');
check(await count('member') === 4, 'team kept after clearing example data');
await page.reload();
await page.waitForSelector('#main .page-head h1');
check(await count('drop') === 0, 'example data does not come back after a reload');
await snap('07-today-empty');

console.log('\nPhone layout');
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-GB' });
const p2 = await phone.newPage();
p2.on('pageerror', (e) => errors.push('pageerror(mobile): ' + e.message));
await p2.goto(base);
await p2.waitForSelector('#main .page-head h1');
await p2.click('.who-btn:has-text("Adam")');
check(await p2.locator('.tabbar').isVisible(), 'bottom tab bar visible on phones');
const overflow = await p2.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
check(!overflow, 'no horizontal page scroll on a 390px phone');
await p2.waitForTimeout(400); await p2.screenshot({ path: path.join(outDir, '08-today-phone.png'), fullPage: false });
await p2.goto(base + '#calendar');
await p2.waitForSelector('.cal');
await p2.waitForTimeout(400); await p2.screenshot({ path: path.join(outDir, '09-calendar-phone.png'), fullPage: false });
await p2.goto(base + '#today'); await p2.waitForSelector('[data-action="newDrop"]'); await p2.click('[data-action="newDrop"]');
await p2.waitForSelector('#dTitle');
await p2.waitForTimeout(400); await p2.screenshot({ path: path.join(outDir, '10-newdrop-phone.png'), fullPage: false });
await phone.close();

await browser.close();
server.close();

console.log('\nRuntime errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
console.log('Result: ' + (failures.length || errors.length ? 'FAILED (' + (failures.length + errors.length) + ')' : 'PASSED') + ' · screenshots in tests/output/');
process.exit(failures.length || errors.length ? 1 : 0);
