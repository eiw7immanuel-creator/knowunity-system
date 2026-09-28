/* ==========================================================================
   Knowunity Content OS — storage adapters
   Every record is an "item": { id, kind, data, updated_at }.
   - localStore:    this browser only (zero setup, used for previews/demos)
   - supabaseStore: shared with the whole team through Supabase's REST API
   The app never talks to storage directly; it only uses the interface below:
     load() -> items[]   put(item)   putMany(items)   remove(id)
     removeMany(ids)     replaceAll(items)
   ========================================================================== */
window.KUStore = (function () {
  'use strict';

  var LOCAL_KEY = 'knowunity-content-os:v1';

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

  function supabaseStore(cfg) {
    var base = cfg.url.replace(/\/+$/, '') + '/rest/v1/' + (cfg.table || 'items');
    var baseHeaders = {
      apikey: cfg.anonKey,
      Authorization: 'Bearer ' + cfg.anonKey,
      'Content-Type': 'application/json'
    };
    function req(method, qs, body, extra) {
      var headers = {};
      Object.keys(baseHeaders).forEach(function (k) { headers[k] = baseHeaders[k]; });
      if (extra) Object.keys(extra).forEach(function (k) { headers[k] = extra[k]; });
      return fetch(base + (qs || ''), {
        method: method,
        headers: headers,
        body: body ? JSON.stringify(body) : undefined
      }).then(function (res) {
        if (res.ok) return res;
        return res.text().then(function (txt) {
          var msg = '';
          try { msg = JSON.parse(txt).message || ''; } catch (e) { msg = txt.slice(0, 120); }
          throw new Error('Supabase ' + method + ' failed (' + res.status + ')' + (msg ? ': ' + msg : ''));
        });
      });
    }
    function chunk(list, n) {
      var out = [];
      for (var i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
      return out;
    }
    var upsertHeaders = { Prefer: 'resolution=merge-duplicates,return=minimal' };
    var api = {
      mode: 'supabase',
      label: 'Shared with the team',
      load: function () {
        return req('GET', '?select=id,kind,data,updated_at&order=updated_at.asc&limit=10000')
          .then(function (res) { return res.json(); });
      },
      put: function (item) { return req('POST', '', [item], upsertHeaders).then(function () {}); },
      putMany: function (items) {
        if (!items.length) return Promise.resolve();
        return chunk(items, 200).reduce(function (p, part) {
          return p.then(function () { return req('POST', '', part, upsertHeaders); });
        }, Promise.resolve()).then(function () {});
      },
      remove: function (id) { return req('DELETE', '?id=eq.' + encodeURIComponent(id)).then(function () {}); },
      removeMany: function (ids) {
        if (!ids.length) return Promise.resolve();
        return chunk(ids, 100).reduce(function (p, part) {
          return p.then(function () {
            return req('DELETE', '?id=in.(' + part.map(encodeURIComponent).join(',') + ')');
          });
        }, Promise.resolve()).then(function () {});
      },
      replaceAll: function (items) {
        return req('DELETE', '?id=neq.__never__').then(function () { return api.putMany(items); });
      }
    };
    return api;
  }

  function create(config) {
    var sb = config && config.supabase;
    if (sb && sb.url && sb.anonKey) return supabaseStore(sb);
    return localStore();
  }

  return { create: create, LOCAL_KEY: LOCAL_KEY };
})();
