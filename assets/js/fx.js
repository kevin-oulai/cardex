/* Visual effects: one shared particle canvas, screen shake/flash, number tweening, card tilt. */
import { reducedMotion } from './util.js';

let canvas, g, parts = [], raf = 0, dpr = 1;
function ensure() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.id = 'fx-canvas'; canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  g = canvas.getContext('2d');
  const size = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  };
  size(); addEventListener('resize', size);
}
function loop() {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, innerWidth, innerHeight);
  g.globalCompositeOperation = 'lighter';
  parts = parts.filter((p) => (p.life -= p.decay) > 0);
  for (const p of parts) {
    p.vx *= p.drag; p.vy = p.vy * p.drag + p.gravity;
    p.x += p.vx; p.y += p.vy; p.rot += p.spin;
    g.globalAlpha = Math.min(1, p.life * 1.6);
    g.fillStyle = p.color;
    if (p.kind === 'spark') {
      g.strokeStyle = p.color; g.lineWidth = p.size * 0.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 3.2, p.y - p.vy * 3.2); g.stroke();
    } else if (p.kind === 'confetti') {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, Math.abs(Math.cos(p.rot * 1.7)) + 0.15);
      g.globalCompositeOperation = 'source-over'; g.fillRect(-p.size, -p.size * 0.45, p.size * 2, p.size * 0.9); g.restore();
      g.globalCompositeOperation = 'lighter';
    } else if (p.kind === 'ring') {
      const r = (1 - p.life) * p.size;
      g.strokeStyle = p.color; g.lineWidth = 3 * p.life + 0.5;
      g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.stroke();
    } else {
      const r = p.size * (0.6 + p.life * 0.4);
      const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.4);
      grd.addColorStop(0, p.color); grd.addColorStop(1, 'transparent');
      g.fillStyle = grd; g.beginPath(); g.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2); g.fill();
    }
  }
  g.globalAlpha = 1;
  raf = parts.length ? requestAnimationFrame(loop) : 0;
  if (!raf) g.clearRect(0, 0, innerWidth, innerHeight);
}
const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

/** Radial burst. opts: color(s), count, speed, kind ('spark'|'glow'|'confetti'), gravity, spread. */
export function burst(x, y, o = {}) {
  if (reducedMotion()) return;
  ensure();
  const colors = [].concat(o.color || '#fff');
  const n = o.count ?? 30;
  for (let i = 0; i < n; i++) {
    const a = (o.angle ?? 0) + (o.spread ?? Math.PI * 2) * (i / n - 0.5) + (Math.random() - 0.5) * 0.4;
    const s = (o.speed ?? 8) * (0.35 + Math.random() * 0.9);
    parts.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, decay: (o.decay ?? 0.018) * (0.7 + Math.random() * 0.6),
      drag: o.drag ?? 0.95, gravity: o.gravity ?? 0.12, size: (o.size ?? 3) * (0.6 + Math.random() * 0.8),
      color: colors[i % colors.length], kind: o.kind || 'spark', rot: Math.random() * 6, spin: (Math.random() - 0.5) * 0.3,
    });
  }
  if (parts.length > 1400) parts.splice(0, parts.length - 1400);
  kick();
}
export function ring(x, y, color, size = 260) {
  if (reducedMotion()) return;
  ensure();
  parts.push({ x, y, vx: 0, vy: 0, life: 1, decay: 0.03, drag: 1, gravity: 0, size, color, kind: 'ring', rot: 0, spin: 0 });
  kick();
}
export function burstAt(el, o) {
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, o);
}
export function confetti(colors) {
  if (reducedMotion()) return;
  for (let i = 0; i < 3; i++) setTimeout(() => burst(innerWidth * (0.2 + 0.3 * i), innerHeight * 0.25, {
    kind: 'confetti', color: colors, count: 46, speed: 13, gravity: 0.22, decay: 0.008, drag: 0.97, size: 5, angle: -Math.PI / 2, spread: Math.PI * 1.2,
  }), i * 110);
}
export function shake(level = 1) {
  if (reducedMotion()) return;
  const el = document.querySelector('.reveal .stage') || document.getElementById('app') || document.body;
  el.style.setProperty('--shake', level);
  el.classList.remove('shaking'); void el.offsetWidth; el.classList.add('shaking');
  setTimeout(() => el.classList.remove('shaking'), 520);
}
export function flash(color = '#fff', strength = 0.7) {
  if (reducedMotion()) strength *= 0.25;
  const f = document.createElement('div');
  f.className = 'fx-flash'; f.style.setProperty('--c', color); f.style.setProperty('--a', strength);
  document.body.append(f);
  f.addEventListener('animationend', () => f.remove());
}
/** Tween the number shown in el from its current value to `to`. */
export function countTo(el, to, ms = 700) {
  if (!el) return;
  const from = Number(el.dataset.value ?? to);
  el.dataset.value = to;
  if (from === to || reducedMotion()) { el.textContent = Number(to).toLocaleString('en-US'); return; }
  const t0 = performance.now();
  el.classList.add(to > from ? 'up' : 'down');
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (to - from) * e).toLocaleString('en-US');
    if (k < 1) requestAnimationFrame(step); else setTimeout(() => el.classList.remove('up', 'down'), 300);
  };
  requestAnimationFrame(step);
}

/* Pointer-driven 3D tilt + light position for any `.card` (delegated, mouse/pen only). */
(() => {
  const fine = matchMedia('(hover:hover) and (pointer:fine)');
  let active = null, frame = 0, pt = null;
  const clear = () => {
    if (!active) return;
    active.classList.remove('tilting');
    ['--rx', '--ry', '--mx', '--my', '--glare'].forEach((k) => active.style.removeProperty(k));
    active = null;
  };
  addEventListener('pointermove', (e) => {
    if (!fine.matches || e.pointerType === 'touch' || reducedMotion()) return;
    const card = e.target.closest?.('.card:not(.no-tilt)');
    if (card !== active) { clear(); active = card; if (card) card.classList.add('tilting'); }
    if (!card) return;
    pt = [e.clientX, e.clientY];
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!active || !pt) return;
      const b = active.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (pt[0] - b.left) / b.width)), y = Math.min(1, Math.max(0, (pt[1] - b.top) / b.height));
      const s = active.classList.contains('big') ? 16 : 10;
      active.style.setProperty('--rx', ((0.5 - y) * s).toFixed(2) + 'deg');
      active.style.setProperty('--ry', ((x - 0.5) * s * 1.2).toFixed(2) + 'deg');
      active.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      active.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      active.style.setProperty('--glare', (0.25 + Math.hypot(x - 0.5, y - 0.5)).toFixed(2));
    });
  }, { passive: true });
  addEventListener('pointerleave', clear);
  addEventListener('blur', clear);
  document.addEventListener('pointerout', (e) => { if (active && !active.contains(e.relatedTarget)) clear(); });
})();
