import { el, T } from '../components/el.js';
import { STATE, newId } from '../../modules/state.js';
import { categorize, getAllCategories } from '../../modules/categorize.js';
import {
  parseExtractRaw, currentMonthKey, monthLabel, txnDateLabel, addMonths, fmt, monthKey,
  MONTHS,
} from '../../modules/parser.js';
import { extractTextFromPDF, extractTextWithOCR } from '../../modules/pdf-extract.js';
import { insertTransactions } from '../../lib/db.js';

// Persists across re-renders within the input tab
let parsedPreview = null;
let lastTextValue = '';

export function clearInputState() {
  parsedPreview = null;
  lastTextValue = '';
}

export function buildInputView(inputTab, setInputTab, setActiveTab, setGlobalMonthFilter, setGlobalPersonFilter, render) {
  const wrap = el('div', { style: { padding: '24px', background: T.bg } });

  if (STATE.people.length === 0) {
    wrap.appendChild(el('div', {
      style: {
        padding: '16px', background: T.warning + '15', borderLeft: '3px solid ' + T.warning,
        borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: T.warning,
      },
    }, [
      '⚠ Você ainda não cadastrou pessoas. ',
      el('button', {
        onclick: () => { setActiveTab('people'); render(); },
        style: { background: 'transparent', border: 'none', color: T.warning, textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', padding: 0 },
      }, 'Cadastrar agora →'),
    ]));
  }

  const subTabs = el('div', { style: { display: 'flex', gap: '8px', marginBottom: '16px' } });
  [['pix', 'Pix', T.pix], ['credit', 'Cartão de crédito', T.credit]].forEach(([id, lbl, c]) => {
    const active = inputTab === id;
    subTabs.appendChild(el('button', {
      onclick: () => { setInputTab(id); parsedPreview = null; render(); },
      style: {
        background: active ? c + '25' : T.surface,
        border: '1px solid ' + (active ? c : T.border),
        color: active ? c : T.textDim,
        padding: '8px 16px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
      },
    }, lbl));
  });
  wrap.appendChild(subTabs);

  if (!parsedPreview) {
    const mkRow = el('div', {
      style: {
        background: T.surface, border: '1px solid ' + T.border, borderRadius: '4px',
        padding: '14px 16px', marginBottom: '12px',
        display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
      },
    });
    mkRow.appendChild(el('div', { style: { display: 'flex', flexDirection: 'column' } }, [
      el('span', { style: { fontSize: '11px', color: T.textMute, textTransform: 'uppercase', letterSpacing: '0.05em' } }, 'Mês de referência'),
      el('span', { style: { fontSize: '10px', color: T.textMute, marginTop: '3px' } }, 'Usado para linhas SEM data'),
    ]));
    mkRow.appendChild(buildMonthPicker(window._defaultMonth || currentMonthKey(), (v) => { window._defaultMonth = v; }));
    wrap.appendChild(mkRow);
  }

  wrap.appendChild(el('div', {
    style: {
      padding: '12px 14px', background: T.accent + '10', borderLeft: '3px solid ' + T.accent,
      borderRadius: '4px', marginBottom: '12px', fontSize: '12px', color: T.textDim, lineHeight: '1.7',
    },
  }, [
    el('strong', { style: { color: T.accent, display: 'block', marginBottom: '4px' } }, '💡 A data é opcional'),
    'Cole linhas com apenas ', el('strong', { style: { color: T.text } }, 'descrição e valor'),
    ' (ex: ', el('code', { style: { color: T.text, background: T.surfaceHi, padding: '1px 6px', borderRadius: '3px' } }, 'Gympass R$ 70,00'),
    '). Aceita: ',
    el('code', { style: { color: T.text, background: T.surfaceHi, padding: '1px 6px', borderRadius: '3px' } }, '15/03/2025'),
    ', ',
    el('code', { style: { color: T.text, background: T.surfaceHi, padding: '1px 6px', borderRadius: '3px' } }, 'mar/25'),
    ', ',
    el('code', { style: { color: T.text, background: T.surfaceHi, padding: '1px 6px', borderRadius: '3px' } }, '03/2025'),
    '.',
  ]));

  const uploadRow = el('div', { style: { display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' } });
  const statusEl = el('span', { id: 'pdf-status', style: { fontSize: '11px', color: T.textMute } }, '');

  function setStatus(msg, color) { statusEl.textContent = msg || ''; statusEl.style.color = color || T.textMute; }

  uploadRow.appendChild(el('button', {
    onclick: () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'application/pdf';
      inp.onchange = async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try {
          setStatus('Lendo PDF...', T.accent);
          const text = await extractTextFromPDF(f);
          const ta = document.getElementById('extract-ta');
          ta.value = ta.value.trim() ? ta.value + '\n' + text : text;
          lastTextValue = ta.value;
          setStatus('✓ ' + text.split('\n').filter(l => l.trim()).length + ' linhas de ' + f.name, T.success);
        } catch (err) { setStatus('Erro: ' + err.message + ' — tente OCR.', T.danger); }
      };
      inp.click();
    },
    title: 'Para PDFs digitais (Nubank, Itaú, etc)',
    style: {
      background: T.accent + '25', border: '1px solid ' + T.accent, color: T.accent,
      padding: '10px 16px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer',
      fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px',
    },
  }, '📎 Anexar PDF (texto)'));

  uploadRow.appendChild(el('button', {
    onclick: () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'application/pdf,image/*';
      inp.onchange = async (e) => {
        const f = e.target.files[0]; if (!f) return;
        if (!confirm('OCR vai baixar ~10MB (1ª vez) e pode demorar 20-60s. Continuar?')) return;
        try {
          setStatus('Carregando OCR...', T.warning);
          const text = await extractTextWithOCR(f, (msg) => setStatus(msg, T.warning));
          const ta = document.getElementById('extract-ta');
          ta.value = ta.value.trim() ? ta.value + '\n' + text : text;
          lastTextValue = ta.value;
          setStatus('✓ OCR concluído: ' + text.split('\n').filter(l => l.trim()).length + ' linhas de ' + f.name, T.success);
        } catch (err) { setStatus('Erro no OCR: ' + err.message, T.danger); }
      };
      inp.click();
    },
    title: 'Para PDFs escaneados ou fotos',
    style: {
      background: T.warning + '20', border: '1px solid ' + T.warning, color: T.warning,
      padding: '10px 16px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer',
      fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px',
    },
  }, '🔍 Anexar PDF/imagem (OCR)'));

  uploadRow.appendChild(statusEl);
  wrap.appendChild(uploadRow);

  const ta = el('textarea', {
    id: 'extract-ta',
    placeholder: 'Pode colar assim (sem data):\nGympass R$ 70,00\nCredPago R$ 129,00\n\nOu com data:\n15/03/2025  NETFLIX  39,90\nmar/25  GELADEIRA  1500,00',
    style: {
      width: '100%', minHeight: '220px', background: T.surface, color: T.text,
      border: '1px solid ' + T.border, borderRadius: '4px', padding: '14px',
      fontFamily: 'monospace', fontSize: '12px', resize: 'vertical', outline: 'none',
    },
  });
  ta.value = lastTextValue;
  ta.oninput = (e) => { lastTextValue = e.target.value; };
  wrap.appendChild(ta);

  const btnRow = el('div', { style: { display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' } });

  function analyze(direction) {
    lastTextValue = ta.value;
    const defaultMonth = window._defaultMonth || currentMonthKey();
    const items = parseExtractRaw(ta.value, defaultMonth);
    if (items.length === 0) {
      parsedPreview = { direction, items: [], defaultMonth, error: 'Nenhum lançamento detectado. Verifique se cada linha tem pelo menos um valor (ex: R$ 70,00 ou 70,00).' };
    } else {
      const isIncome = direction === 'in';
      const defaultPerson = STATE.people[0];
      const defaultPeople = defaultPerson ? [defaultPerson.id] : [];
      parsedPreview = {
        direction, defaultMonth,
        items: items.map(it => ({
          date: it.date, dateOnlyMonth: it.dateOnlyMonth,
          hasOriginalDate: it.hasOriginalDate, desc: it.desc,
          amount: isIncome ? Math.abs(it.rawAmount) : -Math.abs(it.rawAmount),
          category: categorize(it.desc, isIncome),
          people: [...defaultPeople],
          installments: 1, isFixed: false,
          id: newId(),
        })),
      };
    }
    render();
  }

  btnRow.appendChild(el('button', {
    onclick: () => analyze('in'),
    style: {
      background: T.success, border: 'none', color: '#0a0a0f',
      padding: '12px 22px', borderRadius: '4px', fontSize: '13px',
      cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit',
      display: 'flex', alignItems: 'center', gap: '8px',
    },
  }, [el('span', { style: { fontSize: '16px', lineHeight: 1 } }, '↓'), 'Analisar como Entrada']));

  btnRow.appendChild(el('button', {
    onclick: () => analyze('out'),
    style: {
      background: T.danger, border: 'none', color: '#0a0a0f',
      padding: '12px 22px', borderRadius: '4px', fontSize: '13px',
      cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit',
      display: 'flex', alignItems: 'center', gap: '8px',
    },
  }, [el('span', { style: { fontSize: '16px', lineHeight: 1 } }, '↑'), 'Analisar como Saída']));

  btnRow.appendChild(el('button', {
    onclick: () => { ta.value = sampleData(inputTab); lastTextValue = ta.value; },
    style: {
      background: 'transparent', border: '1px solid ' + T.borderHi, color: T.textDim,
      padding: '12px 16px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
    },
  }, 'Carregar exemplo'));
  wrap.appendChild(btnRow);

  if (parsedPreview) {
    wrap.appendChild(buildPreview(inputTab, setActiveTab, setGlobalMonthFilter, setGlobalPersonFilter, render));
  }
  return wrap;
}

function buildMonthPicker(currentValue, onChange) {
  const [y, m] = currentValue.split('-').map(Number);
  const wrap = el('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } });

  const monthSel = el('select', {
    onchange: (e) => { onChange(currentValue.slice(0, 5) + e.target.value); },
    style: { background: T.surfaceHi, color: T.text, border: '1px solid ' + T.border, borderRadius: '4px', padding: '6px 10px', fontSize: '12px', fontFamily: 'inherit', outline: 'none' },
  });
  MONTHS.forEach((mn, i) => {
    const o = el('option', { value: String(i + 1).padStart(2, '0') }, mn);
    if (i + 1 === m) o.selected = true;
    monthSel.appendChild(o);
  });
  wrap.appendChild(monthSel);

  const yearSel = el('select', {
    onchange: (e) => { onChange(e.target.value + '-' + String(m).padStart(2, '0')); },
    style: { background: T.surfaceHi, color: T.text, border: '1px solid ' + T.border, borderRadius: '4px', padding: '6px 10px', fontSize: '12px', fontFamily: 'inherit', outline: 'none' },
  });
  const currentYear = new Date().getFullYear();
  for (let yr = currentYear - 3; yr <= currentYear + 2; yr++) {
    const o = el('option', { value: String(yr) }, String(yr));
    if (yr === y) o.selected = true;
    yearSel.appendChild(o);
  }
  wrap.appendChild(yearSel);
  return wrap;
}

function buildPreview(inputTab, setActiveTab, setGlobalMonthFilter, setGlobalPersonFilter, render) {
  const isIncome = parsedPreview.direction === 'in';
  const color = isIncome ? T.success : T.danger;
  const label = isIncome ? 'Entradas' : 'Saídas';
  const sign = isIncome ? '+' : '−';
  const previewBox = el('div', { style: { marginTop: '18px' } });

  if (parsedPreview.error) {
    previewBox.appendChild(el('div', { style: { padding: '12px', background: T.surfaceHi, borderRadius: '4px', color: T.warning, fontSize: '13px' } }, parsedPreview.error));
    return previewBox;
  }

  const total = parsedPreview.items.reduce((s, t) => s + t.amount, 0);
  const undatedCount = parsedPreview.items.filter(t => !t.hasOriginalDate).length;

  previewBox.appendChild(el('div', {
    style: {
      padding: '12px 14px', background: color + '15', borderLeft: '3px solid ' + color,
      borderRadius: '4px', marginBottom: '12px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
    },
  }, [
    el('div', {}, [
      el('div', { style: { fontSize: '13px', color, fontWeight: 500 } }, sign + ' ' + parsedPreview.items.length + ' ' + label.toLowerCase() + ' detectada(s)'),
      el('div', { style: { fontSize: '11px', color: T.textMute, marginTop: '2px' } },
        undatedCount > 0
          ? undatedCount + ' sem data — foram colocados em ' + monthLabel(parsedPreview.defaultMonth)
          : 'Todos os lançamentos têm data própria'),
    ]),
    el('div', { style: { fontSize: '18px', fontWeight: 500, color, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' } }, fmt(total)),
  ]));

  if (undatedCount > 0) {
    const dateRow = el('div', {
      style: {
        background: T.surface, border: '1px solid ' + T.warning + '40', borderRadius: '4px',
        padding: '10px 12px', marginBottom: '10px',
        display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
      },
    });
    dateRow.appendChild(el('span', { style: { fontSize: '11px', color: T.warning } }, '📅 Mês para os ' + undatedCount + ' sem data:'));
    dateRow.appendChild(buildMonthPicker(parsedPreview.defaultMonth, (newVal) => {
      parsedPreview.defaultMonth = newVal;
      const newDate = newVal + '-01';
      parsedPreview.items.forEach(it => { if (!it.hasOriginalDate) { it.date = newDate; it.dateOnlyMonth = true; } });
      refreshPreviewRows(isIncome, color);
      render();
    }));
    previewBox.appendChild(dateRow);
  }

  if (STATE.people.length > 0) {
    const bulk = el('div', {
      style: { background: T.surface, border: '1px solid ' + T.border, borderRadius: '4px', padding: '10px 12px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
    });
    bulk.appendChild(el('span', { style: { fontSize: '11px', color: T.textMute } }, 'Atribuir todos a:'));
    STATE.people.forEach(p => {
      bulk.appendChild(el('button', {
        onclick: () => { parsedPreview.items.forEach(it => { it.people = [p.id]; }); refreshPreviewRows(isIncome, color); },
        style: { background: p.color + '25', border: '1px solid ' + p.color + '80', color: p.color, padding: '4px 10px', borderRadius: '2px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' },
      }, p.name));
    });
    previewBox.appendChild(bulk);
  }

  if (!isIncome) {
    const fixBulk = el('div', {
      style: { background: T.surface, border: '1px solid ' + T.border, borderRadius: '4px', padding: '10px 12px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
    });
    fixBulk.appendChild(el('span', { style: { fontSize: '11px', color: T.textMute } }, 'Marcar como despesa fixa:'));
    fixBulk.appendChild(el('button', {
      onclick: () => { parsedPreview.items.forEach(it => { it.isFixed = true; }); refreshPreviewRows(isIncome, color); },
      style: { background: T.warning + '20', border: '1px solid ' + T.warning, color: T.warning, padding: '4px 10px', borderRadius: '2px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' },
    }, 'Todas fixas'));
    fixBulk.appendChild(el('button', {
      onclick: () => { parsedPreview.items.forEach(it => { it.isFixed = false; }); refreshPreviewRows(isIncome, color); },
      style: { background: 'transparent', border: '1px solid ' + T.borderHi, color: T.textDim, padding: '4px 10px', borderRadius: '2px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' },
    }, 'Nenhuma fixa'));
    previewBox.appendChild(fixBulk);
  }

  const tbl = el('div', { id: 'preview-tbl', style: { maxHeight: '420px', overflowY: 'auto', background: T.surface, borderRadius: '4px', border: '1px solid ' + T.border } });
  const allCats = getAllCategories(isIncome);
  parsedPreview.items.forEach((t, idx) => tbl.appendChild(buildPreviewRow(t, idx, allCats, isIncome, color)));
  previewBox.appendChild(tbl);

  const warnHost = el('div', { id: 'preview-warn' });
  previewBox.appendChild(warnHost);
  updateUnassignedWarning();

  const actionRow = el('div', { style: { display: 'flex', gap: '10px', marginTop: '12px' } });
  actionRow.appendChild(el('button', {
    onclick: async () => {
      const target = inputTab === 'pix' ? 'pix' : 'credit';
      const expanded = [];
      parsedPreview.items.forEach(it => {
        const n = Math.max(1, parseInt(it.installments) || 1);
        if (n === 1) {
          const { installments, hasOriginalDate, ...rest } = it;
          expanded.push(rest);
        } else {
          // REGRA CRÍTICA: valor digitado = valor de CADA parcela
          const perInstallment = it.amount;
          for (let i = 0; i < n; i++) {
            expanded.push({
              date: addMonths(it.date, i), dateOnlyMonth: it.dateOnlyMonth,
              desc: it.desc + ' (' + (i+1) + '/' + n + ')',
              amount: perInstallment, category: it.category,
              people: [...it.people], isFixed: it.isFixed,
              id: newId(), installmentGroup: it.id,
              installmentNum: i + 1, installmentTotal: n,
            });
          }
        }
      });
      STATE[target] = [...STATE[target], ...expanded];
      insertTransactions(expanded, target).catch(() => {});

      if (expanded.length > 0) {
        const monthsImported = expanded.map(t => monthKey(t.date)).sort();
        setGlobalMonthFilter(monthsImported[monthsImported.length - 1]);
      }
      setGlobalPersonFilter('all');
      parsedPreview = null; lastTextValue = '';
      setActiveTab(target);
      render();
    },
    style: { background: color, border: 'none', color: '#0a0a0f', padding: '10px 20px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' },
  }, 'Salvar lançamentos'));

  actionRow.appendChild(el('button', {
    onclick: () => { parsedPreview = null; render(); },
    style: { background: 'transparent', border: '1px solid ' + T.borderHi, color: T.textDim, padding: '10px 16px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
  }, 'Cancelar'));
  previewBox.appendChild(actionRow);
  return previewBox;
}

function buildPreviewRow(t, idx, allCats, isIncome, color) {
  const row = el('div', { id: 'prv-row-' + idx, style: { padding: '10px 12px', borderBottom: '1px solid ' + T.border, display: 'grid', gridTemplateColumns: '72px 1fr 130px 145px 56px 110px', gap: '8px', fontSize: '12px', alignItems: 'center' } });

  row.appendChild(el('span', {
    title: t.hasOriginalDate ? 'Data original do extrato' : 'Sem data — usando mês de referência',
    style: { color: t.hasOriginalDate ? T.textMute : T.warning, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: '11px', fontStyle: t.hasOriginalDate ? 'normal' : 'italic' },
  }, txnDateLabel(t) + (t.hasOriginalDate ? '' : ' *')));

  row.appendChild(el('span', { style: { color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, t.desc));

  const catSel = el('select', {
    onchange: (e) => { parsedPreview.items[idx].category = e.target.value; },
    style: { background: T.surfaceHi, color, border: '1px solid ' + T.border, borderRadius: '4px', padding: '3px 6px', fontSize: '11px', fontFamily: 'inherit', outline: 'none', maxWidth: '130px' },
  });
  allCats.forEach(c => { const o = el('option', { value: c }, c); if (c === t.category) o.selected = true; catSel.appendChild(o); });
  row.appendChild(catSel);

  const peopleSel = el('div', { className: 'people-sel', style: { display: 'flex', gap: '3px', flexWrap: 'wrap', alignItems: 'center' } });
  function repaintPeople() {
    peopleSel.innerHTML = '';
    if (STATE.people.length === 0) { peopleSel.appendChild(el('span', { style: { fontSize: '10px', color: T.warning } }, 'Cadastre pessoas')); return; }
    STATE.people.forEach(p => {
      const selected = t.people.includes(p.id);
      peopleSel.appendChild(el('div', {
        className: 'person-dot',
        onclick: () => { if (selected) t.people = t.people.filter(pid => pid !== p.id); else t.people = [...t.people, p.id]; repaintPeople(); updateUnassignedWarning(); },
        title: p.name + (selected ? ' (selecionado)' : ''),
        style: { width: '22px', height: '22px', borderRadius: '50%', background: selected ? p.color : 'transparent', border: '2px solid ' + p.color, color: selected ? '#0a0a0f' : p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 500, cursor: 'pointer' },
      }, p.name.slice(0, 1).toUpperCase()));
    });
    if (t.people.length > 1) peopleSel.appendChild(el('span', { style: { fontSize: '9px', color: T.warning, padding: '2px 5px', background: T.warning + '20', borderRadius: '8px', alignSelf: 'center' } }, '÷' + t.people.length));
  }
  repaintPeople();
  row.appendChild(peopleSel);

  if (!isIncome) {
    const instInput = el('input', {
      type: 'number', min: '1', max: '60', value: String(t.installments || 1),
      title: 'Número de parcelas (1 = à vista)',
      onchange: (e) => {
        const v = Math.max(1, Math.min(60, parseInt(e.target.value) || 1));
        t.installments = v; e.target.value = String(v);
        const amtEl = row.querySelector('.preview-amount');
        if (amtEl) amtEl.innerHTML = renderAmountWithInstallments(t, color);
      },
      style: { width: '48px', background: T.surfaceHi, color: t.installments > 1 ? T.warning : T.text, border: '1px solid ' + (t.installments > 1 ? T.warning : T.border), borderRadius: '4px', padding: '3px 6px', fontSize: '11px', fontFamily: 'inherit', outline: 'none', textAlign: 'center' },
    });
    row.appendChild(instInput);
  } else {
    row.appendChild(el('span', { style: { fontSize: '10px', color: T.textMute, textAlign: 'center' } }, '—'));
  }

  const amtEl = el('span', { className: 'preview-amount', style: { color, textAlign: 'right', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 500, fontSize: '12px' } });
  amtEl.innerHTML = renderAmountWithInstallments(t, color);
  row.appendChild(amtEl);
  return row;
}

function renderAmountWithInstallments(t, color) {
  if ((t.installments || 1) <= 1) return fmt(t.amount);
  const total = t.amount * t.installments;
  return fmt(t.amount) + '<br><span style="font-size:10px;color:' + T.warning + ';font-weight:400">' + t.installments + 'x = ' + fmt(total).replace('R$ ', 'R$') + ' total</span>';
}

function refreshPreviewRows(isIncome, color) {
  const tbl = document.getElementById('preview-tbl');
  if (!tbl || !parsedPreview) return;
  tbl.innerHTML = '';
  const allCats = getAllCategories(isIncome);
  parsedPreview.items.forEach((t, idx) => tbl.appendChild(buildPreviewRow(t, idx, allCats, isIncome, color)));
  updateUnassignedWarning();
}

function updateUnassignedWarning() {
  const host = document.getElementById('preview-warn');
  if (!host || !parsedPreview) return;
  host.innerHTML = '';
  const n = parsedPreview.items.filter(t => !t.people || t.people.length === 0).length;
  if (n > 0) {
    host.appendChild(el('div', { style: { marginTop: '10px', padding: '10px 12px', background: T.warning + '15', borderLeft: '3px solid ' + T.warning, borderRadius: '4px', fontSize: '11px', color: T.warning } },
      '⚠ ' + n + ' lançamento(s) sem pessoa atribuída. Aparecerão como "Não atribuído".'));
  }
}

function sampleData(type) {
  if (type === 'pix') return 'Gympass  70,00\nCredPago  129,00\npague Menos  58,58\nMercado L(Ballet)  49,55\nMercado L(Ballet)  29,95\nSan Michel  56,15\nMabeni  61,00\nAmericanaSaude  66,51\nVile forte  72,64\nAmericanas saúde  43,66';
  return 'NETFLIX.COM  39,90\nSPOTIFY  21,90\nIFOOD PIZZARIA  62,40\nRENNER LOJAS  245,00\nCINEMARK  56,00\nUBER TRIP  18,50\nCHATGPT OPENAI  109,90\nGELADEIRA BRASTEMP  1500,00';
}
