import { el, T } from '../components/el.js';
import { buildCard } from '../components/card.js';
import { kpi } from '../components/kpi.js';
import { openTxnEditor } from '../components/txn-editor.js';
import { buildSettleCard } from '../components/settle.js';
import { buildProjectionCard } from '../components/projection.js';
import { buildBudgetCard } from '../components/budget.js';
import { STATE } from '../../modules/state.js';
import { fmt, fmtShort, monthLabel, monthKey, currentMonthKey, txnDateLabel, normalizeDesc } from '../../modules/parser.js';
import { deleteTransaction, deleteTransactionGroup } from '../../lib/db.js';

export function buildDashboard(filtered, unfiltered, globalPersonFilter, globalMonthFilter, render) {
  const wrap = el('div', { style: { padding: '20px 24px', background: T.bg } });

  const expenses = filtered.filter(t => t.amount < 0);
  const incomes = filtered.filter(t => t.amount > 0);
  const totalOut = expenses.reduce((s, t) => s + t.amount, 0);
  const totalIn = incomes.reduce((s, t) => s + t.amount, 0);
  const net = totalIn + totalOut;

  const byMonth = {};
  filtered.forEach(t => {
    const m = monthKey(t.date);
    if (!byMonth[m]) byMonth[m] = { in: 0, out: 0, byCategory: {} };
    if (t.amount < 0) {
      byMonth[m].out += -t.amount;
      byMonth[m].byCategory[t.category] = (byMonth[m].byCategory[t.category] || 0) + (-t.amount);
    } else byMonth[m].in += t.amount;
  });
  const months = Object.keys(byMonth).sort();

  const byCat = {};
  expenses.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + (-t.amount); });
  const catSorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  const byPerson = {};
  STATE.people.forEach(p => { byPerson[p.id] = { person: p, total: 0, count: 0 }; });
  byPerson['unassigned'] = { person: { name: 'Não atribuído', color: T.textMute }, total: 0, count: 0 };
  unfiltered.filter(t => t.amount < 0).forEach(t => {
    const ppl = t.people && t.people.length > 0 ? t.people : ['unassigned'];
    ppl.forEach(pid => {
      if (!byPerson[pid]) byPerson[pid] = { person: { name: '?', color: T.textMute }, total: 0, count: 0 };
      byPerson[pid].total += (-t.amount) / ppl.length;
      byPerson[pid].count += 1;
    });
  });
  const personSorted = Object.entries(byPerson).filter(([, v]) => v.total > 0).sort((a, b) => b[1].total - a[1].total);

  let monthDelta = null;
  if (months.length >= 2) {
    const last = byMonth[months[months.length - 1]].out;
    const prev = byMonth[months[months.length - 2]].out;
    monthDelta = { last, prev, change: last - prev, pct: prev > 0 ? (last - prev) / prev * 100 : 0 };
  }

  const recurringMap = {};
  expenses.forEach(t => {
    if (t.installmentTotal) return;
    const key = normalizeDesc(t.desc);
    if (!recurringMap[key]) recurringMap[key] = { desc: t.desc, months: new Set(), total: 0, count: 0, category: t.category };
    recurringMap[key].months.add(monthKey(t.date));
    recurringMap[key].total += -t.amount;
    recurringMap[key].count += 1;
  });
  const recurring = Object.values(recurringMap).filter(r => r.months.size >= 2).sort((a, b) => b.total - a.total);

  const fixedExpenses = expenses.filter(t => t.isFixed);
  const totalFixed = fixedExpenses.reduce((s, t) => s + t.amount, 0);
  const fixedPct = totalOut < 0 ? (totalFixed / totalOut) * 100 : 0;
  const fixedGrouped = {};
  fixedExpenses.forEach(t => {
    const key = normalizeDesc(t.desc);
    if (!fixedGrouped[key]) fixedGrouped[key] = { desc: t.desc, total: 0, count: 0, category: t.category };
    fixedGrouped[key].total += -t.amount; fixedGrouped[key].count += 1;
  });
  const fixedList = Object.values(fixedGrouped).sort((a, b) => b.total - a.total);

  const todayKey = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
  const futureInstallments = unfiltered.filter(t => t.installmentTotal && t.amount < 0 && monthKey(t.date) >= todayKey).sort((a, b) => a.date.localeCompare(b.date));
  const futureByMonth = {};
  futureInstallments.forEach(t => {
    const m = monthKey(t.date);
    if (!futureByMonth[m]) futureByMonth[m] = 0;
    futureByMonth[m] += -t.amount;
  });

  const growthAlerts = [];
  if (months.length >= 2) {
    const last = byMonth[months[months.length - 1]].byCategory;
    const prev = byMonth[months[months.length - 2]].byCategory;
    const allCats = new Set([...Object.keys(last), ...Object.keys(prev)]);
    allCats.forEach(c => {
      const l = last[c] || 0, p = prev[c] || 0;
      if (l > 50 && (l - p) > 30 && (p === 0 || (l - p) / Math.max(p, 1) > 0.25)) {
        growthAlerts.push({ cat: c, last: l, prev: p, delta: l - p, pct: p > 0 ? (l - p) / p * 100 : null });
      }
    });
    growthAlerts.sort((a, b) => b.delta - a.delta);
  }

  let filterLabel = '';
  if (globalPersonFilter !== 'all') {
    if (globalPersonFilter === 'unassigned') filterLabel = ' · Não atribuído';
    else { const p = STATE.people.find(pp => pp.id === globalPersonFilter); filterLabel = p ? ' · ' + p.name : ''; }
  }

  // ── KPIs ──
  const kpiRow = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' } });
  kpiRow.appendChild(kpi('Total gasto' + filterLabel, fmt(-totalOut), expenses.length + ' lançamentos', T.danger, true));
  if (totalIn > 0) kpiRow.appendChild(kpi('Total recebido', fmt(totalIn), incomes.length + ' entradas', T.success));
  kpiRow.appendChild(kpi('Saldo do período', fmt(net), net >= 0 ? 'positivo' : 'negativo', net >= 0 ? T.success : T.danger));
  if (fixedExpenses.length > 0) kpiRow.appendChild(kpi('Despesas fixas', fmt(-totalFixed), fixedPct.toFixed(1) + '% do total gasto', T.warning));
  if (monthDelta) {
    const sign = monthDelta.change >= 0 ? '+' : '';
    kpiRow.appendChild(kpi('Vs. mês anterior', sign + fmt(monthDelta.change).replace('R$ ', 'R$ '), sign + monthDelta.pct.toFixed(1) + '% em gastos', monthDelta.change > 0 ? T.warning : T.success));
  }
  wrap.appendChild(kpiRow);

  // ── PROJEÇÃO DO MÊS (só no mês corrente, sem filtro de pessoa) ──
  if (globalPersonFilter === 'all' && globalMonthFilter === currentMonthKey()) {
    const proj = buildProjectionCard(unfiltered);
    if (proj) wrap.appendChild(proj);
  }

  // ── ORÇAMENTO DO MÊS ──
  if (globalPersonFilter === 'all' && globalMonthFilter !== 'all') {
    const budget = buildBudgetCard(filtered, globalMonthFilter);
    if (budget) wrap.appendChild(budget);
  }

  // ── ACERTO DO MÊS ──
  if (globalPersonFilter === 'all' && globalMonthFilter !== 'all' && STATE.people.length > 0) {
    const settle = buildSettleCard(filtered, globalMonthFilter, render);
    if (settle) wrap.appendChild(settle);
  }

  // ── COMPROMISSOS FUTUROS ──
  if (Object.keys(futureByMonth).length > 0) {
    wrap.appendChild(buildCard('💳 Compromissos futuros · parcelas a vencer', (host) => {
      const totalFuture = Object.values(futureByMonth).reduce((s, v) => s + v, 0);
      host.appendChild(el('div', { style: { padding: '10px 12px', background: T.warning + '12', borderRadius: '4px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' } }, [
        el('div', { style: { fontSize: '12px', color: T.textDim } }, 'Total comprometido em parcelas futuras: '),
        el('div', { style: { fontSize: '15px', fontWeight: 500, color: T.warning, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' } }, fmt(-totalFuture)),
      ]));
      const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' } });
      Object.entries(futureByMonth).sort().forEach(([m, v]) => {
        grid.appendChild(el('div', { style: { background: T.surfaceHi, padding: '10px 12px', borderRadius: '4px', borderLeft: '3px solid ' + T.warning } }, [
          el('div', { style: { fontSize: '10px', color: T.textMute, textTransform: 'uppercase', letterSpacing: '0.05em' } }, monthLabel(m)),
          el('div', { style: { fontSize: '13px', color: T.text, fontWeight: 500, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', marginTop: '2px' } }, fmt(-v)),
        ]));
      });
      host.appendChild(grid);
    }, { marginBottom: '12px' }, {
      collapsible: true, defaultCollapsed: true, storageKey: 'futureCommitments',
      teaser: (host) => {
        const totalFuture = Object.values(futureByMonth).reduce((s, v) => s + v, 0);
        const monthCount = Object.keys(futureByMonth).length;
        host.appendChild(el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } }, [
          el('span', { style: { fontSize: '12px', color: T.textMute } }, monthCount + ' mes' + (monthCount > 1 ? 'es' : '') + ' com parcelas a vencer'),
          el('span', { className: 'num', style: { fontSize: '14px', color: T.warning, fontWeight: 500 } }, fmt(-totalFuture)),
        ]));
      },
    }));
  }

  // ── DESPESAS FIXAS ──
  if (fixedExpenses.length > 0) {
    wrap.appendChild(buildCard('💰 Despesas fixas' + (filterLabel || ' · no período'), (host) => {
      host.appendChild(el('div', { style: { padding: '12px 14px', background: T.warning + '10', borderLeft: '3px solid ' + T.warning, borderRadius: '2px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' } }, [
        el('div', {}, [
          el('div', { className: 'label-caps', style: { marginBottom: '4px' } }, 'COMPROMETIDO COM FIXOS'),
          el('div', { className: 'num', style: { fontSize: '22px', fontWeight: 600, color: T.text, letterSpacing: '-0.02em' } }, fmt(-totalFixed)),
          el('div', { style: { fontSize: '11px', color: T.textDim, marginTop: '2px' } }, fixedExpenses.length + ' lançamentos · ' + fixedList.length + ' itens únicos'),
        ]),
        el('div', { style: { textAlign: 'right' } }, [
          el('div', { className: 'label-caps', style: { marginBottom: '4px' } }, '% DO TOTAL GASTO'),
          el('div', { className: 'num', style: { fontSize: '22px', fontWeight: 600, color: T.warning, letterSpacing: '-0.02em' } }, fixedPct.toFixed(1) + '%'),
          el('div', { style: { fontSize: '11px', color: T.textDim, marginTop: '2px' } }, fixedPct > 60 ? 'alto comprometimento' : fixedPct > 40 ? 'comprometimento médio' : 'sob controle'),
        ]),
      ]));
      if (totalOut < 0) {
        const bar = el('div', { style: { height: '8px', background: T.surfaceHi, borderRadius: '2px', overflow: 'hidden', marginBottom: '14px', display: 'flex' } });
        bar.appendChild(el('div', { style: { width: Math.min(100, fixedPct) + '%', background: T.warning, transition: 'width 0.3s' } }));
        host.appendChild(bar);
      }
      const list = el('div', { style: { maxHeight: '280px', overflowY: 'auto' } });
      fixedList.slice(0, 20).forEach(r => {
        list.appendChild(el('div', { style: { padding: '9px 0', borderBottom: '1px solid ' + T.border, display: 'grid', gridTemplateColumns: '1fr 90px 110px', gap: '10px', alignItems: 'center' } }, [
          el('div', { style: { minWidth: 0 } }, [
            el('div', { style: { fontSize: '12px', color: T.text, marginBottom: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' } }, r.desc),
            el('div', { style: { fontSize: '10px', color: T.textMute } }, r.category),
          ]),
          el('div', { className: 'label-caps', style: { textAlign: 'right', color: T.textMute, fontSize: '10px' } }, r.count + '×'),
          el('div', { className: 'num', style: { fontSize: '13px', color: T.warning, textAlign: 'right', fontWeight: 500 } }, fmt(-r.total)),
        ]));
      });
      host.appendChild(list);
    }, { marginBottom: '12px' }, {
      collapsible: true, defaultCollapsed: true, storageKey: 'fixedExpenses',
      teaser: (host) => {
        host.appendChild(el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } }, [
          el('span', { style: { fontSize: '12px', color: T.textMute } }, fixedList.length + ' item' + (fixedList.length > 1 ? 's' : '') + ' · ' + fixedPct.toFixed(1) + '% do total gasto'),
          el('span', { className: 'num', style: { fontSize: '14px', color: T.warning, fontWeight: 500 } }, fmt(-totalFixed)),
        ]));
      },
    }));
  }

  // ── GASTOS POR PESSOA ──
  if (globalPersonFilter === 'all' && personSorted.length > 0) {
    wrap.appendChild(buildCard('Gastos por pessoa · comparativo', (host) => {
      const c = el('canvas', { role: 'img', 'aria-label': 'Gráfico de barras de gastos por pessoa' });
      host.appendChild(el('div', { style: { position: 'relative', height: Math.max(140, personSorted.length * 44 + 60) + 'px', width: '100%' } }, c));
      setTimeout(() => {
        new Chart(c.getContext('2d'), {
          type: 'bar',
          data: {
            labels: personSorted.map(([, v]) => v.person.name),
            datasets: [{ label: 'Gasto', data: personSorted.map(([, v]) => v.total), backgroundColor: personSorted.map(([, v]) => v.person.color + 'cc'), borderColor: personSorted.map(([, v]) => v.person.color), borderWidth: 1.5, borderRadius: 4 }],
          },
          options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { backgroundColor: T.surfaceHi, titleColor: T.text, bodyColor: T.textDim, borderColor: T.border, borderWidth: 1, callbacks: { label: (ctx) => ' ' + fmt(-ctx.parsed.x) } } }, scales: { x: { ticks: { color: T.textMute, font: { size: 10 }, callback: (v) => fmtShort(v) }, grid: { color: T.border } }, y: { ticks: { color: T.text, font: { size: 12 } }, grid: { display: false } } } },
        });
      }, 0);
      const stats = el('div', { style: { marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' } });
      const grandTotal = personSorted.reduce((s, [, v]) => s + v.total, 0);
      personSorted.forEach(([, v]) => {
        const pct = grandTotal > 0 ? (v.total / grandTotal * 100).toFixed(1) : 0;
        stats.appendChild(el('div', { style: { background: T.surfaceHi, padding: '10px 12px', borderRadius: '4px', borderLeft: '3px solid ' + v.person.color } }, [
          el('div', { style: { fontSize: '11px', color: T.textMute, marginBottom: '2px' } }, v.person.name),
          el('div', { style: { fontSize: '14px', color: T.text, fontWeight: 500, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' } }, fmt(-v.total)),
          el('div', { style: { fontSize: '10px', color: T.textDim, marginTop: '2px' } }, pct + '% do total'),
        ]));
      });
      host.appendChild(stats);
    }, { marginBottom: '12px' }));
  }

  // ── TENDÊNCIA + TIPOLOGIA ──
  const row1 = el('div', { className: 'ov-grid', style: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px', marginBottom: '12px' } });

  row1.appendChild(buildCard('Tendência mensal · entradas vs. saídas' + filterLabel, (host) => {
    const c = el('canvas', { role: 'img', 'aria-label': 'Entradas e saídas por mês' });
    host.appendChild(el('div', { style: { position: 'relative', height: '240px', width: '100%' } }, c));
    setTimeout(() => {
      const hasIn = months.some(m => byMonth[m].in > 0);
      new Chart(c.getContext('2d'), {
        type: 'bar',
        data: { labels: months.map(monthLabel), datasets: [{ label: 'Saídas', data: months.map(m => byMonth[m].out), backgroundColor: T.danger + 'cc', borderRadius: 4 }, ...(hasIn ? [{ label: 'Entradas', data: months.map(m => byMonth[m].in), backgroundColor: T.success + 'cc', borderRadius: 4 }] : [])] },
        options: chartOpts({ legendPos: 'top' }),
      });
    }, 0);
  }));

  row1.appendChild(buildCard('Tipologia · gastos por categoria' + filterLabel, (host) => {
    if (catSorted.length === 0) {
      host.appendChild(el('div', { style: { padding: '40px 12px', textAlign: 'center', color: T.textMute, fontSize: '12px' } }, 'Nenhuma saída com este filtro.'));
      return;
    }
    const c = el('canvas', { role: 'img', 'aria-label': 'Categorias de gasto' });
    host.appendChild(el('div', { style: { position: 'relative', height: '240px', width: '100%' } }, c));
    setTimeout(() => {
      const top = catSorted.slice(0, 8), otherSum = catSorted.slice(8).reduce((s, [, v]) => s + v, 0);
      const labels = top.map(([k]) => k).concat(otherSum > 0 ? ['Demais categorias'] : []);
      const data = top.map(([, v]) => v).concat(otherSum > 0 ? [otherSum] : []);
      new Chart(c.getContext('2d'), {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: T.palette, borderColor: T.surface, borderWidth: 3, hoverBorderColor: T.surfaceHi, hoverOffset: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: true, position: 'right', labels: { color: T.text, font: { size: 11, family: 'JetBrains Mono' }, boxWidth: 8, boxHeight: 8, padding: 9, usePointStyle: false, generateLabels: (chart) => { const d = chart.data; const total = d.datasets[0].data.reduce((a, b) => a + b, 0); return d.labels.map((l, i) => ({ text: l + ' ' + ((d.datasets[0].data[i] / total) * 100).toFixed(0) + '%', fillStyle: d.datasets[0].backgroundColor[i], strokeStyle: d.datasets[0].backgroundColor[i], fontColor: T.text, index: i })); } } }, tooltip: { callbacks: { label: (ctx) => ' ' + ctx.label + ': ' + fmt(ctx.parsed) } } } },
      });
    }, 0);
  }));
  wrap.appendChild(row1);

  // ── EVOLUÇÃO POR CATEGORIA ──
  if (months.length >= 2 && catSorted.length > 0) {
    wrap.appendChild(buildCard('Evolução por categoria · mês a mês' + filterLabel, (host) => {
      const c = el('canvas', { role: 'img', 'aria-label': 'Área empilhada por categoria' });
      host.appendChild(el('div', { style: { position: 'relative', height: '260px', width: '100%' } }, c));
      setTimeout(() => {
        const topCats = catSorted.slice(0, 6).map(([k]) => k);
        const datasets = topCats.map((cat, i) => ({ label: cat, data: months.map(m => byMonth[m].byCategory[cat] || 0), backgroundColor: T.palette[i] + 'aa', borderColor: T.palette[i], borderWidth: 1.5, fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: T.palette[i] }));
        new Chart(c.getContext('2d'), { type: 'line', data: { labels: months.map(monthLabel), datasets }, options: chartOpts({ stacked: true, legendPos: 'top' }) });
      }, 0);
    }, { marginTop: '12px' }));
  }

  // ── RECORRENTES + ALERTAS ──
  const row3 = el('div', { className: 'ov-grid', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' } });

  row3.appendChild(buildCard('Gastos recorrentes detectados' + filterLabel, (host) => {
    if (recurring.length === 0) { host.appendChild(el('div', { style: { padding: '20px', color: T.textMute, fontSize: '13px', textAlign: 'center' } }, 'Nenhum gasto recorrente identificado ainda.')); return; }
    const list = el('div', { style: { maxHeight: '320px', overflowY: 'auto' } });
    recurring.slice(0, 15).forEach(r => {
      const avg = r.total / r.count;
      list.appendChild(el('div', { style: { padding: '10px 0', borderBottom: '1px solid ' + T.border, display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'center' } }, [
        el('div', {}, [
          el('div', { style: { fontSize: '13px', color: T.text, marginBottom: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' } }, r.desc),
          el('div', { style: { fontSize: '11px', color: T.textMute } }, r.category + ' · ' + r.months.size + ' meses · ~' + fmtShort(avg) + '/mês'),
        ]),
        el('div', { style: { textAlign: 'right' } }, [
          el('div', { style: { fontSize: '13px', color: T.warning, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' } }, fmt(-r.total)),
          el('div', { style: { fontSize: '10px', color: T.textMute, marginTop: '2px' } }, 'total'),
        ]),
      ]));
    });
    host.appendChild(list);
    host.appendChild(el('div', { style: { marginTop: '10px', padding: '10px', background: T.warning + '15', borderRadius: '4px', fontSize: '11px', color: T.warning, borderLeft: '3px solid ' + T.warning } }, '💡 Estes são candidatos a "vampiros do orçamento" — pequenos valores que se acumulam.'));
  }));

  row3.appendChild(buildCard('Alertas · variações relevantes' + filterLabel, (host) => {
    if (growthAlerts.length === 0) { host.appendChild(el('div', { style: { padding: '20px', color: T.textMute, fontSize: '13px', textAlign: 'center' } }, months.length < 2 ? 'Importe lançamentos de pelo menos 2 meses para ver alertas.' : 'Nenhum aumento expressivo entre os últimos 2 meses. 👍')); return; }
    const list = el('div', { style: { maxHeight: '320px', overflowY: 'auto' } });
    growthAlerts.slice(0, 10).forEach(a => {
      const pctStr = a.pct == null ? 'novo' : '+' + a.pct.toFixed(0) + '%';
      list.appendChild(el('div', { style: { padding: '10px 0', borderBottom: '1px solid ' + T.border, display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' } }, [
        el('div', { style: { flex: 1, minWidth: 0 } }, [
          el('div', { style: { fontSize: '13px', color: T.text, marginBottom: '2px' } }, a.cat),
          el('div', { style: { fontSize: '11px', color: T.textMute } }, fmtShort(a.prev) + ' → ' + fmtShort(a.last)),
        ]),
        el('div', { style: { fontSize: '12px', padding: '4px 8px', borderRadius: '4px', background: T.danger + '25', color: T.danger, fontWeight: 500 } }, pctStr),
      ]));
    });
    host.appendChild(list);
  }));
  wrap.appendChild(row3);

  // ── TABELA DE LANÇAMENTOS ──
  wrap.appendChild(buildCard('Lançamentos', (host) => {
    buildTransactionsTable(host, unfiltered, globalPersonFilter, render);
  }, { marginTop: '12px' }));

  return wrap;
}

// ── TRANSACTIONS TABLE (with local filters) ───────────────────────────────────

let txnFilterCat = 'Todas';
let txnFilterType = 'todos';
let txnFilterPerson = null;
let txnFilterMonth = null;
let txnSearchTerm = '';
let txnPersonTouched = false;
let txnMonthTouched = false;

export function resetTxnFilters() {
  txnFilterCat = 'Todas'; txnFilterType = 'todos';
  txnFilterPerson = null; txnFilterMonth = null;
  txnSearchTerm = ''; txnPersonTouched = false; txnMonthTouched = false;
}

export function syncTxnFilters(globalPersonFilter, globalMonthFilter) {
  if (!txnPersonTouched) txnFilterPerson = globalPersonFilter;
  if (!txnMonthTouched) txnFilterMonth = globalMonthFilter;
}

function buildTransactionsTable(host, unfiltered, globalPersonFilter, render) {
  const allCats = ['Todas', ...new Set(unfiltered.map(t => t.category))];
  if (txnFilterCat !== 'Todas' && !allCats.includes(txnFilterCat)) txnFilterCat = 'Todas';
  if (!txnPersonTouched) txnFilterPerson = globalPersonFilter;
  if (txnFilterMonth !== 'all') {
    const monthsAvailable = new Set(unfiltered.map(t => monthKey(t.date)));
    if (!monthsAvailable.has(txnFilterMonth)) { txnFilterMonth = 'all'; txnMonthTouched = false; }
  }

  const countEl = el('span', { style: { fontSize: '10px', color: T.textMute, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', marginLeft: 'auto', alignSelf: 'center' } }, '');
  const ctrl = el('div', { style: { display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' } });

  const searchWrap = el('div', { style: { position: 'relative', flex: '1 1 220px', minWidth: '180px', maxWidth: '320px' } });
  searchWrap.appendChild(el('span', { style: { position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: T.textMute, fontSize: '12px', pointerEvents: 'none', fontFamily: 'var(--font-mono)' } }, '⌕'));
  const searchInput = el('input', {
    id: 'txn-search', type: 'text', placeholder: 'Buscar por descrição...',
    oninput: (e) => { txnSearchTerm = e.target.value.toLowerCase().trim(); redraw(); },
    style: { width: '100%', background: T.surfaceHi, color: T.text, border: '1px solid ' + T.border, borderRadius: '2px', padding: '6px 10px 6px 26px', fontSize: '12px', fontFamily: 'var(--font-mono)', outline: 'none', letterSpacing: '0.02em' },
  });
  searchWrap.appendChild(searchInput);
  ctrl.appendChild(searchWrap);

  const typeSel = el('select', {
    onchange: (e) => { txnFilterType = e.target.value; redraw(); },
    style: { background: T.surfaceHi, color: T.text, border: '1px solid ' + T.border, borderRadius: '4px', padding: '6px 10px', fontSize: '12px', fontFamily: 'inherit', outline: 'none' },
  });
  [['todos', 'Todos'], ['entrada', 'Só entradas'], ['saida', 'Só saídas']].forEach(([v, l]) => typeSel.appendChild(el('option', { value: v }, l)));
  ctrl.appendChild(typeSel);

  const sel = el('select', {
    onchange: (e) => { txnFilterCat = e.target.value; redraw(); },
    style: { background: T.surfaceHi, color: T.text, border: '1px solid ' + T.border, borderRadius: '4px', padding: '6px 10px', fontSize: '12px', fontFamily: 'inherit', outline: 'none' },
  });
  allCats.forEach(c => sel.appendChild(el('option', { value: c }, c)));
  ctrl.appendChild(sel);

  const personSel = el('select', {
    onchange: (e) => { txnFilterPerson = e.target.value; txnPersonTouched = true; redraw(); },
    style: { background: T.surfaceHi, color: T.text, border: '1px solid ' + T.border, borderRadius: '4px', padding: '6px 10px', fontSize: '12px', fontFamily: 'inherit', outline: 'none' },
  });
  [['all', 'Todas as pessoas'], ['unassigned', 'Não atribuídos'], ...STATE.people.map(p => [p.id, p.name])].forEach(([v, l]) => {
    const o = el('option', { value: v }, l);
    if (v === txnFilterPerson) o.selected = true;
    personSel.appendChild(o);
  });
  ctrl.appendChild(personSel);

  const monthsAvailLocal = [...new Set(unfiltered.map(t => monthKey(t.date)))].sort();
  const monthSel = el('select', {
    onchange: (e) => { txnFilterMonth = e.target.value; txnMonthTouched = true; redraw(); },
    style: { background: T.surfaceHi, color: T.text, border: '1px solid ' + T.border, borderRadius: '4px', padding: '6px 10px', fontSize: '12px', fontFamily: 'inherit', outline: 'none' },
  });
  monthSel.appendChild(el('option', { value: 'all' }, 'Todos os meses'));
  monthsAvailLocal.forEach(m => { const o = el('option', { value: m }, monthLabel(m)); if (m === txnFilterMonth) o.selected = true; monthSel.appendChild(o); });
  ctrl.appendChild(monthSel);

  ctrl.appendChild(el('button', {
    onclick: () => {
      let f = getFiltered(unfiltered);
      const rows = [['Data', 'Descrição', 'Categoria', 'Pessoas', 'Valor']];
      f.forEach(t => rows.push([
        t.dateOnlyMonth ? t.date.slice(0, 7) : t.date,
        t.desc.replace(/[";]/g, ''), t.category,
        personLabel(t.people).replace(/[";]/g, ''),
        t.amount.toFixed(2).replace('.', ','),
      ]));
      const csv = rows.map(r => r.map(c => '"' + c + '"').join(';')).join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'lancamentos.csv'; a.click();
      URL.revokeObjectURL(url);
    },
    style: { background: 'transparent', border: '1px solid ' + T.borderHi, color: T.textDim, padding: '6px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' },
  }, '↓ Exportar CSV'));
  ctrl.appendChild(countEl);
  host.appendChild(ctrl);

  const tableHost = el('div');
  host.appendChild(tableHost);

  function getFiltered(all) {
    let f = all;
    if (txnFilterType === 'entrada') f = f.filter(t => t.amount > 0);
    if (txnFilterType === 'saida') f = f.filter(t => t.amount < 0);
    if (txnFilterCat !== 'Todas') f = f.filter(t => t.category === txnFilterCat);
    if (txnFilterPerson === 'unassigned') f = f.filter(t => !t.people || t.people.length === 0);
    else if (txnFilterPerson !== 'all') f = f.filter(t => t.people && t.people.includes(txnFilterPerson));
    if (txnFilterMonth !== 'all') f = f.filter(t => monthKey(t.date) === txnFilterMonth);
    if (txnSearchTerm) f = f.filter(t => (t.desc || '').toLowerCase().includes(txnSearchTerm));
    return f;
  }

  function redraw() {
    tableHost.innerHTML = '';
    const sorted = [...getFiltered(unfiltered)].sort((a, b) => a.date < b.date ? 1 : -1);
    countEl.textContent = sorted.length === unfiltered.length
      ? sorted.length + ' LANÇAMENTOS'
      : sorted.length + ' DE ' + unfiltered.length + ' LANÇAMENTOS';

    const tbl = el('div', { id: 'txn-table-scroll', style: { maxHeight: '380px', overflowY: 'auto', border: '1px solid ' + T.border, borderRadius: '4px' } });
    tbl.appendChild(el('div', { style: { display: 'grid', gridTemplateColumns: '80px 1fr 130px 145px 110px 32px', gap: '8px', padding: '10px 12px', background: T.surfaceHi, fontSize: '11px', color: T.textMute, textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', top: 0, zIndex: 1 } }, [
      el('span', {}, 'Data'), el('span', {}, 'Descrição'), el('span', {}, 'Categoria'), el('span', {}, 'Pessoas'), el('span', { style: { textAlign: 'right' } }, 'Valor'), el('span', {}, ''),
    ]));

    sorted.slice(0, 300).forEach(t => {
      const peopleCell = el('div', { style: { display: 'flex', gap: '2px', flexWrap: 'wrap', alignItems: 'center' } });
      if (!t.people || t.people.length === 0) {
        peopleCell.appendChild(el('span', { style: { fontSize: '10px', color: T.textMute, fontStyle: 'italic' } }, 'não atribuído'));
      } else {
        t.people.forEach(pid => {
          const p = STATE.people.find(pp => pp.id === pid);
          if (!p) return;
          peopleCell.appendChild(el('span', { className: 'person-chip', style: { background: p.color + '25', color: p.color, border: '1px solid ' + p.color + '60' } }, p.name));
        });
        if (t.people.length > 1) peopleCell.appendChild(el('span', { style: { fontSize: '9px', color: T.warning, marginLeft: '2px' } }, '÷' + t.people.length));
      }
      peopleCell.appendChild(el('span', { onclick: (e) => { e.stopPropagation(); openTxnEditor(t, render); }, title: 'Editar pessoas', style: { fontSize: '11px', color: T.textMute, cursor: 'pointer', marginLeft: '4px', padding: '2px 4px', borderRadius: '3px' } }, '✎'));

      const rowEl = el('div', {
        onclick: () => openTxnEditor(t, render),
        title: 'Clique para editar',
        style: { display: 'grid', gridTemplateColumns: '80px 1fr 130px 145px 110px 32px', gap: '8px', padding: '10px 12px', borderBottom: '1px solid ' + T.border, fontSize: '12px', alignItems: 'center', cursor: 'pointer', transition: 'background 0.1s' },
      }, [
        el('span', { style: { color: T.textDim, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: '11px' } }, txnDateLabel(t) + (t.installmentTotal ? ' (' + t.installmentNum + '/' + t.installmentTotal + ')' : '')),
        el('span', { style: { color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' } }, [
          t.isFixed ? el('span', { title: 'Despesa fixa', style: { color: T.warning, fontSize: '9px', fontFamily: 'var(--font-mono)', background: T.warning + '15', padding: '1px 5px', borderRadius: '2px', border: '1px solid ' + T.warning + '30', letterSpacing: '0.05em', flexShrink: 0 } }, 'FIX') : null,
          el('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, t.desc),
        ]),
        el('span', {}, [el('span', { style: { fontSize: '10px', padding: '2px 7px', borderRadius: '3px', background: T.surfaceHi, color: T.textDim } }, t.category)]),
        peopleCell,
        el('span', { style: { color: t.amount < 0 ? T.danger : T.success, textAlign: 'right', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 } }, fmt(t.amount)),
        el('span', {
          onclick: async (e) => {
            e.stopPropagation();
            if (t.installmentGroup) {
              if (!confirm('Esta é uma parcela. Excluir só esta?\nOK = só esta\nCancelar = abrir opção de excluir TODAS')) {
                if (confirm('Excluir TODAS as parcelas desta compra?')) {
                  STATE.pix = STATE.pix.filter(x => x.installmentGroup !== t.installmentGroup);
                  STATE.credit = STATE.credit.filter(x => x.installmentGroup !== t.installmentGroup);
                  deleteTransactionGroup(t.installmentGroup).catch(() => {});
                  render();
                }
                return;
              }
            }
            let idx = STATE.pix.findIndex(x => x.id === t.id);
            if (idx >= 0) STATE.pix.splice(idx, 1);
            else { idx = STATE.credit.findIndex(x => x.id === t.id); if (idx >= 0) STATE.credit.splice(idx, 1); }
            deleteTransaction(t.id).catch(() => {});
            render();
          },
          title: 'Excluir',
          style: { color: T.textMute, cursor: 'pointer', textAlign: 'center', fontSize: '14px' },
        }, '×'),
      ]);
      rowEl.onmouseover = (e) => { rowEl.style.background = T.surfaceHi; };
      rowEl.onmouseout = (e) => { rowEl.style.background = ''; };
      tbl.appendChild(rowEl);
    });

    if (sorted.length === 0) tbl.appendChild(el('div', { style: { padding: '20px', color: T.textMute, fontSize: '12px', textAlign: 'center' } }, 'Nenhum lançamento com esses filtros.'));
    if (sorted.length > 300) tbl.appendChild(el('div', { style: { padding: '8px', color: T.textMute, fontSize: '11px', textAlign: 'center' } }, 'Mostrando 300 de ' + sorted.length));
    tableHost.appendChild(tbl);
  }
  redraw();
}

function personLabel(ids) {
  if (!ids || ids.length === 0) return 'Não atribuído';
  if (ids.length === 1) { const p = STATE.people.find(pp => pp.id === ids[0]); return p ? p.name : 'Não atribuído'; }
  return ids.map(id => { const p = STATE.people.find(pp => pp.id === id); return p ? p.name : '?'; }).join(' + ');
}

function chartOpts(o) {
  o = o || {};
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: !!o.legendPos, position: o.legendPos || 'top', labels: { color: T.textDim, font: { size: 10, family: 'JetBrains Mono' }, boxWidth: 10, padding: 10 } },
      tooltip: { backgroundColor: T.surfaceHi, titleColor: T.text, bodyColor: T.textDim, borderColor: T.borderHi, borderWidth: 1, titleFont: { family: 'JetBrains Mono', size: 11 }, bodyFont: { family: 'JetBrains Mono', size: 11 }, padding: 10, cornerRadius: 2, callbacks: { label: (ctx) => ' ' + ctx.dataset.label + ': ' + fmt(ctx.parsed.y) } },
    },
    scales: {
      x: { stacked: !!o.stacked, ticks: { color: T.textMute, font: { size: 10, family: 'JetBrains Mono' } }, grid: { color: T.border, drawBorder: false } },
      y: { stacked: !!o.stacked, ticks: { color: T.textMute, font: { size: 10, family: 'JetBrains Mono' }, callback: (v) => fmtShort(v) }, grid: { color: T.border, drawBorder: false } },
    },
  };
}
