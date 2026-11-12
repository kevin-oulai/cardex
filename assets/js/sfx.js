/* Synthesised sound effects — no audio files, no network. Muted state persists per device. */
import { local } from './util.js';

let ctx = null, master = null, verb = null, noiseBuf = null;
let muted = local.get('cardex-muted', false);
const listeners = new Set();

function boot() {
  if (ctx) return ctx.state === 'suspended' ? ctx.resume().then(() => ctx) : Promise.resolve(ctx);
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return Promise.resolve(null);
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  // Cheap reverb: feedback delay network.
  verb = ctx.createGain(); verb.gain.value = 0.22;
  const d1 = ctx.createDelay(); d1.delayTime.value = 0.071;
  const d2 = ctx.createDelay(); d2.delayTime.value = 0.113;
  const fb = ctx.createGain(); fb.gain.value = 0.42;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
  verb.connect(d1).connect(d2).connect(lp).connect(fb).connect(d1);
  lp.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const ch = noiseBuf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  return Promise.resolve(ctx);
}
// Unlock audio on the first user gesture (autoplay policies).
['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, () => { if (!muted) boot(); }, { once: true, capture: true }));

function tone({ f = 440, f2, type = 'sine', t = 0, dur = 0.2, vol = 0.3, attack = 0.005, wet = 0, detune = 0 }) {
  const now = ctx.currentTime + t;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, now); o.detune.value = detune;
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + dur);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(vol, now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g).connect(master);
  if (wet) { const s = ctx.createGain(); s.gain.value = wet; g.connect(s).connect(verb); }
  o.start(now); o.stop(now + dur + 0.05);
}
function noise({ t = 0, dur = 0.2, vol = 0.3, type = 'bandpass', f = 1200, f2, q = 1, wet = 0 }) {
  const now = ctx.currentTime + t;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, now);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, now + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  s.connect(fl).connect(g).connect(master);
  if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w).connect(verb); }
  s.start(now, Math.random() * 0.5); s.stop(now + dur + 0.05);
}

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const SOUNDS = {
  tick: () => tone({ f: 1800, dur: 0.035, vol: 0.05, type: 'triangle' }),
  tap: () => { tone({ f: 520, f2: 760, dur: 0.07, vol: 0.09, type: 'triangle' }); },
  nav: () => { noise({ dur: 0.12, vol: 0.06, f: 2500, f2: 800, q: 2 }); tone({ f: 660, dur: 0.06, vol: 0.05, type: 'sine', t: 0.02 }); },
  toggle: () => tone({ f: 900, f2: 1300, dur: 0.06, vol: 0.08, type: 'square' }),
  error: () => { tone({ f: 160, dur: 0.18, vol: 0.18, type: 'sawtooth' }); tone({ f: 120, dur: 0.22, vol: 0.18, type: 'sawtooth', t: 0.12 }); },
  coin: () => { tone({ f: NOTE(83), dur: 0.08, vol: 0.12, type: 'square' }); tone({ f: NOTE(88), dur: 0.32, vol: 0.12, type: 'square', t: 0.07, wet: 0.5 }); },
  success: () => [72, 76, 79, 84].forEach((n, i) => tone({ f: NOTE(n), dur: 0.3, vol: 0.12, type: 'triangle', t: i * 0.06, wet: 0.6 })),
  shake: () => { for (let i = 0; i < 6; i++) noise({ t: i * 0.07, dur: 0.06, vol: 0.12, type: 'lowpass', f: 400 }); },
  tear: () => { noise({ dur: 0.45, vol: 0.5, type: 'highpass', f: 900, f2: 4000, q: 0.7 }); noise({ t: 0.05, dur: 0.3, vol: 0.3, f: 300, f2: 120, type: 'lowpass' }); tone({ f: 90, f2: 40, dur: 0.4, vol: 0.4, t: 0.05 }); },
  whoosh: () => noise({ dur: 0.35, vol: 0.22, f: 400, f2: 3000, q: 1.6 }),
  deal: () => { noise({ dur: 0.08, vol: 0.12, f: 3000, q: 3 }); tone({ f: 300, f2: 200, dur: 0.05, vol: 0.06 }); },
  flip: () => { noise({ dur: 0.18, vol: 0.2, f: 1800, f2: 600, q: 2 }); tone({ f: 200, f2: 120, dur: 0.08, vol: 0.12 }); },
  charge: (tier = 5) => {
    const dur = 0.5 + tier * 0.12;
    tone({ f: 110, f2: 880, dur, vol: 0.12, type: 'sawtooth', wet: 0.4 });
    tone({ f: 112, f2: 890, dur, vol: 0.08, type: 'sawtooth', detune: 12 });
    noise({ dur, vol: 0.14, f: 200, f2: 6000, q: 4 });
  },
  boom: () => { tone({ f: 70, f2: 30, dur: 0.9, vol: 0.6 }); noise({ dur: 0.8, vol: 0.35, type: 'lowpass', f: 1800, f2: 80 }); },
  race: () => {
    // Engine: two detuned saws through a rising low-pass, gear shift dips.
    const now = ctx.currentTime;
    const mk = (det) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = det; return o; };
    const o1 = mk(0), o2 = mk(9), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.Q.value = 6;
    [o1, o2].forEach((o) => { o.frequency.setValueAtTime(55, now); o.connect(lp); });
    const curve = [[0, 55], [0.6, 160], [0.68, 105], [1.2, 190], [1.28, 130], [1.9, 230]];
    curve.forEach(([t, f]) => [o1, o2].forEach((o) => o.frequency.linearRampToValueAtTime(f, now + t)));
    lp.frequency.setValueAtTime(300, now); lp.frequency.linearRampToValueAtTime(2400, now + 1.9);
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.16, now + 0.1);
    g.gain.setValueAtTime(0.16, now + 1.8); g.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
    lp.connect(g).connect(master);
    [o1, o2].forEach((o) => { o.start(now); o.stop(now + 2.3); });
  },
  reveal: (tier = 0) => {
    // Ascending arpeggio whose length, brightness and space scale with rarity.
    const scales = [[72], [72, 76], [72, 76, 79], [71, 74, 78, 83], [72, 76, 79, 84, 88], [72, 76, 79, 84, 88, 91], [73, 77, 80, 85, 89, 92], [74, 78, 81, 86, 90, 93, 98]];
    const notes = scales[tier] || scales[0];
    const step = tier >= 5 ? 0.075 : 0.055, wet = 0.2 + tier * 0.1;
    notes.forEach((n, i) => {
      tone({ f: NOTE(n), dur: 0.5 + tier * 0.12, vol: 0.13, type: 'triangle', t: i * step, wet });
      if (tier >= 3) tone({ f: NOTE(n + 12), dur: 0.35, vol: 0.04, type: 'sine', t: i * step + 0.01, wet });
    });
    if (tier >= 5) {
      [60, 64, 67].forEach((n) => tone({ f: NOTE(n), dur: 1.8, vol: 0.07, type: 'sawtooth', t: 0.05, attack: 0.08, wet: 0.7 }));
      for (let i = 0; i < 10; i++) tone({ f: NOTE(96 + ((i * 5) % 12)), dur: 0.14, vol: 0.03, t: 0.3 + i * 0.06, wet: 0.9 });
    }
  },
  newStamp: () => { noise({ dur: 0.07, vol: 0.4, type: 'lowpass', f: 900 }); tone({ f: 180, f2: 90, dur: 0.12, vol: 0.3 }); },
};

export function play(name, arg) {
  if (muted) return;
  boot().then((c) => { if (c && SOUNDS[name]) try { SOUNDS[name](arg); } catch { /* ignore */ } });
}
export const isMuted = () => muted;
export function setMuted(v) {
  muted = !!v; local.set('cardex-muted', muted);
  if (!muted) boot().then(() => play('toggle'));
  listeners.forEach((f) => f(muted));
}
export const onMute = (f) => listeners.add(f);
