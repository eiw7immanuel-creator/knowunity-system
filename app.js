/* ==========================================================================
   Knowunity Content OS — application
   One file, no build step. Structure:
     1. helpers (DOM, dates, formatting)      5. pages (Today, Drops, Videos, …)
     2. icons + constants                      6. drawers + modal
     3. state + persistence                    7. actions + event wiring
     4. domain logic (rota, slots, stats)      8. example data + boot
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     1. Helpers
     ------------------------------------------------------------------------ */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const nowIso = () => new Date().toISOString();
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  const cmp = (x, y) => {
    if (Array.isArray(x)) { for (let i = 0; i < x.length; i++) { const c = cmp(x[i], y[i]); if (c) return c; } return 0; }
    return x < y ? -1 : x > y ? 1 : 0;
  };
  const sortBy = (arr, fn) => arr.slice().sort((a, b) => cmp(fn(a), fn(b)));
  const clampNum = (n, lo, hi, fallback) => { if (n == null || n === '') return fallback; n = Number(n); if (!Number.isFinite(n)) return fallback; return Math.min(hi, Math.max(lo, Math.round(n))); };

  function uid(prefix) {
    let r;
    if (window.crypto && typeof crypto.randomUUID === 'function') r = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    else r = Math.random().toString(36).slice(2, 12);
    return prefix + '_' + r;
  }

  /* dates: "keys" are local YYYY-MM-DD strings; timestamps are ISO strings */
  const pad2 = (n) => String(n).padStart(2, '0');
  const keyOf = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const parseKey = (k) => { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const todayKey = () => keyOf(new Date());
  const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
  const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
  const monthOf = (k) => k.slice(0, 7);
  const firstOfMonth = (mk) => mk + '-01';
  const daysInMonth = (mk) => { const p = mk.split('-').map(Number); return new Date(p[0], p[1], 0).getDate(); };
  const addMonths = (mk, n) => { const p = mk.split('-').map(Number); const d = new Date(p[0], p[1] - 1 + n, 1); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); };
  const isoWeekday = (d) => ((d.getDay() + 6) % 7) + 1; // 1 = Monday … 7 = Sunday
  const startOfWeek = (k, weekStart) => { const d = parseKey(k); const wd = isoWeekday(d); const off = weekStart === 7 ? (wd % 7) : (wd - 1); d.setDate(d.getDate() - off); return keyOf(d); };
  const dateKeyOfIso = (iso) => keyOf(new Date(iso));

  const fmtDay = (k) => parseKey(k).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtDayLong = (k) => parseKey(k).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtMonth = (mk) => parseKey(firstOfMonth(mk)).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const fmtDT = (iso) => iso ? (new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + fmtTime(iso)) : '—';
  const weekdayName = (wd, style) => { const d = parseKey('2024-01-01'); d.setDate(d.getDate() + wd - 1); return d.toLocaleDateString(undefined, { weekday: style || 'short' }); };

  function fmtDuration(ms) {
    const abs = Math.abs(ms);
    const h = Math.floor(abs / 3600000);
    const m = Math.floor((abs % 3600000) / 60000);
    if (h >= 48) return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
    if (h > 0) return h + 'h ' + pad2(m) + 'm';
    return m + 'm';
  }
  function countdown(dueIso, now) {
    const diff = new Date(dueIso).getTime() - (now || Date.now());
    if (diff < 0) return { text: 'overdue by ' + fmtDuration(diff), tone: 'late', late: true };
    if (diff < 4 * 3600000) return { text: 'due in ' + fmtDuration(diff), tone: 'warn', late: false };
    return { text: 'due in ' + fmtDuration(diff), tone: 'ok', late: false };
  }
  const toLocalInput = (iso) => { const d = iso ? new Date(iso) : new Date(); return keyOf(d) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const fromLocalInput = (v) => { const d = v ? new Date(v) : new Date(); return isNaN(d) ? nowIso() : d.toISOString(); };
  const addHoursIso = (iso, h) => new Date(new Date(iso).getTime() + h * 3600000).toISOString();

  /* ------------------------------------------------------------------------
     2. Icons + constants
     ------------------------------------------------------------------------ */
  const svg = (inner) => '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  const I = {
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    film: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>'),
    layers: svg('<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>'),
    calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5a5 5 0 0 1 6 5"/>'),
    book: svg('<path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h8"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    ext: svg('<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>'),
    copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>'),
    check: svg('<path d="M5 12l5 5L20 7"/>'),
    x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    left: svg('<path d="M15 5l-7 7 7 7"/>'),
    right: svg('<path d="M9 5l7 7-7 7"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    alert: svg('<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17.5v.5"/>'),
    trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    edit: svg('<path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M13 7l4 4"/>'),
    send: svg('<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4 18-7z"/>'),
    swap: svg('<path d="M7 16V4M7 4L3 8M7 4l4 4"/><path d="M17 8v12M17 20l4-4M17 20l-4-4"/>'),
    download: svg('<path d="M12 3v12M12 15l-4-4M12 15l4-4"/><path d="M4 17v3h16v-3"/>'),
    upload: svg('<path d="M12 15V3M12 3L8 7M12 3l4 4"/><path d="M4 17v3h16v-3"/>'),
    wand: svg('<path d="M4 20l10-10M14 4l1 2M20 10l-2-1M17 3l-1 3M21 7l-3 1"/>'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>')
  };

  const SETTINGS_ID = 'settings_main';
  const ROUTES = {
    today: { label: 'Today', icon: 'sun' },
    drops: { label: 'Drops', icon: 'film' },
    videos: { label: 'Videos', icon: 'layers' },
    calendar: { label: 'Calendar', icon: 'calendar' },
    team: { label: 'Team', icon: 'users', title: 'Team & settings' },
    playbook: { label: 'Playbook', icon: 'book' }
  };
  const VSTATUS = [
    ['editing', 'In editing', 'neutral'],
    ['delivered', 'Delivered · to review', 'info'],
    ['changes', 'Changes requested', 'warn'],
    ['approved', 'Ready to post', 'good'],
    ['scheduled', 'Scheduled', 'accent'],
    ['posted', 'Posted', 'done']
  ];
  const VS = {};
  VSTATUS.forEach((row, i) => { VS[row[0]] = { key: row[0], label: row[1], tone: row[2], order: i }; });
  const DSTATUS = {
    sent: ['Sent to editor', 'info'],
    editing: ['Being edited', 'accent'],
    delivered: ['Delivered · in review', 'warn'],
    approved: ['Closed', 'done']
  };
  const COLORS = ['blue', 'orange', 'violet', 'magenta', 'yellow', 'aqua', 'green', 'red'];
  const LIGHT_COLORS = { yellow: true, aqua: true, magenta: true };
  const PLATFORMS = [['instagram', 'IG', 'Instagram'], ['tiktok', 'TT', 'TikTok']];

  const DEFAULT_SETTINGS = {
    id: SETTINGS_ID,
    teamName: 'Knowunity Content',
    monthlyTarget: 60,
    postsPerDay: 2,
    editorSlaHours: 24,
    reviewSlaHours: 24,
    dropsPerMonth: 3,
    variationsPerClip: 3,
    bufferDays: 5,
    rotaMode: 'days',        // days | weeks | weekday
    rotaAnchor: '',          // YYYY-MM-DD, the day the first poster in rotaOrder posts
    rotaOrder: [],           // member ids in rotation order
    rotaWeekday: {},         // { "1": memberId, … "7": memberId } for weekday mode
    weekStart: 1,            // 1 = Monday, 7 = Sunday
    driveRaw: '',
    driveEdits: '',
    driveAssets: '',
    exampleData: false,
    seeded: false
  };

  /* ------------------------------------------------------------------------
     3. State + persistence
     ------------------------------------------------------------------------ */
  const state = {
    items: new Map(),           // id -> { id, kind, data, updated_at }
    route: 'today',
    month: monthOf(todayKey()), // month shown in the calendar
    me: null,                   // member id chosen on this device
    drawer: null,               // { type, … }
    modal: null,                // 'who' | null
    filters: { drop: '', editor: '', status: '', q: '' },
    sync: { status: 'ok', error: '' },
    now: Date.now(),
    ready: false,
    dragId: null
  };
  let store = null;
  const recentWrites = new Map(); // id -> time of our last write; protects in-flight writes from polling

  const getItem = (id) => { const it = state.items.get(id); return it ? it.data : null; };
  const byKind = (kind) => { const out = []; state.items.forEach((it) => { if (it.kind === kind) out.push(it.data); }); return out; };

  function commit(kind, data) {
    const updated_at = nowIso();
    data.updatedAt = updated_at;
    const item = { id: data.id, kind: kind, data: data, updated_at: updated_at };
    state.items.set(data.id, item);
    recentWrites.set(data.id, Date.now());
    return item;
  }
  function setSync(status, error) { state.sync = { status: status, error: error || '' }; renderSync(); }
  async function persist(fn) {
    setSync('busy');
    try { await fn(); setSync('ok'); }
    catch (e) { console.error(e); setSync('error', e.message); toast('Could not save: ' + e.message, 'crit'); }
  }
  async function save(kind, data, opts) {
    const item = commit(kind, data);
    if (!opts || !opts.silent) render();
    await persist(() => store.put(item));
    return data;
  }
  async function saveItems(list, opts) {
    const items = list.map((x) => commit(x.kind, x.data));
    if (!opts || !opts.silent) render();
    await persist(() => store.putMany(items));
  }
  async function del(id) {
    state.items.delete(id); recentWrites.set(id, Date.now()); render();
    await persist(() => store.remove(id));
  }
  async function delMany(ids) {
    ids.forEach((id) => { state.items.delete(id); recentWrites.set(id, Date.now()); });
    render();
    await persist(() => store.removeMany(ids));
  }

  /* settings + members */
  const S = () => getItem(SETTINGS_ID) || DEFAULT_SETTINGS;
  const members = () => sortBy(byKind('member').filter((m) => !m.archived), (m) => [m.order || 0, m.name]);
  const creators = () => members().filter((m) => m.role === 'creator');
  const editors = () => members().filter((m) => m.role === 'editor');
  const member = (id) => (id ? getItem(id) : null);
  const memberName = (id) => { const m = member(id); return m ? m.name : 'Unassigned'; };

  /* drops + videos */
  const drops = () => sortBy(byKind('drop'), (d) => -d.number);
  const videos = () => byKind('video');
  const dropVideos = (dropId) => sortBy(videos().filter((v) => v.dropId === dropId), (v) => v.code || '');
  const dropCode = (d) => 'D' + String(d.number).padStart(2, '0');
  const openDrops = () => drops().filter((d) => d.status === 'sent' || d.status === 'editing');
  const isOnCalendar = (v) => (v.status === 'scheduled' || v.status === 'posted') && !!v.scheduledDate;
  const blankPlatforms = () => ({ instagram: { posted: false, at: null }, tiktok: { posted: false, at: null } });
  const platforms = (v) => { if (!v.platforms || !v.platforms.instagram || !v.platforms.tiktok) v.platforms = blankPlatforms(); return v.platforms; };

  /* ------------------------------------------------------------------------
     4. Domain logic
     ------------------------------------------------------------------------ */
  function rotaMembers() {
    const cs = creators();
    const order = (S().rotaOrder || []).map((id) => cs.find((m) => m.id === id)).filter(Boolean);
    cs.forEach((m) => { if (!order.includes(m)) order.push(m); });
    return order;
  }
  /* Who posts on a given day: an explicit swap wins, otherwise the rota. */
  function posterFor(key) {
    const ov = getItem('override_' + key);
    if (ov && ov.posterId && member(ov.posterId) && !member(ov.posterId).archived) return { id: ov.posterId, source: 'override', note: ov.note || '' };
    const list = rotaMembers();
    if (!list.length) return null;
    const s = S();
    if (s.rotaMode === 'weekday') {
      const wd = isoWeekday(parseKey(key));
      const id = s.rotaWeekday && s.rotaWeekday[wd];
      const m = list.find((x) => x.id === id);
      return { id: (m || list[0]).id, source: 'rota' };
    }
    const anchor = s.rotaAnchor || firstOfMonth(monthOf(todayKey()));
    let n = s.rotaMode === 'weeks'
      ? Math.floor(daysBetween(startOfWeek(anchor, s.weekStart), key) / 7)
      : daysBetween(anchor, key);
    const idx = ((n % list.length) + list.length) % list.length;
    return { id: list[idx].id, source: 'rota' };
  }
  function slotsFor(key) {
    const n = Math.max(1, Math.round(S().postsPerDay) || 1);
    const dayVideos = sortBy(videos().filter((v) => isOnCalendar(v) && v.scheduledDate === key), (v) => v.slot || 99);
    const slots = [];
    const used = {};
    for (let i = 1; i <= n; i++) {
      const v = dayVideos.find((x) => x.slot === i && !used[x.id]);
      if (v) used[v.id] = true;
      slots.push({ slot: i, video: v || null });
    }
    dayVideos.forEach((v) => { if (!used[v.id]) { used[v.id] = true; slots.push({ slot: slots.length + 1, video: v, extra: true }); } });
    return slots;
  }
  function nextFreeSlot(key) {
    const slots = slotsFor(key);
    const free = slots.find((s) => !s.video);
    return free ? free.slot : slots.length + 1;
  }
  function dayState(key) {
    const slots = slotsFor(key);
    const filled = slots.filter((s) => s.video).length;
    const posted = slots.filter((s) => s.video && s.video.status === 'posted').length;
    return { slots: slots, filled: filled, posted: posted, total: slots.length, empty: slots.length - filled };
  }

  function monthStats(mk) {
    const s = S();
    const all = videos();
    const tk = todayKey();
    const curMonth = monthOf(tk);
    const dim = daysInMonth(mk);
    const posted = all.filter((v) => v.status === 'posted' && v.postedDate && monthOf(v.postedDate) === mk).length;
    const scheduled = all.filter((v) => v.status === 'scheduled' && v.scheduledDate && monthOf(v.scheduledDate) === mk).length;
    const ready = all.filter((v) => v.status === 'approved').length;
    const editing = all.filter((v) => v.status === 'editing' || v.status === 'changes').length;
    const review = all.filter((v) => v.status === 'delivered').length;
    const dayIndex = mk < curMonth ? dim : (mk > curMonth ? 0 : Number(tk.slice(8, 10)));
    const expected = Math.round(s.monthlyTarget * dayIndex / dim);
    const remaining = Math.max(0, s.monthlyTarget - posted);
    const remainingDays = Math.max(0, dim - dayIndex);
    return { target: s.monthlyTarget, posted: posted, scheduled: scheduled, ready: ready, editing: editing, review: review,
      expected: expected, diff: posted - expected, dim: dim, dayIndex: dayIndex, remaining: remaining, remainingDays: remainingDays,
      perDay: remainingDays ? remaining / remainingDays : 0 };
  }
  function gapsAhead(fromKey, days) {
    const out = [];
    for (let i = 0; i < days; i++) { const k = addDays(fromKey, i); const ds = dayState(k); if (ds.empty > 0) out.push({ key: k, empty: ds.empty }); }
    return out;
  }
  function dropMath() {
    const s = S();
    const perDrop = Math.ceil(s.monthlyTarget / Math.max(1, s.dropsPerMonth));
    const clips = Math.ceil(perDrop / Math.max(1, s.variationsPerClip));
    const everyDays = Math.round(30 / Math.max(1, s.dropsPerMonth));
    return { perDrop: perDrop, clips: clips, everyDays: everyDays, perDay: s.monthlyTarget / 30 };
  }
  function suggestedNextDrop() {
    const all = drops();
    if (!all.length) return todayKey();
    const last = sortBy(all, (d) => d.sentAt || '').slice(-1)[0];
    return addDays(dateKeyOfIso(last.sentAt), dropMath().everyDays);
  }
  function makeVideoCode(drop, clipId) {
    const siblings = videos().filter((v) => v.dropId === drop.id && (clipId ? v.clipId === clipId : !v.clipId));
    const n = siblings.length + 1;
    if (clipId) {
      const idx = (drop.clips || []).findIndex((c) => c.id === clipId) + 1;
      return dropCode(drop) + '-C' + pad2(idx) + '-v' + n;
    }
    return dropCode(drop) + '-v' + n;
  }
  function newVideo(drop, fields) {
    return Object.assign({
      id: uid('video'), code: makeVideoCode(drop, fields && fields.clipId), title: '', dropId: drop.id, clipId: null,
      editorId: drop.editorId || null, status: 'editing', fileLink: '', caption: '', notes: '', platforms: blankPlatforms(),
      scheduledDate: null, slot: null, posterId: null, postedDate: null, postedAt: null, deliveredAt: null, approvedAt: null, createdAt: nowIso()
    }, fields || {});
  }
  function parseTitleLine(line, drop) {
    const m = line.match(/^c(\d+)\s*[:\-–]\s*(.+)$/i);
    if (m && drop.clips && drop.clips[Number(m[1]) - 1]) return { title: m[2].trim(), clipId: drop.clips[Number(m[1]) - 1].id };
    return { title: line.trim(), clipId: null };
  }

  /* status transitions keep the calendar consistent */
  function setStatus(v, status) {
    const now = nowIso();
    const wasOnCalendar = v.status === 'scheduled' || v.status === 'posted';
    const willBeOnCalendar = status === 'scheduled' || status === 'posted';
    if (v.status === 'posted' && status !== 'posted') { v.platforms = blankPlatforms(); v.postedDate = null; v.postedAt = null; }
    if (wasOnCalendar && !willBeOnCalendar) { v.scheduledDate = null; v.slot = null; v.posterId = null; }
    v.status = status;
    if (status === 'delivered' && !v.deliveredAt) v.deliveredAt = now;
    if ((status === 'approved' || status === 'scheduled' || status === 'posted') && !v.approvedAt) v.approvedAt = now;
    if (status === 'scheduled' && !v.scheduledDate) { v.scheduledDate = todayKey(); v.slot = nextFreeSlot(v.scheduledDate); }
    if (status === 'posted') {
      v.platforms = { instagram: { posted: true, at: now }, tiktok: { posted: true, at: now } };
      if (!v.scheduledDate) { v.scheduledDate = todayKey(); v.slot = nextFreeSlot(v.scheduledDate); }
      v.postedDate = v.scheduledDate; v.postedAt = now;
    }
  }
  function setPlatform(v, platform, on) {
    const p = platforms(v);
    p[platform] = { posted: !!on, at: on ? nowIso() : null };
    const both = p.instagram.posted && p.tiktok.posted;
    if (both) {
      if (!v.scheduledDate) { v.scheduledDate = todayKey(); v.slot = nextFreeSlot(v.scheduledDate); }
      v.status = 'posted'; v.postedDate = v.scheduledDate; v.postedAt = v.postedAt || nowIso();
      if (!v.approvedAt) v.approvedAt = nowIso();
    } else {
      if (v.status === 'posted') { v.status = 'scheduled'; v.postedDate = null; v.postedAt = null; }
      else if (v.status !== 'scheduled') {
        v.status = 'scheduled';
        if (!v.approvedAt) v.approvedAt = nowIso();
        if (!v.scheduledDate) { v.scheduledDate = todayKey(); v.slot = nextFreeSlot(v.scheduledDate); }
      }
    }
  }
  function scheduleVideo(v, date, slot, posterId) {
    v.scheduledDate = date; v.slot = slot; v.posterId = posterId || null;
    if (v.status !== 'posted') v.status = 'scheduled';
    if (!v.approvedAt) v.approvedAt = nowIso();
  }
  function autoFillPlan(fromKey, days) {
    const ready = sortBy(videos().filter((v) => v.status === 'approved'), (v) => (v.approvedAt || v.createdAt || ''));
    const touched = [];
    let i = 0;
    for (let d = 0; d < days && i < ready.length; d++) {
      const key = addDays(fromKey, d);
      slotsFor(key).forEach((s) => {
        if (s.video || i >= ready.length) return;
        const v = ready[i++];
        scheduleVideo(v, key, s.slot, null);
        touched.push(v);
      });
    }
    return { touched: touched, readyCount: ready.length };
  }

  /* message templates for WhatsApp / Slack / email */
  function handoffMessage(d) {
    const s = S();
    const clips = (d.clips || []).length;
    return [
      'Drop ' + dropCode(d) + ' — ' + d.title,
      'Raw footage: ' + (d.driveLink || '(add the Drive link)'),
      (clips ? clips + ' clips → ' : '') + 'target ' + d.targetVideos + ' videos',
      'Deadline: ' + fmtDT(d.dueAt) + ' (' + s.editorSlaHours + 'h turnaround)',
      d.brief ? 'Brief: ' + d.brief : '',
      'From ' + memberName(d.sentBy) + ' · editor: ' + memberName(d.editorId)
    ].filter(Boolean).join('\n');
  }
  function deliveryMessage(d) {
    const vids = dropVideos(d.id).filter((v) => v.status !== 'editing');
    return [
      'Drop ' + dropCode(d) + ' delivered — ' + plural(vids.length, 'video'),
      'Edited files: ' + (d.deliveredLink || '(add the Drive link)'),
      d.deliveryNote ? 'Notes: ' + d.deliveryNote : '',
      'Please review within ' + S().reviewSlaHours + 'h so posting never stalls.'
    ].filter(Boolean).join('\n');
  }
  function dayMessage(key) {
    const p = posterFor(key);
    const lines = ['Posting plan for ' + fmtDay(key) + (p ? ' — ' + memberName(p.id) + ' posts' : '')];
    slotsFor(key).forEach((s) => {
      lines.push(s.slot + '. ' + (s.video ? (s.video.title + (s.video.fileLink ? ' — ' + s.video.fileLink : '') + (s.video.caption ? '\n   Caption: ' + s.video.caption : '')) : '(empty slot)'));
    });
    lines.push('Post on Instagram + TikTok, then tick both in the board.');
    return lines.join('\n');
  }

  /* ------------------------------------------------------------------------
     5. Shared templates + pages
     ------------------------------------------------------------------------ */
  const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  function memberChip(id) {
    const m = member(id);
    if (!m) return '<span class="muted">Unassigned</span>';
    return '<span class="mem"><span class="mem-dot" style="--mc: var(--m-' + esc(m.color) + ')"></span>' + esc(m.name) + '</span>';
  }
  function avatar(id, size, extra) {
    const m = member(id);
    if (!m) return '';
    const cls = ['avatar', size || '', LIGHT_COLORS[m.color] ? 'is-light' : '', extra || ''].filter(Boolean).join(' ');
    return '<span class="' + cls + '" style="--mc: var(--m-' + esc(m.color) + ')" title="' + esc(m.name) + '">' + esc(initials(m.name)) + '</span>';
  }
  const pill = (label, tone, extra) => '<span class="pill tone-' + (tone || 'neutral') + (extra ? ' ' + extra : '') + '">' + esc(label) + '</span>';
  const statusPill = (v) => { const s = VS[v.status] || VS.editing; return pill(s.label, s.tone); };
  const dropPill = (d) => { const r = DSTATUS[d.status] || DSTATUS.sent; return pill(r[0], r[1]); };
  const linkBtn = (url, label, cls) => url ? '<a class="btn btn-sm ' + (cls || '') + '" href="' + esc(url) + '" target="_blank" rel="noopener">' + I.ext + ' ' + esc(label || 'Open') + '</a>' : '';
  const platTicks = (v) => { const p = platforms(v); return '<span class="plat" title="Instagram / TikTok"><span class="' + (p.instagram.posted ? 'is-on' : '') + '">IG</span><span class="' + (p.tiktok.posted ? 'is-on' : '') + '">TT</span></span>'; };
  const countdownHtml = (dueIso) => { const c = countdown(dueIso, state.now); return '<span class="count is-' + c.tone + '">' + esc(c.text) + '</span>'; };
  function selectHtml(name, options, value, attrs) {
    return '<select name="' + esc(name) + '" ' + (attrs || '') + '>' + options.map((o) => '<option value="' + esc(o.value) + '"' + (String(o.value) === String(value == null ? '' : value) ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') + '</select>';
  }
  const memberOptions = (list, emptyLabel) => (emptyLabel != null ? [{ value: '', label: emptyLabel }] : []).concat(list.map((m) => ({ value: m.id, label: m.name })));
  const pageHead = (title, sub, actions) => '<div class="page-head"><div><h1>' + title + '</h1>' + (sub ? '<div class="page-sub">' + sub + '</div>' : '') + '</div>' + (actions ? '<div class="page-actions">' + actions + '</div>' : '') + '</div>';

  function exampleBanner() {
    if (!S().exampleData) return '';
    return '<div class="banner">' + I.alert + '<div><strong>Example data.</strong> Everything on the board is a sample so you can try the whole flow. Clear it when the team is ready to start for real.</div><div class="spacer"></div><button type="button" class="btn btn-sm" data-action="clearExample" data-confirm="Clear every example drop and video?">Clear example data</button></div>';
  }

  /* ---- Today ---- */
  function pageToday() {
    const tk = todayKey();
    const mk = monthOf(tk);
    const st = monthStats(mk);
    const s = S();
    const me = member(state.me);
    const poster = posterFor(tk);
    const ds = dayState(tk);
    const open = openDrops();
    const overdue = open.filter((d) => countdown(d.dueAt, state.now).late);
    const gaps = gapsAhead(addDays(tk, 1), 7);
    const scheduledAhead = videos().filter((v) => v.status === 'scheduled' && v.scheduledDate && v.scheduledDate >= tk).length;
    const review = videos().filter((v) => v.status === 'delivered');

    let greeting = '';
    if (me && poster && poster.id === me.id) greeting = 'You are posting today.';
    else if (me && me.role === 'editor') {
      const mine = open.filter((d) => d.editorId === me.id);
      greeting = mine.length ? 'You have ' + plural(mine.length, 'open drop') + '.' : 'Nothing is waiting for you right now.';
    } else if (poster) greeting = memberName(poster.id) + ' is posting today.';

    const pace = st.diff === 0 ? pill('On pace', 'good') : st.diff > 0 ? pill(st.diff + ' ahead of pace', 'good') : pill(Math.abs(st.diff) + ' behind pace', st.diff < -4 ? 'crit' : 'warn');
    const need = st.remaining === 0 ? 'Monthly target reached.' : st.remainingDays === 0 ? plural(st.remaining, 'post') + ' short of the target.' : plural(st.remaining, 'more post') + ' in ' + plural(st.remainingDays, 'day') + ' (' + (Math.round(st.perDay * 10) / 10) + ' per day).';

    /* day strip: one square per day of the month */
    const strip = [];
    for (let d = 1; d <= st.dim; d++) {
      const key = mk + '-' + pad2(d);
      const dst = dayState(key);
      const future = key > tk;
      let cls = 'ds';
      let attr = '';
      if (future) { cls += ' is-future' + (dst.filled ? ' has-sched' : '') + (dst.filled >= dst.total ? ' is-full' : ''); }
      else {
        const n = dst.posted;
        attr = ' data-n="' + (n >= dst.total ? 'full' : n) + '"';
        if (key < tk && n === 0) cls += ' is-missed';
      }
      if (key === tk) cls += ' is-today';
      const tip = fmtDay(key) + ': ' + (future ? plural(dst.filled, 'video') + ' scheduled' : plural(dst.posted, 'post') + ' published');
      strip.push('<div class="' + cls + '"' + attr + ' data-tip="' + esc(tip) + '"></div>');
    }
    const C = 2 * Math.PI * 52;
    const pct = st.target ? Math.min(1, st.posted / st.target) : 0;
    const hero = '<section class="card"><div class="hero">' +
      '<div class="ring-wrap"><svg viewBox="0 0 120 120"><circle class="ring-track" cx="60" cy="60" r="52" fill="none" stroke-width="10"/><circle class="ring-fill" cx="60" cy="60" r="52" fill="none" stroke-width="10" stroke-linecap="round" transform="rotate(-90 60 60)" stroke-dasharray="' + (pct * C).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg>' +
      '<div class="ring-label"><div class="hero-num">' + st.posted + '</div><div class="hero-den">of ' + st.target + ' posts</div></div></div>' +
      '<div class="hero-body"><div class="flex between"><div><h2>' + esc(fmtMonth(mk)) + '</h2><div class="card-sub">Published on Instagram + TikTok · ' + esc(need) + '</div></div>' + pace + '</div>' +
      '<div class="daystrip" style="grid-template-columns: repeat(' + st.dim + ', minmax(0, 1fr))">' + strip.join('') + '</div>' +
      '<div class="strip-legend"><span><i class="l-full"></i>' + s.postsPerDay + ' posts</span><span><i class="l-half"></i>partly done</span><span><i class="l-missed"></i>missed day</span><span><i class="l-sched"></i>scheduled</span></div>' +
      '</div></div></section>';

    const nextDue = open.length ? sortBy(open, (d) => d.dueAt)[0] : null;
    const tiles = '<div class="grid grid-4">' +
      '<a class="tile" href="#videos" data-action="gotoStatus" data-status="approved"><div class="tile-label">Ready to post</div><div class="tile-value">' + st.ready + '</div><div class="tile-sub">approved, not scheduled yet</div></a>' +
      '<a class="tile' + (gaps.length ? ' is-warn' : '') + '" href="#calendar"><div class="tile-label">Scheduled ahead</div><div class="tile-value">' + scheduledAhead + '</div><div class="tile-sub">' + (gaps.length ? 'first gap: ' + esc(fmtDay(gaps[0].key)) : 'next 7 days are covered') + '</div></a>' +
      '<a class="tile" href="#videos" data-action="gotoStatus" data-status="delivered"><div class="tile-label">Waiting for review</div><div class="tile-value">' + st.review + '</div><div class="tile-sub">' + plural(st.editing, 'video') + ' still in editing</div></a>' +
      '<a class="tile' + (overdue.length ? ' is-alert' : '') + '" href="#drops"><div class="tile-label">Open drops</div><div class="tile-value">' + open.length + '</div><div class="tile-sub">' + (overdue.length ? plural(overdue.length, 'drop') + ' overdue' : nextDue ? 'next: ' + esc(countdown(nextDue.dueAt, state.now).text) : 'nothing with the editor') + '</div></a>' +
      '</div>';

    const slotRows = ds.slots.map((sl) => slotRow(sl, tk)).join('');
    const todayCard = '<section class="card"><div class="card-head"><div><h2>Today\'s posts</h2><div class="card-sub">' +
      (poster ? memberChip(poster.id) + ' is posting' + (poster.source === 'override' ? ' (swapped' + (poster.note ? ': ' + esc(poster.note) : '') + ')' : '') : 'No poster set. Add creators under Team.') +
      '</div></div><div class="flex"><button type="button" class="btn btn-sm" data-action="copyDay" data-date="' + tk + '">' + I.copy + ' Copy list</button><button type="button" class="btn btn-sm" data-action="openDay" data-date="' + tk + '">Edit day</button></div></div>' +
      '<div class="slots">' + slotRows + '</div></section>';

    const weekRows = [];
    for (let i = 1; i <= 7; i++) {
      const k = addDays(tk, i);
      const p = posterFor(k);
      const dsk = dayState(k);
      const tone = dsk.empty === 0 ? 'good' : dsk.filled === 0 ? 'crit' : 'warn';
      weekRows.push('<div class="row is-click" data-action="openDay" data-date="' + k + '"><div class="row-main"><div class="row-title">' + esc(fmtDay(k)) + '</div><div class="row-sub">' + (p ? memberChip(p.id) : '<span class="muted">no poster</span>') + '</div></div><div class="row-side">' + pill(dsk.filled + '/' + dsk.total + ' filled', tone) + '</div></div>');
    }
    const weekCard = '<section class="card"><div class="card-head"><div><h2>Next 7 days</h2><div class="card-sub">' + (gaps.length ? plural(gaps.reduce((a, g) => a + g.empty, 0), 'empty slot') + ' to fill' : 'Every slot has a video') + '</div></div>' +
      (gaps.length && st.ready ? '<button type="button" class="btn btn-sm btn-primary" data-action="autoFill" data-from="' + addDays(tk, 1) + '" data-days="14">' + I.wand + ' Auto-fill from Ready</button>' : '') +
      '</div><div class="list">' + weekRows.join('') + '</div></section>';

    const dropRows = sortBy(open, (d) => d.dueAt).map((d) => {
      const c = countdown(d.dueAt, state.now);
      return '<div class="row is-click" data-action="openDrop" data-id="' + d.id + '"><div class="row-main"><div class="row-title"><span class="mono muted">' + dropCode(d) + '</span> ' + esc(d.title) + '</div><div class="row-sub">' + memberChip(d.editorId) + ' · ' + (d.status === 'editing' ? 'editing' : 'sent, not started') + ' · ' + plural((d.clips || []).length, 'clip') + ' → ' + d.targetVideos + ' videos</div></div><div class="row-side"><span class="count is-' + c.tone + '">' + esc(c.text) + '</span>' + linkBtn(d.driveLink, 'Footage') + '</div></div>';
    }).join('');
    const nextDrop = suggestedNextDrop();
    const dropsCard = '<section class="card"><div class="card-head"><div><h2>Editor deadlines</h2><div class="card-sub">' + s.editorSlaHours + 'h turnaround from the moment a drop is sent</div></div><button type="button" class="btn btn-sm" data-action="newDrop">' + I.plus + ' New drop</button></div>' +
      (dropRows ? '<div class="list">' + dropRows + '</div>' : '<div class="empty">Nothing is with the editor. Plan the next drop around <strong>' + esc(fmtDay(nextDrop)) + '</strong>.</div>') +
      (open.length && nextDrop >= tk ? '<div class="small muted mt">Next drop suggested around ' + esc(fmtDay(nextDrop)) + ' (every ' + dropMath().everyDays + ' days for ' + s.dropsPerMonth + ' drops a month).</div>' : '') +
      '</section>';

    const reviewRows = sortBy(review, (v) => v.deliveredAt || '').slice(0, 6).map((v) => {
      const d = getItem(v.dropId);
      const waited = v.deliveredAt ? Date.now() - new Date(v.deliveredAt).getTime() : 0;
      const late = waited > s.reviewSlaHours * 3600000;
      return '<div class="row is-click" data-action="openVideo" data-id="' + v.id + '"><div class="row-main"><div class="row-title">' + esc(v.title) + '</div><div class="row-sub"><span class="mono">' + esc(v.code) + '</span>' + (d ? ' · ' + esc(d.title) : '') + ' · ' + memberChip(v.editorId) + '</div></div><div class="row-side"><span class="count ' + (late ? 'is-late' : 'is-ok') + '">' + (v.deliveredAt ? 'waiting ' + fmtDuration(waited) : '') + '</span>' + linkBtn(v.fileLink, 'Watch') + '</div></div>';
    }).join('');
    const reviewCard = '<section class="card"><div class="card-head"><div><h2>Needs a review</h2><div class="card-sub">Approve within ' + s.reviewSlaHours + 'h so the editor\'s work does not stall</div></div>' + (review.length > 6 ? '<a class="btn btn-sm" href="#videos" data-action="gotoStatus" data-status="delivered">See all ' + review.length + '</a>' : '') + '</div>' +
      (reviewRows ? '<div class="list">' + reviewRows + '</div>' : '<div class="empty">No delivered videos are waiting for approval.</div>') + '</section>';

    return pageHead('Today', esc(fmtDayLong(tk)) + (greeting ? ' · ' + esc(greeting) : ''), '<button type="button" class="btn btn-primary" data-action="newDrop">' + I.plus + ' New drop</button>') +
      '<div class="stack-lg">' + hero + tiles + '<div class="grid grid-2"><div class="stack-lg">' + todayCard + weekCard + '</div><div class="stack-lg">' + dropsCard + reviewCard + '</div></div></div>';
  }

  function slotRow(sl, key) {
    const v = sl.video;
    if (!v) {
      const ready = videos().filter((x) => x.status === 'approved').length;
      return '<div class="slot"><span class="slot-n">' + sl.slot + '</span><div class="muted">Empty slot' + (ready ? ' · ' + plural(ready, 'ready video') + ' available' : '') + '</div><button type="button" class="btn btn-sm" data-action="openDay" data-date="' + key + '">Assign</button></div>';
    }
    const p = platforms(v);
    const d = getItem(v.dropId);
    const checks = PLATFORMS.map((pl) => '<label><input type="checkbox" data-change="togglePlatform" data-id="' + v.id + '" data-platform="' + pl[0] + '"' + (p[pl[0]].posted ? ' checked' : '') + '> ' + pl[2] + '</label>').join('');
    return '<div class="slot"><span class="slot-n">' + sl.slot + '</span><div class="row-main"><div class="row-title"><a href="#" data-action="openVideo" data-id="' + v.id + '" style="color:inherit;text-decoration:none">' + esc(v.title) + '</a></div><div class="row-sub"><span class="mono">' + esc(v.code) + '</span>' + (d ? ' · ' + esc(d.title) : '') + (v.status === 'posted' ? ' · ' + pill('Posted', 'done') : '') + ' ' + linkBtn(v.fileLink, 'File', 'btn-ghost') + '</div></div><div class="slot-checks">' + checks + '</div></div>';
  }

  /* ---- Drops ---- */
  function pageDrops() {
    const all = drops();
    const rows = all.map((d) => {
      const vids = dropVideos(d.id);
      const approved = vids.filter((v) => v.status === 'approved' || v.status === 'scheduled' || v.status === 'posted').length;
      let deadline;
      if (d.status === 'sent' || d.status === 'editing') deadline = countdownHtml(d.dueAt);
      else if (d.deliveredAt) {
        const late = new Date(d.deliveredAt) - new Date(d.dueAt);
        deadline = '<span class="count ' + (late > 0 ? 'is-late' : 'is-ok') + '">' + (late > 0 ? 'late by ' + fmtDuration(late) : 'on time') + '</span><div class="small muted">' + fmtDuration(new Date(d.deliveredAt) - new Date(d.sentAt)) + ' turnaround</div>';
      } else deadline = '—';
      return '<tr class="is-click" data-action="openDrop" data-id="' + d.id + '">' +
        '<td class="td-main"><div class="row-title"><span class="mono muted">' + dropCode(d) + '</span> ' + esc(d.title) + '</div><div class="row-sub">' + plural((d.clips || []).length, 'clip') + ' · target ' + d.targetVideos + ' · sent by ' + esc(memberName(d.sentBy)) + '</div></td>' +
        '<td data-th="Sent" class="small">' + esc(fmtDT(d.sentAt)) + '</td>' +
        '<td data-th="Editor">' + memberChip(d.editorId) + '</td>' +
        '<td data-th="Deadline">' + deadline + '</td>' +
        '<td data-th="Videos" class="num">' + vids.length + ' <span class="muted small">(' + approved + ' approved)</span></td>' +
        '<td data-th="Status">' + dropPill(d) + '</td>' +
        '<td data-th="Footage">' + (linkBtn(d.driveLink, 'Raw') || '<span class="muted small">no link</span>') + '</td></tr>';
    }).join('');
    const s = S();
    const m = dropMath();
    return pageHead('Drops', 'Raw footage batches, from filming to delivery. Every drop has a ' + s.editorSlaHours + '-hour clock.', '<button type="button" class="btn btn-primary" data-action="newDrop">' + I.plus + ' New drop</button>') +
      '<div class="stack-lg"><div class="card"><div class="card-head"><div><h2>All drops</h2><div class="card-sub">Plan: ' + s.dropsPerMonth + ' drops a month, about ' + m.perDrop + ' videos each, ' + m.clips + '+ clips per drop.</div></div></div>' +
      (rows ? '<div class="table-wrap"><table class="table"><thead><tr><th>Drop</th><th>Sent</th><th>Editor</th><th>Deadline</th><th>Videos</th><th>Status</th><th>Footage</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty">No drops yet. Film, upload the raw footage to Drive, then create the first drop.</div>') +
      '</div></div>';
  }

  /* ---- Videos board ---- */
  function pageVideos() {
    const f = state.filters;
    const tk = todayKey();
    let list = videos();
    if (f.drop) list = list.filter((v) => v.dropId === f.drop);
    if (f.editor) list = list.filter((v) => v.editorId === f.editor);
    if (f.q) { const q = f.q.toLowerCase(); list = list.filter((v) => (v.title + ' ' + v.code + ' ' + (v.caption || '')).toLowerCase().includes(q)); }
    const postedCutoff = addDays(tk, -14);
    const cols = VSTATUS.map((row) => {
      const key = row[0];
      let items = list.filter((v) => v.status === key);
      let hidden = 0;
      if (key === 'posted') { const before = items.length; items = items.filter((v) => (v.postedDate || '') >= postedCutoff); hidden = before - items.length; }
      items = key === 'scheduled' ? sortBy(items, (v) => [v.scheduledDate || '', v.slot || 0]) : key === 'posted' ? sortBy(items, (v) => -(new Date(v.postedAt || 0).getTime())) : sortBy(items, (v) => v.createdAt || '');
      const cards = items.map(videoCard).join('');
      return '<div class="kcol' + (f.status === key ? ' is-focus' : '') + '" data-drop-status="' + key + '"><div class="kcol-head"><span>' + esc(row[1]) + '</span><span class="kcount">' + items.length + '</span></div>' + (cards || '<div class="kempty">Drop a card here</div>') + (hidden ? '<div class="kempty">' + hidden + ' older posted videos live in the Calendar</div>' : '') + '</div>';
    }).join('');
    const dropOpts = [{ value: '', label: 'All drops' }].concat(drops().map((d) => ({ value: d.id, label: dropCode(d) + ' · ' + d.title })));
    const edOpts = [{ value: '', label: 'All editors' }].concat(editors().map((m) => ({ value: m.id, label: m.name })));
    const filters = '<div class="filters">' + selectHtml('drop', dropOpts, f.drop, 'id="f-drop" data-change="filter" data-key="drop" aria-label="Filter by drop"') + selectHtml('editor', edOpts, f.editor, 'id="f-editor" data-change="filter" data-key="editor" aria-label="Filter by editor"') +
      '<input type="search" id="f-q" placeholder="Search title or code" value="' + esc(f.q) + '" data-input="filter" data-key="q" aria-label="Search videos">' + ((f.drop || f.editor || f.q) ? '<button type="button" class="btn btn-sm btn-ghost" data-action="clearFilters">Clear</button>' : '') + '</div>';
    return pageHead('Videos', 'Every edit from delivery to posting. Drag a card to move it, or open it for details.', '<button type="button" class="btn btn-primary" data-action="addVideos">' + I.plus + ' Add videos</button>') +
      filters + '<div class="kanban">' + cols + '</div>';
  }
  function videoCard(v) {
    const d = getItem(v.dropId);
    const meta = [];
    if (v.editorId) meta.push(memberChip(v.editorId));
    if (v.scheduledDate && (v.status === 'scheduled' || v.status === 'posted')) meta.push('<span>' + esc(fmtDay(v.scheduledDate)) + (v.slot ? ' · slot ' + v.slot : '') + '</span>');
    if (v.status === 'scheduled' || v.status === 'posted') meta.push(platTicks(v));
    return '<div class="kcard" draggable="true" data-drag="video" data-action="openVideo" data-id="' + v.id + '" role="button" tabindex="0"><div class="kcode"><span>' + esc(v.code) + (d ? ' · ' + esc(d.title) : '') + '</span>' + (v.fileLink ? I.ext : '') + '</div><div class="kcard-title">' + esc(v.title || 'Untitled') + '</div>' + (meta.length ? '<div class="kmeta">' + meta.join('') + '</div>' : '') + '</div>';
  }

  /* ---- Calendar ---- */
  function pageCalendar() {
    const s = S();
    const mk = state.month;
    const tk = todayKey();
    const st = monthStats(mk);
    const first = firstOfMonth(mk);
    const gridStart = startOfWeek(first, s.weekStart);
    const dim = daysInMonth(mk);
    const last = mk + '-' + pad2(dim);
    const totalDays = daysBetween(gridStart, last) + 1;
    const weeks = Math.ceil(totalDays / 7);
    const dows = [];
    for (let i = 0; i < 7; i++) dows.push('<div class="cal-dow">' + esc(weekdayName(((s.weekStart - 1 + i) % 7) + 1)) + '</div>');
    const cells = [];
    for (let i = 0; i < weeks * 7; i++) {
      const key = addDays(gridStart, i);
      const inMonth = monthOf(key) === mk;
      const p = posterFor(key);
      const ov = getItem('override_' + key);
      const slots = slotsFor(key);
      const slotHtml = slots.map((sl) => {
        if (!sl.video) return '<span class="cal-slot ' + (key < tk ? 'is-missed' : 'is-empty') + '"><span class="t">' + (key < tk ? 'Missed' : 'Empty') + '</span></span>';
        const v = sl.video;
        const pf = platforms(v);
        const cls = v.status === 'posted' ? 'is-posted' : (pf.instagram.posted || pf.tiktok.posted) ? 'is-partial' : 'is-scheduled';
        return '<span class="cal-slot ' + cls + '" title="' + esc(v.title) + '"><span class="t truncate">' + esc(v.title) + '</span></span>';
      }).join('');
      cells.push('<button type="button" class="cal-cell' + (inMonth ? '' : ' is-out') + (key === tk ? ' is-today' : '') + '" data-action="openDay" data-date="' + key + '" aria-label="' + esc(fmtDayLong(key)) + '"><span class="cal-top"><span class="cal-day">' + Number(key.slice(8, 10)) + '</span>' + (p ? avatar(p.id, 'sm', ov ? 'is-swapped' : '') : '') + '</span>' + slotHtml + '</button>');
    }
    const gapCount = (function () { let n = 0; for (let d = 1; d <= dim; d++) { const k = mk + '-' + pad2(d); if (k >= tk) n += dayState(k).empty; } return n; })();
    const rotaText = s.rotaMode === 'weekday' ? 'Fixed weekdays' : s.rotaMode === 'weeks' ? 'Alternating weeks' : 'Alternating days';
    const legend = '<div class="cal-legend">' + rotaMembers().map((m) => memberChip(m.id)).join('') + '<span class="muted">·</span><span class="cal-slot is-posted">posted</span><span class="cal-slot is-partial">one platform</span><span class="cal-slot is-scheduled">scheduled</span><span class="cal-slot is-empty">empty</span><span class="cal-slot is-missed">missed</span></div>';
    return pageHead('Calendar', 'Who posts what, day by day. ' + esc(rotaText) + ' · ' + s.postsPerDay + ' posts per day · <a href="#team">change the rota</a>',
      '<div class="seg"><button type="button" data-action="calMonth" data-dir="-1" aria-label="Previous month">' + I.left + '</button><button type="button" data-action="calMonth" data-dir="0">Today</button><button type="button" data-action="calMonth" data-dir="1" aria-label="Next month">' + I.right + '</button></div>' +
      (gapCount && st.ready ? '<button type="button" class="btn btn-primary" data-action="autoFill" data-from="' + (mk === monthOf(tk) ? tk : mk > monthOf(tk) ? first : tk) + '" data-days="' + dim + '">' + I.wand + ' Auto-fill ' + Math.min(gapCount, st.ready) + ' slots</button>' : '')) +
      '<div class="stack-lg"><div class="card"><div class="card-head"><div><h2>' + esc(fmtMonth(mk)) + '</h2><div class="card-sub">' + st.posted + ' posted · ' + st.scheduled + ' scheduled · ' + gapCount + ' empty slots ahead · target ' + st.target + '</div></div>' + legend + '</div>' +
      '<div class="cal">' + dows.join('') + cells.join('') + '</div></div></div>';
  }

  /* ---- Team & settings ---- */
  function pageTeam() {
    const s = S();
    const ms = members();
    const memberRows = ms.map((m) => '<div class="row is-click" data-action="openMember" data-id="' + m.id + '">' + avatar(m.id) + '<div class="row-main"><div class="row-title">' + esc(m.name) + (state.me === m.id ? ' <span class="muted small">(you on this device)</span>' : '') + '</div><div class="row-sub">' + (m.role === 'creator' ? 'Creator · films, reviews and posts' : 'Editor · turns drops into videos') + '</div></div><div class="row-side">' + I.edit + '</div></div>').join('');
    const teamCard = '<section class="card"><div class="card-head"><div><h2>Team</h2><div class="card-sub">Creators post and review, editors deliver. Tap a person to rename or recolour them.</div></div><button type="button" class="btn btn-sm" data-action="openMember">' + I.plus + ' Add person</button></div><div class="list">' + memberRows + '</div></section>';

    const cs = rotaMembers();
    const firstOpts = cs.map((m) => ({ value: m.id, label: m.name }));
    const weekdayRows = [1, 2, 3, 4, 5, 6, 7].map((wd) => '<div class="field"><label>' + esc(weekdayName(wd, 'long')) + '</label>' + selectHtml('wd' + wd, memberOptions(cs), (s.rotaWeekday || {})[wd] || (cs[0] ? cs[0].id : ''), 'id="wd' + wd + '"') + '</div>').join('');
    const preview = [];
    for (let i = 0; i < 10; i++) { const k = addDays(todayKey(), i); const p = posterFor(k); preview.push('<span class="pill no-dot">' + esc(fmtDay(k)) + ' · ' + esc(p ? memberName(p.id) : '—') + '</span>'); }
    const rotaCard = '<section class="card"><form data-submit="saveRota"><div class="card-head"><div><h2>Posting rota</h2><div class="card-sub">Decides who is responsible for posting each day. Single days can still be swapped in the Calendar.</div></div></div>' +
      '<div class="stack"><div class="radio-list">' +
      '<label><input type="radio" name="rotaMode" value="days"' + (s.rotaMode === 'days' ? ' checked' : '') + '><span>Alternate days<span class="hint">One person per day, taking turns. The most even split for two creators.</span></span></label>' +
      '<label><input type="radio" name="rotaMode" value="weeks"' + (s.rotaMode === 'weeks' ? ' checked' : '') + '><span>Alternate weeks<span class="hint">One person owns a whole week, then the next person.</span></span></label>' +
      '<label><input type="radio" name="rotaMode" value="weekday"' + (s.rotaMode === 'weekday' ? ' checked' : '') + '><span>Fixed weekdays<span class="hint">Choose a poster for each weekday.</span></span></label></div>' +
      '<div class="form-grid"><div class="field"><label for="rotaAnchor">Rotation starts on</label><input type="date" id="rotaAnchor" name="rotaAnchor" value="' + esc(s.rotaAnchor || firstOfMonth(monthOf(todayKey()))) + '"><span class="hint">For alternating modes: the day (or week) the first poster is on.</span></div>' +
      '<div class="field"><label for="rotaFirst">First poster</label>' + selectHtml('rotaFirst', firstOpts, cs[0] ? cs[0].id : '', 'id="rotaFirst"') + '<span class="hint">The others follow in team order.</span></div>' +
      '<div class="field"><label for="weekStart">Week starts on</label>' + selectHtml('weekStart', [{ value: 1, label: 'Monday' }, { value: 7, label: 'Sunday' }], s.weekStart, 'id="weekStart"') + '</div></div>' +
      '<details' + (s.rotaMode === 'weekday' ? ' open' : '') + '><summary class="small strong">Weekday assignments (fixed weekdays mode)</summary><div class="form-grid mt">' + weekdayRows + '</div></details>' +
      '<div><div class="label">Next 10 days</div><div class="flex mt" style="gap:6px">' + preview.join('') + '</div></div>' +
      '<div class="actions"><button class="btn btn-primary" type="submit">Save rota</button></div></div></form></section>';

    const targetsCard = '<section class="card"><form data-submit="saveTargets"><div class="card-head"><div><h2>Targets & deadlines</h2><div class="card-sub">The numbers the whole board is measured against.</div></div></div>' +
      '<div class="form-grid">' +
      '<div class="field"><label for="monthlyTarget">Posts per month</label><input type="number" id="monthlyTarget" name="monthlyTarget" min="1" max="500" value="' + s.monthlyTarget + '"></div>' +
      '<div class="field"><label for="postsPerDay">Posts per day</label><input type="number" id="postsPerDay" name="postsPerDay" min="1" max="6" value="' + s.postsPerDay + '"><span class="hint">Slots on every calendar day.</span></div>' +
      '<div class="field"><label for="editorSlaHours">Editor turnaround (hours)</label><input type="number" id="editorSlaHours" name="editorSlaHours" min="1" max="336" value="' + s.editorSlaHours + '"><span class="hint">Deadline set automatically when a drop is sent.</span></div>' +
      '<div class="field"><label for="reviewSlaHours">Review turnaround (hours)</label><input type="number" id="reviewSlaHours" name="reviewSlaHours" min="1" max="336" value="' + s.reviewSlaHours + '"><span class="hint">How fast creators approve delivered videos.</span></div>' +
      '<div class="field"><label for="dropsPerMonth">Drops per month</label><input type="number" id="dropsPerMonth" name="dropsPerMonth" min="1" max="31" value="' + s.dropsPerMonth + '"></div>' +
      '<div class="field"><label for="variationsPerClip">Variations per clip</label><input type="number" id="variationsPerClip" name="variationsPerClip" min="1" max="20" value="' + s.variationsPerClip + '"><span class="hint">How many videos one raw clip usually becomes.</span></div>' +
      '<div class="field"><label for="bufferDays">Buffer (days)</label><input type="number" id="bufferDays" name="bufferDays" min="0" max="60" value="' + s.bufferDays + '"><span class="hint">Days of ready videos to keep in stock.</span></div>' +
      '<div class="field"><label for="teamName">Team name</label><input type="text" id="teamName" name="teamName" maxlength="60" value="' + esc(s.teamName) + '"></div>' +
      '</div><div class="actions mt"><button class="btn btn-primary" type="submit">Save targets</button></div></form></section>';

    const driveCard = '<section class="card"><form data-submit="saveDrive"><div class="card-head"><div><h2>Drive folders</h2><div class="card-sub">The standing folders everyone uses. Each drop still gets its own link.</div></div></div>' +
      '<div class="stack">' +
      '<div class="field"><label for="driveRaw">Raw footage folder</label><input type="url" id="driveRaw" name="driveRaw" placeholder="https://drive.google.com/…" value="' + esc(s.driveRaw) + '"></div>' +
      '<div class="field"><label for="driveEdits">Edited videos folder</label><input type="url" id="driveEdits" name="driveEdits" placeholder="https://drive.google.com/…" value="' + esc(s.driveEdits) + '"></div>' +
      '<div class="field"><label for="driveAssets">Brand assets (logos, fonts, music)</label><input type="url" id="driveAssets" name="driveAssets" placeholder="https://drive.google.com/…" value="' + esc(s.driveAssets) + '"></div>' +
      '<div class="actions"><button class="btn btn-primary" type="submit">Save folders</button>' + linkBtn(s.driveRaw, 'Raw') + linkBtn(s.driveEdits, 'Edits') + linkBtn(s.driveAssets, 'Assets') + '</div></div></form></section>';

    const counts = { drops: byKind('drop').length, videos: byKind('video').length };
    const dataCard = '<section class="card"><div class="card-head"><div><h2>Data & storage</h2><div class="card-sub">' + esc(store.label) + (store.mode === 'local' ? '. To share one board with the whole team, connect Supabase (see docs/SETUP.md).' : '. Everyone with the link sees the same board.') + '</div></div></div>' +
      '<div class="stack"><div class="kv"><dt>Storage</dt><dd>' + (store.mode === 'supabase' ? 'Supabase (shared)' : 'This browser only') + '</dd><dt>Records</dt><dd>' + plural(counts.drops, 'drop') + ', ' + plural(counts.videos, 'video') + '</dd><dt>Status</dt><dd>' + esc(state.sync.status === 'error' ? 'Error: ' + state.sync.error : 'All changes saved') + '</dd></div>' +
      '<div class="actions"><button type="button" class="btn btn-sm" data-action="exportJson">' + I.download + ' Download backup</button><button type="button" class="btn btn-sm" data-action="copyJson">' + I.copy + ' Copy backup</button>' +
      '<label class="btn btn-sm">' + I.upload + ' Restore backup<input type="file" accept="application/json,.json" data-change="importFile" hidden></label>' +
      (store.mode === 'supabase' ? '<button type="button" class="btn btn-sm" data-action="reload">' + I.refresh + ' Refresh</button>' : '') + '</div>' +
      '<div class="actions">' + (S().exampleData ? '<button type="button" class="btn btn-sm" data-action="clearExample" data-confirm="Clear every example drop and video?">Clear example data</button>' : '<button type="button" class="btn btn-sm" data-action="loadExample" data-confirm="Add example drops and videos?">Load example data</button>') +
      '<button type="button" class="btn btn-sm btn-danger" data-action="clearAll" data-confirm="Delete everything? This cannot be undone">' + I.trash + ' Clear all data</button></div></div></section>';

    return pageHead('Team & settings', 'Who does what, how often, and where the files live.') +
      '<div class="grid grid-2"><div class="stack-lg">' + teamCard + rotaCard + '</div><div class="stack-lg">' + targetsCard + driveCard + dataCard + '</div></div>';
  }

  /* ---- Playbook ---- */
  function pagePlaybook() {
    const s = S();
    const m = dropMath();
    const cs = creators().map((c) => c.name);
    const eds = editors().map((e) => e.name);
    const who = cs.length ? cs.join(' and ') : 'the creators';
    const ed = eds.length ? eds.join(' / ') : 'the editor';
    return pageHead('Playbook', 'The agreed way of working. Short enough to read in five minutes, precise enough to remove every hand-off question.') +
      '<div class="card"><div class="prose">' +
      '<h2>The goal in numbers</h2><p>These update live from your settings.</p>' +
      '<div class="math"><div class="tile"><div class="tile-label">Posts per month</div><div class="tile-value">' + s.monthlyTarget + '</div><div class="tile-sub">Instagram + TikTok, cross-posted</div></div>' +
      '<div class="tile"><div class="tile-label">Per day</div><div class="tile-value">' + s.postsPerDay + '</div><div class="tile-sub">' + (Math.round(m.perDay * 10) / 10) + ' needed on average</div></div>' +
      '<div class="tile"><div class="tile-label">Drops per month</div><div class="tile-value">' + s.dropsPerMonth + '</div><div class="tile-sub">one every ~' + m.everyDays + ' days</div></div>' +
      '<div class="tile"><div class="tile-label">Videos per drop</div><div class="tile-value">' + m.perDrop + '</div><div class="tile-sub">' + m.clips + '+ clips at ' + s.variationsPerClip + ' variations each</div></div></div>' +
      '<div class="callout"><p><strong>The one rule:</strong> a drop is sent with a link and a brief, and the editor delivers within <strong>' + s.editorSlaHours + ' hours</strong>. Creators approve within <strong>' + s.reviewSlaHours + ' hours</strong>. Nothing waits on a chat message; the board is the source of truth.</p></div>' +

      '<h2>Roles</h2><ul>' +
      '<li><strong>Creators (' + esc(who) + ')</strong> film, create the drop, review deliveries, and post on their rota days. Both platforms, both slots, ticked in the board.</li>' +
      '<li><strong>Editor (' + esc(ed) + ')</strong> starts the drop, cuts every clip into as many strong variations as the brief asks for, uploads to the drop\'s Drive folder, and logs the delivery with one line per video.</li>' +
      '<li><strong>Everyone</strong> keeps their own status current. If the board is right, nobody has to ask.</li></ul>' +

      '<h2>How a drop flows</h2><ol class="steps">' +
      '<li><strong>Film.</strong> ' + esc(who) + ' shoot a batch on a filming day. Aim for at least ' + m.clips + ' usable clips so the editor can produce ' + m.perDrop + ' videos.</li>' +
      '<li><strong>Upload.</strong> Put the raw files in <code>Drops / YYYY-MM / Dnn / RAW</code> and set sharing so the editor can view.</li>' +
      '<li><strong>Send the drop.</strong> In the app: New drop → Drive link, clip list, brief, target count. The deadline is set automatically. Copy the handoff message into the team chat.</li>' +
      '<li><strong>Edit.</strong> The editor taps Start editing, works from the brief, exports to <code>Dnn / EDITS</code>, and files are named after their code, e.g. <code>D07-C03-v2_hook-name.mp4</code>.</li>' +
      '<li><strong>Deliver.</strong> Log delivery → paste the EDITS link and one title per line. Each line becomes a video card in Delivered. Prefix a line with <code>C3:</code> to link it to clip 3.</li>' +
      '<li><strong>Review.</strong> A creator watches, then Approve or Request changes with a note. Approved videos land in Ready to post.</li>' +
      '<li><strong>Schedule.</strong> Auto-fill the empty slots from Ready. Keep at least ' + s.bufferDays + ' days (' + (s.bufferDays * s.postsPerDay) + ' videos) scheduled ahead.</li>' +
      '<li><strong>Post.</strong> The day\'s poster opens Today, posts slot 1 and slot 2 on Instagram and TikTok, and ticks both boxes. The month counter moves.</li></ol>' +

      '<h2>Drive structure and naming</h2>' +
      '<div class="tree">Knowunity Content/\n  Brand assets/            logos, fonts, music, caption templates\n  Drops/\n    2026-09/\n      D07/\n        RAW/               original files straight from the phone or camera\n        EDITS/             D07-C01-v1_exam-trick.mp4\n                           D07-C01-v2_exam-trick-subtitles.mp4\n                           D07-C03-v1_pov-11pm.mp4</div>' +
      '<p>Codes are generated by the app: <code>D07</code> is the drop, <code>C03</code> the clip it came from, <code>v2</code> the variation. Keep the code at the start of every file name so anyone can find the source clip in seconds.</p>' +
      '<h3>Export spec</h3><ul><li>9:16 vertical, 1080 × 1920, H.264 MP4, 30 fps (60 fps only if filmed that way).</li><li>Keep text inside the safe zone: away from the bottom 20% and the right edge where platform UI sits.</li><li>No platform watermark. Upload the same clean file to Instagram and TikTok separately, never a re-download.</li><li>Subtitles burned in for variations meant to work on mute.</li></ul>' +

      '<h2>Cross-posting checklist</h2><ul><li>Post the Instagram Reel first from the clean file, then upload the same file to TikTok.</li><li>Adjust the caption per platform (hashtags and hook line), keep the first line identical so performance is comparable.</li><li>Use the same cover frame on both platforms.</li><li>Tick Instagram and TikTok in the board as soon as each one is live. Both ticked = posted.</li></ul>' +

      '<h2>When something slips</h2><ul>' +
      '<li><strong>Drop overdue:</strong> the Today page shows it red. Ping the editor with the handoff message; if they are blocked, reassign the drop to another editor in Edit details.</li>' +
      '<li><strong>Poster unavailable:</strong> open that day in the Calendar and swap the poster. The swap shows a ring on the avatar so everyone can see it.</li>' +
      '<li><strong>Empty slots ahead:</strong> use Auto-fill. If Ready is empty, that is the signal to send the next drop early.</li>' +
      '<li><strong>Behind pace:</strong> the hero card shows how many posts per day are now needed. Add a third slot temporarily under Team → Posts per day.</li></ul>' +

      '<h2>Weekly ten-minute review</h2><ul><li>Pace vs target on the Today page.</li><li>Buffer: at least ' + s.bufferDays + ' days scheduled.</li><li>Any drop older than ' + s.editorSlaHours + 'h without delivery, any delivered video older than ' + s.reviewSlaHours + 'h without a decision.</li><li>Next filming day on the calendar, so the next drop lands before Ready runs dry.</li></ul>' +
      '</div></div>';
  }

  const PAGES = { today: pageToday, drops: pageDrops, videos: pageVideos, calendar: pageCalendar, team: pageTeam, playbook: pagePlaybook };

  /* ------------------------------------------------------------------------
     6. Drawers + modal
     ------------------------------------------------------------------------ */
  const drawerFrame = (opts) => '<div class="drawer-head"><div>' + (opts.eyebrow ? '<div class="eyebrow">' + opts.eyebrow + '</div>' : '') + '<h2>' + opts.title + '</h2></div><button type="button" class="btn btn-icon btn-ghost" data-action="closeDrawer" aria-label="Close">' + I.x + '</button></div><div class="drawer-body">' + opts.body + '</div>' + (opts.foot ? '<div class="drawer-foot">' + opts.foot + '</div>' : '');

  function drawerDrop(ctx) {
    const d = ctx.id ? getItem(ctx.id) : null;
    if (!d) return drawerDropForm(null);
    if (ctx.mode === 'edit') return drawerDropForm(d);
    const s = S();
    const vids = dropVideos(d.id);
    const me = member(state.me);
    const late = d.deliveredAt ? (new Date(d.deliveredAt) - new Date(d.dueAt)) : 0;
    const tl = [
      { label: 'Sent by ' + memberName(d.sentBy), when: fmtDT(d.sentAt), done: true },
      { label: 'Editing started', when: d.editingStartedAt ? fmtDT(d.editingStartedAt) : 'not yet', done: !!d.editingStartedAt },
      { label: 'Delivered', when: d.deliveredAt ? fmtDT(d.deliveredAt) + ' · ' + (late > 0 ? 'late by ' + fmtDuration(late) : 'on time') : 'deadline ' + fmtDT(d.dueAt) + ' · ' + countdown(d.dueAt, state.now).text, done: !!d.deliveredAt, late: d.deliveredAt ? late > 0 : countdown(d.dueAt, state.now).late },
      { label: 'Closed', when: d.closedAt ? fmtDT(d.closedAt) : 'after review', done: !!d.closedAt }
    ].map((t) => '<div class="tl' + (t.done ? ' is-done' : '') + (t.late ? ' is-late' : '') + '"><span class="tl-dot"></span><div><div>' + esc(t.label) + '</div><div class="tl-when">' + esc(t.when) + '</div></div></div>').join('');
    const clipRows = (d.clips || []).length ? '<ol>' + d.clips.map((c, i) => '<li><span class="mono muted">C' + pad2(i + 1) + '</span> ' + esc(c.name) + ' <span class="muted small">· ' + plural(vids.filter((v) => v.clipId === c.id).length, 'variation') + '</span></li>').join('') + '</ol>' : '<div class="muted small">No clip list. Add one under Edit details so variations can be traced back to their source.</div>';
    const videoRows = vids.length ? '<div class="list">' + vids.map((v) => '<div class="row is-click" data-action="openVideo" data-id="' + v.id + '"><div class="row-main"><div class="row-title truncate">' + esc(v.title) + '</div><div class="row-sub mono">' + esc(v.code) + '</div></div><div class="row-side">' + statusPill(v) + '</div></div>').join('') + '</div>' : '<div class="muted small">No videos logged yet.</div>';
    const deliveredCount = vids.filter((v) => v.status === 'delivered').length;
    let actions = '';
    if (d.status === 'sent') actions = '<button type="button" class="btn btn-primary" data-action="dropStart" data-id="' + d.id + '">' + I.check + ' Start editing</button><button type="button" class="btn" data-action="copyHandoff" data-id="' + d.id + '">' + I.copy + ' Copy handoff message</button>';
    else if (d.status === 'editing') actions = '<button type="button" class="btn btn-primary" data-action="openDeliver" data-id="' + d.id + '">' + I.send + ' Log delivery</button><button type="button" class="btn" data-action="copyHandoff" data-id="' + d.id + '">' + I.copy + ' Copy handoff message</button>';
    else if (d.status === 'delivered') actions = (deliveredCount ? '<button type="button" class="btn btn-primary" data-action="dropApproveAll" data-id="' + d.id + '">' + I.check + ' Approve all ' + deliveredCount + ' delivered</button>' : '') + '<button type="button" class="btn" data-action="openDeliver" data-id="' + d.id + '" data-mode="add">' + I.plus + ' Add videos</button><button type="button" class="btn" data-action="copyDelivery" data-id="' + d.id + '">' + I.copy + ' Copy delivery message</button><button type="button" class="btn" data-action="dropClose" data-id="' + d.id + '">Close drop</button>';
    else actions = '<button type="button" class="btn" data-action="dropReopen" data-id="' + d.id + '">Reopen</button><button type="button" class="btn" data-action="openDeliver" data-id="' + d.id + '" data-mode="add">' + I.plus + ' Add videos</button>';
    const body = '<div class="section"><div class="flex">' + dropPill(d) + memberChip(d.editorId) + (me && me.id === d.editorId ? pill('Yours', 'accent') : '') + '</div><div class="actions">' + actions + '</div></div>' +
      '<div class="section"><h3>Timeline · ' + s.editorSlaHours + 'h turnaround</h3><div class="timeline">' + tl + '</div></div>' +
      '<div class="section"><h3>Files</h3><div class="actions">' + (linkBtn(d.driveLink, 'Raw footage') || '<span class="muted small">No raw footage link yet.</span>') + (d.driveLink ? '<button type="button" class="btn btn-sm" data-action="copyText" data-text="' + esc(d.driveLink) + '">' + I.copy + ' Copy link</button>' : '') + linkBtn(d.deliveredLink, 'Edited videos') + '</div>' + (d.deliveryNote ? '<div class="note"><strong>Editor\'s note:</strong> <span class="wrap">' + esc(d.deliveryNote) + '</span></div>' : '') + '</div>' +
      '<div class="section"><h3>Brief</h3>' + (d.brief ? '<div class="note wrap">' + esc(d.brief) + '</div>' : '<div class="muted small">No brief. Tell the editor what hooks, formats and variations you want.</div>') + '</div>' +
      '<div class="section"><h3>Clips · target ' + d.targetVideos + ' videos</h3>' + clipRows + '</div>' +
      '<div class="section"><h3>Videos from this drop · ' + vids.length + '</h3>' + videoRows + '</div>';
    const foot = '<button type="button" class="btn btn-danger left" data-action="dropDelete" data-id="' + d.id + '" data-confirm="Delete drop and its ' + vids.length + ' videos?">' + I.trash + ' Delete</button><button type="button" class="btn" data-action="editDrop" data-id="' + d.id + '">' + I.edit + ' Edit details</button>';
    return drawerFrame({ eyebrow: dropCode(d) + ' · sent ' + esc(fmtDT(d.sentAt)), title: esc(d.title), body: body, foot: foot });
  }

  function drawerDropForm(d) {
    const s = S();
    const isNew = !d;
    const me = member(state.me);
    const defaultSender = (me && me.role === 'creator') ? me.id : (creators()[0] ? creators()[0].id : '');
    const defaultEditor = editors()[0] ? editors()[0].id : '';
    const sentAt = d ? d.sentAt : nowIso();
    const dueAt = d ? d.dueAt : addHoursIso(sentAt, s.editorSlaHours);
    const body = '<div class="form-grid">' +
      '<div class="field span-2"><label for="dTitle">Title</label><input type="text" id="dTitle" name="title" required maxlength="120" placeholder="e.g. Exam week batch" value="' + esc(d ? d.title : '') + '" autofocus></div>' +
      '<div class="field"><label for="dSentBy">Sent by</label>' + selectHtml('sentBy', memberOptions(creators()), d ? d.sentBy : defaultSender, 'id="dSentBy"') + '</div>' +
      '<div class="field"><label for="dEditor">Editor</label>' + selectHtml('editorId', memberOptions(editors(), editors().length ? null : 'No editors yet'), d ? d.editorId : defaultEditor, 'id="dEditor"') + '</div>' +
      '<div class="field"><label for="dSentAt">Sent at</label><input type="datetime-local" id="dSentAt" name="sentAt" value="' + toLocalInput(sentAt) + '" data-input="syncDue" data-sla="' + s.editorSlaHours + '"></div>' +
      '<div class="field"><label for="dDueAt">Deadline</label><input type="datetime-local" id="dDueAt" name="dueAt" value="' + toLocalInput(dueAt) + '" data-input="touchDue"><span class="hint">Auto: sent + ' + s.editorSlaHours + 'h. Edit it if you agreed something else.</span></div>' +
      '<div class="field span-2"><label for="dLink">Raw footage link (Drive)</label><input type="url" id="dLink" name="driveLink" placeholder="https://drive.google.com/…" value="' + esc(d ? d.driveLink : '') + '"></div>' +
      '<div class="field span-2"><label for="dClips">Clips, one per line</label><textarea id="dClips" name="clips" rows="5" placeholder="Desk talking head: exam trick&#10;Whiteboard: vocab method&#10;B-roll: library">' + esc(d ? (d.clips || []).map((c) => c.name).join('\n') : '') + '</textarea><span class="hint">Becomes C01, C02… so every variation can be traced to its clip.</span></div>' +
      '<div class="field"><label for="dTarget">Target videos</label><input type="number" id="dTarget" name="targetVideos" min="1" max="200" value="' + (d ? d.targetVideos : dropMath().perDrop) + '"></div>' +
      '<div class="field span-2"><label for="dBrief">Brief for the editor</label><textarea id="dBrief" name="brief" rows="4" placeholder="Hooks to try, formats, subtitles yes/no, music, CTA…">' + esc(d ? d.brief : '') + '</textarea></div>' +
      '</div>';
    const foot = (isNew ? '' : '<button type="button" class="btn left" data-action="openDrop" data-id="' + d.id + '">Cancel</button>') + '<button class="btn btn-primary" type="submit">' + (isNew ? I.send + ' Send drop' : 'Save changes') + '</button>';
    return '<form data-submit="saveDrop" data-id="' + (d ? d.id : '') + '">' + drawerFrame({ eyebrow: isNew ? 'New drop' : dropCode(d) + ' · edit details', title: isNew ? 'Send raw footage to the editor' : esc(d.title), body: body, foot: foot }) + '</form>';
  }

  function drawerDeliver(ctx) {
    const d = getItem(ctx.dropId);
    if (!d) return drawerFrame({ title: 'Drop not found', body: '' });
    const add = ctx.mode === 'add';
    const clipHint = (d.clips || []).length ? ' Prefix with the clip code to link it, e.g. <code>C2: POV exam tomorrow</code>.' : '';
    const body = '<div class="stack"><div class="note">' + (add ? 'Add more videos to this drop. Each line becomes a card in <strong>Delivered</strong>.' : 'Paste the folder with the exports and list the videos, one per line. Each line becomes a card in <strong>Delivered</strong> for the creators to review.') + '</div>' +
      '<div class="field"><label for="dlLink">Edited videos folder (Drive)</label><input type="url" id="dlLink" name="deliveredLink" placeholder="https://drive.google.com/…" value="' + esc(d.deliveredLink || '') + '" autofocus></div>' +
      '<div class="field"><label for="dlTitles">Videos, one per line</label><textarea id="dlTitles" name="titles" rows="8" placeholder="C1: I passed my exam with this trick&#10;C1: I passed my exam with this trick (subtitles)&#10;C2: POV exam tomorrow"></textarea><span class="hint">' + (d.clips || []).map((c, i) => 'C' + (i + 1) + ' = ' + esc(c.name)).join(' · ') + clipHint + '</span></div>' +
      '<div class="field"><label for="dlNote">Note for the team</label><textarea id="dlNote" name="deliveryNote" rows="2" placeholder="Anything the creators should know">' + esc(d.deliveryNote || '') + '</textarea></div>' +
      (add ? '' : '<label class="check"><input type="checkbox" name="markDelivered" checked> Mark the drop as delivered (stops the ' + S().editorSlaHours + 'h clock)</label>') + '</div>';
    const foot = '<button type="button" class="btn left" data-action="openDrop" data-id="' + d.id + '">Back</button><button class="btn btn-primary" type="submit">' + I.send + ' ' + (add ? 'Add videos' : 'Deliver') + '</button>';
    return '<form data-submit="deliverDrop" data-id="' + d.id + '" data-mode="' + (add ? 'add' : 'deliver') + '">' + drawerFrame({ eyebrow: dropCode(d) + ' · ' + (add ? 'add videos' : 'log delivery'), title: esc(d.title), body: body, foot: foot }) + '</form>';
  }

  function drawerVideo(ctx) {
    const v = getItem(ctx.id);
    if (!v) return drawerFrame({ title: 'Video not found', body: '<div class="muted">It may have been deleted.</div>' });
    const d = getItem(v.dropId);
    const p = platforms(v);
    let stActions = '';
    if (v.status === 'editing') stActions = '<button type="button" class="btn btn-primary" data-action="videoStatus" data-id="' + v.id + '" data-status="delivered">' + I.send + ' Mark delivered</button>';
    else if (v.status === 'delivered') stActions = '<button type="button" class="btn btn-primary" data-action="videoStatus" data-id="' + v.id + '" data-status="approved">' + I.check + ' Approve</button><button type="button" class="btn" data-action="videoStatus" data-id="' + v.id + '" data-status="changes">Request changes</button>';
    else if (v.status === 'changes') stActions = '<button type="button" class="btn btn-primary" data-action="videoStatus" data-id="' + v.id + '" data-status="delivered">' + I.send + ' Delivered again</button><button type="button" class="btn" data-action="videoStatus" data-id="' + v.id + '" data-status="approved">Approve anyway</button>';
    else if (v.status === 'approved') stActions = '<button type="button" class="btn" data-action="videoStatus" data-id="' + v.id + '" data-status="delivered">Back to review</button>';
    else if (v.status === 'scheduled') stActions = '<button type="button" class="btn" data-action="videoStatus" data-id="' + v.id + '" data-status="approved">Unschedule</button>';
    else stActions = '<button type="button" class="btn" data-action="videoStatus" data-id="' + v.id + '" data-status="scheduled">Undo posted</button>';
    const dropOpts = drops().map((x) => ({ value: x.id, label: dropCode(x) + ' · ' + x.title }));
    const clipOpts = [{ value: '', label: 'No specific clip' }].concat(((d && d.clips) || []).map((c, i) => ({ value: c.id, label: 'C' + pad2(i + 1) + ' · ' + c.name })));
    const dayPoster = v.scheduledDate ? posterFor(v.scheduledDate) : posterFor(todayKey());
    const posterOpts = [{ value: '', label: 'Rota: ' + (dayPoster ? memberName(dayPoster.id) : '—') }].concat(creators().map((m) => ({ value: m.id, label: m.name })));
    const slotOpts = []; for (let i = 1; i <= Math.max(1, S().postsPerDay); i++) slotOpts.push({ value: i, label: 'Slot ' + i });
    const onCal = v.status === 'scheduled' || v.status === 'posted';
    const body = '<div class="section"><div class="flex">' + statusPill(v) + memberChip(v.editorId) + (v.status === 'posted' && v.postedDate ? '<span class="small muted">posted ' + esc(fmtDay(v.postedDate)) + '</span>' : '') + '</div><div class="actions">' + stActions + linkBtn(v.fileLink, 'Watch file') + '</div></div>' +
      (onCal ? '<div class="section"><h3>Platforms</h3><div class="flex">' + PLATFORMS.map((pl) => '<label class="check"><input type="checkbox" data-change="togglePlatform" data-id="' + v.id + '" data-platform="' + pl[0] + '"' + (p[pl[0]].posted ? ' checked' : '') + '> Posted on ' + pl[2] + (p[pl[0]].at ? ' <span class="muted small">' + esc(fmtDT(p[pl[0]].at)) + '</span>' : '') + '</label>').join('') + '</div><div class="hint">Both ticked = posted and counted for the month.</div></div>' : '') +
      '<div class="section"><h3>Schedule</h3><div class="form-grid"><div class="field"><label for="vDate">Date</label><input type="date" id="vDate" name="scheduledDate" value="' + esc(v.scheduledDate || '') + '"' + (ctx.focus === 'schedule' ? ' autofocus' : '') + '></div><div class="field"><label for="vSlot">Slot</label>' + selectHtml('slot', slotOpts, v.slot || 1, 'id="vSlot"') + '</div><div class="field span-2"><label for="vPoster">Poster</label>' + selectHtml('posterId', posterOpts, v.posterId || '', 'id="vPoster"') + '</div></div><div class="actions"><button type="button" class="btn btn-primary btn-sm" data-action="videoSchedule" data-id="' + v.id + '">' + I.calendar + ' ' + (onCal ? 'Update schedule' : 'Schedule') + '</button>' + (v.status === 'delivered' || v.status === 'changes' ? '<span class="hint">Scheduling also approves it.</span>' : '') + '</div></div>' +
      '<div class="section"><h3>Details</h3><div class="form-grid">' +
      '<div class="field span-2"><label for="vTitle">Title / hook</label><input type="text" id="vTitle" name="title" required maxlength="140" value="' + esc(v.title) + '"></div>' +
      '<div class="field"><label for="vDrop">Drop</label>' + selectHtml('dropId', dropOpts, v.dropId, 'id="vDrop"') + '</div>' +
      '<div class="field"><label for="vClip">Source clip</label>' + selectHtml('clipId', clipOpts, v.clipId || '', 'id="vClip"') + '</div>' +
      '<div class="field"><label for="vEditor">Editor</label>' + selectHtml('editorId', memberOptions(editors(), 'Unassigned'), v.editorId || '', 'id="vEditor"') + '</div>' +
      '<div class="field"><label for="vCode">Code</label><input type="text" id="vCode" name="code" value="' + esc(v.code) + '" maxlength="24"></div>' +
      '<div class="field span-2"><label for="vFile">Video file (Drive link)</label><input type="url" id="vFile" name="fileLink" placeholder="https://drive.google.com/…" value="' + esc(v.fileLink || '') + '"></div>' +
      '<div class="field span-2"><label for="vCaption">Caption</label><textarea id="vCaption" name="caption" rows="3" placeholder="First line = hook. Hashtags at the end.">' + esc(v.caption || '') + '</textarea>' + (v.caption ? '<div class="actions"><button type="button" class="btn btn-sm" data-action="copyText" data-text="' + esc(v.caption) + '">' + I.copy + ' Copy caption</button></div>' : '') + '</div>' +
      '<div class="field span-2"><label for="vNotes">Feedback / notes</label><textarea id="vNotes" name="notes" rows="3" placeholder="Change requests, what worked, ideas for the next variation">' + esc(v.notes || '') + '</textarea></div>' +
      '</div></div>';
    const foot = '<button type="button" class="btn btn-danger left" data-action="videoDelete" data-id="' + v.id + '" data-confirm="Delete this video?">' + I.trash + ' Delete</button><button class="btn btn-primary" type="submit">Save</button>';
    return '<form data-submit="saveVideo" data-id="' + v.id + '">' + drawerFrame({ eyebrow: esc(v.code) + (d ? ' · ' + esc(d.title) : ''), title: esc(v.title || 'Untitled'), body: body, foot: foot }) + '</form>';
  }

  function drawerDay(ctx) {
    const key = ctx.date;
    const tk = todayKey();
    const p = posterFor(key);
    const ov = getItem('override_' + key);
    const slots = slotsFor(key);
    const ready = sortBy(videos().filter((v) => v.status === 'approved'), (v) => v.approvedAt || '');
    const readyOpts = [{ value: '', label: ready.length ? 'Choose a ready video…' : 'No approved videos yet' }].concat(ready.map((v) => ({ value: v.id, label: v.code + ' · ' + v.title })));
    const slotHtml = slots.map((sl) => {
      if (!sl.video) return '<div class="slot"><span class="slot-n">' + sl.slot + '</span><div class="flex" style="flex-wrap:nowrap">' + selectHtml('assign' + sl.slot, readyOpts, '', 'id="assign' + sl.slot + '" aria-label="Video for slot ' + sl.slot + '"' + (ready.length ? '' : ' disabled')) + '<button type="button" class="btn btn-sm" data-action="assignSlot" data-date="' + key + '" data-slot="' + sl.slot + '"' + (ready.length ? '' : ' disabled') + '>Assign</button></div></div>';
      const v = sl.video;
      const pf = platforms(v);
      return '<div class="slot"><span class="slot-n">' + sl.slot + '</span><div class="row-main"><div class="row-title"><a href="#" data-action="openVideo" data-id="' + v.id + '" style="color:inherit;text-decoration:none">' + esc(v.title) + '</a></div><div class="row-sub"><span class="mono">' + esc(v.code) + '</span> · ' + statusPill(v) + ' ' + linkBtn(v.fileLink, 'File', 'btn-ghost') + '</div><div class="slot-checks mt" style="justify-content:flex-start">' + PLATFORMS.map((pl) => '<label><input type="checkbox" data-change="togglePlatform" data-id="' + v.id + '" data-platform="' + pl[0] + '"' + (pf[pl[0]].posted ? ' checked' : '') + '> ' + pl[2] + '</label>').join('') + '</div></div><button type="button" class="btn btn-sm btn-icon" data-action="videoStatus" data-id="' + v.id + '" data-status="approved" aria-label="Remove from this day" data-tip="Back to Ready">' + I.x + '</button></div>';
    }).join('');
    const posterOpts = [{ value: '', label: 'Rota' + (p && p.source === 'rota' ? ': ' + memberName(p.id) : '') }].concat(creators().map((m) => ({ value: m.id, label: m.name })));
    const body = '<div class="section"><h3>Poster</h3><div class="flex">' + (p ? avatar(p.id, '', ov ? 'is-swapped' : '') + '<div><div class="strong">' + esc(memberName(p.id)) + '</div><div class="small muted">' + (ov ? 'swapped in' + (ov.note ? ' · ' + esc(ov.note) : '') : 'from the rota') + '</div></div>' : '<span class="muted">No creators yet.</span>') + '</div>' +
      '<div class="form-grid"><div class="field"><label for="ovPoster">Change for this day only</label>' + selectHtml('posterId', posterOpts, ov ? ov.posterId : '', 'id="ovPoster"') + '</div><div class="field"><label for="ovNote">Reason (optional)</label><input type="text" id="ovNote" name="note" maxlength="80" placeholder="e.g. Adam travelling" value="' + esc(ov ? ov.note || '' : '') + '"></div></div><div class="actions"><button type="button" class="btn btn-sm" data-action="saveOverride" data-date="' + key + '">' + I.swap + ' Save poster</button>' + (ov ? '<button type="button" class="btn btn-sm btn-ghost" data-action="clearOverride" data-date="' + key + '">Back to rota</button>' : '') + '</div></div>' +
      '<div class="section"><h3>Slots</h3><div class="slots">' + slotHtml + '</div>' + (slots.some((s) => !s.video) && ready.length ? '<div class="actions"><button type="button" class="btn btn-sm" data-action="autoFill" data-from="' + key + '" data-days="1">' + I.wand + ' Fill this day from Ready</button></div>' : '') + '</div>' +
      '<div class="section"><h3>Share</h3><div class="actions"><button type="button" class="btn btn-sm" data-action="copyDay" data-date="' + key + '">' + I.copy + ' Copy posting plan</button></div></div>';
    return drawerFrame({ eyebrow: key === tk ? 'Today' : key < tk ? 'Past day' : 'Upcoming', title: esc(fmtDayLong(key)), body: body });
  }

  function drawerMember(ctx) {
    const m = ctx.id ? getItem(ctx.id) : null;
    const color = m ? m.color : COLORS[members().length % COLORS.length];
    const body = '<div class="stack">' +
      '<div class="field"><label for="mName">Name</label><input type="text" id="mName" name="name" required maxlength="40" value="' + esc(m ? m.name : '') + '" autofocus></div>' +
      '<div class="field"><label>Role</label><div class="radio-list"><label><input type="radio" name="role" value="creator"' + (!m || m.role === 'creator' ? ' checked' : '') + '><span>Creator<span class="hint">Films, reviews and posts. Appears in the posting rota.</span></span></label><label><input type="radio" name="role" value="editor"' + (m && m.role === 'editor' ? ' checked' : '') + '><span>Editor<span class="hint">Receives drops and delivers videos within the deadline.</span></span></label></div></div>' +
      '<div class="field"><label>Colour</label><input type="hidden" name="color" value="' + esc(color) + '"><div class="swatches">' + COLORS.map((c) => '<button type="button" class="swatch' + (c === color ? ' is-on' : '') + '" style="--mc: var(--m-' + c + ')" data-action="pickColor" data-color="' + c + '" aria-label="' + c + '"></button>').join('') + '</div></div>' +
      '</div>';
    const foot = (m ? '<button type="button" class="btn btn-danger left" data-action="memberRemove" data-id="' + m.id + '" data-confirm="Remove ' + esc(m.name) + ' from the team?">' + I.trash + ' Remove</button>' : '') + '<button class="btn btn-primary" type="submit">' + (m ? 'Save' : 'Add to team') + '</button>';
    return '<form data-submit="saveMember" data-id="' + (m ? m.id : '') + '">' + drawerFrame({ eyebrow: m ? 'Team member' : 'New team member', title: m ? esc(m.name) : 'Add a person', body: body, foot: foot }) + '</form>';
  }

  const DRAWERS = { drop: drawerDrop, deliver: drawerDeliver, video: drawerVideo, day: drawerDay, member: drawerMember };

  function renderModal() {
    const root = $('#modalRoot');
    if (!state.modal) { root.innerHTML = ''; return; }
    const ms = members();
    root.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="whoTitle"><div class="modal-card"><div><div class="eyebrow">' + esc(S().teamName) + '</div><h2 id="whoTitle">Who is using this device?</h2><p class="muted small">This only personalises the Today page. Nothing is locked.</p></div><div class="who">' +
      ms.map((m) => '<button type="button" class="who-btn' + (state.me === m.id ? ' is-on' : '') + '" data-action="setMe" data-id="' + m.id + '">' + avatar(m.id) + '<span><span class="strong" style="display:block">' + esc(m.name) + '</span><span class="small muted">' + (m.role === 'creator' ? 'Creator' : 'Editor') + '</span></span></button>').join('') +
      '</div><div class="actions"><button type="button" class="btn btn-ghost" data-action="closeModal">' + (state.me ? 'Cancel' : 'Skip for now') + '</button></div></div></div>';
  }

  /* ------------------------------------------------------------------------
     7. Rendering shell, actions, events
     ------------------------------------------------------------------------ */
  function mountShell() {
    $('#app').innerHTML = '<div class="app"><aside class="rail"><div class="brand"><div class="brand-mark">K</div><div><div class="brand-name" id="brandName"></div><div class="brand-sub">Content OS</div></div></div><nav class="nav" id="nav" aria-label="Main"></nav><div class="rail-foot"><button type="button" class="me-btn" id="meBtn" data-action="who"></button><div class="sync" id="syncBox"></div></div></aside><main class="main" id="main"></main><nav class="tabbar" id="tabbar" aria-label="Main"></nav><div class="drawer-backdrop" id="drawerRoot"></div><div id="modalRoot"></div><div class="toasts" id="toasts" aria-live="polite"></div></div>';
    $('#drawerRoot').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeDrawer(); });
  }
  function navBadges() {
    const overdue = openDrops().filter((d) => countdown(d.dueAt, state.now).late).length;
    const review = videos().filter((v) => v.status === 'delivered').length;
    return { drops: overdue, videos: review };
  }
  function renderNav() {
    const b = navBadges();
    const items = Object.keys(ROUTES).map((r) => '<a class="nav-item" href="#' + r + '"' + (state.route === r ? ' aria-current="page"' : '') + '>' + I[ROUTES[r].icon] + '<span>' + esc(ROUTES[r].label) + '</span>' + (b[r] ? '<span class="nav-badge">' + b[r] + '</span>' : '') + '</a>');
    $('#nav').innerHTML = items.join('');
    $('#tabbar').innerHTML = Object.keys(ROUTES).map((r) => '<a class="tab" href="#' + r + '"' + (state.route === r ? ' aria-current="page"' : '') + '>' + I[ROUTES[r].icon] + '<span>' + esc(ROUTES[r].label) + '</span></a>').join('');
    $('#brandName').textContent = S().teamName;
  }
  function renderMe() {
    const m = member(state.me);
    $('#meBtn').innerHTML = (m ? avatar(m.id) : '<span class="avatar" style="--mc: var(--muted)">?</span>') + '<span><span class="me-name">' + (m ? esc(m.name) : 'Who are you?') + '</span><span class="me-sub">' + (m ? (m.role === 'creator' ? 'Creator · tap to switch' : 'Editor · tap to switch') : 'Tap to choose') + '</span></span>';
  }
  function renderSync() {
    const box = $('#syncBox');
    if (!box) return;
    const st = state.sync.status;
    box.className = 'sync' + (store && store.mode === 'local' ? ' is-local' : '') + (st === 'error' ? ' is-error' : st === 'busy' ? ' is-busy' : '');
    box.innerHTML = '<span class="sync-dot"></span><span>' + esc(st === 'error' ? 'Save failed' : st === 'busy' ? 'Saving…' : store && store.mode === 'local' ? 'Saved on this device' : 'Shared board · synced') + '</span>';
    box.title = state.sync.error || '';
  }
  function captureFocus() {
    const el = document.activeElement;
    if (!el || !el.id || !$('#main').contains(el)) return null;
    return { id: el.id, start: el.selectionStart, end: el.selectionEnd };
  }
  function restoreFocus(f) {
    if (!f) return;
    const el = document.getElementById(f.id);
    if (!el) return;
    el.focus();
    try { if (f.start != null && typeof el.setSelectionRange === 'function') el.setSelectionRange(f.start, f.end); } catch (e) { /* not a text input */ }
  }
  function renderMain() {
    const focus = captureFocus();
    const page = PAGES[state.route] || PAGES.today;
    $('#main').innerHTML = exampleBanner() + page();
    restoreFocus(focus);
    const focusCol = $('.kcol.is-focus');
    if (focusCol && typeof focusCol.scrollIntoView === 'function') focusCol.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    document.title = (ROUTES[state.route] ? (ROUTES[state.route].title || ROUTES[state.route].label) : 'Today') + ' · ' + S().teamName;
  }
  function render() {
    if (!state.ready) return;
    renderNav(); renderMe(); renderSync(); renderMain();
  }
  function renderDrawer() {
    const root = $('#drawerRoot');
    if (!state.drawer) { root.classList.remove('is-open'); root.innerHTML = ''; document.body.classList.remove('no-scroll'); return; }
    const fn = DRAWERS[state.drawer.type];
    root.innerHTML = '<div class="drawer' + (state.drawerEnter ? ' is-enter' : '') + '" role="dialog" aria-modal="true">' + (fn ? fn(state.drawer) : '') + '</div>';
    state.drawerEnter = false;
    root.classList.add('is-open');
    document.body.classList.add('no-scroll');
    const first = root.querySelector('[autofocus]');
    if (first) { try { first.focus(); } catch (e) { /* ignore */ } }
  }
  function openDrawer(d) { state.drawerEnter = !state.drawer; state.drawer = d; renderDrawer(); }
  function closeDrawer() { state.drawer = null; renderDrawer(); }
  function refreshDrawer() { if (state.drawer) renderDrawer(); }
  function openModal(name) { state.modal = name; renderModal(); }
  function closeModal() { state.modal = null; renderModal(); }

  function toast(msg, tone) {
    const box = $('#toasts');
    if (!box) return;
    const t = document.createElement('div');
    t.className = 'toast' + (tone ? ' is-' + tone : '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  }
  async function copyText(text, label) {
    const done = (label || 'Copied') + ' to clipboard';
    try { await navigator.clipboard.writeText(text); toast(done); return; } catch (e) { /* fall through */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    toast(ok ? done : 'Copy failed. Select the text and copy it manually.', ok ? '' : 'crit');
  }
  function formData(form) {
    const out = {};
    Array.from(form.elements).forEach((el) => {
      if (!el.name) return;
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else if (el.type === 'number') out[el.name] = el.value === '' ? null : Number(el.value);
      else if (el.type === 'file') return;
      else out[el.name] = typeof el.value === 'string' ? el.value.trim() : el.value;
    });
    return out;
  }
  function arm(el) {
    el.classList.add('is-armed');
    if (!el.dataset.label) el.dataset.label = el.innerHTML;
    el.innerHTML = esc(el.dataset.confirm || 'Click again to confirm');
    clearTimeout(el._armTimer);
    el._armTimer = setTimeout(() => { if (el.isConnected) { el.classList.remove('is-armed'); el.innerHTML = el.dataset.label; } }, 4000);
  }
  function route() {
    const hash = (location.hash || '#today').slice(1).replace(/[^a-z]/g, '');
    state.route = ROUTES[hash] ? hash : 'today';
    render();
    window.scrollTo(0, 0);
  }
  function parseClips(text, existing) {
    const names = String(text || '').split('\n').map((x) => x.trim()).filter(Boolean);
    return names.map((name, i) => ({ id: (existing && existing[i] && existing[i].id) || uid('clip'), name: name }));
  }
  function readVideoForm(form, v) {
    const f = formData(form);
    if (f.title) v.title = f.title;
    v.code = f.code || v.code;
    v.dropId = f.dropId || v.dropId;
    v.clipId = f.clipId || null;
    v.editorId = f.editorId || null;
    v.fileLink = f.fileLink || '';
    v.caption = f.caption || '';
    v.notes = f.notes || '';
    return f;
  }

  const ACTIONS = {
    closeDrawer: () => closeDrawer(),
    closeModal: () => closeModal(),
    who: () => openModal('who'),
    setMe: (ds) => { state.me = ds.id; try { localStorage.setItem('ku:me', ds.id); } catch (e) { /* ignore */ } closeModal(); render(); toast('Hi ' + memberName(ds.id)); },
    reload: () => reloadFromStore(true),
    gotoStatus: (ds) => { state.filters = { drop: '', editor: '', status: ds.status || '', q: '' }; location.hash = '#videos'; },
    calMonth: (ds) => { const dir = Number(ds.dir); state.month = dir === 0 ? monthOf(todayKey()) : addMonths(state.month, dir); renderMain(); },
    filter: (ds, el) => { state.filters[ds.key] = el.value; renderMain(); },
    clearFilters: () => { state.filters = { drop: '', editor: '', status: '', q: '' }; renderMain(); },
    copyText: (ds) => copyText(ds.text || '', 'Copied'),
    copyDay: (ds) => copyText(dayMessage(ds.date), 'Posting plan copied'),
    copyHandoff: (ds) => { const d = getItem(ds.id); if (d) copyText(handoffMessage(d), 'Handoff message copied'); },
    copyDelivery: (ds) => { const d = getItem(ds.id); if (d) copyText(deliveryMessage(d), 'Delivery message copied'); },

    /* drops */
    newDrop: () => openDrawer({ type: 'drop', id: null, mode: 'edit' }),
    openDrop: (ds) => openDrawer({ type: 'drop', id: ds.id }),
    editDrop: (ds) => openDrawer({ type: 'drop', id: ds.id, mode: 'edit' }),
    openDeliver: (ds) => openDrawer({ type: 'deliver', dropId: ds.id, mode: ds.mode || 'deliver' }),
    syncDue: (ds, el) => { const due = $('#dDueAt'); if (!due || due.dataset.touched === '1' || !el.value) return; due.value = toLocalInput(addHoursIso(fromLocalInput(el.value), Number(ds.sla) || S().editorSlaHours)); },
    touchDue: (ds, el) => { el.dataset.touched = '1'; },
    saveDrop: async (ds, form) => {
      const f = formData(form);
      if (!f.title) { toast('Give the drop a title', 'crit'); return; }
      const existing = ds.id ? getItem(ds.id) : null;
      const sentAt = fromLocalInput(f.sentAt);
      let dueAt = fromLocalInput(f.dueAt);
      if (new Date(dueAt) <= new Date(sentAt)) dueAt = addHoursIso(sentAt, S().editorSlaHours);
      const d = existing || { id: uid('drop'), number: Math.max(0, ...drops().map((x) => x.number || 0)) + 1, status: 'sent', createdAt: nowIso(), clips: [] };
      d.title = f.title; d.sentBy = f.sentBy || null; d.editorId = f.editorId || null; d.sentAt = sentAt; d.dueAt = dueAt;
      d.driveLink = f.driveLink || ''; d.brief = f.brief || ''; d.targetVideos = clampNum(f.targetVideos, 1, 200, dropMath().perDrop);
      d.clips = parseClips(f.clips, existing ? existing.clips : null);
      await save('drop', d);
      openDrawer({ type: 'drop', id: d.id });
      toast(existing ? 'Drop updated' : 'Drop ' + dropCode(d) + ' sent · deadline ' + fmtDT(d.dueAt));
    },
    dropStart: async (ds) => { const d = getItem(ds.id); if (!d) return; d.status = 'editing'; d.editingStartedAt = d.editingStartedAt || nowIso(); await save('drop', d); refreshDrawer(); toast('Editing started. Deadline ' + fmtDT(d.dueAt)); },
    deliverDrop: async (ds, form) => {
      const d = getItem(ds.id); if (!d) return;
      const f = formData(form);
      const lines = String(f.titles || '').split('\n').map((x) => x.trim()).filter(Boolean);
      if (!lines.length && ds.mode === 'add') { toast('List at least one video', 'crit'); return; }
      const items = [];
      lines.forEach((line) => {
        const parsed = parseTitleLine(line, d);
        const v = newVideo(d, { title: parsed.title, clipId: parsed.clipId, status: 'delivered', deliveredAt: nowIso() });
        items.push({ kind: 'video', data: v });
        commit('video', v); // so the next code number sees this one
      });
      if (f.deliveredLink) d.deliveredLink = f.deliveredLink;
      if (f.deliveryNote != null) d.deliveryNote = f.deliveryNote;
      if (ds.mode !== 'add' && f.markDelivered !== false) { d.status = 'delivered'; d.deliveredAt = d.deliveredAt || nowIso(); if (!d.editingStartedAt) d.editingStartedAt = d.deliveredAt; }
      items.push({ kind: 'drop', data: d });
      await saveItems(items);
      openDrawer({ type: 'drop', id: d.id });
      toast(lines.length ? plural(lines.length, 'video') + ' added to review' : 'Drop marked as delivered');
    },
    dropApproveAll: async (ds) => {
      const d = getItem(ds.id); if (!d) return;
      const vids = dropVideos(d.id).filter((v) => v.status === 'delivered');
      vids.forEach((v) => setStatus(v, 'approved'));
      await saveItems(vids.map((v) => ({ kind: 'video', data: v })));
      refreshDrawer(); toast(plural(vids.length, 'video') + ' approved and ready to post');
    },
    dropClose: async (ds) => { const d = getItem(ds.id); if (!d) return; d.status = 'approved'; d.closedAt = nowIso(); await save('drop', d); refreshDrawer(); toast('Drop closed'); },
    dropReopen: async (ds) => { const d = getItem(ds.id); if (!d) return; d.status = 'delivered'; d.closedAt = null; await save('drop', d); refreshDrawer(); toast('Drop reopened'); },
    dropDelete: async (ds) => { const d = getItem(ds.id); if (!d) return; const ids = dropVideos(d.id).map((v) => v.id).concat([d.id]); closeDrawer(); await delMany(ids); toast('Drop deleted'); },

    /* videos */
    addVideos: () => {
      const open = drops().filter((d) => d.status !== 'approved');
      const target = open[0] || drops()[0];
      if (!target) { toast('Create a drop first', 'crit'); openDrawer({ type: 'drop', id: null, mode: 'edit' }); return; }
      openDrawer({ type: 'deliver', dropId: target.id, mode: target.status === 'sent' || target.status === 'editing' ? 'deliver' : 'add' });
    },
    openVideo: (ds) => openDrawer({ type: 'video', id: ds.id }),
    saveVideo: async (ds, form) => {
      const v = getItem(ds.id); if (!v) return;
      const f = readVideoForm(form, v);
      if (!f.title) { toast('Give the video a title', 'crit'); return; }
      await save('video', v);
      closeDrawer(); toast('Saved');
    },
    videoStatus: async (ds, el) => {
      const v = getItem(ds.id); if (!v) return;
      const form = el.closest('form[data-submit="saveVideo"]');
      if (form) readVideoForm(form, v);
      if (ds.status === 'scheduled' && !v.scheduledDate) { setStatus(v, 'scheduled'); }
      else setStatus(v, ds.status);
      await save('video', v);
      refreshDrawer();
      toast(VS[ds.status] ? VS[ds.status].label : 'Updated');
    },
    videoSchedule: async (ds, el) => {
      const v = getItem(ds.id); if (!v) return;
      const form = el.closest('form');
      const f = readVideoForm(form, v);
      if (!f.scheduledDate) { toast('Pick a date first', 'crit'); return; }
      scheduleVideo(v, f.scheduledDate, clampNum(f.slot, 1, 20, 1), f.posterId || null);
      await save('video', v);
      refreshDrawer();
      toast('Scheduled for ' + fmtDay(v.scheduledDate) + ' · slot ' + v.slot);
    },
    videoDelete: async (ds) => { closeDrawer(); await del(ds.id); toast('Video deleted'); },
    togglePlatform: async (ds, el) => {
      const v = getItem(ds.id); if (!v) return;
      setPlatform(v, ds.platform, el.checked);
      await save('video', v);
      refreshDrawer();
      if (v.status === 'posted') toast('Posted on both platforms. ' + monthStats(monthOf(v.postedDate)).posted + ' this month.');
    },
    autoFill: async (ds) => {
      const plan = autoFillPlan(ds.from, clampNum(ds.days, 1, 62, 14));
      if (!plan.readyCount) { toast('No approved videos to schedule yet', 'crit'); return; }
      if (!plan.touched.length) { toast('No empty slots in that range'); return; }
      await saveItems(plan.touched.map((v) => ({ kind: 'video', data: v })));
      refreshDrawer();
      toast(plural(plan.touched.length, 'video') + ' scheduled');
    },

    /* days */
    openDay: (ds) => openDrawer({ type: 'day', date: ds.date }),
    assignSlot: async (ds) => {
      const sel = $('#assign' + ds.slot); const v = sel && sel.value ? getItem(sel.value) : null;
      if (!v) { toast('Choose a ready video first', 'crit'); return; }
      scheduleVideo(v, ds.date, Number(ds.slot), null);
      await save('video', v); refreshDrawer(); toast('Assigned to slot ' + ds.slot);
    },
    saveOverride: async (ds) => {
      const posterId = ($('#ovPoster') || {}).value || '';
      const note = (($('#ovNote') || {}).value || '').trim();
      const id = 'override_' + ds.date;
      if (!posterId) { if (getItem(id)) await del(id); refreshDrawer(); toast('Back to the rota'); return; }
      await save('override', { id: id, date: ds.date, posterId: posterId, note: note });
      refreshDrawer(); toast(memberName(posterId) + ' posts on ' + fmtDay(ds.date));
    },
    clearOverride: async (ds) => { const id = 'override_' + ds.date; if (getItem(id)) await del(id); refreshDrawer(); toast('Back to the rota'); },

    /* team + settings */
    openMember: (ds) => openDrawer({ type: 'member', id: ds.id || null }),
    pickColor: (ds, el) => { const form = el.closest('form'); form.elements.color.value = ds.color; $$('.swatch', form).forEach((s) => s.classList.toggle('is-on', s.dataset.color === ds.color)); },
    saveMember: async (ds, form) => {
      const f = formData(form);
      if (!f.name) { toast('Give them a name', 'crit'); return; }
      const m = ds.id ? getItem(ds.id) : { id: uid('member'), order: members().length, archived: false };
      m.name = f.name; m.role = f.role === 'editor' ? 'editor' : 'creator'; m.color = COLORS.includes(f.color) ? f.color : 'blue';
      await save('member', m);
      closeDrawer(); toast(ds.id ? 'Saved' : m.name + ' added');
    },
    memberRemove: async (ds) => {
      const m = getItem(ds.id); if (!m) return;
      m.archived = true;
      if (state.me === m.id) { state.me = null; try { localStorage.removeItem('ku:me'); } catch (e) { /* ignore */ } }
      await save('member', m); closeDrawer(); toast(m.name + ' removed');
    },
    saveRota: async (ds, form) => {
      const f = formData(form);
      const s = S();
      s.rotaMode = ['days', 'weeks', 'weekday'].includes(f.rotaMode) ? f.rotaMode : 'days';
      s.rotaAnchor = /^\d{4}-\d{2}-\d{2}$/.test(f.rotaAnchor || '') ? f.rotaAnchor : firstOfMonth(monthOf(todayKey()));
      s.weekStart = Number(f.weekStart) === 7 ? 7 : 1;
      const cs = creators();
      const first = cs.findIndex((m) => m.id === f.rotaFirst);
      s.rotaOrder = (first >= 0 ? cs.slice(first).concat(cs.slice(0, first)) : cs).map((m) => m.id);
      const wd = {};
      for (let i = 1; i <= 7; i++) if (f['wd' + i]) wd[i] = f['wd' + i];
      s.rotaWeekday = wd;
      await save('settings', s); toast('Rota saved');
    },
    saveTargets: async (ds, form) => {
      const f = formData(form);
      const s = S();
      s.monthlyTarget = clampNum(f.monthlyTarget, 1, 500, 60);
      s.postsPerDay = clampNum(f.postsPerDay, 1, 6, 2);
      s.editorSlaHours = clampNum(f.editorSlaHours, 1, 336, 24);
      s.reviewSlaHours = clampNum(f.reviewSlaHours, 1, 336, 24);
      s.dropsPerMonth = clampNum(f.dropsPerMonth, 1, 31, 3);
      s.variationsPerClip = clampNum(f.variationsPerClip, 1, 20, 3);
      s.bufferDays = clampNum(f.bufferDays, 0, 60, 5);
      s.teamName = f.teamName || 'Knowunity Content';
      await save('settings', s); toast('Targets saved');
    },
    saveDrive: async (ds, form) => { const f = formData(form); const s = S(); s.driveRaw = f.driveRaw || ''; s.driveEdits = f.driveEdits || ''; s.driveAssets = f.driveAssets || ''; await save('settings', s); toast('Folders saved'); },
    exportJson: () => {
      const blob = new Blob([exportJson()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'knowunity-content-backup-' + todayKey() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('Backup downloaded (if downloads are allowed here). Use Copy backup otherwise.');
    },
    copyJson: () => copyText(exportJson(), 'Backup copied'),
    importFile: (ds, el) => {
      const file = el.files && el.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const items = Array.isArray(parsed) ? parsed : parsed.items;
          if (!Array.isArray(items) || !items.every((x) => x && x.id && x.kind && x.data)) throw new Error('not a Content OS backup');
          state.items.clear();
          items.forEach((it) => state.items.set(it.id, it));
          await persist(() => store.replaceAll(items));
          await ensureDefaults(false);
          render(); toast('Backup restored: ' + plural(items.length, 'record'));
        } catch (e) { toast('Could not restore: ' + e.message, 'crit'); }
        el.value = '';
      };
      reader.readAsText(file);
    },
    loadExample: async () => { const list = buildExampleData(todayKey()); const s = S(); s.exampleData = true; list.push({ kind: 'settings', data: s }); await saveItems(list); toast('Example data loaded'); },
    clearExample: async () => {
      const ids = byKind('drop').map((d) => d.id).concat(byKind('video').map((v) => v.id), byKind('override').map((o) => o.id));
      const s = S(); s.exampleData = false; commit('settings', s);
      await delMany(ids); await persist(() => store.put(state.items.get(SETTINGS_ID)));
      closeDrawer(); toast('Board cleared. Send your first real drop.');
    },
    clearAll: async () => {
      const ids = Array.from(state.items.keys());
      state.items.clear(); state.me = null; closeDrawer();
      try { localStorage.removeItem('ku:me'); } catch (e) { /* ignore */ }
      await persist(() => store.removeMany(ids));
      await ensureDefaults(false); render(); toast('Everything cleared');
    }
  };

  function exportJson() { return JSON.stringify({ app: 'knowunity-content-os', version: 1, exportedAt: nowIso(), items: Array.from(state.items.values()) }, null, 2); }

  function wireEvents() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (link && !link.dataset.action && link.getAttribute('href') !== '#') return; // plain navigation
      const el = e.target.closest('[data-action]');
      if (!el) return;
      if (el.dataset.confirm !== undefined && !el.classList.contains('is-armed')) { e.preventDefault(); arm(el); return; }
      e.preventDefault();
      const fn = ACTIONS[el.dataset.action];
      if (fn) fn(el.dataset, el, e);
      else if (el.tagName === 'A') location.hash = el.getAttribute('href');
    });
    document.addEventListener('change', (e) => {
      const el = e.target.closest('[data-change]');
      if (!el) return;
      const fn = ACTIONS[el.dataset.change];
      if (fn) fn(el.dataset, el, e);
    });
    document.addEventListener('input', (e) => {
      const el = e.target.closest('[data-input]');
      if (!el) return;
      const fn = ACTIONS[el.dataset.input];
      if (fn) fn(el.dataset, el, e);
    });
    document.addEventListener('submit', (e) => {
      const form = e.target.closest('form[data-submit]');
      if (!form) return;
      e.preventDefault();
      const fn = ACTIONS[form.dataset.submit];
      if (fn) fn(form.dataset, form, e);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { if (state.modal) closeModal(); else if (state.drawer) closeDrawer(); }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('kcard')) { e.preventDefault(); ACTIONS.openVideo(e.target.dataset); }
    });
    /* drag and drop on the board */
    document.addEventListener('dragstart', (e) => {
      const card = e.target.closest ? e.target.closest('[data-drag="video"]') : null;
      if (!card) return;
      state.dragId = card.dataset.id;
      try { e.dataTransfer.setData('text/plain', card.dataset.id); e.dataTransfer.effectAllowed = 'move'; } catch (err) { /* ignore */ }
      card.classList.add('is-dragging');
    });
    document.addEventListener('dragend', () => { state.dragId = null; $$('.is-dragging').forEach((x) => x.classList.remove('is-dragging')); $$('.kcol.is-over').forEach((x) => x.classList.remove('is-over')); });
    document.addEventListener('dragover', (e) => {
      const col = e.target.closest ? e.target.closest('[data-drop-status]') : null;
      if (!col || !state.dragId) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch (err) { /* ignore */ }
      $$('.kcol.is-over').forEach((x) => { if (x !== col) x.classList.remove('is-over'); });
      col.classList.add('is-over');
    });
    document.addEventListener('drop', async (e) => {
      const col = e.target.closest ? e.target.closest('[data-drop-status]') : null;
      if (!col) return;
      e.preventDefault();
      let id = state.dragId;
      try { id = e.dataTransfer.getData('text/plain') || id; } catch (err) { /* ignore */ }
      state.dragId = null;
      col.classList.remove('is-over');
      const v = id ? getItem(id) : null;
      if (!v) return;
      const status = col.dataset.dropStatus;
      if (v.status === status) return;
      if (status === 'scheduled' && !v.scheduledDate) { openDrawer({ type: 'video', id: v.id, focus: 'schedule' }); toast('Pick a date to schedule it'); return; }
      setStatus(v, status);
      await save('video', v);
      toast('Moved to ' + VS[status].label);
    });
    window.addEventListener('hashchange', route);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { state.now = Date.now(); if (store && store.mode === 'supabase') reloadFromStore(false); else if (!state.drawer) renderMain(); } });
  }

  /* shared-board polling (Supabase mode) */
  let pollTimer = null;
  async function reloadFromStore(manual) {
    if (!store || state.sync.status === 'busy') return;
    try {
      const items = await store.load();
      const seen = {};
      const now = Date.now();
      let changed = false;
      items.forEach((it) => {
        if (!it || !it.id) return;
        seen[it.id] = true;
        const local = state.items.get(it.id);
        const recent = recentWrites.get(it.id);
        if (recent && now - recent < 10000) return; // our own write is still in flight
        if (!local || (local.updated_at || '') < (it.updated_at || '')) { state.items.set(it.id, it); changed = true; }
      });
      Array.from(state.items.keys()).forEach((id) => {
        const recent = recentWrites.get(id);
        if (!seen[id] && !(recent && now - recent < 10000)) { state.items.delete(id); changed = true; }
      });
      if (changed || manual) { await ensureDefaults(false); render(); if (state.drawer && changed) refreshDrawer(); }
      if (manual) toast(changed ? 'Board refreshed' : 'Already up to date');
      if (state.sync.status === 'error') setSync('ok');
    } catch (e) { if (manual) toast('Refresh failed: ' + e.message, 'crit'); }
  }
  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => { if (!document.hidden) reloadFromStore(false); }, 20000);
  }

  /* ------------------------------------------------------------------------
     8. Defaults, example data, boot
     ------------------------------------------------------------------------ */
  function defaultMembers() {
    return [
      { id: 'member_immanuel', name: 'Immanuel', role: 'creator', color: 'blue', order: 0, archived: false },
      { id: 'member_adam', name: 'Adam', role: 'creator', color: 'orange', order: 1, archived: false },
      { id: 'member_editor1', name: 'Editor 1', role: 'editor', color: 'violet', order: 2, archived: false }
    ];
  }
  /* Makes sure settings and a team exist. `seedExample` is true only on the very
     first visit in single-device mode, which then opens on a realistic sample board. */
  async function ensureDefaults(seedExample) {
    const toSave = [];
    let settingsChanged = false;
    let s = getItem(SETTINGS_ID);
    if (!s) { s = Object.assign({}, DEFAULT_SETTINGS); s.rotaAnchor = firstOfMonth(monthOf(todayKey())); settingsChanged = true; }
    else Object.keys(DEFAULT_SETTINGS).forEach((k) => { if (s[k] === undefined) { s[k] = DEFAULT_SETTINGS[k]; settingsChanged = true; } });
    if (!byKind('member').length) {
      defaultMembers().forEach((m) => { commit('member', m); toSave.push({ kind: 'member', data: m }); });
      s.rotaOrder = ['member_immanuel', 'member_adam'];
      settingsChanged = true;
    }
    if (!s.seeded) {
      s.seeded = true; settingsChanged = true;
      if (seedExample && store.mode === 'local' && !byKind('drop').length && !byKind('video').length) {
        s.exampleData = true;
        commit('settings', s); // so the example builder sees the real rota
        buildExampleData(todayKey()).forEach((x) => toSave.push(x));
      }
    }
    if (settingsChanged) toSave.push({ kind: 'settings', data: s });
    if (toSave.length) await saveItems(toSave, { silent: true });
  }

  const HOOKS = [
    'I passed my exam with this 2-minute trick', 'POV: it is 11pm and the exam is tomorrow', '3 apps every student should have',
    'How I learn 50 vocab words in 10 minutes', 'Stop highlighting. Do this instead', 'Study with me: 25/5 pomodoro',
    'The note-taking method teachers never told you', 'Rating study hacks from TikTok', 'What 8 hours of studying actually looks like',
    'My teacher was shocked by this summary', 'How to plan a week of revision in 5 minutes', 'Things I wish I knew before my finals',
    'This is why you forget everything after class', 'Math exam tomorrow? Watch this', 'Reacting to your study setups',
    'Free summaries for every subject (seriously)', 'How top students revise the night before', 'Flashcards vs mind maps: which wins?',
    'Turn any textbook page into notes in 30 seconds', 'The only study schedule you need'
  ];
  const VARIANTS = ['', ' (subtitles)', ' (alt hook)', ' (fast cut)', ' (long version)'];
  const CLIP_NAMES = ['Desk talking head', 'Whiteboard explainer', 'Library b-roll', 'Phone screen recording', 'Walking POV', 'Reaction at desk', 'Notes close-up'];
  const CAPTIONS = ['Free summaries in the app. Link in bio. #studytok #exams #knowunity', 'Save this for exam week. #studytips #school', 'Which one are you? Comment below. #students #studyhacks', ''];

  function buildExampleData(tk) {
    const s = S();
    const out = [];
    const at = (key, hh, mm) => { const d = parseKey(key); d.setHours(hh, mm || 0, 0, 0); return d.toISOString(); };
    const dayOf = (offset) => addDays(tk, offset);
    let dropNo = Math.max(0, ...drops().map((d) => d.number || 0));
    const makeDrop = (offset, hh, by, title, brief, deliveredOffset, deliveredHH, deliveredMM, targetVideos, status) => {
      const sentAt = at(dayOf(offset), hh, 0);
      const d = { id: uid('drop'), number: ++dropNo, title: title, sentBy: by, editorId: 'member_editor1', sentAt: sentAt, dueAt: addHoursIso(sentAt, s.editorSlaHours),
        driveLink: 'https://drive.google.com/drive/folders/example-' + dropNo + '-raw', brief: brief, targetVideos: targetVideos, status: status, createdAt: sentAt,
        clips: CLIP_NAMES.map((n) => ({ id: uid('clip'), name: n })), editingStartedAt: addHoursIso(sentAt, 2), deliveredAt: null, deliveredLink: '', deliveryNote: '', closedAt: null };
      if (deliveredOffset != null) { d.deliveredAt = at(dayOf(deliveredOffset), deliveredHH, deliveredMM); d.deliveredLink = 'https://drive.google.com/drive/folders/example-' + dropNo + '-edits'; d.deliveryNote = 'All exports 1080x1920, subtitles burned in where marked.'; }
      if (status === 'approved') d.closedAt = addHoursIso(d.deliveredAt, 6);
      out.push({ kind: 'drop', data: d });
      return d;
    };
    const d1 = makeDrop(-29, 10, 'member_immanuel', 'Exam season kick-off', 'Hooks around exam panic and quick wins. Subtitles on every second variation. End with the app CTA.', -28, 8, 45, 20, 'approved');
    const d2 = makeDrop(-19, 11, 'member_adam', 'Study hacks reactions', 'React to viral study hacks, keep cuts fast. Two variations per clip minimum.', -18, 15, 10, 20, 'approved');
    const d3 = makeDrop(-9, 9, 'member_immanuel', 'Library day', 'B-roll heavy. Calm tone, longer versions welcome. Try three hooks on the desk clip.', -8, 12, 40, 20, 'delivered');
    const d4 = makeDrop(-1, 16, 'member_adam', 'Finals week', 'Teacher reactions and POVs. Fast, loud, subtitles everywhere.', null, 0, 0, 20, 'editing');

    const clipCounters = {};
    let hookIdx = 0;
    const mkVideo = (d, i) => {
      const clip = d.clips[i % d.clips.length];
      clipCounters[clip.id] = (clipCounters[clip.id] || 0) + 1;
      const n = clipCounters[clip.id];
      const cIdx = d.clips.indexOf(clip) + 1;
      const hook = HOOKS[hookIdx % HOOKS.length]; hookIdx++;
      return { id: uid('video'), code: dropCode(d) + '-C' + pad2(cIdx) + '-v' + n, title: hook + VARIANTS[(n - 1) % VARIANTS.length], dropId: d.id, clipId: clip.id, editorId: 'member_editor1',
        status: 'delivered', fileLink: 'https://drive.google.com/file/d/example-' + d.number + '-' + i, caption: CAPTIONS[i % CAPTIONS.length], notes: '', platforms: blankPlatforms(),
        scheduledDate: null, slot: null, posterId: null, postedDate: null, postedAt: null, deliveredAt: d.deliveredAt || nowIso(), approvedAt: null, createdAt: d.deliveredAt || nowIso() };
    };
    const queue = [];
    for (let i = 0; i < 20; i++) queue.push(mkVideo(d1, i));
    for (let i = 0; i < 20; i++) queue.push(mkVideo(d2, i));
    const d3v = []; for (let i = 0; i < 20; i++) d3v.push(mkVideo(d3, i));
    queue.push.apply(queue, d3v.slice(0, 13));
    const perDay = Math.max(1, s.postsPerDay);
    let qi = 0;
    for (let off = -27; off <= -1 && qi < queue.length; off++) {
      const key = dayOf(off);
      for (let slot = 1; slot <= perDay && qi < queue.length; slot++) {
        if (off === -4 && slot === 2) continue; // one missed slot, so the board shows what a gap looks like
        const v = queue[qi++];
        const when = at(key, slot === 1 ? 12 : 18, 15);
        v.status = 'posted'; v.scheduledDate = key; v.slot = slot; v.postedDate = key; v.postedAt = when; v.approvedAt = addHoursIso(v.deliveredAt, 5);
        v.platforms = { instagram: { posted: true, at: when }, tiktok: { posted: true, at: addHoursIso(when, 0.25) } };
      }
    }
    const rest = d3v.slice(13);
    const sched = [[0, 1, 'partial'], [0, 2, 'scheduled'], [1, 1, 'scheduled'], [1, 2, 'scheduled'], [2, 1, 'scheduled']];
    sched.forEach((row, i) => {
      const v = rest[i]; const key = dayOf(row[0]);
      v.status = 'scheduled'; v.scheduledDate = key; v.slot = row[1]; v.approvedAt = addHoursIso(v.deliveredAt, 5);
      if (row[2] === 'partial') v.platforms.instagram = { posted: true, at: at(key, 12, 20) };
    });
    rest.slice(5).forEach((v) => { v.status = 'approved'; v.approvedAt = addHoursIso(v.deliveredAt, 5); });
    d3v.forEach((v) => out.push({ kind: 'video', data: v }));
    queue.slice(0, 40).forEach((v) => out.push({ kind: 'video', data: v }));
    for (let i = 0; i < 5; i++) {
      const v = mkVideo(d4, i);
      v.deliveredAt = i < 2 ? addHoursIso(d4.sentAt, 14 + i) : null; v.status = i < 2 ? 'delivered' : 'editing'; v.fileLink = i < 2 ? v.fileLink : ''; v.createdAt = v.deliveredAt || d4.editingStartedAt;
      out.push({ kind: 'video', data: v });
    }
    const swapDay = dayOf(3);
    const p = posterFor(swapDay);
    const other = creators().find((m) => !p || m.id !== p.id);
    if (p && other) out.push({ kind: 'override', data: { id: 'override_' + swapDay, date: swapDay, posterId: other.id, note: memberName(p.id) + ' away' } });
    return out;
  }

  async function boot() {
    store = window.KUStore.create(window.KU_CONFIG || {});
    mountShell();
    wireEvents();
    try { state.me = localStorage.getItem('ku:me') || null; } catch (e) { state.me = null; }
    let items = [];
    try { items = await store.load(); }
    catch (e) { console.error(e); setSync('error', e.message); }
    items.forEach((it) => { if (it && it.id && it.kind && it.data) state.items.set(it.id, it); });
    await ensureDefaults(true);
    if (state.me && !getItem(state.me)) state.me = null;
    state.ready = true;
    route();
    if (state.sync.status === 'error') toast('Could not load the shared board: ' + state.sync.error, 'crit');
    if (!state.me && members().length) openModal('who');
    if (store.mode === 'supabase') startPolling();
    setInterval(() => { state.now = Date.now(); if (!state.drawer && !state.modal && (state.route === 'today' || state.route === 'drops')) renderMain(); }, 60000);
  }

  window.KU = { state: state, boot: boot, posterFor: posterFor, slotsFor: slotsFor, monthStats: monthStats };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
