/* Shared UI primitives: icons, the card component, toasts, confirm/prompt dialogs, sheets. */
import { CARS, TIER_COLOR, TIER_GLYPH, statPct } from './catalog.js';
import { esc, num, h } from './util.js';
import { play } from './sfx.js';

const P = {
  packs: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 7h14M9 3v4M12 11l1.5 3h3l-2.5 2 1 3-3-2-3 2 1-3-2.5-2h3z"/>',
  garage: '<path d="M3 21V9l9-6 9 6v12"/><path d="M7 21v-7h10v7M7 17h10"/>',
  market: '<path d="M3 9l2-5h14l2 5"/><path d="M4 9v11h16V9"/><path d="M3 9c0 2 1.5 3 3 3s3-1 3-3c0 2 1.5 3 3 3s3-1 3-3c0 2 1.5 3 3 3s3-1 3-3"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h13l-2 4 2 4H5"/><path d="M9 4v8M13 4v8" opacity=".5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c.8-3.5 3.5-5 7-5s6.2 1.5 7 5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.5 2.3 4 5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9"/><path d="M10 21h4"/>',
  soundOn: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 8.5a5 5 0 0 1 0 7M19 5.5a9 9 0 0 1 0 13"/>',
  soundOff: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  heart: '<path d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9z"/>',
  recycle: '<path d="M7 19H4l3.5-6M17 19h3l-3.5-6M9.5 5 12 1l2.5 4"/><path d="M8.5 9 12 3l3.5 6M6 16l-2 3M18 16l2 3M9 19h6"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M15 9.5c0-1.1-1.3-2-3-2s-3 .9-3 2 1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2-3-.9-3-2"/>',
  ticket: '<path d="M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 1 0-4V4H3z" transform="translate(0 2)"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  userPlus: '<circle cx="9" cy="8" r="4"/><path d="M2 21c1-4 3.5-6 7-6s6 2 7 6M19 8v6M16 11h6"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  book: '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
  tag: '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
};
export const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;

const SILHOUETTE = '<svg class="silhouette" viewBox="0 0 200 80" aria-hidden="true"><path d="M8 58c0-6 3-9 9-10l26-5c10-9 24-17 46-19 22-2 42 2 58 12l22 4c12 2 21 7 23 13v6c0 3-2 5-5 5h-11a17 17 0 0 0-33 0H65a17 17 0 0 0-33 0H14c-4 0-6-2-6-6z"/><circle cx="48" cy="64" r="12"/><circle cx="153" cy="64" r="12"/></svg>';
const FINISH_LABEL = { Standard: '', Foil: 'FOIL', Holographic: 'HOLO', Collector: 'COLLECTOR' };
export const tierSlug = (r) => r.toLowerCase().replace(/\s+/g, '-');

/** The CARDEX card. opts: finish, serial, count, size ('sm'|'md'|'big'), locked, badge, tag (wrapper element). */
export function card(id, o = {}) {
  const c = CARS[id];
  if (!c) return '';
  const finish = o.finish || 'Standard';
  const fslug = finish.toLowerCase();
  const locked = !!o.locked;
  const stats = [['PWR', 'hp', c.hp, 'hp'], ['TOP', 'speed', c.speed, 'km/h'], ['MASS', 'weight', c.weight, 'kg']];
  return `<article class="card r-${tierSlug(c.rarity)} f-${fslug} ${o.size || 'md'}${locked ? ' locked' : ''}" style="--rc:${TIER_COLOR[c.rarity]}" data-car="${id}"${o.attrs || ''}>
  <div class="card-inner">
    <div class="card-top"><span class="glyph">${TIER_GLYPH[c.rarity]}</span><span class="rarity">${c.rarity}</span>${FINISH_LABEL[finish] ? `<span class="finish">${FINISH_LABEL[finish]}</span>` : ''}</div>
    <div class="photo">${SILHOUETTE}${locked ? '' : `<img data-photo="${id}" alt="" loading="lazy" decoding="async" draggable="false">`}</div>
    <div class="card-name"><small>${esc(c.make)}</small><strong>${esc(c.model)}</strong></div>
    <div class="card-stats">${stats.map(([l, k, v, u]) => `<div class="stat"><span>${l}</span><i style="--v:${statPct(k, v)}%"></i><b>${locked ? '???' : num(v)}<small>${u}</small></b></div>`).join('')}</div>
    <div class="card-foot"><span>${c.year} · ${esc(c.country)} · ${c.drive}</span><span>${o.serial != null ? '#' + String(o.serial).padStart(5, '0') : ''}</span></div>
    ${o.count > 1 ? `<span class="count">×${o.count}</span>` : ''}
    ${o.badge || ''}
    <div class="shine"></div><div class="glare"></div>
  </div>
</article>`;
}

// ── Toasts ──────────────────────────────────────────────────────────────
let toastHost;
export function toast(msg, kind = 'info', ms = 3200) {
  toastHost ||= document.getElementById('toasts');
  const t = h(`<div class="toast ${kind}" role="${kind === 'error' ? 'alert' : 'status'}">${icon(kind === 'error' ? 'x' : kind === 'success' ? 'check' : kind === 'reward' ? 'coin' : 'bolt')}<span>${esc(msg)}</span></div>`);
  toastHost.append(t);
  if (kind === 'error') play('error');
  while (toastHost.children.length > 4) toastHost.firstElementChild.remove();
  setTimeout(() => { t.classList.add('out'); t.addEventListener('animationend', () => t.remove(), { once: true }); }, ms);
}

// ── Dialogs ─────────────────────────────────────────────────────────────
/** Open a <dialog> with given HTML; resolves with the value passed to close(). */
export function sheet(html, { cls = '', onOpen, label = 'Dialog' } = {}) {
  return new Promise((resolve) => {
    const d = h(`<dialog class="sheet ${cls}" aria-label="${esc(label)}"><button class="icon-btn sheet-x" data-close aria-label="Close">${icon('x')}</button><div class="sheet-body">${html}</div></dialog>`);
    document.body.append(d);
    let value;
    const close = (v) => { value = v; d.classList.add('closing'); setTimeout(() => d.close(), 180); };
    d.addEventListener('close', () => { d.remove(); resolve(value); });
    d.addEventListener('click', (e) => {
      if (e.target === d) return close();
      if (e.target.closest('[data-close]')) close(e.target.closest('[data-close]').dataset.close || undefined);
    });
    d.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
    d.showModal();
    onOpen?.(d, close);
  });
}
export async function confirm({ title, body = '', ok = 'Confirm', danger = false }) {
  const v = await sheet(`<h2>${esc(title)}</h2>${body ? `<p class="muted">${body}</p>` : ''}<div class="row end gap"><button class="btn ghost" data-close="no">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-close="yes" autofocus>${esc(ok)}</button></div>`, { cls: 'small', label: title });
  return v === 'yes';
}

/** Busy state on a button for the duration of an async action; prevents double submits. */
export async function busy(btn, fn) {
  if (btn?.disabled) return;
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }
  try { return await fn(); } finally { if (btn?.isConnected) { btn.disabled = false; btn.classList.remove('loading'); } }
}

export const empty = (title, body = '', action = '') => `<div class="empty"><div class="empty-mark">${icon('grid')}</div><h3>${esc(title)}</h3>${body ? `<p class="muted">${body}</p>` : ''}${action}</div>`;
export const skeleton = (n = 6) => `<div class="card-grid">${Array.from({ length: n }, () => '<div class="card-skel"></div>').join('')}</div>`;
export function avatar(emoji, name, size = '') {
  return `<span class="avatar ${size}" aria-hidden="true">${esc(emoji || (name || 'C').slice(0, 1).toUpperCase())}</span>`;
}
