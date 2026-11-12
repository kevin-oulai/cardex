/* Game rules mirrored from the server. The server is authoritative; these exist for display/preview only. */
import { CARS } from './catalog-data.js';
export { CARS };

export const TIERS = ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Ultra Rare', 'Legendary', 'Exotic', 'Limited'];
export const WEIGHTS = [44.6, 26.8, 15.9, 8, 3.5, 0.5, 0.5, 0.2];
export const TIER_COLOR = {
  Common: '#9aa6b8', Uncommon: '#3ddc97', Rare: '#4c8dff', 'Super Rare': '#b26bff',
  'Ultra Rare': '#ff8a2a', Legendary: '#ffd23f', Exotic: '#ff4fa3', Limited: '#e9f4ff',
};
export const TIER_GLYPH = { Common: '◆', Uncommon: '◈', Rare: '✦', 'Super Rare': '✧', 'Ultra Rare': '✷', Legendary: '♛', Exotic: '✺', Limited: '❖' };
export const FINISHES = ['Standard', 'Foil', 'Holographic', 'Collector'];
export const FINISH_ODDS = { Standard: 85.3, Foil: 12, Holographic: 2.5, Collector: 0.2 };
export const tierIndex = (r) => TIERS.indexOf(r);
export const isHighTier = (r) => tierIndex(r) >= 5;

export const THEMES = [
  { id: 0, name: 'World Mix', tag: 'Every era, every country', hero: 21, test: () => true },
  { id: 1, name: 'JDM Legends', tag: 'Japan only', hero: 15, test: (c) => c.country === 'Japan' },
  { id: 2, name: 'European Icons', tag: 'Germany · France · Italy · UK', hero: 19, test: (c) => ['Germany', 'France', 'Italy', 'UK'].includes(c.country) },
  { id: 3, name: 'Motorsport', tag: 'Race cars & Legendary+', hero: 23, test: (c) => c.motorsport || isHighTier(c.rarity) },
].map((t) => {
  const pool = CARS.filter(t.test);
  return { ...t, pool: pool.length, top: pool.reduce((m, c) => Math.max(m, tierIndex(c.rarity)), 0) };
});

export const PACK_SIZE = 5;
export const TICKET_PRICE = 250;
export const TICKET_CAP_FREE = 10;
export const TICKET_CAP = 100;
export const REFILL_MS = 600000;
export const PITY_AT = 60;
export const RECYCLE_VALUE = [10, 20, 35, 60, 100, 200, 300, 500];
export const recycleValue = (id) => RECYCLE_VALUE[tierIndex(CARS[id]?.rarity)] ?? 10;
export const MARKET_FEE = 0.05;
export const marketFee = (price) => Math.ceil(price * 5 / 100);

export const level = (xp) => Math.floor(Math.sqrt(xp / 120)) + 1;
export const levelStart = (l) => 120 * (l - 1) * (l - 1);
export const levelProgress = (xp) => {
  const l = level(xp), a = levelStart(l), b = levelStart(l + 1);
  return { level: l, into: xp - a, span: b - a, pct: (xp - a) / (b - a) };
};

export const TITLE_TIERS = ['standard', 'epic', 'legendary', 'mythic', 'ascendant'];

export const MILESTONES = [
  { at: 20, credits: 100 }, { at: 40, credits: 200 }, { at: 60, tickets: 1 },
  { at: 80, credits: 350 }, { at: 100, credits: 200, tickets: 1 },
];

/** Mirrors cardex_submit_showdown exactly. */
export function scoreAgainst(c, boss) {
  const parts = [
    { key: 'hp', label: 'Power', unit: 'hp', a: c.hp, b: boss.hp, ratio: Math.min(1.5, c.hp / Math.max(1, boss.hp)), win: c.hp > boss.hp },
    { key: 'speed', label: 'Top speed', unit: 'km/h', a: c.speed, b: boss.speed, ratio: Math.min(1.5, c.speed / Math.max(1, boss.speed)), win: c.speed > boss.speed },
    { key: 'weight', label: 'Weight', unit: 'kg', a: c.weight, b: boss.weight, ratio: Math.min(1.5, boss.weight / Math.max(1, c.weight)), win: c.weight < boss.weight },
  ];
  const wins = parts.filter((p) => p.win).length;
  const avg = parts.reduce((n, p) => n + p.ratio, 0) / 3;
  const score = Math.min(wins >= 2 ? 100 : 99, Math.max(0, Math.round((100 * avg) / 1.08)));
  return { parts, wins, avg, score };
}

/** Boss fallback identical to cardex_publish_boss (used only before the server answers). */
export function predictedBossId(dateStr) {
  const days = Math.round(Date.parse(dateStr + 'T00:00:00Z') / 86400000);
  return (((days * 17 + 7) % CARS.length) + CARS.length) % CARS.length;
}

// Stat normalisation for card bars (log scale so a 90 hp Golf is still visible next to a Nevera).
const span = (k) => { const v = CARS.map((c) => c[k]); return [Math.min(...v), Math.max(...v)]; };
const RANGES = { hp: span('hp'), speed: span('speed'), weight: span('weight') };
export function statPct(key, value) {
  const [lo, hi] = RANGES[key];
  const t = (Math.log(value) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
  return Math.round(8 + 92 * (key === 'weight' ? 1 - t : t));
}

export const COUNTRIES = [...new Set(CARS.map((c) => c.country))].sort();
export const AVATARS = ['🏎️', '🏁', '🔧', '🚗', '⚡', '🏆', '🔥', '🛞'];
export const PROFILE_THEMES = { heritage: 'Heritage', ember: 'Ember', midnight: 'Midnight', circuit: 'Circuit' };
