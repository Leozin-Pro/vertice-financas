import { el, T } from './el.js';
import { buildCard } from './card.js';
import { fmt, fmtShort, monthKey, monthLabel, currentMonthKey, addMonths, normalizeDesc } from '../../modules/parser.js';

// Card "Projeção do mês" — só faz sentido para o mês corrente.
// Recorrentes = mesma descrição normalizada em >=2 dos últimos 4 meses (ou marcada FIX),
// sem parcelamentos (esses já têm data própria dentro do mês).
export function buildProjectionCard(allTxns) {
  const mk = currentMonthKey();
  const expenses = allTxns.filter(t => t.amount < 0);
  const inMonth = expenses.filter(t => monthKey(t.date) === mk);
  const realized = inMonth.reduce((s, t) => s + (-t.amount), 0);

  const windowStart = addMonths(mk + '-01', -4).slice(0, 7);
  const seenThisMonth = new Set(inMonth.map(t => normalizeDesc(t.desc)));

  const groups = {};
  expenses.forEach(t => {
    const m = monthKey(t.date);
    if (m < windowStart || m >= mk || t.installmentTotal) return;
    const key = normalizeDesc(t.desc);
    if (!key) return;
    if (!groups[key]) groups[key] = { desc: t.desc, category: t.category, months: new Set(), total: 0, isFixed: false };
    groups[key].months.add(m);
    groups[key].total += -t.amount;
    if (t.isFixed) groups[key].isFixed = true;
  });

  const pendingItems = Object.entries(groups)
    .filter(([key, g]) => (g.months.size >= 2 || g.isFixed) && !seenThisMonth.has(key))
    .map(([, g]) => ({ ...g, est: g.total / g.months.size }))
    .sort((a, b) => b.est - a.est);

  const pendingTotal = pendingItems.reduce((s, g) => s + g.est, 0);
  if (realized === 0 && pendingTotal === 0) return null;
  const projected = realized + pendingTotal;

  const prevMk = addMonths(mk + '-01', -1).slice(0, 7);
  const prevTotal = expenses.filter(t => monthKey(t.date) === prevMk).reduce((s, t) => s + (-t.amount), 0);

  const now = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const deltaPct = prevTotal > 0 ? ((projected - prevTotal) / prevTotal) * 100 : null;

  function stat(label, value, sub, color) {
    return el('div', { style: { background: T.surfaceHi, padding: '10px 12px', borderRadius: '2px', borderLeft: '2px solid ' + color } }, [
      el('div', { className: 'label-caps', style: { marginBottom: '4px' } }, label),
      el('div', { className: 'num', style: { fontSize: '18px', fontWeight: 600, color: T.text, letterSpacing: '-0.02em' } }, value),
      el('div', { style: { fontSize: '10px', color, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' } }, sub),
    ]);
  }

  return buildCard('Projeção do mês · ' + monthLabel(mk), (host) => {
    const statsRow = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginBottom: '14px' } });
    statsRow.appendChild(stat('Realizado até hoje', fmt(realized), inMonth.length + ' lançamentos', T.danger));
    statsRow.appendChild(stat('Ainda deve cair', '~' + fmt(pendingTotal), pendingItems.length + ' itens recorrentes', T.warning));
    statsRow.appendChild(stat('Projeção de fechamento', '~' + fmt(projected),
      deltaPct == null ? daysLeft + ' dias até fechar' : (deltaPct >= 0 ? '+' : '') + deltaPct.toFixed(1) + '% vs. mês anterior',
      deltaPct != null && deltaPct > 0 ? T.warning : T.success));
    host.appendChild(statsRow);

    // Barra: sólido = realizado; hachurado = estimado a cair
    const barWrap = el('div', { style: { position: 'relative', marginBottom: pendingItems.length > 0 ? '14px' : '4px' } });
    const bar = el('div', { style: { height: '10px', background: T.surfaceHi, borderRadius: '2px', overflow: 'hidden', display: 'flex' } });
    const max = Math.max(projected, prevTotal);
    if (max > 0) {
      bar.appendChild(el('div', { style: { width: (realized / max) * 100 + '%', background: T.danger + 'cc' } }));
      bar.appendChild(el('div', { style: { width: (pendingTotal / max) * 100 + '%', background: 'repeating-linear-gradient(135deg, ' + T.warning + '66 0 4px, transparent 4px 8px)' } }));
    }
    barWrap.appendChild(bar);
    if (prevTotal > 0 && max > 0) {
      barWrap.appendChild(el('div', {
        title: 'Mês anterior fechou em ' + fmt(prevTotal),
        style: { position: 'absolute', top: '-3px', bottom: '-3px', left: Math.min(100, (prevTotal / max) * 100) + '%', width: '2px', background: T.text, opacity: 0.6 },
      }));
      barWrap.appendChild(el('div', { style: { fontSize: '10px', color: T.textMute, marginTop: '6px', letterSpacing: '0.04em' } },
        'Marcador = fechamento do mês anterior (' + fmtShort(prevTotal) + ')'));
    }
    host.appendChild(barWrap);

    if (pendingItems.length > 0) {
      const list = el('div', { style: { maxHeight: '240px', overflowY: 'auto' } });
      pendingItems.slice(0, 12).forEach(g => {
        list.appendChild(el('div', { style: { padding: '8px 0', borderBottom: '1px solid ' + T.border, display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'center' } }, [
          el('div', { style: { minWidth: 0 } }, [
            el('div', { style: { fontSize: '12px', color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' } }, [
              g.isFixed ? el('span', { style: { color: T.warning, fontSize: '9px', fontFamily: 'var(--font-mono)', background: T.warning + '15', padding: '1px 5px', borderRadius: '2px', border: '1px solid ' + T.warning + '30', flexShrink: 0 } }, 'FIX') : null,
              el('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, g.desc),
            ]),
            el('div', { style: { fontSize: '10px', color: T.textMute, marginTop: '2px' } }, g.category + ' · caiu em ' + g.months.size + ' dos últimos 4 meses'),
          ]),
          el('span', { className: 'num', style: { fontSize: '12px', color: T.warning } }, '~' + fmt(g.est)),
        ]));
      });
      host.appendChild(list);
    }
  }, { marginBottom: '12px' }, {
    collapsible: true, storageKey: 'monthProjection',
    teaser: (host) => {
      host.appendChild(el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } }, [
        el('span', { style: { fontSize: '12px', color: T.textMute } }, 'Fechamento projetado · ' + pendingItems.length + ' itens ainda por cair'),
        el('span', { className: 'num', style: { fontSize: '14px', color: T.text, fontWeight: 500 } }, '~' + fmt(projected)),
      ]));
    },
  });
}
