/* ==========================================================================
   Knowunity Content OS — application
   One file, no build step. Structure:
     1. helpers (DOM, dates, formatting)      5. pages (Home, Calendar, Drops, …)
     2. icons + constants                      6. sheets (every dialog)
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
  const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';

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
  const isLate = (dueIso) => new Date(dueIso).getTime() < Date.now();
  const toLocalInput = (iso) => { const d = iso ? new Date(iso) : new Date(); return keyOf(d) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  const fromLocalInput = (v) => { const d = v ? new Date(v) : new Date(); return isNaN(d) ? nowIso() : d.toISOString(); };
  const addHoursIso = (iso, h) => new Date(new Date(iso).getTime() + h * 3600000).toISOString();
  function greeting() { const h = new Date().getHours(); return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }

  /* ------------------------------------------------------------------------
     2. Icons + constants
     ------------------------------------------------------------------------ */
  const svg = (inner) => '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  const I = {
    home: svg('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),
    calendar: svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    film: svg('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>'),
    play: svg('<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l5.5-3.5z"/>'),
    settings: svg('<path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h12M20 18h0"/><circle cx="15" cy="6" r="2.5"/><circle cx="9" cy="12" r="2.5"/><circle cx="18" cy="18" r="2.5"/>'),
    book: svg('<path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h8"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    ext: svg('<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>'),
    copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>'),
    check: svg('<path d="M5 12l5 5L20 7"/>'),
    x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    left: svg('<path d="M15 5l-7 7 7 7"/>'),
    right: svg('<path d="M9 5l7 7-7 7"/>'),
    trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    edit: svg('<path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M13 7l4 4"/>'),
    send: svg('<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4 18-7z"/>'),
    swap: svg('<path d="M7 16V4M7 4L3 8M7 4l4 4"/><path d="M17 8v12M17 20l4-4M17 20l-4-4"/>'),
    download: svg('<path d="M12 3v12M12 15l-4-4M12 15l4-4"/><path d="M4 17v3h16v-3"/>'),
    upload: svg('<path d="M12 15V3M12 3L8 7M12 3l4 4"/><path d="M4 17v3h16v-3"/>'),
    wand: svg('<path d="M4 20l10-10M14 4l1 2M20 10l-2-1M17 3l-1 3M21 7l-3 1"/>'),
    refresh: svg('<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>'),
    alert: svg('<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17.5v.5"/>')
  };

  const SETTINGS_ID = 'settings_main';
  const ROUTES = {
    home: { label: 'Home', icon: 'home' },
    calendar: { label: 'Calendar', icon: 'calendar' },
    drops: { label: 'Drops', icon: 'film' },
    videos: { label: 'Videos', icon: 'play' },
    settings: { label: 'Settings', icon: 'settings' },
    help: { label: 'How it works', icon: 'book' }
  };
  const VSTATUS = [
    ['editing', 'In editing', 'muted'],
    ['delivered', 'To review', 'info'],
    ['changes', 'Needs changes', 'warn'],
    ['approved', 'Ready', 'good'],
    ['scheduled', 'Planned', 'primary'],
    ['posted', 'Posted', 'dark']
  ];
  const VS = {};
  VSTATUS.forEach((row, i) => { VS[row[0]] = { key: row[0], label: row[1], tone: row[2], order: i }; });
  const DSTATUS = {
    sent: ['With the editor', 'info'],
    editing: ['Being edited', 'primary'],
    delivered: ['Delivered', 'warn'],
    approved: ['Done', 'dark']
  };
  const COLORS = ['teal', 'orange', 'pink', 'blue', 'green', 'gold'];
  const LIGHT_COLORS = { gold: true };
  const COLOR_MIGRATION = { violet: 'pink', magenta: 'pink', yellow: 'gold', aqua: 'teal', red: 'orange' };
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
    route: 'home',
    month: monthOf(todayKey()), // month shown in the calendar
    me: null,                   // member id chosen on this device
    sheet: null,                // { type, … } the open dialog
    sheetEnter: false,
    filters: { status: '', drop: '', q: '' },
    sync: { status: 'ok', error: '' },
    now: Date.now(),
    ready: false
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
  function setSync(status, error) { state.sync = { status: status, error: error || '', lastSyncAt: state.sync.lastSyncAt || 0 }; }
  async function persist(fn) {
    setSync('busy');
    try { await fn(); setSync('ok'); if (store && store.mode === 'supabase') scheduleCheck(3000); }
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
  const me = () => member(state.me);
  const isEditor = () => { const m = me(); return !!m && m.role === 'editor'; };

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
    const n = s.rotaMode === 'weeks'
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
    return { perDrop: perDrop, clips: clips, everyDays: everyDays };
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
      (clips ? clips + ' clips → ' : '') + d.targetVideos + ' videos wanted',
      'Deadline: ' + fmtDT(d.dueAt) + ' (' + s.editorSlaHours + 'h)',
      d.brief ? 'Notes: ' + d.brief : '',
      'From ' + memberName(d.sentBy) + ' · editor: ' + memberName(d.editorId)
    ].filter(Boolean).join('\n');
  }
  function deliveryMessage(d) {
    const vids = dropVideos(d.id).filter((v) => v.status !== 'editing');
    return [
      'Drop ' + dropCode(d) + ' delivered — ' + plural(vids.length, 'video'),
      'Edited files: ' + (d.deliveredLink || '(add the Drive link)'),
      d.deliveryNote ? 'Notes: ' + d.deliveryNote : '',
      'Please review within ' + S().reviewSlaHours + 'h.'
    ].filter(Boolean).join('\n');
  }
  function dayMessage(key) {
    const p = posterFor(key);
    const lines = ['Posting plan for ' + fmtDay(key) + (p ? ' — ' + memberName(p.id) + ' posts' : '')];
    slotsFor(key).forEach((s) => {
      lines.push(s.slot + '. ' + (s.video ? (s.video.title + (s.video.fileLink ? ' — ' + s.video.fileLink : '') + (s.video.caption ? '\n   Caption: ' + s.video.caption : '')) : '(nothing planned)'));
    });
    lines.push('Post on Instagram + TikTok, then tick both in the app.');
    return lines.join('\n');
  }

  /* ------------------------------------------------------------------------
     5. Shared templates + pages
     ------------------------------------------------------------------------ */
  const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const colorOf = (m) => COLOR_MIGRATION[m.color] || (COLORS.includes(m.color) ? m.color : 'blue');
  function avatar(id, size, extra) {
    const m = member(id);
    if (!m) return '';
    const c = colorOf(m);
    const cls = ['avatar', size || '', LIGHT_COLORS[c] ? 'is-light' : '', extra || ''].filter(Boolean).join(' ');
    return '<span class="' + cls + '" style="--mc: var(--m-' + c + ')" title="' + esc(m.name) + '">' + esc(initials(m.name)) + '</span>';
  }
  function memberChip(id) {
    const m = member(id);
    if (!m) return '<span class="muted">Unassigned</span>';
    return '<span class="mem"><span class="mem-dot" style="--mc: var(--m-' + colorOf(m) + ')"></span>' + esc(m.name) + '</span>';
  }
  const chip = (label, tone) => '<span class="chip' + (tone && tone !== 'muted' ? ' chip-' + tone : '') + '">' + esc(label) + '</span>';
  const statusChip = (v) => { const s = VS[v.status] || VS.editing; return chip(s.label, s.tone); };
  const dropChip = (d) => { const r = DSTATUS[d.status] || DSTATUS.sent; return chip(r[0], r[1]); };
  function dueChip(d) {
    if (d.status === 'sent' || d.status === 'editing') {
      const diff = new Date(d.dueAt).getTime() - state.now;
      if (diff < 0) return chip('Late by ' + fmtDuration(diff), 'bad');
      if (diff < 4 * 3600000) return chip('Due in ' + fmtDuration(diff), 'warn');
      return chip(fmtDuration(diff) + ' left', 'muted');
    }
    if (d.deliveredAt) {
      const late = new Date(d.deliveredAt) - new Date(d.dueAt);
      return late > 0 ? chip('Delivered late by ' + fmtDuration(late), 'warn') : chip('Delivered on time', 'good');
    }
    return chip('Done', 'dark');
  }
  const linkBtn = (url, label, cls) => url ? '<a class="btn btn-sm ' + (cls || '') + '" href="' + esc(url) + '" target="_blank" rel="noopener">' + I.ext + ' ' + esc(label || 'Open') + '</a>' : '';
  function toggleBtn(v, key) {
    const on = platforms(v)[key].posted;
    const pl = PLATFORMS.find((x) => x[0] === key);
    return '<button type="button" class="toggle' + (on ? ' is-on' : '') + '" data-action="platform" data-id="' + v.id + '" data-platform="' + key + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + (on ? I.check : '<span class="ring"></span>') + esc(pl[2]) + '</button>';
  }
  function selectHtml(name, options, value, attrs) {
    return '<select name="' + esc(name) + '" ' + (attrs || '') + '>' + options.map((o) => '<option value="' + esc(o.value) + '"' + (String(o.value) === String(value == null ? '' : value) ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') + '</select>';
  }
  const memberOptions = (list, emptyLabel) => (emptyLabel != null ? [{ value: '', label: emptyLabel }] : []).concat(list.map((m) => ({ value: m.id, label: m.name })));
  const head = (title, sub, actions) => '<div class="head"><div><h1>' + title + '</h1>' + (sub ? '<div class="head-sub">' + sub + '</div>' : '') + '</div>' + (actions ? '<div class="row">' + actions + '</div>' : '') + '</div>';
  const cardHead = (title, sub, right) => '<div class="card-head"><div><div class="card-title">' + title + '</div>' + (sub ? '<div class="card-sub">' + sub + '</div>' : '') + '</div>' + (right ? '<div class="row">' + right + '</div>' : '') + '</div>';
  const empty = (emoji, text) => '<div class="empty"><span class="big">' + emoji + '</span>' + esc(text) + '</div>';

  function dayDots(key) {
    const ds = dayState(key);
    const tk = todayKey();
    return '<span class="dots">' + ds.slots.map((sl) => {
      let c = key < tk ? 'is-miss' : 'is-empty';
      if (sl.video) { const p = platforms(sl.video); c = sl.video.status === 'posted' ? 'is-done' : (p.instagram.posted || p.tiktok.posted) ? 'is-half' : 'is-plan'; }
      return '<span class="dot ' + c + '"></span>';
    }).join('') + '</span>';
  }
  function weekStrip(from, n) {
    let out = '';
    for (let i = 0; i < n; i++) {
      const k = addDays(from, i);
      const p = posterFor(k);
      out += '<button type="button" class="day-pill" data-action="openDay" data-date="' + k + '" aria-label="' + esc(fmtDayLong(k)) + '"><span class="dw">' + esc(parseKey(k).toLocaleDateString(undefined, { weekday: 'short' })) + '</span><span class="dn">' + Number(k.slice(8, 10)) + '</span>' + (p ? avatar(p.id, 'avatar-sm', getItem('override_' + k) ? 'is-swapped' : '') : '') + dayDots(k) + '</button>';
    }
    return '<div class="week">' + out + '</div>';
  }
  const legend = () => '<div class="legend"><span><span class="dot is-done"></span>posted</span><span><span class="dot is-half"></span>one platform</span><span><span class="dot is-plan"></span>planned</span><span><span class="dot is-empty"></span>empty</span><span><span class="dot is-miss"></span>missed</span></div>';

  function videoItem(v, opts) {
    const d = getItem(v.dropId);
    const bits = ['<span class="mono">' + esc(v.code) + '</span>'];
    if (d) bits.push(esc(d.title));
    if (v.status === 'posted' && v.postedDate) bits.push('posted ' + esc(fmtDay(v.postedDate)));
    else if (v.status === 'scheduled' && v.scheduledDate) bits.push('planned ' + esc(fmtDay(v.scheduledDate)));
    else if (v.editorId && (!opts || !opts.hideEditor)) bits.push(esc(memberName(v.editorId)));
    return '<div class="item is-click vitem" data-action="openVideo" data-id="' + v.id + '"><div class="item-main"><div class="item-title">' + esc(v.title || 'Untitled') + '</div><div class="item-sub">' + bits.join(' · ') + '</div></div>' + statusChip(v) + '</div>';
  }
  function exampleBanner() {
    if (!S().exampleData) return '';
    return '<div class="banner">' + I.alert + '<div class="grow">This is example data so you can click around. Clear it when the team starts for real.</div><button type="button" class="btn btn-sm" data-action="clearExample" data-confirm="Clear every example drop and video?">Clear example data</button></div>';
  }
  function slotRow(sl, key) {
    const v = sl.video;
    if (!v) {
      const ready = videos().filter((x) => x.status === 'approved').length;
      return '<div class="slot"><div class="slot-n">' + sl.slot + '</div><div class="grow"><div class="slot-title muted">Nothing planned yet</div><div class="slot-row mt">' + (ready ? '<button type="button" class="btn btn-sm" data-action="openPick" data-date="' + key + '" data-slot="' + sl.slot + '" data-back="close">Pick a video</button>' : '<span class="hint">Approve a video first, then it can go here.</span>') + '</div></div></div>';
    }
    const d = getItem(v.dropId);
    return '<div class="slot"><div class="slot-n">' + sl.slot + '</div><div class="grow"><div class="slot-title">' + esc(v.title) + '</div><div class="slot-sub"><span class="mono">' + esc(v.code) + '</span>' + (d ? ' · ' + esc(d.title) : '') + (v.status === 'posted' ? ' · posted ✓' : '') + '</div><div class="slot-row">' + toggleBtn(v, 'instagram') + toggleBtn(v, 'tiktok') + linkBtn(v.fileLink, 'Watch') + (v.caption ? '<button type="button" class="btn btn-sm" data-action="copyText" data-text="' + esc(v.caption) + '" data-label="Caption copied">' + I.copy + ' Caption</button>' : '') + '<button type="button" class="btn btn-sm btn-ghost" data-action="openVideo" data-id="' + v.id + '">Details</button></div></div></div>';
  }

  /* ---- Home ---- */
  function pageHome() { return isEditor() ? homeEditor() : homeCreator(); }

  function homeCreator() {
    const tk = todayKey();
    const mk = monthOf(tk);
    const st = monthStats(mk);
    const s = S();
    const m = me();
    const poster = posterFor(tk);
    const ds = dayState(tk);
    const review = sortBy(videos().filter((v) => v.status === 'delivered'), (v) => v.deliveredAt || '');
    const active = sortBy(drops().filter((d) => d.status !== 'approved'), (d) => d.dueAt || '');
    const gaps = gapsAhead(addDays(tk, 1), 7);
    const emptyAhead = gaps.reduce((a, g) => a + g.empty, 0);

    let sub = esc(fmtDayLong(tk));
    if (poster) sub += ' · ' + (m && poster.id === m.id ? 'you post today' : esc(memberName(poster.id)) + ' posts today');
    const hello = '<div class="head"><div><h1 class="hello">' + esc(greeting()) + (m ? ', ' + esc(firstName(m.name)) : '') + ' 👋</h1><div class="hello-sub">' + sub + (m ? '' : ' · <a href="#" data-action="who">choose who you are</a>') + '</div></div><button type="button" class="btn btn-primary" data-action="newDrop">' + I.send + ' Send a drop</button></div>';

    const pct = st.target ? Math.min(100, Math.round(100 * st.posted / st.target)) : 0;
    const pace = st.remaining === 0 ? chip('Target reached 🎉', 'good') : st.diff >= 0 ? chip(st.diff === 0 ? 'On track' : st.diff + ' ahead', 'good') : chip(Math.abs(st.diff) + ' behind', st.diff < -4 ? 'bad' : 'warn');
    const need = st.remaining === 0 ? 'Everything for this month is out. Nice.' : st.remainingDays === 0 ? plural(st.remaining, 'post') + ' short this month.' : plural(st.remaining, 'more post') + ' to go · ' + plural(st.remainingDays, 'day') + ' left · about ' + (Math.round(st.perDay * 10) / 10) + ' a day';
    const progress = '<section class="card">' + cardHead(esc(fmtMonth(mk)), 'Instagram + TikTok, both ticked = one post', pace) + '<div class="progress-top"><span class="progress-num">' + st.posted + '</span><span class="progress-of">of ' + st.target + ' posts</span></div><div class="progress"><div class="progress-fill" style="width:' + pct + '%"></div></div><div class="small muted">' + esc(need) + '</div></section>';

    const today = '<section class="card">' + cardHead('Today', poster ? esc(memberName(poster.id)) + ' posts' + (poster.source === 'override' ? ' (swapped in' + (poster.note ? ': ' + esc(poster.note) : '') + ')' : '') : 'No poster yet. Add creators in Settings.', '<button type="button" class="btn btn-sm" data-action="copyDay" data-date="' + tk + '">' + I.copy + ' Copy plan</button>') + '<div>' + ds.slots.map((sl) => slotRow(sl, tk)).join('') + '</div></section>';

    const reviewRows = review.slice(0, 5).map((v) => {
      const d = getItem(v.dropId);
      return '<div class="item"><div class="item-main"><div class="item-title">' + esc(v.title) + '</div><div class="item-sub"><span class="mono">' + esc(v.code) + '</span>' + (d ? ' · ' + esc(d.title) : '') + ' · ' + esc(memberName(v.editorId)) + '</div></div><div class="item-actions">' + linkBtn(v.fileLink, 'Watch') + '<button type="button" class="btn btn-sm btn-good" data-action="videoStatus" data-id="' + v.id + '" data-status="approved">' + I.check + ' Approve</button><button type="button" class="btn btn-sm btn-ghost" data-action="openChanges" data-id="' + v.id + '">Changes</button></div></div>';
    }).join('');
    const reviewCard = '<section class="card">' + cardHead('To review', review.length ? plural(review.length, 'video') + ' from the editor · approve within ' + s.reviewSlaHours + 'h' : 'New videos from the editor land here', review.length > 5 ? '<a class="btn btn-sm" href="#videos" data-action="gotoVideos" data-status="delivered">See all ' + review.length + '</a>' : '') + (reviewRows || empty('✨', 'Nothing to review right now')) + '</section>';

    const dropRows = active.map((d) => '<div class="item is-click" data-action="openDrop" data-id="' + d.id + '"><div class="item-main"><div class="item-title">' + esc(d.title) + '</div><div class="item-sub"><span class="mono">' + dropCode(d) + '</span> · ' + esc(memberName(d.editorId)) + ' · ' + esc(DSTATUS[d.status][0].toLowerCase()) + '</div></div>' + dueChip(d) + '</div>').join('');
    const nextDrop = suggestedNextDrop();
    const dropsCard = '<section class="card">' + cardHead('With the editor', active.length ? 'The editor has ' + s.editorSlaHours + ' hours from the moment a drop is sent' : 'Next drop around ' + esc(fmtDay(nextDrop < tk ? tk : nextDrop))) + (dropRows || empty('🎬', 'Nothing with the editor. Film, upload, send a drop.')) + '</section>';

    const weekCard = '<section class="card">' + cardHead('Next 7 days', emptyAhead ? plural(emptyAhead, 'empty slot') + ' to fill' : 'Every day is covered', (emptyAhead && st.ready ? '<button type="button" class="btn btn-sm btn-primary" data-action="autoFill" data-from="' + addDays(tk, 1) + '" data-days="14">' + I.wand + ' Fill empty days</button>' : '')) + weekStrip(addDays(tk, 1), 7) + '<div class="mt">' + legend() + '</div></section>';

    return hello + '<div class="stack">' + welcomeCard('creator', m) + progress + today + reviewCard + dropsCard + weekCard + '</div><div class="link-row"><a href="#help">How it works</a> · <a href="#" data-action="who">Switch person</a></div>';
  }

  function homeEditor() {
    const m = me();
    const s = S();
    const tk = todayKey();
    const mine = sortBy(openDrops(), (d) => d.dueAt || '');
    const delivered = drops().filter((d) => d.status === 'delivered');
    const changes = sortBy(videos().filter((v) => v.status === 'changes'), (v) => v.updatedAt || '');
    const monthDelivered = videos().filter((v) => v.editorId === m.id && v.deliveredAt && monthOf(dateKeyOfIso(v.deliveredAt)) === monthOf(tk)).length;

    const hello = '<div class="head"><div><h1 class="hello">' + esc(greeting()) + ', ' + esc(firstName(m.name)) + ' 👋</h1><div class="hello-sub">' + esc(fmtDayLong(tk)) + ' · ' + (mine.length ? plural(mine.length, 'drop') + ' to deliver' : 'nothing waiting for you') + '</div></div></div>';

    const dropCards = mine.map((d) => {
      const late = isLate(d.dueAt);
      const cta = d.status === 'sent'
        ? '<button type="button" class="btn btn-primary btn-lg" data-action="dropStart" data-id="' + d.id + '">' + I.check + ' Start editing</button>'
        : '<button type="button" class="btn btn-primary btn-lg" data-action="openDeliver" data-id="' + d.id + '">' + I.send + ' Deliver</button>';
      return '<section class="card">' + cardHead(esc(d.title), '<span class="mono">' + dropCode(d) + '</span> · from ' + esc(memberName(d.sentBy)) + ' · ' + plural((d.clips || []).length, 'clip') + ' · ' + d.targetVideos + ' videos wanted', dueChip(d)) +
        '<div class="stack-sm"><div class="note"><b>' + (late ? 'Deadline passed: ' : 'Deadline: ') + esc(fmtDT(d.dueAt)) + '</b>' + (d.brief ? '<div class="wrap mt">' + esc(d.brief) + '</div>' : '') + '</div>' +
        '<div class="row">' + cta + (d.driveLink ? '<a class="btn btn-lg" href="' + esc(d.driveLink) + '" target="_blank" rel="noopener">' + I.ext + ' Open footage</a>' : '<span class="hint">No footage link yet, ask ' + esc(firstName(memberName(d.sentBy))) + '.</span>') + '<button type="button" class="btn btn-ghost" data-action="openDrop" data-id="' + d.id + '">Details</button></div></div></section>';
    }).join('');
    const dropsBlock = dropCards || '<section class="card">' + empty('☕', 'No drops to edit right now. Enjoy the quiet.') + '</section>';

    const waiting = delivered.length ? '<section class="card">' + cardHead('Waiting for review', 'Delivered, the creators are checking') + delivered.map((d) => '<div class="item is-click" data-action="openDrop" data-id="' + d.id + '"><div class="item-main"><div class="item-title">' + esc(d.title) + '</div><div class="item-sub"><span class="mono">' + dropCode(d) + '</span> · ' + plural(dropVideos(d.id).length, 'video') + '</div></div>' + dueChip(d) + '</div>').join('') + '</section>' : '';

    const changesRows = changes.map((v) => {
      const d = getItem(v.dropId);
      return '<div class="item"><div class="item-main"><div class="item-title">' + esc(v.title) + '</div><div class="item-sub"><span class="mono">' + esc(v.code) + '</span>' + (d ? ' · ' + esc(d.title) : '') + '</div>' + (v.notes ? '<div class="note mt wrap">' + esc(v.notes) + '</div>' : '') + '</div><div class="item-actions">' + linkBtn(v.fileLink, 'Open') + '<button type="button" class="btn btn-sm btn-primary" data-action="videoStatus" data-id="' + v.id + '" data-status="delivered">' + I.check + ' Fixed, delivered again</button></div></div>';
    }).join('');
    const changesCard = changes.length ? '<section class="card">' + cardHead('Needs changes', plural(changes.length, 'video') + ' sent back with notes') + changesRows + '</section>' : '';

    const stat = '<section class="card is-soft">' + cardHead('This month', 'Thank you for the work') + '<div class="progress-top"><span class="progress-num">' + monthDelivered + '</span><span class="progress-of">videos delivered 🎬</span></div><div class="small muted mt">Turnaround agreed with the team: ' + s.editorSlaHours + ' hours per drop.</div></section>';

    return hello + '<div class="stack">' + welcomeCard('editor', m) + dropsBlock + changesCard + waiting + stat + '</div><div class="link-row"><a href="#help">How it works</a> · <a href="#" data-action="who">Switch person</a></div>';
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
    const weeks = Math.ceil((daysBetween(gridStart, last) + 1) / 7);
    const dows = [];
    for (let i = 0; i < 7; i++) dows.push('<div class="cal-dow">' + esc(weekdayName(((s.weekStart - 1 + i) % 7) + 1)) + '</div>');
    const cells = [];
    for (let i = 0; i < weeks * 7; i++) {
      const key = addDays(gridStart, i);
      const inMonth = monthOf(key) === mk;
      const p = posterFor(key);
      cells.push('<button type="button" class="cal-cell' + (inMonth ? '' : ' is-out') + (key === tk ? ' is-today' : '') + '" data-action="openDay" data-date="' + key + '" aria-label="' + esc(fmtDayLong(key)) + '"><span class="cal-top"><span class="cal-num">' + Number(key.slice(8, 10)) + '</span>' + (p ? avatar(p.id, 'avatar-sm', getItem('override_' + key) ? 'is-swapped' : '') : '') + '</span>' + dayDots(key) + '</button>');
    }
    let gapCount = 0;
    for (let d = 1; d <= dim; d++) { const k = mk + '-' + pad2(d); if (k >= tk) gapCount += dayState(k).empty; }
    const fillFrom = mk === monthOf(tk) ? tk : (mk > monthOf(tk) ? first : tk);
    const who = rotaMembers().map((m) => '<span class="mem">' + avatar(m.id, 'avatar-sm') + esc(m.name) + '</span>').join('');
    return head('Calendar', 'Who posts on which day. Tap a day to change things.',
      '<div class="seg"><button type="button" data-action="calMonth" data-dir="-1" aria-label="Previous month">' + I.left + '</button><button type="button" data-action="calMonth" data-dir="0">Today</button><button type="button" data-action="calMonth" data-dir="1" aria-label="Next month">' + I.right + '</button></div>' +
      (gapCount && st.ready ? '<button type="button" class="btn btn-primary" data-action="autoFill" data-from="' + fillFrom + '" data-days="' + dim + '">' + I.wand + ' Fill empty days</button>' : '')) +
      '<section class="card">' + cardHead(esc(fmtMonth(mk)), st.posted + ' posted · ' + st.scheduled + ' planned · ' + gapCount + ' empty slots ahead', '<span class="row">' + who + '</span>') +
      '<div class="cal">' + dows.join('') + cells.join('') + '</div><div class="mt">' + legend() + '</div></section>';
  }

  /* ---- Drops ---- */
  function pageDrops() {
    const all = drops();
    const rows = all.map((d) => {
      const vids = dropVideos(d.id);
      return '<div class="item is-click" data-action="openDrop" data-id="' + d.id + '"><div class="item-main"><div class="item-title">' + esc(d.title) + '</div><div class="item-sub"><span class="mono">' + dropCode(d) + '</span> · ' + esc(memberName(d.editorId)) + ' · sent ' + esc(fmtDay(dateKeyOfIso(d.sentAt))) + ' · ' + vids.length + ' of ' + d.targetVideos + ' videos</div></div>' + dueChip(d) + '</div>';
    }).join('');
    const m = dropMath();
    return head('Drops', 'A drop is one batch of raw footage for the editor. The ' + S().editorSlaHours + '-hour clock starts when you send it.', '<button type="button" class="btn btn-primary" data-action="newDrop">' + I.send + ' Send a drop</button>') +
      '<section class="card">' + cardHead('All drops', 'Plan: ' + S().dropsPerMonth + ' a month, about ' + m.perDrop + ' videos each') + (rows || empty('🎬', 'No drops yet. Film, upload the footage to Drive, then send the first drop.')) + '</section>';
  }

  /* ---- Videos ---- */
  function pageVideos() {
    const f = state.filters;
    const tk = todayKey();
    const all = videos();
    const counts = { delivered: 0, approved: 0, scheduled: 0, posted: 0, editing: 0 };
    all.forEach((v) => { if (v.status === 'changes') counts.editing++; else if (counts[v.status] != null) counts[v.status]++; });
    const groups = [['delivered', 'To review'], ['approved', 'Ready'], ['scheduled', 'Planned'], ['posted', 'Posted'], ['editing', 'In editing'], ['', 'All']];
    const chips = '<div class="chips">' + groups.map((g) => '<button type="button" class="chip-btn' + (f.status === g[0] ? ' is-on' : '') + '" data-action="vfilter" data-status="' + g[0] + '">' + esc(g[1]) + (g[0] && counts[g[0]] ? ' · ' + counts[g[0]] : '') + '</button>').join('') + '</div>';
    let list = all;
    if (f.status === 'editing') list = list.filter((v) => v.status === 'editing' || v.status === 'changes');
    else if (f.status) list = list.filter((v) => v.status === f.status);
    else list = list.filter((v) => v.status !== 'posted' || (v.postedDate || '') >= addDays(tk, -30));
    if (f.drop) list = list.filter((v) => v.dropId === f.drop);
    if (f.q) { const q = f.q.toLowerCase(); list = list.filter((v) => (v.title + ' ' + v.code + ' ' + (v.caption || '')).toLowerCase().includes(q)); }
    list = sortBy(list, (v) => [VS[v.status] ? VS[v.status].order : 9, v.status === 'posted' ? (v.postedDate ? '~' + v.postedDate : '') : (v.scheduledDate || v.createdAt || '')]);
    if (f.status === 'posted') list = sortBy(list, (v) => -(new Date(v.postedAt || 0).getTime()));
    const dropOpts = [{ value: '', label: 'All drops' }].concat(drops().map((d) => ({ value: d.id, label: dropCode(d) + ' · ' + d.title })));
    const filters = '<div class="filters">' + selectHtml('drop', dropOpts, f.drop, 'id="f-drop" data-change="filter" data-key="drop" aria-label="Filter by drop"') + '<input type="search" id="f-q" placeholder="Search by title or code" value="' + esc(f.q) + '" data-input="filter" data-key="q" aria-label="Search videos"></div>';
    return head('Videos', 'Every video, from editing to posted.', isEditor() ? '' : '<button type="button" class="btn" data-action="addVideos">' + I.plus + ' Add videos</button>') + chips + filters +
      '<section class="card">' + (list.length ? list.map((v) => videoItem(v)).join('') : empty('🔍', 'No videos here' + (f.q ? ' for "' + f.q + '"' : '') + '.')) + (!f.status && all.some((v) => v.status === 'posted' && (v.postedDate || '') < addDays(tk, -30)) ? '<div class="small muted center mt">Older posted videos are under the Posted filter.</div>' : '') + '</section>';
  }

  /* ---- Settings ---- */
  function pageSettings() {
    const s = S();
    const m = me();
    const ms = members();
    const cs = rotaMembers();
    const youCard = '<section class="card">' + cardHead('You', m ? 'Chosen on this device. Only changes what Home shows first.' : 'Choose your name so Home shows your work first.', '<button type="button" class="btn btn-sm" data-action="who">' + I.swap + ' Switch</button>') + (m ? '<div class="row">' + avatar(m.id, 'avatar-lg') + '<div><div class="item-title">' + esc(m.name) + '</div><div class="item-sub">' + (m.role === 'creator' ? 'Creator' : 'Editor') + '</div></div></div>' : '') + '</section>';
    const teamRows = ms.map((x) => '<div class="item is-click" data-action="openMember" data-id="' + x.id + '">' + avatar(x.id) + '<div class="item-main"><div class="item-title">' + esc(x.name) + '</div><div class="item-sub">' + (x.role === 'creator' ? 'Creator · films, reviews, posts' : 'Editor · edits and delivers') + '</div></div><div class="item-actions"><button type="button" class="btn btn-sm" data-action="copyInvite" data-id="' + x.id + '">' + I.copy + ' Invite</button>' + I.edit + '</div></div>').join('');
    const teamCard = '<section class="card">' + cardHead('Team', '<b>Invite</b> copies a personal link plus a short explanation. Whoever opens that link is signed in as that person, no questions asked. Tap a name to rename or recolour.', '<button type="button" class="btn btn-sm" data-action="openMember">' + I.plus + ' Add person</button>') + teamRows + '</section>';

    const preview = [];
    for (let i = 0; i < 7; i++) { const k = addDays(todayKey(), i); const p = posterFor(k); preview.push('<span class="chip">' + esc(fmtDay(k)) + ' · ' + esc(p ? memberName(p.id) : '—') + '</span>'); }
    const weekdayRows = [1, 2, 3, 4, 5, 6, 7].map((wd) => '<div class="field"><label for="wd' + wd + '">' + esc(weekdayName(wd, 'long')) + '</label>' + selectHtml('wd' + wd, memberOptions(cs), (s.rotaWeekday || {})[wd] || (cs[0] ? cs[0].id : ''), 'id="wd' + wd + '"') + '</div>').join('');
    const rotaCard = '<section class="card"><form data-submit="saveRota">' + cardHead('Posting turns', 'Who is responsible for posting each day. Single days can be swapped in the Calendar.') +
      '<div class="form"><div class="choices">' +
      '<label class="choice"><input type="radio" name="rotaMode" value="days"' + (s.rotaMode === 'days' ? ' checked' : '') + '><div><b>Take turns daily</b><span>One person per day, alternating. Fairest for two people.</span></div></label>' +
      '<label class="choice"><input type="radio" name="rotaMode" value="weeks"' + (s.rotaMode === 'weeks' ? ' checked' : '') + '><div><b>Take turns weekly</b><span>One person owns a whole week.</span></div></label>' +
      '<label class="choice"><input type="radio" name="rotaMode" value="weekday"' + (s.rotaMode === 'weekday' ? ' checked' : '') + '><div><b>Fixed weekdays</b><span>Pick who posts on each weekday.</span></div></label></div>' +
      '<div class="two"><div class="field"><label for="rotaAnchor">Turns start on</label><input type="date" id="rotaAnchor" name="rotaAnchor" value="' + esc(s.rotaAnchor || firstOfMonth(monthOf(todayKey()))) + '"></div><div class="field"><label for="rotaFirst">Who starts</label>' + selectHtml('rotaFirst', memberOptions(cs), cs[0] ? cs[0].id : '', 'id="rotaFirst"') + '</div></div>' +
      '<details' + (s.rotaMode === 'weekday' ? ' open' : '') + '><summary>Weekday picks (for fixed weekdays)</summary><div class="two">' + weekdayRows + '</div></details>' +
      '<div class="field"><label for="weekStart">Week starts on</label>' + selectHtml('weekStart', [{ value: 1, label: 'Monday' }, { value: 7, label: 'Sunday' }], s.weekStart, 'id="weekStart"') + '</div>' +
      '<div><div class="hint">Next 7 days</div><div class="row mt">' + preview.join('') + '</div></div>' +
      '<div class="row"><button class="btn btn-primary" type="submit">Save turns</button></div></div></form></section>';

    const targetsCard = '<section class="card"><form data-submit="saveTargets">' + cardHead('Goals & deadlines', 'The numbers everything is measured against') +
      '<div class="form"><div class="two">' +
      '<div class="field"><label for="monthlyTarget">Posts per month</label><input type="number" id="monthlyTarget" name="monthlyTarget" min="1" max="500" value="' + s.monthlyTarget + '"></div>' +
      '<div class="field"><label for="postsPerDay">Posts per day</label><input type="number" id="postsPerDay" name="postsPerDay" min="1" max="6" value="' + s.postsPerDay + '"></div>' +
      '<div class="field"><label for="editorSlaHours">Editor has (hours)</label><input type="number" id="editorSlaHours" name="editorSlaHours" min="1" max="336" value="' + s.editorSlaHours + '"><span class="hint">From sending a drop to delivery.</span></div>' +
      '<div class="field"><label for="reviewSlaHours">Review within (hours)</label><input type="number" id="reviewSlaHours" name="reviewSlaHours" min="1" max="336" value="' + s.reviewSlaHours + '"><span class="hint">From delivery to approval.</span></div>' +
      '<div class="field"><label for="dropsPerMonth">Drops per month</label><input type="number" id="dropsPerMonth" name="dropsPerMonth" min="1" max="31" value="' + s.dropsPerMonth + '"></div>' +
      '<div class="field"><label for="variationsPerClip">Videos per clip</label><input type="number" id="variationsPerClip" name="variationsPerClip" min="1" max="20" value="' + s.variationsPerClip + '"><span class="hint">How many variations one clip usually becomes.</span></div>' +
      '<div class="field"><label for="bufferDays">Days planned ahead</label><input type="number" id="bufferDays" name="bufferDays" min="0" max="60" value="' + s.bufferDays + '"></div>' +
      '<div class="field"><label for="teamName">Team name</label><input type="text" id="teamName" name="teamName" maxlength="60" value="' + esc(s.teamName) + '"></div>' +
      '</div><div class="row"><button class="btn btn-primary" type="submit">Save goals</button></div></div></form></section>';

    const driveCard = '<section class="card"><form data-submit="saveDrive">' + cardHead('Drive folders', 'The shared folders everyone uses') +
      '<div class="form"><div class="field"><label for="driveRaw">Raw footage</label><input type="url" id="driveRaw" name="driveRaw" placeholder="https://drive.google.com/…" value="' + esc(s.driveRaw) + '"></div>' +
      '<div class="field"><label for="driveEdits">Edited videos</label><input type="url" id="driveEdits" name="driveEdits" placeholder="https://drive.google.com/…" value="' + esc(s.driveEdits) + '"></div>' +
      '<div class="field"><label for="driveAssets">Logos, fonts, music</label><input type="url" id="driveAssets" name="driveAssets" placeholder="https://drive.google.com/…" value="' + esc(s.driveAssets) + '"></div>' +
      '<div class="row"><button class="btn btn-primary" type="submit">Save folders</button>' + linkBtn(s.driveRaw, 'Raw') + linkBtn(s.driveEdits, 'Edits') + linkBtn(s.driveAssets, 'Assets') + '</div></div></form></section>';

    const counts = { drops: byKind('drop').length, videos: byKind('video').length };
    const dataCard = '<section class="card">' + cardHead('Data', (store.mode === 'supabase' ? 'Shared board: everyone sees the same thing.' + (state.sync.lastSyncAt ? ' Last synced ' + esc(fmtTime(new Date(state.sync.lastSyncAt).toISOString())) + '.' : '') : 'Saved in this browser only. To share one board with the team, connect Supabase (docs/SETUP.md).') + ' ' + plural(counts.drops, 'drop') + ', ' + plural(counts.videos, 'video') + '.') +
      '<div class="row"><button type="button" class="btn btn-sm" data-action="exportJson">' + I.download + ' Download backup</button><button type="button" class="btn btn-sm" data-action="copyJson">' + I.copy + ' Copy backup</button><label class="btn btn-sm">' + I.upload + ' Restore backup<input type="file" accept="application/json,.json" data-change="importFile" hidden></label>' + (store.mode === 'supabase' ? '<button type="button" class="btn btn-sm" data-action="reload">' + I.refresh + ' Refresh</button>' : '') + '</div>' +
      '<div class="row mt">' + (s.exampleData ? '<button type="button" class="btn btn-sm btn-ghost" data-action="clearExample" data-confirm="Clear every example drop and video?">Clear example data</button>' : '<button type="button" class="btn btn-sm btn-ghost" data-action="loadExample" data-confirm="Add example drops and videos?">Load example data</button>') + '<button type="button" class="btn btn-sm btn-danger" data-action="clearAll" data-confirm="Delete everything? This cannot be undone">' + I.trash + ' Clear all data</button></div></section>';

    return head('Settings', 'Who does what, how often, and where the files live.') + '<div class="stack">' + youCard + teamCard + rotaCard + targetsCard + driveCard + dataCard + '</div><div class="link-row"><a href="#help">How it works</a></div>';
  }

  /* ---- How it works ---- */
  function pageHelp() {
    const s = S();
    const m = dropMath();
    const cs = creators().map((c) => c.name);
    const who = cs.length ? cs.join(' and ') : 'the creators';
    return head('How it works', 'Three steps. Everything else in the app follows from them.') +
      '<div class="stack">' +
      '<section class="card"><div class="stack">' +
      '<div class="step"><div class="step-num">1</div><div><h3>Film and send a drop</h3><p>' + esc(who) + ' film a batch, upload the raw clips to Drive and tap <b>Send a drop</b> with the link. The editor gets a deadline automatically: <b>' + s.editorSlaHours + ' hours</b>. About ' + m.clips + ' clips make the ' + m.perDrop + ' videos one drop should produce.</p></div></div>' +
      '<div class="step"><div class="step-num">2</div><div><h3>Editor delivers</h3><p>The editor taps <b>Start editing</b>, makes the videos, uploads them to the drop\'s Edits folder and taps <b>Deliver</b>: paste the folder link and write one title per line. That is the whole hand-off.</p></div></div>' +
      '<div class="step"><div class="step-num">3</div><div><h3>Approve and post</h3><p>A creator taps <b>Approve</b> on each video (or sends it back with a note). Approved videos fill the calendar, ' + s.postsPerDay + ' a day. On the day, the poster opens Home, posts on Instagram and TikTok, and ticks both. That counts as one of the ' + s.monthlyTarget + ' posts.</p></div></div>' +
      '</div></section>' +
      '<section class="card">' + cardHead('Words we use') + '<dl class="kv"><dt>Drop</dt><dd>One batch of raw footage sent to the editor.</dd><dt>Ready</dt><dd>An approved video waiting for a day on the calendar.</dd><dt>Slot</dt><dd>One posting moment. Every day has ' + s.postsPerDay + '.</dd><dt>Posted</dt><dd>Both Instagram and TikTok are ticked.</dd><dt>Code</dt><dd><span class="mono">D07-C03-v2</span> = drop 7, clip 3, variation 2. Name the exported file after it so anyone can find the source clip.</dd></dl></section>' +
      '<section class="card">' + cardHead('Drive folders') + '<div class="tree">Knowunity Content/\n  Brand assets/          logos, fonts, music\n  Drops/\n    2026-09/\n      D07/\n        RAW/             files straight from the phone\n        EDITS/           D07-C01-v1_exam-trick.mp4\n                         D07-C01-v2_exam-trick-subtitles.mp4</div><p class="small muted mt">Exports: 9:16, 1080 × 1920, MP4, no platform watermark. Upload the same clean file to both platforms.</p></section>' +
      '<section class="card is-soft"><div class="card-title">If something slips</div><ul class="mt"><li><b>Drop late:</b> it turns red on Home. Ping the editor with the copied message, or reassign the drop.</li><li><b>Poster away:</b> open that day in the Calendar and swap the poster.</li><li><b>Empty days ahead:</b> tap <b>Fill empty days</b>. If nothing is Ready, send the next drop early.</li></ul></section>' +
      '</div>';
  }

  const PAGES = { home: pageHome, calendar: pageCalendar, drops: pageDrops, videos: pageVideos, settings: pageSettings, help: pageHelp };

  /* ------------------------------------------------------------------------
     6. Sheets (every dialog)
     ------------------------------------------------------------------------ */
  const frame = (o) => '<div class="sheet-head"><div class="grow">' + (o.eyebrow ? '<div class="eyebrow">' + o.eyebrow + '</div>' : '') + '<h2 class="sheet-title">' + o.title + '</h2>' + (o.sub ? '<div class="card-sub">' + o.sub + '</div>' : '') + '</div><button type="button" class="btn btn-icon btn-ghost" data-action="closeSheet" aria-label="Close">' + I.x + '</button></div><div class="sheet-body">' + o.body + '</div>' + (o.foot ? '<div class="sheet-foot">' + o.foot + '</div>' : '');

  function sheetWho() {
    const ms = members();
    return frame({ eyebrow: esc(S().teamName), title: 'Who are you?', sub: 'Only changes what your Home shows first. Nothing is locked.',
      body: '<div class="who">' + ms.map((m) => '<button type="button" class="who-btn' + (state.me === m.id ? ' is-on' : '') + '" data-action="setMe" data-id="' + m.id + '">' + avatar(m.id, 'avatar-lg') + '<span><span class="who-name">' + esc(m.name) + '</span><span class="who-role">' + (m.role === 'creator' ? 'Creator · films, reviews, posts' : 'Editor · edits and delivers') + '</span></span></button>').join('') + '</div>',
      foot: '<button type="button" class="btn btn-ghost" data-action="closeSheet">' + (state.me ? 'Cancel' : 'Skip for now') + '</button>' });
  }

  function sheetDrop(ctx) {
    const d = ctx.id ? getItem(ctx.id) : null;
    if (!d) return sheetDropForm(null);
    if (ctx.mode === 'edit') return sheetDropForm(d);
    const vids = dropVideos(d.id);
    const deliveredCount = vids.filter((v) => v.status === 'delivered').length;
    const lateBy = d.deliveredAt ? (new Date(d.deliveredAt) - new Date(d.dueAt)) : 0;
    const stages = [
      { label: 'Sent by ' + memberName(d.sentBy), when: fmtDT(d.sentAt), done: true },
      { label: 'Editing started', when: d.editingStartedAt ? fmtDT(d.editingStartedAt) : 'not yet', done: !!d.editingStartedAt },
      { label: 'Delivered', when: d.deliveredAt ? fmtDT(d.deliveredAt) + (lateBy > 0 ? ' · late by ' + fmtDuration(lateBy) : ' · on time') : 'deadline ' + fmtDT(d.dueAt), done: !!d.deliveredAt, late: d.deliveredAt ? lateBy > 0 : isLate(d.dueAt) },
      { label: 'Done', when: d.closedAt ? fmtDT(d.closedAt) : 'after all videos are approved', done: !!d.closedAt }
    ].map((t) => '<div class="stage' + (t.done ? ' is-done' : '') + (t.late ? ' is-late' : '') + '"><span class="stage-dot"></span><div><div>' + esc(t.label) + '</div><div class="stage-when">' + esc(t.when) + '</div></div></div>').join('');
    let actions = '';
    if (d.status === 'sent') actions = '<button type="button" class="btn btn-primary" data-action="dropStart" data-id="' + d.id + '">' + I.check + ' Start editing</button>';
    else if (d.status === 'editing') actions = '<button type="button" class="btn btn-primary" data-action="openDeliver" data-id="' + d.id + '">' + I.send + ' Deliver</button>';
    else if (d.status === 'delivered') actions = (deliveredCount ? '<button type="button" class="btn btn-primary" data-action="dropApproveAll" data-id="' + d.id + '">' + I.check + ' Approve all ' + deliveredCount + '</button>' : '<button type="button" class="btn btn-primary" data-action="dropClose" data-id="' + d.id + '">' + I.check + ' Mark as done</button>') + '<button type="button" class="btn" data-action="openDeliver" data-id="' + d.id + '" data-mode="add">' + I.plus + ' Add videos</button>';
    else actions = '<button type="button" class="btn" data-action="dropReopen" data-id="' + d.id + '">Reopen</button>';
    const msg = d.status === 'delivered' || d.status === 'approved' ? '<button type="button" class="btn" data-action="copyDelivery" data-id="' + d.id + '">' + I.copy + ' Copy message</button>' : '<button type="button" class="btn" data-action="copyHandoff" data-id="' + d.id + '">' + I.copy + ' Copy message for editor</button>';
    const body = '<div class="row">' + dueChip(d) + dropChip(d) + memberChip(d.editorId) + '</div>' +
      '<div class="row">' + actions + linkBtn(d.driveLink, 'Open footage', '') + linkBtn(d.deliveredLink, 'Edited videos', '') + msg + '</div>' +
      (d.status === 'sent' ? '<div class="hint">Next: copy the message and send it to ' + esc(firstName(memberName(d.editorId))) + ' in your chat. The board shows the drop on their Home, but it does not send notifications by itself.</div>' : '') +
      (d.brief ? '<div class="note wrap"><b>Notes for the editor:</b> ' + esc(d.brief) + '</div>' : '') +
      (d.deliveryNote ? '<div class="note wrap"><b>Editor says:</b> ' + esc(d.deliveryNote) + '</div>' : '') +
      '<div class="sec"><div class="sec-title">Progress</div>' + stages + '</div>' +
      '<div class="sec"><div class="sec-title">Videos · ' + vids.length + ' of ' + d.targetVideos + ' wanted</div>' + (vids.length ? '<div>' + vids.map((v) => videoItem(v, { hideEditor: true })).join('') + '</div>' : '<div class="hint">None logged yet. They appear when the editor delivers.</div>') + '</div>' +
      ((d.clips || []).length ? '<details><summary>Clips in this drop (' + d.clips.length + ')</summary><ol>' + d.clips.map((c, i) => '<li><span class="mono muted">C' + pad2(i + 1) + '</span> ' + esc(c.name) + '</li>').join('') + '</ol></details>' : '');
    const foot = '<button type="button" class="btn btn-danger btn-sm left" data-action="dropDelete" data-id="' + d.id + '" data-confirm="Delete drop and its ' + vids.length + ' videos?">' + I.trash + ' Delete</button><button type="button" class="btn" data-action="editDrop" data-id="' + d.id + '">' + I.edit + ' Edit</button>';
    return frame({ eyebrow: dropCode(d) + ' · sent ' + esc(fmtDT(d.sentAt)), title: esc(d.title), body: body, foot: foot });
  }

  function sheetDropForm(d) {
    const s = S();
    const isNew = !d;
    const m = me();
    const defaultSender = (m && m.role === 'creator') ? m.id : (creators()[0] ? creators()[0].id : '');
    const defaultEditor = editors()[0] ? editors()[0].id : '';
    const sentAt = d ? d.sentAt : nowIso();
    const dueAt = d ? d.dueAt : addHoursIso(sentAt, s.editorSlaHours);
    const body = '<div class="form">' +
      '<div class="field"><label for="dTitle">What is in it?</label><input type="text" id="dTitle" name="title" required maxlength="120" placeholder="e.g. Exam week batch" value="' + esc(d ? d.title : '') + '" autofocus></div>' +
      '<div class="field"><label for="dLink">Drive link to the raw footage</label><input type="url" id="dLink" name="driveLink" placeholder="https://drive.google.com/…" value="' + esc(d ? d.driveLink : '') + '"></div>' +
      '<div class="two"><div class="field"><label for="dEditor">Editor</label>' + selectHtml('editorId', memberOptions(editors(), editors().length ? null : 'No editors yet'), d ? d.editorId : defaultEditor, 'id="dEditor"') + '</div>' +
      '<div class="field"><label for="dTarget">Videos wanted</label><input type="number" id="dTarget" name="targetVideos" min="1" max="200" value="' + (d ? d.targetVideos : dropMath().perDrop) + '"></div></div>' +
      '<div class="field"><label for="dBrief">Notes for the editor</label><textarea id="dBrief" name="brief" rows="3" placeholder="Hooks to try, subtitles yes/no, music, anything special">' + esc(d ? d.brief : '') + '</textarea></div>' +
      '<div class="hint">' + (isNew ? 'Deadline: ' + esc(fmtDT(dueAt)) + ' (' + s.editorSlaHours + 'h from now). ' : '') + 'You can also copy a ready-made message for the editor after sending.</div>' +
      '<details' + (d && (d.clips || []).length ? ' open' : '') + '><summary>More options</summary><div class="form">' +
      '<div class="field"><label for="dClips">Clips, one per line (optional)</label><textarea id="dClips" name="clips" rows="4" placeholder="Desk talking head&#10;Whiteboard explainer&#10;Library b-roll">' + esc(d ? (d.clips || []).map((c) => c.name).join('\n') : '') + '</textarea><span class="hint">Becomes C01, C02… so every video can be traced to its clip.</span></div>' +
      '<div class="two"><div class="field"><label for="dSentBy">Sent by</label>' + selectHtml('sentBy', memberOptions(creators()), d ? d.sentBy : defaultSender, 'id="dSentBy"') + '</div><div class="field"><label for="dSentAt">Sent at</label><input type="datetime-local" id="dSentAt" name="sentAt" value="' + toLocalInput(sentAt) + '" data-input="syncDue" data-sla="' + s.editorSlaHours + '"></div></div>' +
      '<div class="field"><label for="dDueAt">Deadline</label><input type="datetime-local" id="dDueAt" name="dueAt" value="' + toLocalInput(dueAt) + '" data-input="touchDue"></div>' +
      '</div></details></div>';
    const foot = (isNew ? '' : '<button type="button" class="btn btn-ghost left" data-action="openDrop" data-id="' + d.id + '">Cancel</button>') + '<button class="btn btn-primary" type="submit">' + (isNew ? I.send + ' Send to editor' : 'Save') + '</button>';
    return '<form data-submit="saveDrop" data-id="' + (d ? d.id : '') + '">' + frame({ eyebrow: isNew ? 'New drop' : dropCode(d) + ' · edit', title: isNew ? 'Send footage to the editor' : esc(d.title), body: body, foot: foot }) + '</form>';
  }

  function sheetDeliver(ctx) {
    const d = getItem(ctx.dropId);
    if (!d) return frame({ title: 'Drop not found', body: '' });
    const add = ctx.mode === 'add';
    const clipHint = (d.clips || []).length ? ' Start a line with the clip number to link it, like <span class="mono">C2: POV exam tomorrow</span>.' : '';
    const body = '<div class="form"><div class="note">' + (add ? 'Add more videos to this drop. Each line becomes one video for the creators to check.' : 'Paste the folder with your exports and write one line per video. Each line becomes one video for the creators to check.') + '</div>' +
      '<div class="field"><label for="dlLink">Drive link to the edited videos</label><input type="url" id="dlLink" name="deliveredLink" placeholder="https://drive.google.com/…" value="' + esc(d.deliveredLink || '') + '" autofocus></div>' +
      '<div class="field"><label for="dlTitles">Videos, one per line</label><textarea id="dlTitles" name="titles" rows="7" placeholder="I passed my exam with this trick&#10;I passed my exam with this trick (subtitles)&#10;POV: exam tomorrow"></textarea>' + ((d.clips || []).length ? '<span class="hint">' + d.clips.map((c, i) => 'C' + (i + 1) + ' = ' + esc(c.name)).join(' · ') + clipHint + '</span>' : '') + '</div>' +
      '<div class="field"><label for="dlNote">Anything the team should know? (optional)</label><textarea id="dlNote" name="deliveryNote" rows="2">' + esc(d.deliveryNote || '') + '</textarea></div>' +
      (add ? '' : '<label class="check"><input type="checkbox" name="markDelivered" checked> This completes the drop</label>') + '</div>';
    const foot = '<button type="button" class="btn btn-ghost left" data-action="openDrop" data-id="' + d.id + '">Back</button><button class="btn btn-primary btn-lg" type="submit">' + I.send + ' ' + (add ? 'Add videos' : 'Deliver') + '</button>';
    return '<form data-submit="deliverDrop" data-id="' + d.id + '" data-mode="' + (add ? 'add' : 'deliver') + '">' + frame({ eyebrow: dropCode(d) + ' · ' + (add ? 'add videos' : 'deliver'), title: esc(d.title), body: body, foot: foot }) + '</form>';
  }

  function sheetVideo(ctx) {
    const v = getItem(ctx.id);
    if (!v) return frame({ title: 'Video not found', body: '<div class="muted">It may have been deleted.</div>' });
    const d = getItem(v.dropId);
    let actions = '';
    if (v.status === 'editing') actions = '<button type="button" class="btn btn-primary" data-action="videoStatus" data-id="' + v.id + '" data-status="delivered">' + I.send + ' Mark delivered</button>';
    else if (v.status === 'delivered') actions = '<button type="button" class="btn btn-primary" data-action="videoStatus" data-id="' + v.id + '" data-status="approved">' + I.check + ' Approve</button><button type="button" class="btn" data-action="openChanges" data-id="' + v.id + '">Needs changes</button>';
    else if (v.status === 'changes') actions = '<button type="button" class="btn btn-primary" data-action="videoStatus" data-id="' + v.id + '" data-status="delivered">' + I.check + ' Fixed, delivered again</button><button type="button" class="btn" data-action="videoStatus" data-id="' + v.id + '" data-status="approved">Approve anyway</button>';
    else if (v.status === 'approved') actions = '<button type="button" class="btn" data-action="videoStatus" data-id="' + v.id + '" data-status="delivered">Back to review</button>';
    else if (v.status === 'scheduled') actions = '<button type="button" class="btn" data-action="videoStatus" data-id="' + v.id + '" data-status="approved">Take off the calendar</button>';
    else actions = '<button type="button" class="btn" data-action="videoStatus" data-id="' + v.id + '" data-status="scheduled">Undo posted</button>';
    const onCal = v.status === 'scheduled' || v.status === 'posted';
    const dropOpts = drops().map((x) => ({ value: x.id, label: dropCode(x) + ' · ' + x.title }));
    const clipOpts = [{ value: '', label: 'No specific clip' }].concat(((d && d.clips) || []).map((c, i) => ({ value: c.id, label: 'C' + pad2(i + 1) + ' · ' + c.name })));
    const dayPoster = v.scheduledDate ? posterFor(v.scheduledDate) : posterFor(todayKey());
    const posterOpts = [{ value: '', label: 'Whoever has the turn' + (dayPoster ? ' (' + memberName(dayPoster.id) + ')' : '') }].concat(creators().map((m) => ({ value: m.id, label: m.name })));
    const slotOpts = []; for (let i = 1; i <= Math.max(1, S().postsPerDay); i++) slotOpts.push({ value: i, label: 'Slot ' + i });
    const body = '<div class="row">' + statusChip(v) + memberChip(v.editorId) + (v.status === 'posted' && v.postedDate ? '<span class="small muted">posted ' + esc(fmtDay(v.postedDate)) + '</span>' : '') + '</div>' +
      '<div class="row">' + actions + linkBtn(v.fileLink, 'Watch', '') + '</div>' +
      (onCal ? '<div class="sec"><div class="sec-title">Posted on</div><div class="row">' + toggleBtn(v, 'instagram') + toggleBtn(v, 'tiktok') + '</div><div class="hint">Both ticked = posted and counted for the month.</div></div>' : '') +
      (v.status !== 'editing' && v.status !== 'delivered' && v.status !== 'changes' ? '<div class="sec"><div class="sec-title">' + (onCal ? 'Planned for' : 'Plan it') + '</div><div class="two"><div class="field"><label for="vDate">Day</label><input type="date" id="vDate" name="scheduledDate" value="' + esc(v.scheduledDate || '') + '"' + (ctx.focus === 'schedule' ? ' autofocus' : '') + '></div><div class="field"><label for="vSlot">Slot</label>' + selectHtml('slot', slotOpts, v.slot || 1, 'id="vSlot"') + '</div></div><div class="field"><label for="vPoster">Who posts it</label>' + selectHtml('posterId', posterOpts, v.posterId || '', 'id="vPoster"') + '</div><div class="row"><button type="button" class="btn btn-primary btn-sm" data-action="videoSchedule" data-id="' + v.id + '">' + I.calendar + ' ' + (onCal ? 'Move' : 'Put on the calendar') + '</button></div></div>' : '') +
      '<div class="sec"><div class="sec-title">Caption</div><textarea id="vCaption" name="caption" rows="3" placeholder="First line is the hook. Hashtags at the end.">' + esc(v.caption || '') + '</textarea>' + (v.caption ? '<div class="row"><button type="button" class="btn btn-sm" data-action="copyText" data-text="' + esc(v.caption) + '" data-label="Caption copied">' + I.copy + ' Copy caption</button></div>' : '') + '</div>' +
      '<div class="sec"><div class="sec-title">Notes</div><textarea id="vNotes" name="notes" rows="2" placeholder="Feedback, change requests, ideas">' + esc(v.notes || '') + '</textarea></div>' +
      '<details><summary>Details</summary><div class="form"><div class="field"><label for="vTitle">Title</label><input type="text" id="vTitle" name="title" required maxlength="140" value="' + esc(v.title) + '"></div>' +
      '<div class="two"><div class="field"><label for="vDrop">Drop</label>' + selectHtml('dropId', dropOpts, v.dropId, 'id="vDrop"') + '</div><div class="field"><label for="vClip">Clip</label>' + selectHtml('clipId', clipOpts, v.clipId || '', 'id="vClip"') + '</div>' +
      '<div class="field"><label for="vEditor">Editor</label>' + selectHtml('editorId', memberOptions(editors(), 'Unassigned'), v.editorId || '', 'id="vEditor"') + '</div><div class="field"><label for="vCode">Code</label><input type="text" id="vCode" name="code" value="' + esc(v.code) + '" maxlength="24"></div></div>' +
      '<div class="field"><label for="vFile">Video file (Drive link)</label><input type="url" id="vFile" name="fileLink" placeholder="https://drive.google.com/…" value="' + esc(v.fileLink || '') + '"></div></div></details>';
    const foot = '<button type="button" class="btn btn-danger btn-sm left" data-action="videoDelete" data-id="' + v.id + '" data-confirm="Delete this video?">' + I.trash + ' Delete</button><button class="btn btn-primary" type="submit">Save</button>';
    return '<form data-submit="saveVideo" data-id="' + v.id + '">' + frame({ eyebrow: esc(v.code) + (d ? ' · ' + esc(d.title) : ''), title: esc(v.title || 'Untitled'), body: body, foot: foot }) + '</form>';
  }

  function sheetChanges(ctx) {
    const v = getItem(ctx.id);
    if (!v) return frame({ title: 'Video not found', body: '' });
    const body = '<div class="form"><div class="field"><label for="chNote">What should change?</label><textarea id="chNote" name="note" rows="4" placeholder="e.g. Cut the intro, bigger subtitles, end on the app screen" autofocus>' + esc(v.notes || '') + '</textarea><span class="hint">The editor sees this note on their Home.</span></div></div>';
    const foot = '<button type="button" class="btn btn-ghost left" data-action="closeSheet">Cancel</button><button class="btn btn-primary" type="submit">' + I.send + ' Send back to editor</button>';
    return '<form data-submit="saveChanges" data-id="' + v.id + '">' + frame({ eyebrow: esc(v.code), title: esc(v.title), body: body, foot: foot }) + '</form>';
  }

  function sheetDay(ctx) {
    const key = ctx.date;
    const tk = todayKey();
    const p = posterFor(key);
    const ov = getItem('override_' + key);
    const slots = slotsFor(key);
    const ready = videos().filter((v) => v.status === 'approved').length;
    const slotHtml = slots.map((sl) => {
      if (!sl.video) return '<div class="slot"><div class="slot-n">' + sl.slot + '</div><div class="grow"><div class="slot-title muted">Nothing planned</div><div class="slot-row mt">' + (ready ? '<button type="button" class="btn btn-sm" data-action="openPick" data-date="' + key + '" data-slot="' + sl.slot + '" data-back="day">Pick a video</button>' : '<span class="hint">No ready videos yet.</span>') + '</div></div></div>';
      const v = sl.video;
      const d = getItem(v.dropId);
      return '<div class="slot"><div class="slot-n">' + sl.slot + '</div><div class="grow"><div class="slot-title">' + esc(v.title) + '</div><div class="slot-sub"><span class="mono">' + esc(v.code) + '</span>' + (d ? ' · ' + esc(d.title) : '') + '</div><div class="slot-row">' + toggleBtn(v, 'instagram') + toggleBtn(v, 'tiktok') + linkBtn(v.fileLink, 'Watch') + '<button type="button" class="btn btn-sm btn-ghost" data-action="videoStatus" data-id="' + v.id + '" data-status="approved" data-back="day" data-date="' + key + '">Remove</button></div></div></div>';
    }).join('');
    const posterOpts = [{ value: '', label: 'Whoever has the turn' + (p && p.source === 'rota' ? ' (' + memberName(p.id) + ')' : '') }].concat(creators().map((m) => ({ value: m.id, label: m.name })));
    const body = '<div class="row">' + (p ? avatar(p.id, 'avatar-lg', ov ? 'is-swapped' : '') + '<div><div class="item-title">' + esc(memberName(p.id)) + ' posts</div><div class="item-sub">' + (ov ? 'swapped in' + (ov.note ? ' · ' + esc(ov.note) : '') : 'their turn') + '</div></div>' : '<span class="muted">No creators yet.</span>') + '</div>' +
      '<details' + (ov ? ' open' : '') + '><summary>Change who posts this day</summary><div class="form"><div class="two"><div class="field"><label for="ovPoster">Poster</label>' + selectHtml('posterId', posterOpts, ov ? ov.posterId : '', 'id="ovPoster"') + '</div><div class="field"><label for="ovNote">Why (optional)</label><input type="text" id="ovNote" name="note" maxlength="80" placeholder="e.g. Adam travelling" value="' + esc(ov ? ov.note || '' : '') + '"></div></div><div class="row"><button type="button" class="btn btn-sm btn-primary" data-action="saveOverride" data-date="' + key + '">' + I.swap + ' Save</button>' + (ov ? '<button type="button" class="btn btn-sm btn-ghost" data-action="clearOverride" data-date="' + key + '">Back to normal turns</button>' : '') + '</div></div></details>' +
      '<div class="sec"><div class="sec-title">Posts</div><div>' + slotHtml + '</div>' + (slots.some((s) => !s.video) && ready ? '<div class="row"><button type="button" class="btn btn-sm" data-action="autoFill" data-from="' + key + '" data-days="1">' + I.wand + ' Fill this day</button></div>' : '') + '</div>' +
      '<div class="row"><button type="button" class="btn btn-sm" data-action="copyDay" data-date="' + key + '">' + I.copy + ' Copy plan for chat</button></div>';
    return frame({ eyebrow: key === tk ? 'Today' : key < tk ? 'Past day' : 'Upcoming', title: esc(fmtDayLong(key)), body: body });
  }

  function sheetPick(ctx) {
    const ready = sortBy(videos().filter((v) => v.status === 'approved'), (v) => v.approvedAt || '');
    const rows = ready.map((v) => { const d = getItem(v.dropId); return '<div class="item is-click" data-action="pickVideo" data-id="' + v.id + '" data-date="' + ctx.date + '" data-slot="' + ctx.slot + '" data-back="' + esc(ctx.back || 'close') + '"><div class="item-main"><div class="item-title">' + esc(v.title) + '</div><div class="item-sub"><span class="mono">' + esc(v.code) + '</span>' + (d ? ' · ' + esc(d.title) : '') + '</div></div><span class="btn btn-sm">Choose</span></div>'; }).join('');
    return frame({ eyebrow: 'Slot ' + ctx.slot + ' · ' + esc(fmtDay(ctx.date)), title: 'Pick a video', body: rows || empty('✨', 'No ready videos. Approve some first.'), foot: '<button type="button" class="btn btn-ghost" data-action="' + (ctx.back === 'day' ? 'openDay' : 'closeSheet') + '" data-date="' + ctx.date + '">Back</button>' });
  }

  function sheetMember(ctx) {
    const m = ctx.id ? getItem(ctx.id) : null;
    const color = m ? colorOf(m) : COLORS[members().length % COLORS.length];
    const body = '<div class="form">' +
      '<div class="field"><label for="mName">Name</label><input type="text" id="mName" name="name" required maxlength="40" value="' + esc(m ? m.name : '') + '" autofocus></div>' +
      '<div class="choices"><label class="choice"><input type="radio" name="role" value="creator"' + (!m || m.role === 'creator' ? ' checked' : '') + '><div><b>Creator</b><span>Films, reviews and posts. Takes turns posting.</span></div></label><label class="choice"><input type="radio" name="role" value="editor"' + (m && m.role === 'editor' ? ' checked' : '') + '><div><b>Editor</b><span>Gets drops and delivers videos.</span></div></label></div>' +
      '<div class="field"><label>Colour</label><input type="hidden" name="color" value="' + esc(color) + '"><div class="swatches">' + COLORS.map((c) => '<button type="button" class="swatch' + (c === color ? ' is-on' : '') + '" style="--mc: var(--m-' + c + ')" data-action="pickColor" data-color="' + c + '" aria-label="' + c + '"></button>').join('') + '</div></div></div>';
    const foot = (m ? '<button type="button" class="btn btn-danger btn-sm left" data-action="memberRemove" data-id="' + m.id + '" data-confirm="Remove ' + esc(m.name) + '?">' + I.trash + ' Remove</button>' : '') + '<button class="btn btn-primary" type="submit">' + (m ? 'Save' : 'Add') + '</button>';
    return '<form data-submit="saveMember" data-id="' + (m ? m.id : '') + '">' + frame({ eyebrow: m ? 'Team member' : 'New team member', title: m ? esc(m.name) : 'Add a person', body: body, foot: foot }) + '</form>';
  }

  const SHEETS = { who: sheetWho, drop: sheetDrop, deliver: sheetDeliver, video: sheetVideo, changes: sheetChanges, day: sheetDay, pick: sheetPick, member: sheetMember };

  /* ------------------------------------------------------------------------
     7. Rendering shell, actions, events
     ------------------------------------------------------------------------ */
  function mountShell() {
    $('#app').innerHTML = '<header class="topbar"><div class="topbar-inner"><a class="brand" href="#home"><span class="brand-mark">K</span><span class="brand-name" id="brandName"></span></a><nav class="tabs" id="tabs" aria-label="Main"></nav><button type="button" class="avatar-btn" id="meBtn" data-action="who" aria-label="Switch person"></button></div></header><main class="page" id="main"></main><nav class="tabbar" id="tabbar" aria-label="Main"></nav><div id="sheetRoot"></div><div class="toasts" id="toasts" aria-live="polite"></div>';
  }
  function navRoutes() { return isEditor() ? ['home', 'videos', 'help'] : ['home', 'calendar', 'drops', 'videos', 'settings']; }
  function badges() {
    const b = {};
    if (isEditor()) b.home = openDrops().length + videos().filter((v) => v.status === 'changes').length;
    else b.videos = videos().filter((v) => v.status === 'delivered').length;
    return b;
  }
  function renderNav() {
    const b = badges();
    const item = (r, cls) => '<a class="' + cls + '" href="#' + r + '"' + (state.route === r ? ' aria-current="page"' : '') + '>' + I[ROUTES[r].icon] + '<span>' + esc(ROUTES[r].label) + '</span>' + (b[r] ? '<span class="tab-badge">' + b[r] + '</span>' : '') + '</a>';
    const routes = navRoutes();
    $('#tabs').innerHTML = routes.map((r) => item(r, 'tab')).join('');
    $('#tabbar').innerHTML = routes.map((r) => item(r, 'tab-m')).join('');
    $('#brandName').textContent = S().teamName;
    const m = me();
    $('#meBtn').innerHTML = m ? avatar(m.id) : '<span class="avatar">?</span>';
    $('#meBtn').title = m ? m.name + ' · switch person' : 'Choose who you are';
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
    const page = PAGES[state.route] || PAGES.home;
    $('#main').innerHTML = exampleBanner() + page();
    restoreFocus(focus);
    document.title = (ROUTES[state.route] ? ROUTES[state.route].label : 'Home') + ' · ' + S().teamName;
  }
  function render() {
    if (!state.ready) return;
    renderNav(); renderMain();
  }
  function renderSheet() {
    const root = $('#sheetRoot');
    if (!state.sheet) { root.innerHTML = ''; document.body.classList.remove('no-scroll'); return; }
    const fn = SHEETS[state.sheet.type];
    root.innerHTML = '<div class="overlay" id="overlay"><div class="sheet' + (state.sheetEnter ? ' is-enter' : '') + '" role="dialog" aria-modal="true">' + (fn ? fn(state.sheet) : '') + '</div></div>';
    state.sheetEnter = false;
    document.body.classList.add('no-scroll');
    const first = root.querySelector('[autofocus]');
    if (first) { try { first.focus(); } catch (e) { /* ignore */ } }
  }
  function openSheet(d) { state.sheetEnter = !state.sheet; state.sheet = d; renderSheet(); }
  function closeSheet() { state.sheet = null; renderSheet(); }
  function refreshSheet() { if (state.sheet) renderSheet(); }

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
    const done = label || 'Copied';
    try { await navigator.clipboard.writeText(text); toast(done); return; } catch (e) { /* fall through */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    toast(ok ? done : 'Copy did not work here. Select the text and copy it by hand.', ok ? '' : 'crit');
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
    el.innerHTML = esc(el.dataset.confirm || 'Tap again to confirm');
    clearTimeout(el._armTimer);
    el._armTimer = setTimeout(() => { if (el.isConnected) { el.classList.remove('is-armed'); el.innerHTML = el.dataset.label; } }, 4000);
  }
  function route() {
    const raw = (location.hash || '#home').slice(1);
    if (raw.indexOf('as-') === 0) {
      // Personal invite link (#as-<memberId>): signs this device in as that person, then opens Home.
      const id = raw.slice(3).replace(/[^A-Za-z0-9_]/g, '');
      const m = getItem(id);
      if (m && !m.archived) { state.me = id; try { localStorage.setItem('ku:me', id); } catch (e) { /* ignore */ } closeSheet(); }
      location.replace('#home');
      return;
    }
    const hash = raw.replace(/[^a-z]/g, '');
    state.route = ROUTES[hash] ? hash : 'home';
    render();
    window.scrollTo(0, 0);
  }
  const inviteLink = (id) => location.href.split('#')[0] + '#as-' + id;
  function inviteMessage(m) {
    const s = S();
    const link = inviteLink(m.id);
    const who = creators().map((c) => firstName(c.name)).join(' or ') || 'the creators';
    if (m.role === 'editor') {
      return [
        'Hi ' + firstName(m.name) + '! 👋 This is our content board: ' + link,
        'It already knows you are ' + m.name + '. Open it on your phone and add it to your home screen.',
        'When ' + who + ' send footage, one card appears on your Home:',
        '1. Open footage → edit',
        '2. Tap Deliver → paste the Drive folder with your exports, one title per line',
        'You have ' + s.editorSlaHours + ' hours per drop. If a video comes back with a note, fix it and tap "Fixed, delivered again". That is all.'
      ].join('\n');
    }
    return [
      'Hi ' + firstName(m.name) + '! 👋 This is our content board: ' + link,
      'It already knows you are ' + m.name + '. Home shows what to post today, what to approve and what is with the editor.',
      'Send footage with "Send a drop", approve with one tap, and tick Instagram + TikTok after posting.'
    ].join('\n');
  }
  function welcomeCard(role, m) {
    if (!m) return '';
    let seen = false;
    try { seen = localStorage.getItem('ku:welcomed:' + m.id) === '1'; } catch (e) { seen = false; }
    if (seen) return '';
    const s = S();
    const body = role === 'editor'
      ? '<p>This is your inbox for footage. Every drop is one card with the deadline and the notes.</p><ol class="mt"><li><b>Open footage</b> and edit.</li><li>Tap <b>Deliver</b>, paste the Drive folder with your exports, one title per line.</li></ol><p class="mt">You have <b>' + s.editorSlaHours + ' hours</b> per drop. If a video comes back with a note, fix it and tap <b>Fixed, delivered again</b>.</p>'
      : '<p>Home shows what to post today, what to approve and what is with the editor. Everything else lives in the tabs.</p><p class="mt">Send footage with <b>Send a drop</b>, approve with one tap, fill the calendar with <b>Fill empty days</b>.</p>';
    return '<section class="card is-soft welcome">' + cardHead('Welcome, ' + esc(firstName(m.name)) + ' 👋', role === 'editor' ? 'How this works for you, in three lines' : 'Your board, in two lines', '<button type="button" class="btn btn-sm btn-primary" data-action="dismissWelcome" data-id="' + m.id + '">Got it</button>') + body + '</section>';
  }
  function parseClips(text, existing) {
    const names = String(text || '').split('\n').map((x) => x.trim()).filter(Boolean);
    return names.map((name, i) => ({ id: (existing && existing[i] && existing[i].id) || uid('clip'), name: name }));
  }
  function readVideoForm(form, v) {
    const f = formData(form);
    if (f.title) v.title = f.title;
    if (f.code) v.code = f.code;
    if (f.dropId) v.dropId = f.dropId;
    if ('clipId' in f) v.clipId = f.clipId || null;
    if ('editorId' in f) v.editorId = f.editorId || null;
    if ('fileLink' in f) v.fileLink = f.fileLink || '';
    if ('caption' in f) v.caption = f.caption || '';
    if ('notes' in f) v.notes = f.notes || '';
    return f;
  }
  function afterAction(ds) {
    if (ds && ds.back === 'day' && ds.date) { openSheet({ type: 'day', date: ds.date }); return; }
    refreshSheet();
  }

  const ACTIONS = {
    closeSheet: () => closeSheet(),
    who: () => openSheet({ type: 'who' }),
    setMe: (ds) => { state.me = ds.id; try { localStorage.setItem('ku:me', ds.id); } catch (e) { /* ignore */ } closeSheet(); if (!navRoutes().includes(state.route)) location.hash = '#home'; render(); toast('Hi ' + firstName(memberName(ds.id)) + ' 👋'); },
    dismissWelcome: (ds) => { try { localStorage.setItem('ku:welcomed:' + ds.id, '1'); } catch (e) { /* ignore */ } renderMain(); },
    copyInvite: (ds) => { const m = getItem(ds.id); if (!m) return; copyText(inviteMessage(m), 'Invite copied. Send it to ' + firstName(m.name) + ' in your chat.'); },
    reload: () => reloadFromStore(true),
    gotoVideos: (ds) => { state.filters = { status: ds.status || '', drop: '', q: '' }; location.hash = '#videos'; },
    vfilter: (ds) => { state.filters.status = ds.status || ''; renderMain(); },
    calMonth: (ds) => { const dir = Number(ds.dir); state.month = dir === 0 ? monthOf(todayKey()) : addMonths(state.month, dir); renderMain(); },
    filter: (ds, el) => { state.filters[ds.key] = el.value; renderMain(); },
    copyText: (ds) => copyText(ds.text || '', ds.label || 'Copied'),
    copyDay: (ds) => copyText(dayMessage(ds.date), 'Plan copied. Paste it in the chat.'),
    copyHandoff: (ds) => { const d = getItem(ds.id); if (d) copyText(handoffMessage(d), 'Message copied. Paste it to the editor.'); },
    copyDelivery: (ds) => { const d = getItem(ds.id); if (d) copyText(deliveryMessage(d), 'Message copied. Paste it in the chat.'); },

    /* drops */
    newDrop: () => openSheet({ type: 'drop', id: null, mode: 'edit' }),
    openDrop: (ds) => openSheet({ type: 'drop', id: ds.id }),
    editDrop: (ds) => openSheet({ type: 'drop', id: ds.id, mode: 'edit' }),
    openDeliver: (ds) => openSheet({ type: 'deliver', dropId: ds.id, mode: ds.mode || 'deliver' }),
    syncDue: (ds, el) => { const due = $('#dDueAt'); if (!due || due.dataset.touched === '1' || !el.value) return; due.value = toLocalInput(addHoursIso(fromLocalInput(el.value), Number(ds.sla) || S().editorSlaHours)); },
    touchDue: (ds, el) => { el.dataset.touched = '1'; },
    saveDrop: async (ds, form) => {
      const f = formData(form);
      if (!f.title) { toast('Give the drop a name first', 'crit'); return; }
      const existing = ds.id ? getItem(ds.id) : null;
      const sentAt = fromLocalInput(f.sentAt);
      let dueAt = fromLocalInput(f.dueAt);
      if (new Date(dueAt) <= new Date(sentAt)) dueAt = addHoursIso(sentAt, S().editorSlaHours);
      const d = existing || { id: uid('drop'), number: Math.max(0, ...drops().map((x) => x.number || 0)) + 1, status: 'sent', createdAt: nowIso(), clips: [] };
      d.title = f.title; d.sentBy = f.sentBy || null; d.editorId = f.editorId || null; d.sentAt = sentAt; d.dueAt = dueAt;
      d.driveLink = f.driveLink || ''; d.brief = f.brief || ''; d.targetVideos = clampNum(f.targetVideos, 1, 200, dropMath().perDrop);
      d.clips = parseClips(f.clips, existing ? existing.clips : null);
      await save('drop', d);
      openSheet({ type: 'drop', id: d.id });
      toast(existing ? 'Saved' : 'Sent. Deadline ' + fmtDT(d.dueAt));
    },
    dropStart: async (ds) => { const d = getItem(ds.id); if (!d) return; d.status = 'editing'; d.editingStartedAt = d.editingStartedAt || nowIso(); await save('drop', d); refreshSheet(); toast('Started. Deadline ' + fmtDT(d.dueAt)); },
    deliverDrop: async (ds, form) => {
      const d = getItem(ds.id); if (!d) return;
      const f = formData(form);
      const lines = String(f.titles || '').split('\n').map((x) => x.trim()).filter(Boolean);
      if (!lines.length && ds.mode === 'add') { toast('Write at least one video title', 'crit'); return; }
      const items = [];
      lines.forEach((line) => {
        const parsed = parseTitleLine(line, d);
        const v = newVideo(d, { title: parsed.title, clipId: parsed.clipId, status: 'delivered', deliveredAt: nowIso(), fileLink: '' });
        items.push({ kind: 'video', data: v });
        commit('video', v); // so the next code number sees this one
      });
      if (f.deliveredLink) d.deliveredLink = f.deliveredLink;
      if (f.deliveryNote != null) d.deliveryNote = f.deliveryNote;
      if (ds.mode !== 'add' && f.markDelivered !== false) { d.status = 'delivered'; d.deliveredAt = d.deliveredAt || nowIso(); if (!d.editingStartedAt) d.editingStartedAt = d.deliveredAt; }
      items.push({ kind: 'drop', data: d });
      await saveItems(items);
      openSheet({ type: 'drop', id: d.id });
      toast(lines.length ? plural(lines.length, 'video') + ' delivered. Nice work.' : 'Drop marked as delivered');
    },
    dropApproveAll: async (ds) => {
      const d = getItem(ds.id); if (!d) return;
      const vids = dropVideos(d.id).filter((v) => v.status === 'delivered');
      vids.forEach((v) => setStatus(v, 'approved'));
      await saveItems(vids.map((v) => ({ kind: 'video', data: v })));
      refreshSheet(); toast(plural(vids.length, 'video') + ' approved and ready');
    },
    dropClose: async (ds) => { const d = getItem(ds.id); if (!d) return; d.status = 'approved'; d.closedAt = nowIso(); await save('drop', d); refreshSheet(); toast('Drop done'); },
    dropReopen: async (ds) => { const d = getItem(ds.id); if (!d) return; d.status = 'delivered'; d.closedAt = null; await save('drop', d); refreshSheet(); toast('Drop reopened'); },
    dropDelete: async (ds) => { const d = getItem(ds.id); if (!d) return; const ids = dropVideos(d.id).map((v) => v.id).concat([d.id]); closeSheet(); await delMany(ids); toast('Drop deleted'); },

    /* videos */
    addVideos: () => {
      const open = drops().filter((d) => d.status !== 'approved');
      const target = open[0] || drops()[0];
      if (!target) { toast('Send a drop first', 'crit'); openSheet({ type: 'drop', id: null, mode: 'edit' }); return; }
      openSheet({ type: 'deliver', dropId: target.id, mode: target.status === 'sent' || target.status === 'editing' ? 'deliver' : 'add' });
    },
    openVideo: (ds) => openSheet({ type: 'video', id: ds.id }),
    saveVideo: async (ds, form) => {
      const v = getItem(ds.id); if (!v) return;
      readVideoForm(form, v);
      await save('video', v);
      closeSheet(); toast('Saved');
    },
    videoStatus: async (ds, el) => {
      const v = getItem(ds.id); if (!v) return;
      const form = el.closest('form[data-submit="saveVideo"]');
      if (form) readVideoForm(form, v);
      setStatus(v, ds.status);
      await save('video', v);
      afterAction(ds);
      toast(ds.status === 'approved' && !ds.back ? 'Approved and ready to plan' : VS[ds.status] ? VS[ds.status].label : 'Updated');
    },
    videoSchedule: async (ds, el) => {
      const v = getItem(ds.id); if (!v) return;
      const form = el.closest('form');
      const f = readVideoForm(form, v);
      if (!f.scheduledDate) { toast('Pick a day first', 'crit'); return; }
      scheduleVideo(v, f.scheduledDate, clampNum(f.slot, 1, 20, 1), f.posterId || null);
      await save('video', v);
      refreshSheet();
      toast('Planned for ' + fmtDay(v.scheduledDate) + ', slot ' + v.slot);
    },
    videoDelete: async (ds) => { closeSheet(); await del(ds.id); toast('Video deleted'); },
    platform: async (ds) => {
      const v = getItem(ds.id); if (!v) return;
      const on = !platforms(v)[ds.platform].posted;
      setPlatform(v, ds.platform, on);
      await save('video', v);
      refreshSheet();
      if (v.status === 'posted') toast('Posted on both. ' + monthStats(monthOf(v.postedDate)).posted + ' this month 🎉');
    },
    openChanges: (ds) => openSheet({ type: 'changes', id: ds.id }),
    saveChanges: async (ds, form) => {
      const v = getItem(ds.id); if (!v) return;
      const f = formData(form);
      v.notes = f.note || '';
      setStatus(v, 'changes');
      await save('video', v);
      closeSheet(); toast('Sent back to ' + firstName(memberName(v.editorId)) + ' with your note');
    },
    autoFill: async (ds) => {
      const plan = autoFillPlan(ds.from, clampNum(ds.days, 1, 62, 14));
      if (!plan.readyCount) { toast('No ready videos to plan yet', 'crit'); return; }
      if (!plan.touched.length) { toast('No empty slots there'); return; }
      await saveItems(plan.touched.map((v) => ({ kind: 'video', data: v })));
      refreshSheet();
      toast(plural(plan.touched.length, 'video') + ' planned');
    },

    /* days */
    openDay: (ds) => openSheet({ type: 'day', date: ds.date }),
    openPick: (ds) => openSheet({ type: 'pick', date: ds.date, slot: Number(ds.slot), back: ds.back || 'close' }),
    pickVideo: async (ds) => {
      const v = getItem(ds.id); if (!v) return;
      scheduleVideo(v, ds.date, Number(ds.slot), null);
      await save('video', v);
      if (ds.back === 'day') openSheet({ type: 'day', date: ds.date }); else closeSheet();
      toast('Planned for ' + fmtDay(ds.date) + ', slot ' + ds.slot);
    },
    saveOverride: async (ds) => {
      const posterId = ($('#ovPoster') || {}).value || '';
      const note = (($('#ovNote') || {}).value || '').trim();
      const id = 'override_' + ds.date;
      if (!posterId) { if (getItem(id)) await del(id); refreshSheet(); toast('Back to normal turns'); return; }
      await save('override', { id: id, date: ds.date, posterId: posterId, note: note });
      refreshSheet(); toast(memberName(posterId) + ' posts on ' + fmtDay(ds.date));
    },
    clearOverride: async (ds) => { const id = 'override_' + ds.date; if (getItem(id)) await del(id); refreshSheet(); toast('Back to normal turns'); },

    /* team + settings */
    openMember: (ds) => openSheet({ type: 'member', id: ds.id || null }),
    pickColor: (ds, el) => { const form = el.closest('form'); form.elements.color.value = ds.color; $$('.swatch', form).forEach((s) => s.classList.toggle('is-on', s.dataset.color === ds.color)); },
    saveMember: async (ds, form) => {
      const f = formData(form);
      if (!f.name) { toast('Give them a name', 'crit'); return; }
      const m = ds.id ? getItem(ds.id) : { id: uid('member'), order: members().length, archived: false };
      m.name = f.name; m.role = f.role === 'editor' ? 'editor' : 'creator'; m.color = COLORS.includes(f.color) ? f.color : 'blue';
      await save('member', m);
      closeSheet(); toast(ds.id ? 'Saved' : m.name + ' added');
    },
    memberRemove: async (ds) => {
      const m = getItem(ds.id); if (!m) return;
      m.archived = true;
      if (state.me === m.id) { state.me = null; try { localStorage.removeItem('ku:me'); } catch (e) { /* ignore */ } }
      await save('member', m); closeSheet(); toast(m.name + ' removed');
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
      await save('settings', s); toast('Turns saved');
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
      await save('settings', s); toast('Goals saved');
    },
    saveDrive: async (ds, form) => { const f = formData(form); const s = S(); s.driveRaw = f.driveRaw || ''; s.driveEdits = f.driveEdits || ''; s.driveAssets = f.driveAssets || ''; await save('settings', s); toast('Folders saved'); },
    exportJson: () => {
      const blob = new Blob([exportJson()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'knowunity-content-backup-' + todayKey() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('Backup downloaded (if downloads work here). Otherwise use Copy backup.');
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
      closeSheet(); toast('Cleared. Send your first real drop when ready.');
    },
    clearAll: async () => {
      const ids = Array.from(state.items.keys());
      state.items.clear(); state.me = null; closeSheet();
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
      if (!el) { if (e.target.id === 'overlay') closeSheet(); return; }
      if (el.dataset.confirm !== undefined && !el.classList.contains('is-armed')) { e.preventDefault(); arm(el); return; }
      e.preventDefault();
      const fn = ACTIONS[el.dataset.action];
      if (fn) fn(el.dataset, el, e);
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
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.sheet) closeSheet(); });
    window.addEventListener('hashchange', route);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { state.now = Date.now(); if (store && store.mode === 'supabase') reloadFromStore(false); else if (!state.sheet) renderMain(); } });
    window.addEventListener('focus', () => { if (store && store.mode === 'supabase') checkForChanges(); });
  }

  /* Shared-board sync (Supabase mode): a cheap id+timestamp check every few
     seconds, a full reload only when something actually changed, an extra
     check shortly after our own writes, and a reload whenever the tab comes back. */
  let pollTimer = null;
  let checkTimer = null;
  let checking = false;
  const inFlight = (id, now) => { const t = recentWrites.get(id); return !!t && now - t < 10000; };
  function scheduleCheck(ms) { clearTimeout(checkTimer); checkTimer = setTimeout(() => checkForChanges(), ms); }
  async function checkForChanges() {
    if (!store || store.mode !== 'supabase' || checking || state.sync.status === 'busy' || document.hidden) return;
    checking = true;
    try {
      const fp = await store.fingerprint();
      const now = Date.now();
      const seen = {};
      let changed = false;
      fp.forEach((r) => {
        if (!r || !r.id) return;
        seen[r.id] = true;
        if (changed || inFlight(r.id, now)) return;
        const local = state.items.get(r.id);
        if (!local || (local.updated_at || '') < (r.updated_at || '')) changed = true;
      });
      if (!changed) state.items.forEach((it, id) => { if (!seen[id] && !inFlight(id, now)) changed = true; });
      if (changed) await reloadFromStore(false);
      if (state.sync.status === 'error') setSync('ok');
    } catch (e) { /* transient network error: the next check will try again */ }
    finally { checking = false; }
  }
  async function reloadFromStore(manual) {
    if (!store || state.sync.status === 'busy') return;
    try {
      const items = await store.load();
      state.sync.lastSyncAt = Date.now();
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
      if (changed || manual) { await ensureDefaults(false); render(); if (state.sheet && changed) refreshSheet(); }
      if (manual) toast(changed ? 'Refreshed' : 'Already up to date');
      if (state.sync.status === 'error') setSync('ok');
    } catch (e) { if (manual) toast('Refresh failed: ' + e.message, 'crit'); }
  }
  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => { if (!document.hidden) checkForChanges(); }, 8000);
  }

  /* ------------------------------------------------------------------------
     8. Defaults, example data, boot
     ------------------------------------------------------------------------ */
  function defaultMembers() {
    return [
      { id: 'member_immanuel', name: 'Immanuel', role: 'creator', color: 'teal', order: 0, archived: false },
      { id: 'member_adam', name: 'Adam', role: 'creator', color: 'orange', order: 1, archived: false },
      { id: 'member_editor1', name: 'Editor 1', role: 'editor', color: 'pink', order: 2, archived: false }
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
    byKind('member').forEach((m) => { if (COLOR_MIGRATION[m.color]) { m.color = COLOR_MIGRATION[m.color]; toSave.push({ kind: 'member', data: m }); } });
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
    try { items = await store.load(); state.sync.lastSyncAt = Date.now(); }
    catch (e) { console.error(e); setSync('error', e.message); }
    items.forEach((it) => { if (it && it.id && it.kind && it.data) state.items.set(it.id, it); });
    await ensureDefaults(true);
    if (state.me && !getItem(state.me)) state.me = null;
    state.ready = true;
    route();
    if (state.sync.status === 'error') toast('Could not load the shared board: ' + state.sync.error, 'crit');
    if (!state.me && members().length) openSheet({ type: 'who' });
    if (store.mode === 'supabase') startPolling();
    setInterval(() => { state.now = Date.now(); if (!state.sheet && (state.route === 'home' || state.route === 'drops')) renderMain(); }, 60000);
  }

  window.KU = { state: state, boot: boot, posterFor: posterFor, slotsFor: slotsFor, monthStats: monthStats };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
