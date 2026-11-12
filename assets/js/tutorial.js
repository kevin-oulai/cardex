/* First-run tutorial: a spotlight tour that makes the player actually do each core action once.
   Progress is saved in preferences, so it resumes on another device and never repeats once finished. */
import { S, updatePrefs } from './store.js';
import { CARS } from './catalog.js';
import { esc, sleep, reducedMotion } from './util.js';
import { play } from './sfx.js';
import { confetti } from './fx.js';

const STEPS = [
  { id: 'welcome', route: 'packs', center: true, title: 'Welcome to CARDEX', cta: 'Show me around',
    body: `Collect ${CARS.length} real cars from boosters, trade them with other players and race a new boss every day. This tour takes about two minutes — you’ll open your first pack on the way.` },
  { id: 'tickets', route: 'packs', target: '.chip.tickets', title: 'Tickets',
    body: 'Each booster costs one ticket. You start with 10, and a free one refills every 10 minutes (up to 10). You can also buy tickets with credits.' },
  { id: 'pack', route: 'packs', target: '.pack-tile[data-theme="0"]', title: 'Open your first booster', wait: 'packOpened',
    body: 'Hit <b>Open</b>. Tap the pack to tear it, then tap each card to flip it. Five cards per pack — the last is always Rare or better. A glowing card means something big.',
    skipIf: () => (S.wallet?.tickets ?? 0) < 1 },
  { id: 'garage', route: 'garage', target: '.card-grid .card-btn', title: 'Your garage', wait: 'inspect',
    body: 'Everything you pull lands here. <b>Tap a card</b> to inspect it.', skipIf: () => !S.cards.length },
  { id: 'inspect', target: '.inspector-actions', title: 'What you can do with a card',
    body: '<b>Favourite</b> it, put it in one of your three <b>showroom</b> bays (shown on your public profile), <b>race</b> it, <b>sell</b> it, or <b>recycle</b> spare copies for credits.',
    skipIf: () => !document.querySelector('.inspector') },
  { id: 'cardex', route: 'garage', target: '[data-mode="dex"]', title: 'The Cardex',
    body: 'Switch to the Cardex to see every car in the game. The ones you’re missing are greyed out — tap one to add it to your wishlist.' },
  { id: 'boss', route: 'showdown', target: '.boss', title: 'Daily Showdown',
    body: 'A new boss car every day at midnight UTC. Your score compares power, top speed and weight against it. Milestones at 20/40/60/80/100% pay credits and tickets.' },
  { id: 'race', route: 'showdown', target: '.compare', title: 'Race the boss', wait: 'raced',
    body: 'Your strongest car is already selected. Hit <b>Race</b> — unlimited attempts, only your best of the day counts.', skipIf: () => !S.cards.length },
  { id: 'market', route: 'market', target: '.page-head .tabs', title: 'The Market',
    body: 'Buy and sell individual cards — with their serial numbers — from other players, for credits. Sellers pay a 5% fee.' },
  { id: 'achievements', route: 'profile', target: '#achievements', title: 'Achievements', wait: 'claimed',
    body: 'You’ve already earned some. <b>Claim</b> them for credits, then turn credits into tickets.',
    skipIf: () => !S.achievements.some((a) => !a.claimed && a.progress >= a.goal) },
  { id: 'titles', route: 'profile', target: '#titles', title: 'Titles',
    body: 'Progress unlocks titles in five tiers, from Standard to Ascendant. Equip one and it shows on your profile.' },
  { id: 'community', target: () => (matchMedia('(max-width: 640px)').matches ? '#inboxBtn' : '#communityBtn'), title: 'Community',
    body: 'Find friends, browse their garages and catch requests here. You can replay this tour from your Profile.' },
  { id: 'done', center: true, title: 'You’re ready', cta: 'Start collecting',
    body: 'Come back daily for the new boss and your free tickets. Good luck pulling a Limited.' },
];

let layer, idx = -1, active = false, raf = 0, goFn = null, waitingFor = null, paused = false;

function ensureLayer() {
  if (layer) return;
  layer = document.createElement('div');
  layer.className = 'tut';
  layer.setAttribute('popover', 'manual');
  layer.innerHTML = '<div class="tut-dim"></div><div class="tut-spot"></div><div class="tut-card" role="dialog" aria-live="polite"></div>';
  document.body.append(layer);
  layer.querySelector('.tut-card').addEventListener('click', (e) => {
    const a = e.target.closest('[data-tut]')?.dataset.tut;
    if (a === 'next') next();
    if (a === 'skip') finish(true);
  });
  // Keep the tour above dialogs opened later (both live in the top layer) and pause it during pack reveals.
  new MutationObserver(() => {
    if (!active) return;
    if (!layer.isConnected) mountIn(document.body);
    const revealing = !!document.querySelector('.reveal');
    layer.classList.toggle('paused', revealing || paused);
    const dlg = document.querySelector('dialog[open]');
    if (dlg && layer.parentElement === document.body && layer.matches(':popover-open')) { layer.hidePopover(); layer.showPopover(); }
  }).observe(document.body, { childList: true });
  addEventListener('cardex:tutorial', (e) => { if (active && waitingFor === e.detail) { waitingFor = null; setTimeout(next, e.detail === 'packOpened' ? 300 : 900); } });
}

// A modal dialog makes everything outside it inert, so steps about a dialog render inside it.
function mountIn(host) {
  if (layer.parentElement === host && layer.matches(':popover-open')) return;
  if (layer.matches(':popover-open')) layer.hidePopover();
  host.append(layer);
  layer.showPopover();
}
const resolveTarget = (s) => (typeof s.target === 'function' ? s.target() : s.target);
async function findTarget(sel) {
  for (let i = 0; i < 40; i++) {
    const el = sel && document.querySelector(sel);
    if (el && el.getBoundingClientRect().width) return el;
    await sleep(100);
  }
  return null;
}

function place(target, step) {
  const spot = layer.querySelector('.tut-spot'), card = layer.querySelector('.tut-card');
  if (!target || step.center) {
    layer.classList.add('centered');
    spot.style.cssText = 'opacity:0';
    card.style.cssText = '';
    return;
  }
  layer.classList.remove('centered');
  const r = target.getBoundingClientRect(), pad = 8;
  spot.style.cssText = `opacity:1;left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
  const cw = Math.min(360, innerWidth - 24), ch = card.offsetHeight || 180;
  const clampY = (y) => Math.min(Math.max(70, y), innerHeight - ch - 80);
  const clampX = (x) => Math.min(Math.max(12, x), innerWidth - cw - 12);
  let top, left, side;
  if (r.bottom + pad + 14 + ch < innerHeight - 70) { side = 'below'; top = r.bottom + pad + 14; left = clampX(r.left + r.width / 2 - cw / 2); }
  else if (r.top - pad - 14 - ch > 70) { side = 'above'; top = r.top - pad - 14 - ch; left = clampX(r.left + r.width / 2 - cw / 2); }
  else if (r.left - pad - 14 - cw > 12) { side = 'left'; left = r.left - pad - 14 - cw; top = clampY(r.top + r.height / 2 - ch / 2); }
  else if (r.right + pad + 14 + cw < innerWidth - 12) { side = 'right'; left = r.right + pad + 14; top = clampY(r.top + r.height / 2 - ch / 2); }
  else { side = 'float'; left = clampX(r.left + r.width / 2 - cw / 2); top = innerHeight - ch - 90; }
  card.style.cssText = `left:${left}px;top:${top}px;width:${cw}px`;
  card.dataset.side = side;
}

async function show(i) {
  idx = i;
  const s = STEPS[i];
  if (!s) return finish(false);
  if (s.skipIf?.()) return show(i + 1);
  updatePrefs((p) => { p.tutorial = i; });
  const dlg = document.querySelector('dialog[open]');
  if (s.id === 'inspect' && dlg) mountIn(dlg);
  else { mountIn(document.body); document.querySelectorAll('dialog[open]').forEach((d) => d.close()); }
  if (s.route && !location.hash.startsWith('#/' + s.route)) { goFn(s.route); await sleep(350); }
  const target = s.center ? null : await findTarget(resolveTarget(s));
  if (!target && !s.center) return show(i + 1);
  if (target) target.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
  waitingFor = s.wait || null;
  const visible = STEPS.filter((x) => !x.center).length;
  const n = STEPS.slice(0, i).filter((x) => !x.center).length + (s.center ? 0 : 1);
  layer.querySelector('.tut-card').innerHTML = `
    ${s.center ? '' : `<span class="tut-step mono">${n} / ${visible}</span>`}
    <h3>${esc(s.title)}</h3><p>${s.body}</p>
    <div class="tut-actions">
      ${i < STEPS.length - 1 ? '<button class="link" data-tut="skip">Skip tour</button>' : '<span></span>'}
      ${s.wait ? '<span class="tut-wait">Waiting for you…</span>' : `<button class="btn primary sm" data-tut="next">${esc(s.cta || 'Next')}</button>`}
    </div>`;
  layer.classList.remove('paused');
  layer.querySelector('.tut-card').classList.remove('pop'); void layer.offsetWidth; layer.querySelector('.tut-card').classList.add('pop');
  play('tick');
  if (s.id === 'done') { play('success'); confetti(['#ffb000', '#fff', '#ff3b30']); }
  await sleep(reducedMotion() ? 0 : 320);
  const loop = () => { if (!active) return; const t = s.center ? null : document.querySelector(resolveTarget(s)); place(t, s); raf = requestAnimationFrame(loop); };
  cancelAnimationFrame(raf); loop();
}
const next = () => show(idx + 1);

function finish(skipped) {
  active = false; waitingFor = null; cancelAnimationFrame(raf);
  updatePrefs((p) => { p.tutorial = 'done'; });
  if (layer?.matches(':popover-open')) layer.hidePopover();
  if (skipped) play('toggle');
}

export function startTutorial(go, from = 0) {
  goFn = go;
  ensureLayer();
  if (!layer.matches(':popover-open')) layer.showPopover();
  active = true;
  show(from);
}
/** Called after sign-in: start for brand-new accounts, resume an unfinished tour. */
export function maybeStartTutorial(go) {
  const t = S.prefs.tutorial;
  if (t === 'done') return;
  if (t == null && (S.wallet?.opened ?? 0) > 0) { updatePrefs((p) => { p.tutorial = 'done'; }); return; }
  setTimeout(() => startTutorial(go, Number.isInteger(t) ? Math.max(0, Math.min(t, STEPS.length - 1)) : 0), 600);
}
export const tutorialActive = () => active;
export const tutorialEvent = (name) => window.dispatchEvent(new CustomEvent('cardex:tutorial', { detail: name }));
export function pauseTutorial(v) { paused = v; layer?.classList.toggle('paused', v); }
