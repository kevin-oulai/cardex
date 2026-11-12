import * as api from '../api.js';
import { S, syncSocial, emit } from '../store.js';
import { icon, toast, busy, empty, avatar, confirm } from '../ui.js';
import { esc, friendly, debounce, relTime } from '../util.js';

const TABS = { friends: 'Friends', requests: 'Requests', find: 'Find collectors' };

export function relation(id) {
  const s = S.social;
  if (s.friends.some((x) => x.id === id)) return { kind: 'friend' };
  const out = s.outgoing.find((x) => x.id === id); if (out) return { kind: 'outgoing', request: out.request_id };
  const inc = s.incoming.find((x) => x.id === id); if (inc) return { kind: 'incoming', request: inc.request_id };
  return { kind: 'none' };
}
export function relationButtons(id) {
  if (id === S.user?.id) return '';
  const r = relation(id);
  if (r.kind === 'friend') return `<button class="btn sm ghost" data-soc="remove" data-target="${esc(id)}">Remove</button>`;
  if (r.kind === 'outgoing') return `<button class="btn sm ghost" data-soc="cancel" data-target="${esc(id)}">${icon('clock')} Requested</button>`;
  if (r.kind === 'incoming') return `<button class="btn sm primary" data-soc="accept" data-request="${r.request}">${icon('check')} Accept</button><button class="btn sm ghost" data-soc="decline" data-request="${r.request}">Decline</button>`;
  return `<button class="btn sm primary" data-soc="send" data-target="${esc(id)}">${icon('userPlus')} Add</button>`;
}
/** Delegated handler for [data-soc] buttons; shared with the collector page. */
export async function socialClick(e, after) {
  const b = e.target.closest('[data-soc]');
  if (!b) return false;
  const act = b.dataset.soc;
  if (act === 'remove' && !(await confirm({ title: 'Remove friend?', ok: 'Remove', danger: true }))) return true;
  await busy(b, async () => {
    try {
      S.social = await api.socialAction(act, { target: b.dataset.target || null, request: b.dataset.request ? Number(b.dataset.request) : null });
      emit('social');
      toast({ send: 'Friend request sent', accept: 'You’re now friends', remove: 'Friend removed', cancel: 'Request cancelled', decline: 'Request declined' }[act] || 'Updated', 'success');
      after?.();
    } catch (er) { toast(friendly(er), 'error'); }
  });
  return true;
}
const person = (p, extra = '') => `<div class="person">
  <button class="person-main" data-collector="${esc(p.id)}">${avatar(null, p.name)}<span><b>${esc(p.name || 'Collector')}</b><small>${p.public === false ? icon('lock') + ' Private garage' : extra || 'Public garage'}</small></span></button>
  <div class="person-actions">${relationButtons(p.id)}</div></div>`;

export default {
  title: 'Community',
  mount({ el, params, watch, go }) {
    const tab = TABS[params[0]] ? params[0] : 'friends';
    let results = null, q = '', seq = 0;
    el.innerHTML = `<header class="page-head"><div><span class="eyebrow">Collector network</span><h1>Community</h1></div>
      <nav class="seg tabs">${Object.entries(TABS).map(([k, l]) => `<a href="#/community/${k}" class="${k === tab ? 'on' : ''}" ${k === tab ? 'aria-current="page"' : ''}>${l}<span class="tab-count" data-count="${k}"></span></a>`).join('')}</nav></header>
      <div class="community-body"></div>`;
    const body = el.querySelector('.community-body');
    const search = debounce(async () => {
      const my = ++seq;
      if (q.trim().length < 2) { results = null; return draw(); }
      try { const r = await api.socialSearch(q.trim()); if (my === seq) { results = r || []; draw(); } }
      catch (e) { if (my === seq) { results = []; toast(friendly(e), 'error'); draw(); } }
    }, 250);
    function draw() {
      const s = S.social;
      el.querySelector('[data-count="requests"]').textContent = s.incoming.length ? ' ' + s.incoming.length : '';
      el.querySelector('[data-count="friends"]').textContent = s.friends.length ? ' ' + s.friends.length : '';
      if (tab === 'friends') body.innerHTML = s.friends.length ? `<div class="people">${s.friends.map((p) => person(p)).join('')}</div>` : empty('No friends yet', 'Find collectors by name and send a request.', '<a class="btn primary" href="#/community/find">Find collectors</a>');
      else if (tab === 'requests') body.innerHTML = `<h2 class="h3">Received</h2><div class="people">${s.incoming.length ? s.incoming.map((p) => person(p, 'Sent ' + relTime(p.created_at))).join('') : '<p class="muted">No pending requests.</p>'}</div>
        <h2 class="h3">Sent</h2><div class="people">${s.outgoing.length ? s.outgoing.map((p) => person(p, 'Awaiting reply')).join('') : '<p class="muted">Nothing pending.</p>'}</div>`;
      else {
        if (!body.querySelector('[data-q]')) body.innerHTML = `<label class="search big">${icon('search')}<input class="input" data-q type="search" autocomplete="off" placeholder="Collector name (2+ characters)" aria-label="Search collectors"></label><div class="people results"></div>`;
        const out = body.querySelector('.results');
        out.innerHTML = results == null ? '<p class="muted">Search by display name.</p>' : results.length ? results.map((p) => person(p)).join('') : '<p class="muted">No collectors found.</p>';
      }
    }
    draw();
    syncSocial().catch((e) => toast(friendly(e), 'error'));
    watch(['social'], draw);
    body.addEventListener('input', (e) => { if (e.target.matches('[data-q]')) { q = e.target.value; search(); } });
    body.addEventListener('click', async (e) => {
      if (await socialClick(e, () => tab === 'find' && search())) return;
      const c = e.target.closest('[data-collector]');
      if (c) go('collector/' + c.dataset.collector);
    });
    if (tab === 'find') setTimeout(() => body.querySelector('[data-q]')?.focus(), 50);
  },
};
