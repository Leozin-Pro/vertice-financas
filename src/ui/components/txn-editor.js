import { el, T } from './el.js';
import { STATE, newId } from '../../modules/state.js';
import { getAllCategories } from '../../modules/categorize.js';
import { addMonths } from '../../modules/parser.js';
import {
  updateTransaction, deleteTransaction, deleteTransactionGroup,
  insertTransactions,
} from '../../lib/db.js';

export function openTxnEditor(txn, render) {
  const overlay = el('div', {
    onclick: (e) => { if (e.target === overlay) overlay.remove(); },
    style: {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '20px',
    },
  });

  const modal = el('div', {
    style: {
      background: T.surface, border: '1px solid ' + T.borderHi,
      borderRadius: '4px', padding: '20px',
      minWidth: '380px', maxWidth: '500px', width: '100%',
      maxHeight: '90vh', overflowY: 'auto',
    },
  });

  const isIncome = txn.amount > 0;
  const isInstallment = !!txn.installmentGroup;
  const source = STATE.pix.some(x => x.id === txn.id || (isInstallment && x.installmentGroup === txn.installmentGroup))
    ? 'pix' : 'credit';

  modal.appendChild(el('div', {
    style: { fontSize: '14px', color: T.text, fontWeight: 500, marginBottom: '14px' },
  }, 'Editar lançamento'));

  let edit = {
    desc: isInstallment ? txn.desc.replace(/\s*\(\d+\/\d+\)\s*$/, '') : txn.desc,
    amount: Math.abs(txn.amount),
    category: txn.category,
    people: [...(txn.people || [])],
    date: txn.date,
    dateOnlyMonth: txn.dateOnlyMonth,
    installments: isInstallment ? txn.installmentTotal : 1,
    isFixed: !!txn.isFixed,
  };

  // Description
  modal.appendChild(el('label', { style: { fontSize: '11px', color: T.textMute, display: 'block', marginBottom: '4px' } }, 'Descrição'));
  modal.appendChild(el('input', {
    type: 'text', value: edit.desc,
    oninput: (e) => { edit.desc = e.target.value; },
    style: {
      width: '100%', background: T.surfaceHi, color: T.text,
      border: '1px solid ' + T.border, borderRadius: '4px',
      padding: '8px 12px', fontSize: '13px', fontFamily: 'inherit',
      outline: 'none', marginBottom: '12px',
    },
  }));

  // Amount + Installments
  const amtRow = el('div', { style: { display: 'grid', gridTemplateColumns: isIncome ? '1fr' : '1fr 100px', gap: '10px', marginBottom: '12px' } });
  const amtWrap = el('div');
  amtWrap.appendChild(el('label', { style: { fontSize: '11px', color: T.textMute, display: 'block', marginBottom: '4px' } }, isInstallment ? 'Valor da parcela' : 'Valor'));
  amtWrap.appendChild(el('input', {
    type: 'text', value: edit.amount.toFixed(2).replace('.', ','),
    oninput: (e) => {
      const v = parseFloat(e.target.value.replace(/[^\d,.-]/g, '').replace(',', '.'));
      if (!isNaN(v)) edit.amount = Math.abs(v);
    },
    style: {
      width: '100%', background: T.surfaceHi,
      color: isIncome ? T.success : T.danger,
      border: '1px solid ' + T.border, borderRadius: '4px',
      padding: '8px 12px', fontSize: '13px', fontFamily: 'inherit',
      outline: 'none', fontWeight: 500,
    },
  }));
  amtRow.appendChild(amtWrap);

  if (!isIncome) {
    const instWrap = el('div');
    instWrap.appendChild(el('label', { style: { fontSize: '11px', color: T.textMute, display: 'block', marginBottom: '4px' } }, 'Parcelas'));
    instWrap.appendChild(el('input', {
      type: 'number', min: '1', max: '60', value: String(edit.installments),
      onchange: (e) => { edit.installments = Math.max(1, Math.min(60, parseInt(e.target.value) || 1)); },
      style: {
        width: '100%', background: T.surfaceHi,
        color: edit.installments > 1 ? T.warning : T.text,
        border: '1px solid ' + T.border, borderRadius: '4px',
        padding: '8px 12px', fontSize: '13px', fontFamily: 'inherit',
        outline: 'none', textAlign: 'center',
      },
    }));
    amtRow.appendChild(instWrap);
  }
  modal.appendChild(amtRow);

  // Category
  modal.appendChild(el('label', { style: { fontSize: '11px', color: T.textMute, display: 'block', marginBottom: '4px' } }, 'Categoria'));
  const catSel = el('select', {
    onchange: (e) => { edit.category = e.target.value; },
    style: {
      width: '100%', background: T.surfaceHi, color: T.text,
      border: '1px solid ' + T.border, borderRadius: '4px',
      padding: '8px 12px', fontSize: '13px', fontFamily: 'inherit',
      outline: 'none', marginBottom: '12px',
    },
  });
  getAllCategories(isIncome).forEach(c => {
    const o = el('option', { value: c }, c);
    if (c === edit.category) o.selected = true;
    catSel.appendChild(o);
  });
  modal.appendChild(catSel);

  // Fixed expense toggle (custom div — NOT native checkbox to avoid global click conflicts)
  if (!isIncome) {
    const fixedWrap = el('div', {
      onclick: () => { edit.isFixed = !edit.isFixed; updateFixedUI(); },
      style: {
        display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
        padding: '10px 12px', background: T.surfaceHi, borderRadius: '4px',
        marginBottom: '12px',
        border: '1px solid ' + (edit.isFixed ? T.warning + '60' : T.border),
        transition: 'border-color 0.15s', userSelect: 'none',
      },
    });
    const fixedBox = el('div', {
      style: {
        width: '16px', height: '16px', borderRadius: '2px',
        border: '1.5px solid ' + (edit.isFixed ? T.warning : T.borderHi),
        background: edit.isFixed ? T.warning : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'all 0.12s',
        color: '#0a0a0f', fontSize: '12px', fontWeight: 700, lineHeight: 1,
      },
    }, edit.isFixed ? '✓' : '');
    fixedWrap.appendChild(fixedBox);
    fixedWrap.appendChild(el('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } }, [
      el('span', { style: { fontSize: '12px', color: edit.isFixed ? T.warning : T.text, fontWeight: 500, transition: 'color 0.15s' } }, 'Despesa fixa / recorrente'),
      el('span', { style: { fontSize: '10px', color: T.textMute } }, 'Aluguel, assinaturas, contas mensais'),
    ]));
    modal.appendChild(fixedWrap);

    function updateFixedUI() {
      fixedWrap.style.borderColor = edit.isFixed ? T.warning + '60' : T.border;
      fixedBox.style.borderColor = edit.isFixed ? T.warning : T.borderHi;
      fixedBox.style.background = edit.isFixed ? T.warning : 'transparent';
      fixedBox.textContent = edit.isFixed ? '✓' : '';
      fixedWrap.children[1].children[0].style.color = edit.isFixed ? T.warning : T.text;
    }
  }

  // People
  if (STATE.people.length > 0) {
    modal.appendChild(el('label', { style: { fontSize: '11px', color: T.textMute, display: 'block', marginBottom: '6px' } }, 'Pessoas (clique para selecionar)'));
    const peopleRow = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' } });
    function repaintPeople() {
      peopleRow.innerHTML = '';
      STATE.people.forEach(p => {
        const isSel = edit.people.includes(p.id);
        peopleRow.appendChild(el('button', {
          onclick: () => {
            if (isSel) edit.people = edit.people.filter(pid => pid !== p.id);
            else edit.people.push(p.id);
            repaintPeople();
          },
          style: {
            background: isSel ? p.color + '30' : 'transparent',
            border: '1px solid ' + (isSel ? p.color : T.borderHi),
            color: isSel ? p.color : T.textDim,
            padding: '6px 12px', borderRadius: '2px', fontSize: '12px',
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: isSel ? 500 : 400,
          },
        }, p.name));
      });
      if (edit.people.length > 1) {
        peopleRow.appendChild(el('span', {
          style: {
            fontSize: '10px', color: T.warning, padding: '4px 8px',
            background: T.warning + '20', borderRadius: '2px', alignSelf: 'center',
          },
        }, 'Valor dividido por ' + edit.people.length));
      }
    }
    repaintPeople();
    modal.appendChild(peopleRow);
  }

  if (!isIncome && edit.installments > 1) {
    modal.appendChild(el('div', {
      style: {
        padding: '8px 10px', background: T.warning + '15',
        borderLeft: '3px solid ' + T.warning, borderRadius: '4px',
        fontSize: '11px', color: T.warning, marginBottom: '14px',
      },
    }, '💡 Ao salvar, as parcelas anteriores serão recriadas com os novos valores/datas.'));
  }

  // Buttons
  const btns = el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'space-between', marginTop: '6px', flexWrap: 'wrap' } });

  btns.appendChild(el('button', {
    onclick: async () => {
      if (!confirm('Excluir este lançamento' + (isInstallment ? ' e todas as parcelas relacionadas' : '') + '?')) return;
      if (isInstallment) {
        STATE.pix = STATE.pix.filter(x => x.installmentGroup !== txn.installmentGroup);
        STATE.credit = STATE.credit.filter(x => x.installmentGroup !== txn.installmentGroup);
        deleteTransactionGroup(txn.installmentGroup).catch(() => {});
      } else {
        let idx = STATE.pix.findIndex(x => x.id === txn.id);
        if (idx >= 0) STATE.pix.splice(idx, 1);
        else { idx = STATE.credit.findIndex(x => x.id === txn.id); if (idx >= 0) STATE.credit.splice(idx, 1); }
        deleteTransaction(txn.id).catch(() => {});
      }
      overlay.remove();
      render();
    },
    style: {
      background: 'transparent', border: '1px solid ' + T.danger + '80', color: T.danger,
      padding: '8px 14px', borderRadius: '4px', fontSize: '12px',
      cursor: 'pointer', fontFamily: 'inherit',
    },
  }, 'Excluir'));

  const rightBtns = el('div', { style: { display: 'flex', gap: '8px' } });
  rightBtns.appendChild(el('button', {
    onclick: () => overlay.remove(),
    style: {
      background: 'transparent', border: '1px solid ' + T.borderHi, color: T.textDim,
      padding: '8px 14px', borderRadius: '4px', fontSize: '12px',
      cursor: 'pointer', fontFamily: 'inherit',
    },
  }, 'Cancelar'));

  rightBtns.appendChild(el('button', {
    onclick: async () => {
      const signedAmount = isIncome ? edit.amount : -edit.amount;

      if (isInstallment) {
        // Remove all old installments in memory
        STATE[source] = STATE[source].filter(x => x.installmentGroup !== txn.installmentGroup);
        await deleteTransactionGroup(txn.installmentGroup);

        const n = edit.installments;
        const newTxns = [];
        if (n === 1) {
          const t = {
            id: newId(), date: edit.date, dateOnlyMonth: edit.dateOnlyMonth,
            desc: edit.desc, amount: signedAmount, category: edit.category,
            people: [...edit.people], isFixed: edit.isFixed,
            installmentGroup: null, installmentNum: null, installmentTotal: null,
          };
          STATE[source].push(t);
          newTxns.push(t);
        } else {
          const group = txn.installmentGroup;
          for (let i = 0; i < n; i++) {
            const t = {
              id: newId(), date: addMonths(edit.date, i), dateOnlyMonth: edit.dateOnlyMonth,
              desc: edit.desc + ' (' + (i+1) + '/' + n + ')',
              amount: signedAmount, category: edit.category,
              people: [...edit.people], isFixed: edit.isFixed,
              installmentGroup: group, installmentNum: i + 1, installmentTotal: n,
            };
            STATE[source].push(t);
            newTxns.push(t);
          }
        }
        insertTransactions(newTxns, source).catch(() => {});

      } else {
        if (!isIncome && edit.installments > 1) {
          // Expand single → installments
          let idx = STATE[source].findIndex(x => x.id === txn.id);
          if (idx >= 0) STATE[source].splice(idx, 1);
          await deleteTransaction(txn.id);

          const group = newId();
          const n = edit.installments;
          const newTxns = [];
          for (let i = 0; i < n; i++) {
            const t = {
              id: newId(), date: addMonths(edit.date, i), dateOnlyMonth: edit.dateOnlyMonth,
              desc: edit.desc + ' (' + (i+1) + '/' + n + ')',
              amount: signedAmount, category: edit.category,
              people: [...edit.people], isFixed: edit.isFixed,
              installmentGroup: group, installmentNum: i + 1, installmentTotal: n,
            };
            STATE[source].push(t);
            newTxns.push(t);
          }
          insertTransactions(newTxns, source).catch(() => {});
        } else {
          const t = STATE[source].find(x => x.id === txn.id);
          if (t) {
            t.desc = edit.desc; t.amount = signedAmount;
            t.category = edit.category; t.people = [...edit.people];
            t.isFixed = edit.isFixed;
          }
          updateTransaction({ ...txn, ...edit, amount: signedAmount }, source).catch(() => {});
        }
      }
      overlay.remove();
      render();
    },
    style: {
      background: T.accent, border: 'none', color: '#0a0a0f',
      padding: '8px 14px', borderRadius: '4px', fontSize: '12px',
      cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
    },
  }, 'Salvar'));

  btns.appendChild(rightBtns);
  modal.appendChild(btns);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}
