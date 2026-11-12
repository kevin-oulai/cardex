export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const num = (n) => Number(n || 0).toLocaleString('en-US');
export const plural = (n, word, many = word + 's') => `${num(n)} ${n === 1 ? word : many}`;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isUuid = (x) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(x));
export const utcDay = () => new Date().toISOString().slice(0, 10);
export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
export function timeLeft(ms) {
  if (ms <= 0) return '0:00';
  const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(r).padStart(2, '0')}`;
}
export function msToUtcMidnight() {
  const n = new Date();
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1) - n.getTime();
}
export function relTime(iso) {
  const d = (Date.now() - Date.parse(iso)) / 1000;
  if (!isFinite(d)) return '';
  if (d < 60) return 'just now';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  if (d < 86400) return Math.floor(d / 3600) + 'h ago';
  if (d < 86400 * 7) return Math.floor(d / 86400) + 'd ago';
  return new Date(iso).toLocaleDateString();
}
/** Turn Postgres/Supabase errors into a sentence a player can act on. */
export function friendly(e) {
  const msg = String(e?.message || e || 'Something went wrong');
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Connection lost. Check your network and try again.';
  if (/JWT|session/i.test(msg) && /expired|invalid/i.test(msg)) return 'Your session expired. Please sign in again.';
  return msg.replace(/^(Action failed: |Error: )/, '').replace(/\bcoins\b/gi, 'credits');
}
export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
export const local = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full / disabled */ } },
};
