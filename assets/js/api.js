/* Thin, typed-by-convention wrapper over Supabase. Every economy mutation is a server RPC. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

export const SUPABASE_URL = 'https://svqaunlehadayyyctvuo.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_bmN4o7CWUi8OqQ8_jqLaig_DSYcorRO';
export const SITE_URL = 'https://kevin-oulai.github.io/cardex/';

export const sb = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const unwrap = ({ data, error }) => { if (error) throw new Error(error.message || String(error)); return data; };
const rpc = async (fn, args) => unwrap(await sb.rpc(fn, args));

// ── Auth ────────────────────────────────────────────────────────────────
export const auth = {
  user: async () => (await sb.auth.getUser()).data?.user || null,
  signIn: async (email, password) => unwrap(await sb.auth.signInWithPassword({ email, password })),
  signUp: async (email, password) => unwrap(await sb.auth.signUp({ email, password, options: { emailRedirectTo: SITE_URL } })),
  signOut: async () => unwrap(await sb.auth.signOut()),
  reset: async (email) => unwrap(await sb.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL })),
  setPassword: async (password) => unwrap(await sb.auth.updateUser({ password })),
  on: (fn) => sb.auth.onAuthStateChange(fn),
};

// ── Account ─────────────────────────────────────────────────────────────
export async function profile(uid) {
  return unwrap(await sb.from('profiles').select('display_name,public_collection,equipped_title').eq('id', uid).maybeSingle());
}
export async function setName(uid, name) {
  unwrap(await sb.from('profiles').update({ display_name: name }).eq('id', uid));
}
export const setVisibility = (visible) => rpc('cardex_set_collection_visibility', { p_visible: visible });

export async function loadPrefs(uid) {
  const row = unwrap(await sb.from('player_saves').select('state,revision').eq('user_id', uid).maybeSingle());
  if (row) return { state: row.state || {}, revision: Number(row.revision || 0) };
  const fresh = { v: 2, collector: {}, favorites: [] };
  const { error } = await sb.from('player_saves').insert({ user_id: uid, state: fresh });
  if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
  return error ? loadPrefs(uid) : { state: fresh, revision: 0 };
}
export const savePrefs = (state, revision) => rpc('cardex_save_preferences', { p_state: state, p_expected_revision: revision });

export async function deleteAccount(password, confirmation) {
  const { data, error } = await sb.functions.invoke('cardex-delete-account', { body: { password, confirmation } });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context?.json())?.error || msg; } catch { /* body not JSON */ }
    throw new Error(msg || 'Account deletion failed');
  }
  if (!data?.deleted) throw new Error(data?.error || 'Account deletion was not confirmed');
}

// ── Economy ─────────────────────────────────────────────────────────────
export const wallet = () => rpc('cardex_get_wallet');
/** PostgREST caps responses at 1000 rows: page through the whole inventory. */
export async function cards() {
  const out = [], size = 1000;
  for (let from = 0; ; from += size) {
    const rows = unwrap(await sb.from('global_card_serials').select('id,car_id,finish,issued_at,model_serial').order('id').range(from, from + size - 1));
    out.push(...rows);
    if (rows.length < size) return out;
  }
}
export const openPacks = (theme, quantity) => rpc('cardex_open_packs', { p_theme: theme, p_quantity: quantity });
export const buyTickets = (quantity) => rpc('cardex_buy_tickets', { p_quantity: quantity });
export const recycle = (carId = null, finish = null) => rpc('cardex_recycle_duplicates', { p_car_id: carId, p_finish: finish });
export const claimAchievement = (id) => rpc('cardex_claim_achievement', { p_id: id });
export const achievements = () => rpc('cardex_achievements');
export const titles = (uid) => rpc('cardex_titles', { p_user_id: uid });
export const equipTitle = (id) => rpc('cardex_equip_title', { p_title: id });

// ── Showdown ────────────────────────────────────────────────────────────
export async function boss(day) {
  try { await rpc('cardex_publish_boss'); } catch (e) { console.warn('publish boss', e); }
  return unwrap(await sb.from('daily_bosses').select('car_id').eq('challenge_date', day).maybeSingle())?.car_id ?? null;
}
export const leaderboard = (day) => rpc('cardex_daily_leaderboard', { p_day: day });
export const showdownStatus = () => rpc('cardex_get_showdown_status');
export const submitShowdown = (serialId) => rpc('cardex_submit_showdown', { p_serial_id: serialId });

// ── Community ───────────────────────────────────────────────────────────
export const socialList = () => rpc('cardex_social_list');
export const socialSearch = (q) => rpc('cardex_social_search', { p_query: q });
export const socialAction = (action, { target = null, request = null, notification = null } = {}) =>
  rpc('cardex_social_action', { p_action: action, p_target: target, p_request: request, p_notification: notification });
export const socialGarage = (uid) => rpc('cardex_social_garage', { p_user_id: uid });
export const publicCollector = (uid) => rpc('cardex_public_collector', { p_user_id: uid });

// ── Market ──────────────────────────────────────────────────────────────
export const marketList = () => rpc('cardex_market_list', { p_limit: 100 });
export const marketMine = () => rpc('cardex_market_mine');
export const marketCreate = (serialId, price) => rpc('cardex_market_create', { p_serial_id: serialId, p_price: price });
export const marketBuy = (id) => rpc('cardex_market_buy', { p_listing_id: id });
export const marketCancel = (id) => rpc('cardex_market_cancel', { p_listing_id: id });
