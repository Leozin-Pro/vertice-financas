import { el, T, btnSmall } from './el.js';
import { buildCard } from './card.js';
import { STATE } from '../../modules/state.js';
import { fmt, monthLabel } from '../../modules/parser.js';
import { saveSettlements } from '../../lib/db.js';

// Card "Acerto do mês" — quanto cada pessoa deve no mês selecionado,
// com toggle acertado/pendente persistido em user_prefs.settlements.
// Chave do acerto: "<YYYY-MM>|<personId>".
export function buildSettleCard(filtered, mk, render) {
  const shares = {};
  filtered.filter(t => t.amount < 0 && t.people && t.people.length > 0).forEach(t => {
    t.people.forEach(pid => {
      shares[pid] = (shares[pid] || 0) + (-t.amount) / t.people.length;
    });
  });

  const rows = STATE.people
    .filter(p => shares[p.id] > 0)
    .map(p => ({ p, total: shares[p.id], key: mk + '|' + p.id }))
    .sort((a, b) => b.total - a.total);
  if (rows.length === 0) return null;

  if (!STATE.settlements) STATE.settlements = {};
  const settled = STATE.settlements;
  const pendingRows = rows.filter(r => !settled[r.key]);
  const totalAll = rows.reduce((s, r) => s + r.total, 0);
  const totalPending = pendingRows.reduce((s, r) => s + r.total, 0);
  const settledPct = totalAll > 0 ? ((totalAll - totalPending) / totalAll) * 100 : 0;

  function toggle(r) {
    if (settled[r.key]) delete settled[r.key];
    else settled[r.key] = new Date().toISOString().slice(0, 10);
    saveSettlements(settled).catch(() => {});
    render();
  }

  return buildCard('Acerto do mês · ' + monthLabel(mk), (host) => {
    host.appendChild(el('div', { style: { padding: '12px 14px', background: (totalPending > 0 ? T.warning : T.success) + '10', borderLeft: '3px solid ' + (totalPending > 0 ? T.warning : T.success), borderRadius: '2px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' } }, [
      el('div', {}, [
        el('div', { className: 'label-caps', style: { marginBottom: '4px' } }, 'PENDENTE DE ACERTO'),
        el('div', { className: 'num', style: { fontSize: '22px', fontWeight: 600, color: totalPending > 0 ? T.warning : T.success, letterSpacing: '-0.02em' } }, fmt(totalPending)),
      ]),
      el('div', { style: { textAlign: 'right' } }, [
        el('div', { className: 'label-caps', style: { marginBottom: '4px' } }, 'ACERTADOS'),
        el('div', { className: 'num', style: { fontSize: '22px', fontWeight: 600, color: T.text, letterSpacing: '-0.02em' } }, (rows.length - pendingRows.length) + '/' + rows.length),
      ]),
    ]));

    const bar = el('div', { style: { height: '8px', background: T.surfaceHi, borderRadius: '2px', overflow: 'hidden', marginBottom: '14px' } });
    bar.appendChild(el('div', { style: { width: settledPct + '%', height: '100%', background: T.success, transition: 'width 0.3s' } }));
    host.appendChild(bar);

    rows.forEach(r => {
      const isOk = !!settled[r.key];
      const row = el('div', { style: { padding: '10px 0', borderBottom: '1px solid ' + T.border, display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '12px', alignItems: 'center' } }, [
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 } }, [
          el('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: r.p.color, flexShrink: 0 } }),
          el('span', { style: { fontSize: '13px', color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, r.p.name),
        ]),
        el('span', { className: 'num', style: { fontSize: '13px', fontWeight: 500, color: isOk ? T.textMute : T.text, textDecoration: isOk ? 'line-through' : 'none' } }, fmt(r.total)),
        el('span', { style: { fontSize: '9px', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', padding: '2px 7px', borderRadius: '2px', background: (isOk ? T.success : T.warning) + '15', color: isOk ? T.success : T.warning, border: '1px solid ' + (isOk ? T.success : T.warning) + '30' } },
          isOk ? 'ACERTADO · ' + settled[r.key].slice(8, 10) + '/' + settled[r.key].slice(5, 7) : 'PENDENTE'),
        btnSmall(isOk ? 'DESFAZER' : '✓ ACERTAR', () => toggle(r), isOk ? null : T.success),
      ]);
      host.appendChild(row);
    });

    host.appendChild(el('div', { style: { marginTop: '10px', fontSize: '10px', color: T.textMute, letterSpacing: '0.04em' } },
      'Valores = parte de cada pessoa nos gastos divididos do mês. O acerto fica salvo por mês.'));
  }, { marginBottom: '12px' }, {
    collapsible: true, storageKey: 'settleMonth',
    teaser: (host) => {
      host.appendChild(el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } }, [
        el('span', { style: { fontSize: '12px', color: T.textMute } }, pendingRows.length > 0 ? pendingRows.length + ' pessoa' + (pendingRows.length > 1 ? 's' : '') + ' com acerto pendente' : 'Tudo acertado neste mês ✓'),
        el('span', { className: 'num', style: { fontSize: '14px', color: totalPending > 0 ? T.warning : T.success, fontWeight: 500 } }, fmt(totalPending)),
      ]));
    },
  });
}
