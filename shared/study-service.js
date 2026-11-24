import { createClient } from '@supabase/supabase-js';
import { StudyLedger } from './study-ledger.js';

export class StudyService {
  constructor(config, { storage = globalThis.localStorage, prefix = 'language-study', onChange, onStatus } = {}) {
    const url = new URL(config.url);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) throw new Error('Use your HTTPS Supabase project URL.');
    if (!config.key || config.key.startsWith('sb_secret_')) throw new Error('Use a publishable key, never a secret key.');
    if(config.key.startsWith('eyJ')){
      let payload;try{payload=JSON.parse(atob(config.key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{throw new Error('The anon key is invalid.');}
      if(payload.role!=='anon')throw new Error('Use the public anon key, never a service-role key.');
    }
    // Each app/device has an independent refresh token. Never use the Syncthing vault for this storage.
    this.client = createClient(config.url, config.key, { auth: { storage, storageKey: `${prefix}:auth:${url.hostname}`, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    this.ledger = new StudyLedger(this.client, { storage, prefix: `${prefix}:${url.hostname}`, onChange, onStatus });
    this.channel = null; this.timer = null; this.authSubscription = null; this.closed = false;
  }
  async start() {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    this.activate(data.session?.user || null);
    const { data: subscription } = this.client.auth.onAuthStateChange((_event, session) => {
      // SDK warns against awaiting Supabase requests inside the auth callback.
      setTimeout(() => { if (!this.closed && session?.user?.id !== this.ledger.user?.id) this.activate(session?.user || null); }, 0);
    });
    this.authSubscription = subscription.subscription;
    this.timer = setInterval(() => this.ledger.sync(), 30000);
  }
  activate(user) {
    if (this.channel) this.client.removeChannel(this.channel);
    this.channel = null; this.ledger.activate(user);
    if (!user) return;
    this.channel = this.client.channel(`language-study:${user.id}:${this.ledger.device}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'language_study_items', filter: `user_id=eq.${user.id}` }, event => {
        if (this.ledger.user?.id !== user.id || !event.new?.key) return;
        try { this.ledger.receive(event.new); } catch (error) { this.ledger.error = error.message; this.ledger.onStatus(this.ledger.status()); }
      }).subscribe(status => { if (status === 'SUBSCRIBED') this.ledger.sync(); });
    this.ledger.sync();
  }
  async signIn(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.activate(data.user); return data.user;
  }
  async signUp(email, password) {
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) throw error;
    if (data.session) this.activate(data.user);
    return Boolean(data.session);
  }
  async signOut() { const { error } = await this.client.auth.signOut({ scope: 'local' }); if (error) throw error; this.activate(null); }
  close() { this.closed = true; clearInterval(this.timer); this.authSubscription?.unsubscribe(); if (this.channel) this.client.removeChannel(this.channel); this.ledger.activate(null); this.client.auth.stopAutoRefresh(); }
}
