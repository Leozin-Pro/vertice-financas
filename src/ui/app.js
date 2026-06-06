import '../styles/theme.css';
import { el, T } from './components/el.js';
import { buildHeader } from './components/header.js';
import { buildDropdown } from './components/dropdown.js';
import { setCollapsedCards } from './components/card.js';
import { STATE } from '../modules/state.js';
import { currentMonthKey, monthKey, monthLabel } from '../modules/parser.js';
import { buildPeopleView } from './tabs/people.js';
import { buildCategoriesView } from './tabs/categories.js';
import { buildInputView, clearInputState } from './tabs/input.js';
import { buildDashboard, resetTxnFilters, syncTxnFilters } from './tabs/overview.js';

const root = document.getElementById('app-root');

// ── Global UI state ───────────────────────────────────────────────────────────
let activeTab = 'overview';
let inputTab = 'pix';
let globalPersonFilter = 'all';
let globalMonthFilter = currentMonthKey();
let openFilterMenu = null;

export function setActiveTab(t) { activeTab = t; }
export function setInputTab(t) { inputTab = t; }
export function setGlobalMonthFilter(v) { globalMonthFilter = v; }
export function setGlobalPersonFilter(v) { globalPersonFilter = v; }

export function initCollapsedCards(obj) {
  setCollapsedCards(obj);
}

// ── Main render ───────────────────────────────────────────────────────────────
export function render(user) {
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const oldTable = document.getElementById('txn-table-scroll');
  const tableScrollTop = oldTable ? oldTable.scrollTop : 0;

  root.innerHTML = '';
  root.appendChild(buildHeader(user, () => render(user)));
  root.appendChild(buildTabs());

  if (activeTab === 'input') {
    root.appendChild(buildInputView(
      inputTab,
      (t) => { inputTab = t; },
      setActiveTab,
      setGlobalMonthFilter,
      setGlobalPersonFilter,
      () => render(user),
    ));
    window.scrollTo(0, scrollY);
    return;
  }
  if (activeTab === 'people') {
    root.appendChild(buildPeopleView(() => render(user)));
    window.scrollTo(0, scrollY);
    return;
  }
  if (activeTab === 'categories') {
    root.appendChild(buildCategoriesView(() => render(user)));
    window.scrollTo(0, scrollY);
    return;
  }

  const txns = getActiveTxns();
  if (txns.length === 0) {
    root.appendChild(buildEmpty());
    window.scrollTo(0, scrollY);
    return;
  }

  root.appendChild(buildFilterBar());

  syncTxnFilters(globalPersonFilter, globalMonthFilter);
  const filtered = getFilteredTxns();
  root.appendChild(buildDashboard(filtered, txns, globalPersonFilter, () => render(user)));

  window.scrollTo(0, scrollY);
  if (tableScrollTop > 0) {
    const newTable = document.getElementById('txn-table-scroll');
    if (newTable) newTable.scrollTop = tableScrollTop;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getActiveTxns() {
  if (activeTab === 'pix') return STATE.pix;
  if (activeTab === 'credit') return STATE.credit;
  return [...STATE.pix, ...STATE.credit];
}

function getFilteredTxns() {
  let all = getActiveTxns();
  if (globalMonthFilter !== 'all') all = all.filter(t => monthKey(t.date) === globalMonthFilter);
  if (globalPersonFilter === 'all') return all;
  if (globalPersonFilter === 'unassigned') return all.filter(t => !t.people || t.people.length === 0);
  const result = [];
  all.forEach(t => {
    const ppl = t.people || [];
    if (ppl.includes(globalPersonFilter)) result.push({ ...t, amount: t.amount / ppl.length, _shared: ppl.length > 1 });
  });
  return result;
}

// ── Tabs bar ──────────────────────────────────────────────────────────────────
function buildTabs() {
  const tabs = [
    ['overview', 'Visão geral', STATE.pix.length + STATE.credit.length],
    ['pix', 'Pix', STATE.pix.length, T.pix],
    ['credit', 'Cartão', STATE.credit.length, T.credit],
    ['people', 'Pessoas', STATE.people.length],
    ['categories', 'Categorias', (STATE.customCategories || []).length],
    ['input', 'Importar', null],
  ];
  const wrap = el('div', { style: { display: 'flex', background: T.surface, borderBottom: '1px solid ' + T.border, padding: '0 18px', gap: 0, flexWrap: 'wrap' } });
  tabs.forEach(([id, label, count, color]) => {
    const active = activeTab === id;
    const tab = el('div', {
      onclick: () => {
        activeTab = id;
        clearInputState();
        globalMonthFilter = currentMonthKey();
        resetTxnFilters();
        openFilterMenu = null;
        // render is called with user param — we close over it via a re-render trigger
        // This is handled in main.js via the exported render fn
        document.dispatchEvent(new Event('app:render'));
      },
      onmouseover: (e) => { if (!active) e.currentTarget.style.color = T.text; },
      onmouseout: (e) => { if (!active) e.currentTarget.style.color = T.textDim; },
      style: {
        padding: '14px 14px', cursor: 'pointer', fontSize: '11px', fontWeight: 500,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        color: active ? T.text : T.textDim,
        borderBottom: active ? '1px solid ' + (color || T.accent) : '1px solid transparent',
        marginBottom: '-1px',
        display: 'flex', alignItems: 'center', gap: '8px',
        transition: 'color 0.12s, border-color 0.12s',
      },
    }, [
      label,
      count != null
        ? el('span', { className: 'num', style: { fontSize: '10px', padding: '1px 5px', borderRadius: '2px', background: active ? (color || T.accent) + '18' : 'transparent', color: active ? (color || T.accent) : T.textMute, border: active ? '1px solid ' + (color || T.accent) + '40' : '1px solid ' + T.border, minWidth: '18px', textAlign: 'center' } }, String(count))
        : el('span', { style: { color: T.accent, fontSize: '12px', lineHeight: 1 } }, '+'),
    ]);
    wrap.appendChild(tab);
  });
  return wrap;
}

// ── Filter bar ────────────────────────────────────────────────────────────────
function buildFilterBar() {
  const wrap = el('div', { style: { padding: '12px 24px', background: T.surface, borderBottom: '1px solid ' + T.border, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } });
  const allTxns = getActiveTxns();
  const monthsAvail = [...new Set(allTxns.map(t => monthKey(t.date)))].sort();

  wrap.appendChild(el('span', { className: 'label-caps' }, 'COMPETÊNCIA'));
  wrap.appendChild(buildDropdown({
    type: 'month',
    currentLabel: globalMonthFilter === 'all' ? 'Todos os meses' : monthLabel(globalMonthFilter),
    isDefault: globalMonthFilter === 'all',
    color: T.accent,
    options: [
      { id: 'all', label: 'Todos os meses', active: globalMonthFilter === 'all' },
      ...monthsAvail.map(m => ({ id: m, label: monthLabel(m), active: globalMonthFilter === m })),
    ],
    onSelect: (id) => { globalMonthFilter = id; openFilterMenu = null; document.dispatchEvent(new Event('app:render')); },
    openFilterMenu,
    setOpenFilterMenu: (v) => { openFilterMenu = v; document.dispatchEvent(new Event('app:render')); },
  }));

  if (STATE.people.length > 0) {
    let currentPersonLabel = 'Todos', currentPersonColor = T.text;
    if (globalPersonFilter === 'unassigned') { currentPersonLabel = 'Não atribuído'; currentPersonColor = T.textMute; }
    else if (globalPersonFilter !== 'all') {
      const p = STATE.people.find(pp => pp.id === globalPersonFilter);
      if (p) { currentPersonLabel = p.name; currentPersonColor = p.color; }
    }
    wrap.appendChild(el('span', { className: 'label-caps', style: { marginLeft: '8px' } }, 'PESSOA'));
    wrap.appendChild(buildDropdown({
      type: 'person',
      currentLabel: currentPersonLabel,
      isDefault: globalPersonFilter === 'all',
      color: currentPersonColor,
      showDot: globalPersonFilter !== 'all' && globalPersonFilter !== 'unassigned',
      options: [
        { id: 'all', label: 'Todos', active: globalPersonFilter === 'all' },
        ...STATE.people.map(p => ({ id: p.id, label: p.name, color: p.color, dot: true, active: globalPersonFilter === p.id })),
        { id: 'unassigned', label: 'Não atribuído', color: T.textMute, active: globalPersonFilter === 'unassigned' },
      ],
      onSelect: (id) => { globalPersonFilter = id; openFilterMenu = null; document.dispatchEvent(new Event('app:render')); },
      openFilterMenu,
      setOpenFilterMenu: (v) => { openFilterMenu = v; document.dispatchEvent(new Event('app:render')); },
    }));
  }

  const activeFiltersCount = (globalMonthFilter !== 'all' ? 1 : 0) + (globalPersonFilter !== 'all' ? 1 : 0);
  if (activeFiltersCount > 0) {
    const clearBtn = el('button', {
      onclick: () => { globalMonthFilter = 'all'; globalPersonFilter = 'all'; openFilterMenu = null; document.dispatchEvent(new Event('app:render')); },
      style: { marginLeft: 'auto', background: 'transparent', border: '1px solid ' + T.border, color: T.textMute, padding: '5px 10px', borderRadius: '2px', fontSize: '10px', cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', fontWeight: 500, textTransform: 'uppercase' },
      onmouseover: (e) => { e.currentTarget.style.color = T.danger; e.currentTarget.style.borderColor = T.danger; },
      onmouseout: (e) => { e.currentTarget.style.color = T.textMute; e.currentTarget.style.borderColor = T.border; },
    }, '× LIMPAR FILTROS');
    wrap.appendChild(clearBtn);
  }
  return wrap;
}

// ── Empty state ───────────────────────────────────────────────────────────────
function buildEmpty() {
  return el('div', { style: { padding: '80px 24px', textAlign: 'center', background: T.bg } }, [
    el('div', { style: { fontSize: '40px', marginBottom: '12px', color: T.textMute } }, '∅'),
    el('div', { style: { fontSize: '15px', color: T.textDim, marginBottom: '6px' } }, 'Sem dados nesta aba ainda'),
    el('div', { style: { fontSize: '13px', color: T.textMute, marginBottom: '20px' } },
      STATE.people.length === 0 ? 'Primeiro cadastre as pessoas em "Pessoas", depois importe o extrato.' : 'Cole seu extrato em "Importar extrato" para começar'),
    el('button', {
      onclick: () => { activeTab = STATE.people.length === 0 ? 'people' : 'input'; document.dispatchEvent(new Event('app:render')); },
      style: { background: T.accent, border: 'none', color: '#0a0a0f', padding: '10px 20px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' },
    }, STATE.people.length === 0 ? 'Cadastrar pessoas →' : 'Importar extrato →'),
  ]);
}
