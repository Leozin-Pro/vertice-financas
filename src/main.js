import { supabase } from './lib/supabase.js';
import { getSession, onAuthStateChange, signInWithGoogle } from './lib/auth.js';
import { loadAll } from './lib/db.js';
import { hydrate } from './modules/state.js';
import { render, initCollapsedCards } from './ui/app.js';
import { el, T } from './ui/components/el.js';
import { showToast } from './ui/components/toast.js';

const root = document.getElementById('app-root');

// ── Auth event from tab clicks (app.js uses a DOM event to trigger re-render) ─
let currentUser = null;
document.addEventListener('app:render', () => {
  if (currentUser) render(currentUser);
});

// ── Keyboard shortcuts (global) ───────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    const inp = document.getElementById('txn-search');
    if (inp) { e.preventDefault(); inp.focus(); inp.select(); }
  }
});

// ── Auth flow ─────────────────────────────────────────────────────────────────
async function boot() {
  showLoadingScreen('Verificando sessão...');

  const session = await getSession().catch(() => null);
  if (session?.user) {
    await initDashboard(session.user);
  } else {
    showAuthScreen();
  }

  // Listen for future auth changes (OAuth redirect, logout)
  onAuthStateChange(async (session) => {
    if (session?.user) {
      await initDashboard(session.user);
    } else {
      currentUser = null;
      showAuthScreen();
    }
  });
}

async function initDashboard(user) {
  currentUser = user;
  showLoadingScreen('Carregando dados...');
  try {
    const data = await loadAll();
    hydrate(data);
    initCollapsedCards(data.collapsedCards);
    render(user);
  } catch (err) {
    showToast('Erro ao carregar dados: ' + err.message, 'error');
    showErrorScreen(err.message);
  }
}

// ── Screens ───────────────────────────────────────────────────────────────────
function showLoadingScreen(msg) {
  root.innerHTML = '';
  root.appendChild(el('div', { className: 'loading-screen' }, [
    el('div', { className: 'loading-spinner' }),
    el('div', { className: 'loading-text' }, msg || 'Carregando...'),
  ]));
}

function showAuthScreen() {
  root.innerHTML = '';
  root.appendChild(el('div', { className: 'auth-screen' }, [
    el('div', { className: 'auth-logo' }, [
      (() => {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width', '28'); svg.setAttribute('height', '28'); svg.setAttribute('viewBox', '0 0 20 20');
        svg.style.display = 'block';
        const poly = document.createElementNS(ns, 'polygon');
        poly.setAttribute('points', '10,2 18,18 2,18'); poly.setAttribute('fill', 'none');
        poly.setAttribute('stroke', T.accent); poly.setAttribute('stroke-width', '1.5');
        svg.appendChild(poly);
        return svg;
      })(),
      el('div', { className: 'auth-logo-text' }, [
        el('div', { className: 'auth-title' }, 'finance/v5'),
        el('div', { className: 'auth-subtitle' }, 'VÉRTICE · COCKPIT'),
      ]),
    ]),
    el('button', {
      className: 'auth-btn-google',
      onclick: async () => {
        try { await signInWithGoogle(); }
        catch (e) { showToast('Erro ao entrar: ' + e.message, 'error'); }
      },
    }, [
      // Google icon SVG
      (() => {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width', '18'); svg.setAttribute('height', '18'); svg.setAttribute('viewBox', '0 0 24 24');
        svg.style.display = 'block';
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', 'M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z');
        path.setAttribute('fill', '#4285F4');
        svg.appendChild(path);
        return svg;
      })(),
      'Entrar com Google',
    ]),
    el('p', { className: 'auth-desc' }, 'Seus dados ficam privados. Cada conta Google tem acesso apenas às suas próprias transações.'),
  ]));
}

function showErrorScreen(msg) {
  root.innerHTML = '';
  root.appendChild(el('div', { style: { padding: '60px 24px', textAlign: 'center' } }, [
    el('div', { style: { color: T.danger, fontSize: '14px', marginBottom: '8px' } }, 'Erro ao carregar dados'),
    el('div', { style: { color: T.textMute, fontSize: '12px', fontFamily: 'var(--font-mono)' } }, msg),
    el('button', {
      onclick: () => location.reload(),
      style: { marginTop: '20px', background: T.accent, border: 'none', color: '#0a0a0f', padding: '10px 20px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
    }, 'Recarregar'),
  ]));
}

boot();
