/* Booster opening sequence: tear → (per-card charge/flip) → haul summary. */
import { CARS, THEMES, TIERS, TIER_COLOR, tierIndex } from './catalog.js';
import { card, icon, tierSlug } from './ui.js';
import { burst, ring, flash, shake, confetti } from './fx.js';
import { play } from './sfx.js';
import { esc, sleep, reducedMotion, plural } from './util.js';
import { paint } from './photos.js';

export function packArt(theme, { big = false } = {}) {
  const t = THEMES[theme];
  return `<div class="pack t${theme}${big ? ' big' : ''}" aria-hidden="true">
    <div class="pack-flap"><span></span></div>
    <div class="pack-body">
      <div class="pack-photo"><img data-photo="${t.hero}" alt="" draggable="false"></div>
      <div class="pack-label"><small>CARDEX · ${t.pool} cars</small><strong>${esc(t.name)}</strong></div>
      <div class="pack-foil"></div>
    </div>
  </div>`;
}

/**
 * @param {{theme:number, quantity:number, cards:{id:number,finish:string,serial:number,isNew:boolean}[], canRepeat:(q:number)=>boolean}} o
 * @returns {Promise<'again'|'garage'|'close'>}
 */
export function reveal(o) {
  return new Promise((resolve) => {
    const cards = o.cards.map((c) => ({ ...c, tier: tierIndex(CARS[c.id].rarity) }));
    const best = cards.reduce((m, c) => Math.max(m, c.tier), 0);
    const bulk = o.quantity > 1;
    const quick = reducedMotion();
    const root = document.createElement('div');
    root.className = 'reveal';
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Booster opening');
    root.style.setProperty('--best', TIER_COLOR[TIERS[best]]);
    root.innerHTML = `<div class="reveal-bg"><div class="rays"></div><div class="vignette"></div></div>
      <header class="reveal-head"><span class="eyebrow">${esc(THEMES[o.theme].name)} · ${plural(o.quantity, 'booster')}</span>
        <div class="pips">${bulk ? '' : cards.map(() => '<i></i>').join('')}</div>
        <button class="btn ghost sm" data-act="skip">Skip ${icon('arrowR')}</button></header>
      <div class="stage">
        <div class="pack-slot">${packArt(o.theme, { big: true })}</div>
        <div class="deck"></div>
      </div>
      <p class="hint" aria-live="polite">Tap the pack to tear it open</p>
      <section class="summary" hidden></section>`;
    document.body.append(root);
    document.body.classList.add('no-scroll');
    paint(root);
    const $ = (s) => root.querySelector(s);
    const pack = $('.pack'), deck = $('.deck'), hint = $('.hint');
    let phase = 'pack', index = -1, busy = false;
    if (best >= 5) pack.classList.add('special');
    requestAnimationFrame(() => root.classList.add('in'));
    play('whoosh');

    const done = (v) => {
      document.removeEventListener('keydown', onKey, true);
      root.classList.add('out');
      document.body.classList.remove('no-scroll');
      setTimeout(() => root.remove(), 260);
      resolve(v);
    };

    async function tear() {
      if (phase !== 'pack' || busy) return;
      busy = true;
      if (!quick) { pack.classList.add('rumble'); play('shake'); await sleep(best >= 5 ? 700 : 380); }
      pack.classList.remove('rumble'); pack.classList.add('torn');
      play('tear');
      const r = pack.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height * 0.14, { color: ['#fff', TIER_COLOR[TIERS[best]]], count: 46, speed: 11, spread: Math.PI, angle: -Math.PI / 2 });
      flash(TIER_COLOR[TIERS[Math.max(best, 2)]], best >= 5 ? 0.85 : 0.45);
      root.classList.add('opened');
      await sleep(quick ? 50 : 520);
      busy = false;
      if (bulk) return summary();
      phase = 'cards';
      $('.pack-slot').classList.add('gone');
      deck.innerHTML = cards.map((c, i) => `<div class="flip" style="--i:${i}" data-i="${i}">
        <div class="flip-inner"><div class="face back"><div class="card-back"><span>CAR<em>DEX</em></span></div></div>
        <div class="face front">${card(c.id, { finish: c.finish, serial: c.serial, size: 'big', attrs: ' data-no-tilt' })}</div></div></div>`).join('');
      paint(deck);
      cards.forEach((_, i) => setTimeout(() => play('deal'), i * 70));
      await sleep(quick ? 0 : 420);
      next();
    }

    function next() {
      const prev = deck.querySelector(`.flip[data-i="${index}"]`);
      if (prev) { prev.classList.add('tossed'); play('whoosh'); }
      index++;
      if (index >= cards.length) return summary();
      deck.querySelectorAll('.flip').forEach((f) => f.classList.toggle('current', Number(f.dataset.i) === index));
      hint.textContent = index === cards.length - 1 ? 'Final card — Rare or better' : 'Tap to flip';
      phase = 'face-down';
    }

    async function flip() {
      if (busy) return;
      const c = cards[index], el = deck.querySelector(`.flip[data-i="${index}"]`);
      busy = true;
      const color = TIER_COLOR[TIERS[c.tier]];
      el.style.setProperty('--rc', color);
      if (c.tier >= 3 && !quick) {
        el.classList.add('charging', 'c' + Math.min(c.tier, 6));
        root.style.setProperty('--charge', color);
        root.classList.add('charging');
        play('charge', c.tier);
        await sleep(450 + c.tier * 110);
        root.classList.remove('charging');
      }
      el.classList.remove('charging'); el.classList.add('flipped');
      play('flip');
      await sleep(quick ? 0 : 260);
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      play('reveal', c.tier);
      burst(x, y, { color: [color, '#fff'], count: 18 + c.tier * 12, speed: 6 + c.tier * 1.6 });
      if (c.tier >= 2) ring(x, y, color, 180 + c.tier * 50);
      if (c.tier >= 4) flash(color, 0.35 + (c.tier - 4) * 0.15);
      if (c.tier >= 5) { shake(c.tier - 4); play('boom'); confetti([color, '#fff', '#ffd23f']); }
      root.querySelectorAll('.pips i')[index]?.style.setProperty('--c', color);
      root.querySelectorAll('.pips i')[index]?.classList.add('on');
      const cc = CARS[c.id];
      hint.innerHTML = `<b style="color:${color}">${esc(cc.rarity)}</b> · ${esc(cc.name)}${c.finish !== 'Standard' ? ' · ' + esc(c.finish) : ''}`;
      if (c.isNew) setTimeout(() => { el.insertAdjacentHTML('beforeend', '<span class="stamp">NEW</span>'); play('newStamp'); }, quick ? 0 : 320);
      phase = 'face-up';
      await sleep(quick ? 0 : 280);
      busy = false;
    }

    function summary() {
      phase = 'summary';
      root.classList.add('summarising');
      $('.stage').hidden = true; hint.hidden = true;
      $('[data-act="skip"]').hidden = true;
      const sorted = bulk ? [...cards].sort((a, b) => b.tier - a.tier || a.id - b.id) : cards;
      const fresh = new Set(cards.filter((c) => c.isNew).map((c) => c.id)).size;
      const counts = TIERS.map((t, i) => [t, cards.filter((c) => c.tier === i).length]).filter(([, n]) => n);
      const s = $('.summary');
      s.hidden = false;
      s.innerHTML = `<div class="summary-head">
          <span class="eyebrow">Haul · ${plural(cards.length, 'card')}</span>
          <h2>${fresh ? `${plural(fresh, 'new model')}` : 'No new models'}<span class="best" style="--c:${TIER_COLOR[TIERS[best]]}">Best pull: ${TIERS[best]}</span></h2>
          <div class="tier-strip">${counts.map(([t, n]) => `<span class="r-${tierSlug(t)}" style="--c:${TIER_COLOR[t]};flex:${n}" title="${t}: ${n}">${n}</span>`).join('')}</div>
        </div>
        <div class="summary-grid ${bulk ? 'dense' : ''}">${sorted.map((c, i) => `<div class="deal" style="--i:${Math.min(i, 40)}">${card(c.id, { finish: c.finish, serial: c.serial, size: bulk ? 'sm' : 'md', badge: c.isNew ? '<span class="new-badge">NEW</span>' : '' })}</div>`).join('')}</div>
        <div class="summary-actions">
          <button class="btn primary" data-act="again" ${o.canRepeat(o.quantity) ? '' : 'disabled'}>${icon('packs')} Open ${o.quantity > 1 ? '×' + o.quantity : 'another'}</button>
          <button class="btn" data-act="garage">${icon('garage')} Garage</button>
          <button class="btn ghost" data-act="close">Done</button>
        </div>`;
      paint(s);
      if (!quick) sorted.slice(0, 24).forEach((_, i) => setTimeout(() => play('deal'), 80 + i * 45));
      if (bulk && best >= 5) setTimeout(() => { confetti([TIER_COLOR[TIERS[best]], '#fff']); play('reveal', best); }, 400);
      s.querySelector('[data-act="again"]').focus({ preventScroll: true });
    }

    const advance = () => {
      if (phase === 'pack') return tear();
      if (phase === 'face-down') return flip();
      if (phase === 'face-up' && !busy) return next();
    };
    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'skip') { if (!busy) summary(); return; }
      if (act) return done(act);
      if (phase !== 'summary') advance();
    });
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); phase === 'summary' ? done('close') : !busy && summary(); }
      else if ((e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') && phase !== 'summary') { e.preventDefault(); advance(); }
    }
    document.addEventListener('keydown', onKey, true);
  });
}
