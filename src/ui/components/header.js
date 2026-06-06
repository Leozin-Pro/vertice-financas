import { el, T, btnSmall } from './el.js';
import { STATE } from '../../modules/state.js';
import { signOut } from '../../lib/auth.js';
import { showToast } from './toast.js';
import {
  deleteAllTransactions, deleteAllPeople, upsertPerson,
  insertTransactions,
} from '../../lib/db.js';

export function buildHeader(user, render) {
  const hasData = STATE.pix.length + STATE.credit.length > 0;

  return el('div', {
    style: {
      padding: '18px 24px', background: T.surface,
      borderBottom: '1px solid ' + T.border,
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
    },
  }, [
    el('div', { style: { display: 'flex', alignItems: 'center', gap: '14px' } }, [
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
        (() => {
          const ns = 'http://www.w3.org/2000/svg';
          const svg = document.createElementNS(ns, 'svg');
          svg.setAttribute('width', '18'); svg.setAttribute('height', '18');
          svg.setAttribute('viewBox', '0 0 20 20');
          svg.style.display = 'block';
          const poly = document.createElementNS(ns, 'polygon');
          poly.setAttribute('points', '10,2 18,18 2,18');
          poly.setAttribute('fill', 'none');
          poly.setAttribute('stroke', T.accent);
          poly.setAttribute('stroke-width', '1.5');
          svg.appendChild(poly);
          return svg;
        })(),
        el('div', { style: { display: 'flex', flexDirection: 'column', gap: '1px' } }, [
          el('div', { className: 'label-caps', style: { color: T.accent, fontSize: '9px', letterSpacing: '0.15em' } }, 'VÉRTICE · COCKPIT'),
          el('div', { style: { fontFamily: 'var(--font-mono)', fontSize: '13px', color: T.text, fontWeight: 500, letterSpacing: '-0.01em' } }, 'finance/v5'),
        ]),
      ]),
      el('div', { style: { width: '1px', height: '24px', background: T.border } }),
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } }, [
        el('div', { className: 'label-caps' }, hasData ? 'STATUS' : 'AGUARDANDO DADOS'),
        el('div', { style: { fontSize: '12px', color: T.textDim, fontFamily: 'var(--font-mono)' } },
          hasData
            ? (STATE.pix.length + STATE.credit.length) + ' transações · ' + STATE.people.length + ' perfis'
            : 'sem entradas ainda'),
      ]),
    ]),

    el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' } }, [
      // User avatar + name
      user ? el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' } }, [
        user.user_metadata?.avatar_url
          ? (() => {
              const img = document.createElement('img');
              img.src = user.user_metadata.avatar_url;
              img.style.cssText = 'width:24px;height:24px;border-radius:50%;border:1px solid ' + T.borderHi;
              return img;
            })()
          : null,
        el('span', { style: { fontSize: '11px', color: T.textDim, fontFamily: 'var(--font-mono)' } },
          user.user_metadata?.name || user.email || ''),
      ]) : null,

      hasData ? btnSmall('EXPORT BACKUP', exportBackup, T.accent) : null,
      btnSmall('IMPORT BACKUP', () => importBackup(render)),
      hasData ? btnSmall('RESET', () => resetAll(render), T.danger) : null,
      btnSmall('LOGOUT', async () => {
        try { await signOut(); } catch (e) { showToast('Erro ao sair: ' + e.message, 'error'); }
      }, T.textMute),
    ]),
  ]);
}

function exportBackup() {
  const data = { pix: STATE.pix, credit: STATE.credit, people: STATE.people, customCategories: STATE.customCategories };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'financas_backup_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importBackup(render) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      try {
        const obj = JSON.parse(r.result);
        if (!obj.pix || !obj.credit) { alert('Arquivo inválido.'); return; }
        if (!obj.people) obj.people = STATE.people;
        obj.pix.forEach(t => { if (!t.people) t.people = []; if (t.dateOnlyMonth === undefined) t.dateOnlyMonth = false; });
        obj.credit.forEach(t => { if (!t.people) t.people = []; if (t.dateOnlyMonth === undefined) t.dateOnlyMonth = false; });

        // Clear DB then re-insert
        await deleteAllTransactions();
        await deleteAllPeople();
        STATE.pix = obj.pix;
        STATE.credit = obj.credit;
        STATE.people = obj.people;
        STATE.customCategories = obj.customCategories || [];

        await Promise.all(STATE.people.map(p => upsertPerson(p)));
        if (STATE.pix.length) await insertTransactions(STATE.pix, 'pix');
        if (STATE.credit.length) await insertTransactions(STATE.credit, 'credit');
        showToast('Backup importado com sucesso.', 'success');
        render();
      } catch (err) { alert('Erro: ' + err.message); }
    };
    r.readAsText(f);
  };
  input.click();
}

async function resetAll(render) {
  if (!confirm('Apagar todos os lançamentos e pessoas?')) return;
  await deleteAllTransactions();
  await deleteAllPeople();
  STATE.pix = []; STATE.credit = [];
  STATE.people = []; STATE.customCategories = [];
  render();
}
