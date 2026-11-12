/* Single source of truth for the signed-in session. Views subscribe; nothing else holds game state. */
import * as api from './api.js';
import { CARS, AVATARS, PROFILE_THEMES } from './catalog.js';
import { debounce, utcDay, friendly } from './util.js';

const listeners = new Map();
export const S = {
  user: null,          // { id, email }
  profile: null,       // { display_name, public_collection, equipped_title }
  wallet: null,        // { tickets, credits, xp, opened, pity, last_refill }
  cards: [],           // [{ sid, id, finish, serial, at }]
  prefs: { collector: {}, favorites: [] },
  claims: [],          // achievement ids
  showdown: { date: utcDay(), best: 0, claimed: [] },
  bossId: null,
  titles: null,
  social: { friends: [], incoming: [], outgoing: [], notifications: [] },
  synced: false,
};
let revision = 0, saving = false, dirty = false;

export function on(key, fn) {
  (listeners.get(key) || listeners.set(key, new Set()).get(key)).add(fn);
  return () => listeners.get(key).delete(fn);
}
export function emit(...keys) {
  for (const k of [...keys, '*']) listeners.get(k)?.forEach((fn) => { try { fn(S); } catch (e) { console.error(e); } });
}

// ── Preferences (cosmetic, device-synced; economy fields are NOT stored here any more) ──
function sanitizePrefs(raw = {}) {
  const c = raw.collector && typeof raw.collector === 'object' ? raw.collector : {};
  const ids = (a, max) => [...new Set((Array.isArray(a) ? a : []).filter((x) => Number.isInteger(x) && CARS[x]))].slice(0, max);
  return {
    collector: {
      avatar: AVATARS.includes(c.avatar) ? c.avatar : '🏎️',
      bio: typeof c.bio === 'string' ? c.bio.slice(0, 90) : '',
      theme: c.theme in PROFILE_THEMES ? c.theme : 'heritage',
      showcase: (Array.isArray(c.showcase) ? c.showcase : []).slice(0, 3).map((x) => (Number.isInteger(x) && CARS[x] ? x : null)),
      wishlist: ids(c.wishlist, 192),
    },
    favorites: ids(raw.favorites, 192),
  };
}
const flush = debounce(async () => {
  if (saving || !dirty || !S.user) return;
  saving = true; dirty = false;
  try {
    const res = await api.savePrefs({ v: 2, ...S.prefs }, revision);
    revision = Number(res.revision);
  } catch (e) {
    if (/SAVE_CONFLICT/.test(e.message)) {
      const fresh = await api.loadPrefs(S.user.id);
      revision = fresh.revision; S.prefs = sanitizePrefs(fresh.state);
      emit('prefs'); notify?.('Profile changed on another device — loaded the latest version.', 'warn');
    } else { dirty = true; notify?.('Couldn’t save profile changes: ' + friendly(e), 'error'); }
  } finally { saving = false; if (dirty) flush(); }
}, 600);
export function updatePrefs(mutator) {
  mutator(S.prefs);
  S.prefs = sanitizePrefs(S.prefs);
  dirty = true; emit('prefs'); flush();
}
export const isFavorite = (id) => S.prefs.favorites.includes(id);
export const toggleFavorite = (id) => updatePrefs((p) => { p.favorites = p.favorites.includes(id) ? p.favorites.filter((x) => x !== id) : [...p.favorites, id]; });
export const toggleWish = (id) => updatePrefs((p) => { const w = p.collector.wishlist; p.collector.wishlist = w.includes(id) ? w.filter((x) => x !== id) : [...w, id]; });

let notify = null;
export const setNotifier = (fn) => { notify = fn; };

// ── Server sync ─────────────────────────────────────────────────────────
const mapCard = (o) => ({ sid: o.id, id: o.car_id, finish: o.finish, serial: o.model_serial, at: Date.parse(o.issued_at) || 0 });
export async function syncInventory() {
  const [wallet, cards] = await Promise.all([api.wallet(), api.cards()]);
  S.wallet = wallet;
  S.cards = cards.filter((o) => CARS[o.car_id]).map(mapCard);
  emit('wallet', 'cards');
}
export async function syncWallet() { S.wallet = await api.wallet(); emit('wallet'); }
export async function syncShowdown() {
  const day = utcDay();
  const [bossId, status] = await Promise.all([api.boss(day), api.showdownStatus()]);
  S.bossId = bossId; S.showdown = { date: day, best: Number(status?.best) || 0, claimed: status?.claimed || [] };
  emit('showdown');
}
export async function syncClaims() { S.claims = (await api.achievementClaims()) || []; emit('claims'); }
export async function syncTitles() { S.titles = await api.titles(S.user.id); emit('titles'); }
export async function syncSocial() { S.social = await api.socialList(); emit('social'); }

export async function signedIn(user) {
  S.user = { id: user.id, email: user.email };
  const [profile, prefs] = await Promise.all([api.profile(user.id), api.loadPrefs(user.id)]);
  S.profile = profile || { display_name: 'Collector', public_collection: true };
  revision = prefs.revision; S.prefs = sanitizePrefs(prefs.state);
  await syncInventory();
  S.synced = true;
  emit('profile', 'prefs', 'session');
  // Secondary data: never block first paint on these.
  Promise.allSettled([syncShowdown(), syncClaims(), syncTitles(), syncSocial()]).then((r) =>
    r.filter((x) => x.status === 'rejected').forEach((x) => console.warn('CARDEX sync', x.reason)));
}
export function signedOut() {
  Object.assign(S, { user: null, profile: null, wallet: null, cards: [], prefs: sanitizePrefs(), claims: [], titles: null, synced: false,
    social: { friends: [], incoming: [], outgoing: [], notifications: [] } });
  revision = 0; dirty = false;
  emit('session', 'wallet', 'cards', 'prefs', 'social');
}

// ── Derived data ────────────────────────────────────────────────────────
export const ownedModels = () => new Set(S.cards.map((c) => c.id));
export function groups(cards = S.cards) {
  const m = new Map();
  for (const c of cards) {
    const k = c.id + '|' + c.finish;
    if (!m.has(k)) m.set(k, { key: k, id: c.id, finish: c.finish, copies: [], latest: 0 });
    const g = m.get(k); g.copies.push(c); g.latest = Math.max(g.latest, c.at);
  }
  return [...m.values()];
}
export function spares() {
  let n = 0, value = 0;
  for (const g of groups()) if (g.copies.length > 1) { n += g.copies.length - 1; value += (g.copies.length - 1) * [10, 20, 35, 60, 100, 200, 300, 500][['Common', 'Uncommon', 'Rare', 'Super Rare', 'Ultra Rare', 'Legendary', 'Exotic', 'Limited'].indexOf(CARS[g.id].rarity)]; }
  return { n, value };
}
export const unreadCount = () => S.social.notifications.filter((n) => !n.read).length;
