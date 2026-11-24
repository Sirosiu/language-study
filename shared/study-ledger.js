import { normaliseItem, sameContent, uuid } from './study-model.js';

// The same revision protocol runs in the website and the mobile Obsidian plugin.
// Tokens are managed separately by Supabase, never written into these snapshots.
export class StudyLedger {
  constructor(client, { storage, prefix = 'language-study', onChange = () => {}, onStatus = () => {} } = {}) {
    Object.assign(this, { client, storage, prefix, onChange, onStatus });
    this.user = null; this.generation = 0; this.server = {}; this.pending = {}; this.conflicts = {};
    this.flight = new Map(); this.device = uuid(); this.error = ''; this.busy = false;
  }
  activate(user) {
    this.generation++; this.user = user; this.server = {}; this.pending = {}; this.conflicts = {}; this.flight.clear();
    this.error = ''; this.busy = false; this.cacheProblem = false;
    if (user) {
      try {
        const saved = JSON.parse(this.storage?.getItem(this.cacheKey()) || '{}');
        for (const row of Object.values(saved.server || {})) { const item = normaliseItem(row); this.server[item.key] = item; }
        for (const p of Object.values(saved.pending || {})) {
          const item = normaliseItem(p.item);
          if (!Number.isSafeInteger(p.base) || p.base < 0 || typeof p.seq !== 'string') throw new Error('Invalid pending edit');
          this.pending[item.key] = { item, base: p.base, seq: p.seq };
        }
        for (const [key, c] of Object.entries(saved.conflicts || {})) {
          if (this.pending[key]) this.conflicts[key] = { remote: c.remote ? normaliseItem(c.remote) : null };
        }
      } catch { this.cacheProblem = true; this.error = 'The local sync backup could not be read. Export a backup before making more changes.'; }
    }
    this.emit();
  }
  cacheKey() { return `${this.prefix}:records:${this.user.id}`; }
  emit() { this.onChange(); this.onStatus(this.status()); }
  status() { return { signedIn: Boolean(this.user), busy: this.busy, pending: Object.keys(this.pending).length, conflicts: Object.keys(this.conflicts).length, error: this.error }; }
  persist() {
    if (!this.user) return;
    try { this.storage?.setItem(this.cacheKey(), JSON.stringify({ server: this.server, pending: this.pending, conflicts: this.conflicts })); }
    catch { this.error = 'Device storage is full or unavailable. Export your private backup before leaving.'; this.onStatus(this.status()); throw new Error(this.error); }
  }
  get(key) { if (!this.user) return null; return this.pending[key]?.item || this.server[key] || null; }
  items(language, kind, includeDeleted = false) {
    if (!this.user) return [];
    return [...new Set([...Object.keys(this.server), ...Object.keys(this.pending)])].map(k => this.get(k))
      .filter(i => (!language || i.language === language) && (!kind || i.kind === kind) && (includeDeleted || !i.deleted));
  }
  put(raw, expectedRevision) {
    if (!this.user) throw new Error('Sign in to save private answers and notes.');
    if (this.cacheProblem) throw new Error(this.error);
    const item = normaliseItem(raw), old = this.get(item.key);
    if (sameContent(item, old)) return old;
    const previous = this.pending[item.key];
    const base = previous?.base ?? expectedRevision ?? this.server[item.key]?.revision ?? item.revision;
    item.revision = base;
    this.pending[item.key] = { item, base, seq: uuid() };
    if (this.server[item.key]?.revision > base) this.conflicts[item.key] = { remote: this.server[item.key] };
    this.persist(); this.emit(); return item;
  }
  ingest(raw) {
    const item = normaliseItem(raw), old = this.server[item.key];
    if (old && item.revision <= old.revision) return false;
    this.server[item.key] = item;
    const p = this.pending[item.key], flight = this.flight.get(item.key);
    if (p) {
      if (sameContent(item, p.item)) { delete this.pending[item.key]; delete this.conflicts[item.key]; }
      else if (flight && item.origin === flight.origin) {
        p.base = item.revision; p.item.revision = item.revision;
      } else if (item.revision > p.base) this.conflicts[item.key] = { remote: item };
    }
    return true;
  }
  async pull() {
    if (!this.user) return;
    const generation = this.generation;
    let offset = 0, changed = false;
    do {
      const { data, error } = await this.client.from('language_study_items').select('*').order('key').range(offset, offset + 499);
      if (generation !== this.generation) return;
      if (error) throw new Error(error.message);
      for (const item of data) changed = this.ingest(item) || changed;
      if (data.length < 500) break;
      offset += 500;
    } while (true);
    if (changed) { this.persist(); this.emit(); }
  }
  async sync() {
    if (!this.user || this.busy || this.cacheProblem) return;
    const generation = this.generation; this.busy = true; this.error = ''; this.onStatus(this.status());
    try {
      // Pull first so offline edits are checked against the latest revision.
      await this.pull();
      while (generation === this.generation) {
        const entry = Object.entries(this.pending).find(([key]) => !this.conflicts[key]);
        if (!entry) break;
        const [key, p] = entry, origin = `${this.device}:${p.seq}`;
        this.flight.set(key, { seq: p.seq, origin });
        const { data, error } = await this.client.rpc('language_study_put_item', {
          p_key: key, p_language: p.item.language, p_kind: p.item.kind, p_data: p.item.data,
          p_expected_revision: p.base, p_deleted: p.item.deleted, p_origin: origin,
        });
        if (generation !== this.generation) return;
        if (error) throw new Error(error.message);
        if (data?.ok) {
          // An edit made while the request was in flight must stay in the queue.
          const latest = this.pending[key];
          this.ingest(data.item);
          if (latest?.seq === p.seq) { delete this.pending[key]; delete this.conflicts[key]; }
          else if (this.pending[key]) { this.pending[key].base = data.item.revision; this.pending[key].item.revision = data.item.revision; }
        } else if (data?.conflict) {
          if (data.current) this.ingest(data.current);
          this.conflicts[key] = { remote: data.current ? normaliseItem(data.current) : null };
        } else throw new Error('The sync service returned an invalid response.');
        this.flight.delete(key); this.persist(); this.emit();
      }
    } catch (error) { if (generation === this.generation) this.error = error.message; }
    finally { if (generation === this.generation) { this.busy = false; this.flight.clear(); this.onStatus(this.status()); } }
  }
  receive(raw) { if (!this.user || this.cacheProblem || !this.ingest(raw)) return; this.persist(); this.emit(); }
  resolve(key, choice) {
    if (!this.conflicts[key]) return;
    const remote = this.conflicts[key].remote;
    if (choice === 'remote') { delete this.pending[key]; if (remote) this.server[key] = remote; else delete this.server[key]; }
    else if (choice === 'local') {
      const p = this.pending[key]; p.base = remote?.revision || 0; p.item.revision = p.base; p.seq = uuid();
    } else throw new Error('Choose the device or cloud version.');
    delete this.conflicts[key]; this.persist(); this.emit();
  }
  backup() { return { schemaVersion: 1, exportedAt: new Date().toISOString(), items: this.items(null, null, true), conflicts: Object.entries(this.conflicts).map(([key, c]) => ({ key, local: this.get(key), remote: c.remote })) }; }
}
