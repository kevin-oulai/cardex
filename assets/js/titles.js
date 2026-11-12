/* Collector titles: tiered badges with escalating effects, and the equip ceremony. */
import { esc, reducedMotion } from './util.js';
import { burst, ring, flash, confetti, shake } from './fx.js';
import { play } from './sfx.js';

export const TIER = {
  standard: { name: 'Standard', color: '#c9d1dc', sfx: 1 },
  epic: { name: 'Epic', color: '#b26bff', sfx: 3 },
  legendary: { name: 'Legendary', color: '#ffd23f', sfx: 5 },
  mythic: { name: 'Mythic', color: '#ff4fa3', sfx: 6 },
  ascendant: { name: 'Ascendant', color: '#9ff3ff', sfx: 7 },
};
const EMBLEM = {
  Boosters: '<path d="M7 3h10v18H7z"/><path d="M7 7h10M12 11l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z"/>',
  Collection: '<rect x="3" y="5" width="8" height="12" rx="1.5"/><rect x="13" y="7" width="8" height="12" rx="1.5"/>',
  Achievements: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM12 13v4M8 21h8M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/>',
  Regions: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  Rarity: '<path d="M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7z"/>',
  Showdown: '<path d="M5 21V4M5 4h13l-2 4 2 4H5"/>',
  Level: '<path d="M4 18l5-6 4 3 7-9"/><path d="M15 6h5v5"/>',
  Market: '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
};
const emblem = (cat) => `<svg class="tb-emblem" viewBox="0 0 24 24" aria-hidden="true">${EMBLEM[cat] || EMBLEM.Rarity}</svg>`;

/** Title badge. size: 'sm' | 'md' | 'lg'. Locked titles render muted. */
export function titleBadge(t, { size = 'md', locked = false } = {}) {
  if (!t) return '';
  const tier = TIER[t.tier] ? t.tier : 'standard';
  const motes = ['legendary', 'mythic', 'ascendant'].includes(tier) && !locked
    ? `<span class="tb-motes" aria-hidden="true">${Array.from({ length: tier === 'ascendant' ? 10 : tier === 'mythic' ? 7 : 5 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</span>` : '';
  return `<span class="tbadge t-${tier} ${size}${locked ? ' locked' : ''}" title="${esc(TIER[tier].name)} title">
    <span class="tb-aura" aria-hidden="true"></span>${emblem(t.category)}<span class="tb-label">${esc(t.label)}</span>${motes}<span class="tb-shine" aria-hidden="true"></span></span>`;
}

/** Full-screen equip ceremony; escalates with tier. */
export function celebrate(t) {
  const tier = TIER[t.tier] ? t.tier : 'standard';
  const color = TIER[tier].color;
  const o = document.createElement('div');
  o.className = `title-ceremony t-${tier}`;
  o.style.setProperty('--c', color);
  o.innerHTML = `<div class="tc-rays"></div><div class="tc-body"><span class="eyebrow">${esc(TIER[tier].name)} title equipped</span>${titleBadge(t, { size: 'lg' })}<p class="muted">${esc(t.description || '')}</p></div>`;
  document.body.append(o);
  requestAnimationFrame(() => o.classList.add('in'));
  play('reveal', TIER[tier].sfx);
  const b = o.querySelector('.tbadge').getBoundingClientRect();
  const x = b.left + b.width / 2, y = b.top + b.height / 2;
  setTimeout(() => {
    burst(x, y, { color: [color, '#fff'], count: 30 + TIER[tier].sfx * 8, speed: 7 + TIER[tier].sfx });
    ring(x, y, color, 220 + TIER[tier].sfx * 30);
    if (TIER[tier].sfx >= 5) { flash(color, 0.4); confetti([color, '#fff']); }
    if (tier === 'ascendant') { shake(1); play('boom'); }
  }, reducedMotion() ? 0 : 260);
  const close = () => { o.classList.add('out'); setTimeout(() => o.remove(), 300); };
  o.addEventListener('click', close);
  setTimeout(close, 2600);
}
