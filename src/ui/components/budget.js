import { el, T } from './el.js';
import { buildCard } from './card.js';
import { STATE } from '../../modules/state.js';
import { fmt, monthLabel } from '../../modules/parser.js';
import { getAllCategories, categoryColor } from '../../modules/categorize.js';
import { saveBudgets } from '../../lib/db.js';

// ── Card na Visão geral: progresso gasto × teto no mês selecionado ────────────
export function buildBudgetCard(filtered, mk) {
  const budgets = STATE.budgets || {};
  const entries = Object.entries(budgets).filter(([, v]) => v > 0);
  if (entries.length === 0) return null;

  const spentByCat = {};
  filtered.filter(t => t.amount < 0).forEach(t => {
    spentByCat[t.category] = (spentByCat[t.category] || 0) + (-t.amount);
  });

  const rows = entries
    .map(([cat, limit]) => ({ cat, limit, spent: spentByCat[cat] || 0, pct: ((spentByCat[cat] || 0) / limit) * 100 }))
    .sort((a, b) => b.pct - a.pct);

  const totLimit = rows.reduce((s, r) => s + r.limit, 0);
  const totSpent = rows.reduce((s, r) => s + r.spent, 0);
  const overCount = rows.filter(r => r.pct >= 100).length;

  const barColor = (pct) => pct >= 100 ? T.danger : pct >= 75 ? T.warning : T.success;

  return buildCard('Orçamento do mês · ' + monthLabel(mk), (host) => {
    host.appendChild(el('div', { style: { padding: '12px 14px', background: barColor((totSpent / totLimit) * 100) + '10', borderLeft: '3px solid ' + barColor((totSpent / totLimit) * 100), borderRadius: '2px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' } }, [
      el('div', {}, [
        el('div', { className: 'label-caps', style: { marginBottom: '4px' } }, 'GASTO NAS CATEGORIAS COM TETO'),
        el('div', { className: 'num', style: { fontSize: '22px', fontWeight: 600, color: T.text, letterSpacing: '-0.02em' } }, fmt(totSpent) + ' / ' + fmt(totLimit)),
      ]),
      el('div', { style: { textAlign: 'right' } }, [
        el('div', { className: 'label-caps', style: { marginBottom: '4px' } }, 'SITUAÇÃO'),
        el('div', { className: 'num', style: { fontSize: '22px', fontWeight: 600, color: barColor((totSpent / totLimit) * 100), letterSpacing: '-0.02em' } },
          overCount > 0 ? overCount + ' estourada' + (overCount > 1 ? 's' : '') : ((totSpent / totLimit) * 100).toFixed(0) + '%'),
      ]),
    ]));

    rows.forEach(r => {
      const color = barColor(r.pct);
      const catColor = categoryColor(r.cat);
      host.appendChild(el('div', { style: { marginBottom: '10px' } }, [
        el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', marginBottom: '4px' } }, [
          el('span', { style: { fontSize: '12px', color: T.text, display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 } }, [
            catColor ? el('span', { style: { width: '8px', height: '8px', borderRadius: '2px', background: catColor, flexShrink: 0 } }) : null,
            el('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, r.cat),
          ]),
          el('span', { className: 'num', style: { fontSize: '11px', color: T.textDim, flexShrink: 0 } }, [
            el('span', { style: { color: color, fontWeight: 500 } }, fmt(r.spent)),
            ' / ' + fmt(r.limit) + ' · ',
            el('span', { style: { color: color, fontWeight: 500 } }, r.pct.toFixed(0) + '%'),
          ]),
        ]),
        (() => {
          const bar = el('div', { style: { height: '6px', background: T.surfaceHi, borderRadius: '2px', overflow: 'hidden' } });
          bar.appendChild(el('div', { style: { width: Math.min(100, r.pct) + '%', height: '100%', background: color, transition: 'width 0.3s' } }));
          return bar;
        })(),
        r.pct >= 100 ? el('div', { style: { fontSize: '10px', color: T.danger, marginTop: '3px', letterSpacing: '0.04em' } }, 'Estourou ' + fmt(r.spent - r.limit) + ' acima do teto') : null,
      ]));
    });
  }, { marginBottom: '12px' }, {
    collapsible: true, storageKey: 'budgetMonth',
    teaser: (host) => {
      host.appendChild(el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } }, [
        el('span', { style: { fontSize: '12px', color: T.textMute } }, rows.length + ' categoria' + (rows.length > 1 ? 's' : '') + ' com teto' + (overCount > 0 ? ' · ' + overCount + ' estourada' + (overCount > 1 ? 's' : '') : '')),
        el('span', { className: 'num', style: { fontSize: '14px', color: barColor((totSpent / totLimit) * 100), fontWeight: 500 } }, fmt(totSpent) + ' / ' + fmt(totLimit)),
      ]));
    },
  });
}

// ── Config na aba Categorias: definir teto mensal por categoria ───────────────
export function buildBudgetConfig(render) {
  const budgets = STATE.budgets || {};
  if (!STATE.budgets) STATE.budgets = budgets;
  const cats = getAllCategories(false);
  const definedCount = Object.values(budgets).filter(v => v > 0).length;

  const card = el('div', {
    style: { background: T.surface, border: '1px solid ' + T.border, borderRadius: '4px', padding: '14px 16px', marginBottom: '16px' },
  });
  card.appendChild(el('div', {
    style: { fontSize: '12px', color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontWeight: 500 },
  }, 'Orçamento mensal por categoria · ' + definedCount + ' com teto'));
  card.appendChild(el('div', { style: { fontSize: '11px', color: T.textMute, marginBottom: '12px', lineHeight: 1.5 } },
    'Defina um teto de gasto por mês. As categorias com teto aparecem com barra de progresso na Visão geral.'));

  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' } });
  const sorted = [...cats].sort((a, b) => {
    const ba = budgets[a] > 0 ? 0 : 1, bb = budgets[b] > 0 ? 0 : 1;
    return ba - bb || a.localeCompare(b);
  });

  sorted.forEach(cat => {
    const has = budgets[cat] > 0;
    const inputId = 'budget-' + cat.replace(/\W/g, '');
    const row = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: T.surfaceHi, borderRadius: '2px', borderLeft: '2px solid ' + (has ? T.accent : T.border) } });
    row.appendChild(el('label', { for: inputId, style: { flex: 1, fontSize: '12px', color: has ? T.text : T.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' } }, cat));
    row.appendChild(el('span', { style: { fontSize: '10px', color: T.textMute, fontFamily: 'var(--font-mono)' } }, 'R$'));
    row.appendChild(el('input', {
      id: inputId, type: 'number', min: '0', step: '50', placeholder: '—',
      value: has ? budgets[cat] : '',
      onchange: (e) => {
        const v = parseFloat(e.target.value);
        if (v > 0) STATE.budgets[cat] = v;
        else delete STATE.budgets[cat];
        saveBudgets(STATE.budgets).catch(() => {});
        render();
      },
      style: { width: '90px', background: T.surface, color: T.text, border: '1px solid ' + T.border, borderRadius: '2px', padding: '5px 8px', fontSize: '12px', fontFamily: 'var(--font-mono)', outline: 'none', textAlign: 'right' },
    }));
    grid.appendChild(row);
  });
  card.appendChild(grid);
  return card;
}
