/* ==========================================================================
   Knowunity Content OS — storage adapters
   Every record is an "item": { id, kind, data, updated_at }.
   - apiStore:      the team server (server/server.js on your own VM); live
                    updates through Server-Sent Events
   - supabaseStore: alternative shared backend through Supabase's REST API
   - localStore:    this browser only (zero setup, used for previews/demos)
   The app never talks to storage directly; it only uses the interface below:
     load() -> items[]   fingerprint() -> [{id, updated_at}]   put(item)
     putMany(items)      remove(id)   removeMany(ids)   replaceAll(items)
     subscribe(onChange, onState) -> unsubscribe   (optional, api only)
   ========================================================================== */
window.KUStore = (function () {
  'use strict';

  var LOCAL_KEY = 'knowunity-content-os:v1';
  var SERVER_KEY = 'ku:server';

  function localStore() {
    var cache = null;
    function read() {
      if (cache) return cache;
      try { cache = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); }
      catch (e) { cache = []; }
      if (!Array.isArray(cache)) cache = [];
      return cache;
    }
    function write() {
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(cache)); }
      catch (e) { throw new Error('This browser refused to save (private window or storage full): ' + e.message); }
    }
    function upsert(item) {
      var list = read();
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === item.id) { list[i] = item; return; }
      }
      list.push(item);
    }
    return {
      mode: 'local',
      label: 'Saved on this device only',
      load: function () { return Promise.resolve(read().map(function (x) { return JSON.parse(JSON.stringify(x)); })); },
      fingerprint: function () { return Promise.resolve(read().map(function (x) { return { id: x.id, updated_at: x.updated_at }; })); },
      put: function (item) { upsert(item); write(); return Promise.resolve(); },
      putMany: function (items) { items.forEach(upsert); write(); return Promise.resolve(); },
      remove: function (id) { cache = read().filter(function (x) { return x.id !== id; }); write(); return Promise.resolve(); },
      removeMany: function (ids) {
        var set = {}; ids.forEach(function (id) { set[id] = true; });
        cache = read().filter(function (x) { return !set[x.id]; }); write(); return Promise.resolve();
      },
      replaceAll: function (items) { cache = items.slice(); write(); return Promise.resolve(); }
    };
  }

  function failure(prefix, method, res) {
    return res.text().then(function (txt) {
      var msg = '';
      try { msg = JSON.parse(txt).message || ''; } catch (e) { msg = txt.slice(0, 120); }
      var err = new Error(prefix + ' ' + method + ' failed (' + res.status + ')' + (msg ? ': ' + msg : ''));
      err.status = res.status;
      throw err;
    });
  }

  /* ---- the team server (server/server.js) ---- */
  function apiStore(cfg) {
    var base = String(cfg.url || '').replace(/\/+$/, '');
    var key = String(cfg.key || '');
    function req(method, pathname, body) {
      return fetch(base + pathname, {
        method: method,
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
      }).then(function (res) { return res.ok ? res : failure('Team server', method, res); });
    }
    return {
      mode: 'api',
      label: 'Shared with the team on your server',
      url: base,
      key: key,
      load: function () { return req('GET', '/api/items').then(function (r) { return r.json(); }).then(function (j) { return j.items || []; }); },
      fingerprint: function () { return req('GET', '/api/items?fields=meta').then(function (r) { return r.json(); }).then(function (j) { return j.items || []; }); },
      health: function () { return req('GET', '/api/health').then(function (r) { return r.json(); }); },
      put: function (item) { return req('PUT', '/api/items', [item]).then(function () {}); },
      putMany: function (items) { return items.length ? req('PUT', '/api/items', items).then(function () {}) : Promise.resolve(); },
      remove: function (id) { return req('DELETE', '/api/items', { ids: [id] }).then(function () {}); },
      removeMany: function (ids) { return ids.length ? req('DELETE', '/api/items', { ids: ids }).then(function () {}) : Promise.resolve(); },
      replaceAll: function (items) { return req('POST', '/api/items/replace', items).then(function () {}); },
      /* live updates: the server sends one message per change */
      subscribe: function (onChange, onState) {
        if (typeof EventSource === 'undefined') return null;
        var es = new EventSource(base + '/api/events?key=' + encodeURIComponent(key));
        es.onopen = function () { if (onState) onState('live'); onChange({ reconnected: true }); };
        es.onmessage = function (ev) {
          var msg = null;
          try { msg = JSON.parse(ev.data); } catch (e) { msg = null; }
          if (msg && !msg.hello) onChange(msg);
        };
        es.onerror = function () { if (onState) onState('reconnecting'); };
        return function () { es.close(); };
      }
    };
  }

  /* ---- Supabase (alternative) ---- */
  function supabaseStore(cfg) {
    var base = cfg.url.replace(/\/+$/, '') + '/rest/v1/' + (cfg.table || 'items');
    var baseHeaders = { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey, 'Content-Type': 'application/json' };
    function req(method, qs, body, extra) {
      var headers = {};
      Object.keys(baseHeaders).forEach(function (k) { headers[k] = baseHeaders[k]; });
      if (extra) Object.keys(extra).forEach(function (k) { headers[k] = extra[k]; });
      return fetch(base + (qs || ''), { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined })
        .then(function (res) { return res.ok ? res : failure('Supabase', method, res); });
    }
    function chunk(list, n) { var out = []; for (var i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out; }
    var upsertHeaders = { Prefer: 'resolution=merge-duplicates,return=minimal' };
    var api = {
      mode: 'supabase',
      label: 'Shared with the team (Supabase)',
      load: function () { return req('GET', '?select=id,kind,data,updated_at&order=updated_at.asc&limit=10000').then(function (res) { return res.json(); }); },
      fingerprint: function () { return req('GET', '?select=id,updated_at&limit=10000').then(function (res) { return res.json(); }); },
      put: function (item) { return req('POST', '', [item], upsertHeaders).then(function () {}); },
      putMany: function (items) {
        if (!items.length) return Promise.resolve();
        return chunk(items, 200).reduce(function (p, part) { return p.then(function () { return req('POST', '', part, upsertHeaders); }); }, Promise.resolve()).then(function () {});
      },
      remove: function (id) { return req('DELETE', '?id=eq.' + encodeURIComponent(id)).then(function () {}); },
      removeMany: function (ids) {
        if (!ids.length) return Promise.resolve();
        return chunk(ids, 100).reduce(function (p, part) { return p.then(function () { return req('DELETE', '?id=in.(' + part.map(encodeURIComponent).join(',') + ')'); }); }, Promise.resolve()).then(function () {});
      },
      replaceAll: function (items) { return req('DELETE', '?id=neq.__never__').then(function () { return api.putMany(items); }); }
    };
    return api;
  }

  /* ---- which adapter to use ---- */
  function savedServer() {
    try { var s = JSON.parse(localStorage.getItem(SERVER_KEY) || 'null'); return s && s.url && s.key ? { url: s.url, key: s.key } : null; }
    catch (e) { return null; }
  }
  function saveServer(cfg) { try { localStorage.setItem(SERVER_KEY, JSON.stringify({ url: cfg.url, key: cfg.key })); return true; } catch (e) { return false; } }
  function clearServer() { try { localStorage.removeItem(SERVER_KEY); } catch (e) { /* ignore */ } }
  function create(config) {
    var saved = savedServer();
    var api = saved || (config && config.api && config.api.url && config.api.key ? config.api : null);
    if (api) return apiStore(api);
    var sb = config && config.supabase;
    if (sb && sb.url && sb.anonKey) return supabaseStore(sb);
    return localStore();
  }

  return { create: create, apiStore: apiStore, savedServer: savedServer, saveServer: saveServer, clearServer: clearServer, LOCAL_KEY: LOCAL_KEY };
})();
