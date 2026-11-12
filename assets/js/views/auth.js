import * as api from '../api.js';
import { card } from '../ui.js';
import { busy } from '../ui.js';
import { friendly } from '../util.js';
import { paint } from '../photos.js';

export default {
  title: 'Sign in',
  mount({ el }) {
    let mode = 'in';
    el.innerHTML = `<section class="auth">
      <div class="auth-fan" aria-hidden="true">
        ${card(25, { finish: 'Holographic', size: 'md' })}${card(79, { finish: 'Foil', size: 'md' })}${card(0, { size: 'md' })}
      </div>
      <div class="auth-panel">
        <div class="logo xl"><span>CAR</span><em>DEX</em></div>
        <p class="lead">Rip boosters. Collect 192 real cars. Trade them, then race the daily boss.</p>
        <form class="stack" novalidate>
          <label class="field"><span>Email</span><input class="input" name="email" type="email" autocomplete="email" required></label>
          <label class="field"><span>Password</span><input class="input" name="password" type="password" autocomplete="current-password" minlength="8" required></label>
          <p class="form-msg" role="status" aria-live="polite"></p>
          <button class="btn primary lg" type="submit" data-submit>Sign in</button>
          <div class="row between small">
            <button type="button" class="link" data-mode>New here? Create an account</button>
            <button type="button" class="link" data-forgot>Forgot password?</button>
          </div>
        </form>
        <p class="fine">Free to play. No real-money purchases. By creating an account you accept the <a href="./terms.html">terms</a> and <a href="./privacy.html">privacy policy</a>.</p>
      </div>
    </section>`;
    paint(el);
    const form = el.querySelector('form'), msg = el.querySelector('.form-msg'), submit = el.querySelector('[data-submit]');
    const say = (t, kind = '') => { msg.textContent = t; msg.className = 'form-msg ' + kind; };
    const setMode = (m) => {
      mode = m;
      submit.textContent = m === 'in' ? 'Sign in' : 'Create account';
      el.querySelector('[data-mode]').textContent = m === 'in' ? 'New here? Create an account' : 'Have an account? Sign in';
      form.password.autocomplete = m === 'in' ? 'current-password' : 'new-password';
      say('');
    };
    el.querySelector('[data-mode]').addEventListener('click', () => setMode(mode === 'in' ? 'up' : 'in'));
    el.querySelector('[data-forgot]').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      const email = form.email.value.trim();
      if (!form.email.checkValidity() || !email) return say('Enter your email above first.', 'error');
      try { await api.auth.reset(email); say('Check your inbox for a reset link.', 'ok'); } catch (er) { say(friendly(er), 'error'); }
    }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = form.email.value.trim(), password = form.password.value;
      if (!email || !form.email.checkValidity()) return say('Enter a valid email.', 'error');
      if (password.length < 8) return say('Passwords are at least 8 characters.', 'error');
      busy(submit, async () => {
        try {
          if (mode === 'in') { say('Signing in…'); await api.auth.signIn(email, password); say('Loading your garage…', 'ok'); }
          else {
            const data = await api.auth.signUp(email, password);
            if (!data.session) setMode('in');
            say(data.session ? 'Account created — loading…' : 'Almost there: confirm the link we emailed you, then sign in.', 'ok');
          }
        } catch (er) { say(friendly(er), 'error'); }
      });
    });
  },
};
