/* VERSION and SHELL are replaced by scripts/build.mjs. */
const VERSION = '__BUILD_VERSION__';
const SHELL = __SHELL_FILES__;
const SCOPE = self.registration.scope;
const PREFIX = 'language-study:' + new URL(SCOPE).pathname + ':';
const CORE = PREFIX + 'core:' + VERSION;
const CONTENT = PREFIX + 'content:' + VERSION;
const localURL = path => new URL(path, SCOPE).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE);
    await cache.addAll(SHELL.map(path => new Request(localURL(path), { cache: 'reload' })));
    if (!self.registration.active) await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(PREFIX) && key !== CORE && key !== CONTENT) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

async function rangeResponse(request, response) {
  const header = request.headers.get('range');
  if (!header) return response;
  const buffer = await response.arrayBuffer();
  const size = buffer.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  let start, end;
  if (match && (match[1] || match[2])) {
    if (!match[1]) { start = Math.max(0, size - Number(match[2])); end = size - 1; }
    else { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1; }
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
    return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  }
  const headers = new Headers(response.headers);
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  headers.set('Accept-Ranges', 'bytes');
  return new Response(buffer.slice(start, end + 1), { status: 206, headers });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== new URL(SCOPE).origin || !url.href.startsWith(SCOPE)) return;
  const path = decodeURIComponent(url.pathname.slice(new URL(SCOPE).pathname.length));
  event.respondWith((async () => {
    const content = await caches.open(CONTENT);
    const core = await caches.open(CORE);
    const cached = await content.match(request.url) || await core.match(request.url);
    if (path.startsWith('Audio/') || path.startsWith('Books/')) {
      if (cached) return rangeResponse(request, cached);
      return fetch(request);
    }
    if (request.mode === 'navigate') {
      try { const response = await fetch(request); if (response.ok) return response; } catch {}
      return cached || await core.match(localURL('index.html')) || new Response('Reconnect to open the course.', { status: 503 });
    }
    if (path.startsWith('data/') && path.endsWith('.json')) {
      try {
        const response = await fetch(request);
        if (response.ok) { await content.put(request.url, response.clone()); return response; }
        if (!cached) return response;
      } catch {}
      return cached || new Response('This language has not been saved offline.', { status: 503 });
    }
    return cached || fetch(request);
  })());
});

let saving = false;
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE') { self.skipWaiting(); return; }
  const port = event.ports[0];
  if (!port) return;
  event.waitUntil((async () => {
    try {
      const core = await caches.open(CORE);
      const content = await caches.open(CONTENT);
      const manifestResponse = await core.match(localURL('offline-packs.json'));
      const packs = await manifestResponse.json();
      if (event.data.type === 'STATUS') {
        const codes = [];
        for (const code of Object.keys(packs)) if (await content.match(localURL('__offline__/' + code))) codes.push(code);
        port.postMessage({ codes }); return;
      }
      if (event.data.type !== 'CACHE_LANGUAGE' || !Object.hasOwn(packs, event.data.code)) throw new Error('Unknown language.');
      if (saving) throw new Error('Another language is still saving. Wait for it to finish.');
      saving = true;
      try {
        const pack = packs[event.data.code];
        let done = 0;
        for (const path of pack.files) {
          const url = localURL(path);
          if (!await content.match(url)) {
            const response = await fetch(new Request(url, { cache: 'reload', signal: AbortSignal.timeout(30000) }));
            if (!response.ok) throw new Error('A course file could not download. Reconnect and save the language again.');
            await content.put(url, response);
          }
          port.postMessage({ type: 'progress', done: ++done, total: pack.files.length });
        }
        await content.put(localURL('__offline__/' + event.data.code), new Response(JSON.stringify({ version: VERSION, savedAt: new Date().toISOString() })));
        port.postMessage({ ok: true });
      } finally { saving = false; }
    } catch (error) {
      port.postMessage({ error: error.name === 'QuotaExceededError' ? 'Your device has too little free browser storage. Free some space, then try again, or download the PDF.' : ['TypeError','AbortError','TimeoutError'].includes(error.name) ? 'A file could not download. Reconnect and save the language again.' : error.message || 'Offline saving failed. Reconnect and try again.' });
    }
  })());
});
