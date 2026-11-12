/* CARDEX boot, routing and app shell. */
import * as api from './api.js';
import { S, on, signedIn, signedOut, syncWallet, syncInventory, syncSocial, unreadCount, setNotifier, claimable } from './store.js';
import { levelProgress, TICKET_CAP_FREE, REFILL_MS } from './catalog.js';
import { $, $$, esc, friendly, relTime, timeLeft, isUuid } from './util.js';
import { icon, toast, sheet, busy } from './ui.js';
import { countTo } from './fx.js';
import { play, isMuted, setMuted, onMute } from './sfx.js';
import { initPhotos } from './photos.js';
import { maybeStartTutorial } from './tutorial.js';

import packs from './views/packs.js';
import garage from './views/garage.js';
import showdown from './views/showdown.js';
import market from './views/market.js';
import profile from './views/profile.js';
import community from './views/community.js';
import collector from './views/collector.js';
import authView from './views/auth.js';

const ROUTES = { packs, garage, showdown, market, profile, community, collector, auth: authView };
const view = $('#view');
let current = null;
setNotifier(toast);

// ── Router ──────────────────────────────────────────────────────────────
export function go(path) { location.hash = '#/' + path; }
window.cardexGo = go;
function parse() {
  const [name, ...params] = (location.hash.replace(/^#\/?/, '') || 'packs').split('/').map(decodeURIComponent);
  return { name: ROUTES[name] ? name : 'packs', params };
}
function mount() {
  let { name, params } = parse();
  if (!S.synced && name !== 'auth') name = 'auth';
  if (S.synced && name === 'auth') { history.replaceState(null, '', '#/packs'); name = 'packs'; params = []; }
  if (name === 'collector' && (!isUuid(params[0]) || params[0] === S.user?.id)) { name = 'profile'; params = []; }
  const key = name + '/' + params.join('/');
  if (current?.key === key) return;
  current?.offs.forEach((f) => f());
  current?.cleanup?.();
  const offs = [];
  const el = document.createElement('div');
  el.className = 'page page-' + name;
  const ctx = {
    el, params, go,
    watch: (keys, fn) => keys.forEach((k) => offs.push(on(k, fn))),
    interval: (fn, ms) => { const t = setInterval(fn, ms); offs.push(() => clearInterval(t)); },
  };
  const swap = () => {
    view.replaceChildren(el);
    current = { key, name, offs, cleanup: ROUTES[name].mount(ctx) };
    document.title = (ROUTES[name].title ? ROUTES[name].title + ' · ' : '') + 'CARDEX';
    $$('.tabbar a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.tab === name || (name === 'collector' && a.dataset.tab === 'profile' && false)));
    scrollTo({ top: 0 });
    view.focus({ preventScroll: true });
  };
  if (document.startViewTransition && current && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(swap);
  else swap();
}
addEventListener('hashchange', () => { if (S.synced) play('nav'); mount(); });
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); go(g.dataset.go); }
});

// ── Shell ───────────────────────────────────────────────────────────────
$$('[data-icon]').forEach((s) => { s.innerHTML = icon(s.dataset.icon); });
$('#communityBtn').innerHTML = icon('users');
$('#inboxBtn').insertAdjacentHTML('afterbegin', icon('bell'));
const paintMute = () => { $('#soundBtn').innerHTML = icon(isMuted() ? 'soundOff' : 'soundOn'); $('#soundBtn').setAttribute('aria-pressed', String(!isMuted())); };
paintMute(); onMute(paintMute);
$('#soundBtn').addEventListener('click', () => setMuted(!isMuted()));
document.addEventListener('pointerdown', (e) => { if (e.target.closest('button.btn,.chip-btn,.seg button')) play('tap'); }, { passive: true });

function showShell(on) {
  ['.topbar', '.tabbar', '.legal'].forEach((s) => { $(s).hidden = !on; });
  document.body.classList.toggle('signed-in', on);
}
on('wallet', () => {
  const w = S.wallet; if (!w) return;
  const lp = levelProgress(w.xp);
  $('#levelNum').textContent = lp.level;
  $('#xpRing').style.strokeDashoffset = String(94.25 * (1 - lp.pct));
  $('.chip.level').title = `Level ${lp.level} · ${lp.into} / ${lp.span} XP`;
  countTo($('#credits'), w.credits);
  countTo($('#tickets'), w.tickets);
  tickTimer();
});
let refillPending = false;
function tickTimer() {
  const w = S.wallet, t = $('#ticketTimer');
  if (!w) return;
  if (w.tickets >= TICKET_CAP_FREE) { t.textContent = ''; return; }
  const left = Date.parse(w.last_refill) + REFILL_MS - Date.now();
  t.textContent = '+1 ' + timeLeft(left);
  if (left <= 0 && !refillPending) { refillPending = true; syncWallet().catch(() => {}).finally(() => { refillPending = false; }); }
}
setInterval(tickTimer, 1000);

// Inbox popover
const inbox = $('#inbox'), inboxBtn = $('#inboxBtn');
function renderInbox() {
  const n = unreadCount(), b = $('#inboxBadge');
  b.hidden = !n; b.textContent = n > 99 ? '99+' : n;
  const list = S.social.notifications;
  inbox.innerHTML = `<div class="pop-head"><strong>Notifications</strong>${n ? '<button class="link" data-readall>Mark all read</button>' : ''}</div>
    <div class="pop-list">${list.length ? list.slice(0, 20).map((x) => `<button class="note ${x.read ? '' : 'unread'}" data-note="${x.id}" data-actor="${esc(x.actor_id || '')}">
      ${icon(x.kind === 'friend_request' ? 'userPlus' : x.kind === 'friend_accepted' ? 'users' : 'bell')}
      <span><b>${esc(x.actor_name || 'A collector')}</b> ${esc(x.message)}<small>${relTime(x.created_at)}</small></span></button>`).join('') : '<p class="muted pad">Nothing yet.</p>'}</div>`;
}
on('social', renderInbox);
on('achievements', () => {
  const n = claimable(), tab = $('.tabbar [data-tab="profile"]');
  let b = tab.querySelector('.tab-badge');
  if (!b) { b = document.createElement('span'); b.className = 'tab-badge'; tab.append(b); }
  b.hidden = !n; b.textContent = n;
  tab.title = n ? `${n} achievement${n === 1 ? '' : 's'} to claim` : '';
});
const closeInbox = () => { inbox.hidden = true; inboxBtn.setAttribute('aria-expanded', 'false'); };
inboxBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  inbox.hidden = !inbox.hidden;
  inboxBtn.setAttribute('aria-expanded', String(!inbox.hidden));
  if (!inbox.hidden) { renderInbox(); syncSocial().catch(() => {}); }
});
inbox.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (e.target.closest('[data-readall]')) { S.social = await api.socialAction('read_all').catch((er) => (toast(friendly(er), 'error'), S.social)); renderInbox(); return; }
  const n = e.target.closest('[data-note]');
  if (!n) return;
  const id = Number(n.dataset.note), item = S.social.notifications.find((x) => x.id === id);
  closeInbox();
  if (item && !item.read) api.socialAction('read', { notification: id }).then((s) => { S.social = s; renderInbox(); }).catch(() => {});
  if (item?.kind === 'friend_request') go('community/requests');
  else if (isUuid(n.dataset.actor)) go('collector/' + n.dataset.actor);
});
document.addEventListener('click', (e) => { if (!inbox.hidden && !e.target.closest('.inbox-wrap')) closeInbox(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !inbox.hidden) { closeInbox(); inboxBtn.focus(); } });

// ── Session ─────────────────────────────────────────────────────────────
let sessionUser = null, lastSync = 0, starting = null;
async function enter(user) {
  if (sessionUser === user.id) return;
  sessionUser = user.id;
  starting = (async () => {
    try {
      await signedIn(user);
      lastSync = Date.now();
      showShell(true);
      mount();
      maybeStartTutorial(go);
    } catch (e) {
      sessionUser = null;
      console.error('CARDEX sign-in sync', e);
      toast('Couldn’t load your collection: ' + friendly(e), 'error', 6000);
      mount();
    }
  })();
  return starting;
}
function leave() { signedOut(); }
on('session', () => { if (!S.synced) { sessionUser = null; showShell(false); mount(); } });
api.auth.on((event, session) => {
  // Supabase recommends deferring work out of this callback.
  setTimeout(() => {
    if (event === 'PASSWORD_RECOVERY') return recoverPassword();
    if (session?.user) enter(session.user);
    else if (event === 'SIGNED_OUT') leave();
  }, 0);
});
async function recoverPassword() {
  await sheet(`<h2>Choose a new password</h2><form class="stack" id="newPw"><input class="input" type="password" name="pw" minlength="8" autocomplete="new-password" placeholder="New password (8+ characters)" required><p class="form-msg muted" role="status"></p><button class="btn primary">Update password</button></form>`, {
    cls: 'small', label: 'New password',
    onOpen: (d, close) => d.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      busy(btn, async () => {
        try { await api.auth.setPassword(e.target.pw.value); toast('Password updated', 'success'); close(); }
        catch (er) { d.querySelector('.form-msg').textContent = friendly(er); }
      });
    }),
  });
}
addEventListener('focus', () => {
  if (!S.synced || Date.now() - lastSync < 60000) return;
  lastSync = Date.now();
  syncInventory().catch(() => {}); syncSocial().catch(() => {});
});

(async function boot() {
  initPhotos();
  try {
    const user = await api.auth.user();
    if (user) await enter(user); else mount();
  } catch (e) {
    console.error('CARDEX boot', e);
    mount();
    toast('Online services unreachable: ' + friendly(e), 'error', 8000);
  }
})();
