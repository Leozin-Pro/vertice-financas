import { el, T, PERSON_COLORS } from '../components/el.js';
import { STATE, newId } from '../../modules/state.js';
import { fmt } from '../../modules/parser.js';
import { upsertPerson, deletePerson } from '../../lib/db.js';

export function buildPeopleView(render) {
  const wrap = el('div', { style: { padding: '24px', background: T.bg } });

  wrap.appendChild(el('div', {
    style: {
      padding: '12px 14px', background: T.accent + '10',
      borderLeft: '3px solid ' + T.accent, borderRadius: '4px',
      marginBottom: '16px', fontSize: '12px', color: T.textDim, lineHeight: '1.6',
    },
  }, [
    el('strong', { style: { color: T.accent, display: 'block', marginBottom: '4px' } }, 'Como usar pessoas'),
    'Cadastre cada pessoa que usa suas contas. Lançamentos com 2+ pessoas são divididos igualmente nos relatórios.',
  ]));

  const form = el('div', {
    style: {
      background: T.surface, border: '1px solid ' + T.border,
      borderRadius: '4px', padding: '14px 16px', marginBottom: '16px',
    },
  });
  form.appendChild(el('div', {
    style: { fontSize: '12px', color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', fontWeight: 500 },
  }, 'Adicionar pessoa'));

  let newName = '';
  let newColor = PERSON_COLORS[STATE.people.length % PERSON_COLORS.length];

  const row = el('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' } });

  const nameWrap = el('div', { style: { flex: '1 1 200px' } });
  nameWrap.appendChild(el('label', { style: { fontSize: '11px', color: T.textMute, display: 'block', marginBottom: '4px' } }, 'Nome'));
  const nameInput = el('input', {
    type: 'text', placeholder: 'Ex: Mãe, Namorada, João...',
    oninput: (e) => { newName = e.target.value; },
    style: {
      width: '100%', background: T.surfaceHi, color: T.text,
      border: '1px solid ' + T.border, borderRadius: '4px',
      padding: '8px 12px', fontSize: '13px', fontFamily: 'inherit', outline: 'none',
    },
  });
  nameWrap.appendChild(nameInput);
  row.appendChild(nameWrap);

  const colorWrap = el('div');
  colorWrap.appendChild(el('label', { style: { fontSize: '11px', color: T.textMute, display: 'block', marginBottom: '4px' } }, 'Cor'));
  const colorsRow = el('div', { style: { display: 'flex', gap: '5px' } });
  let selectedColorEl = null;
  PERSON_COLORS.forEach(c => {
    const dot = el('div', {
      onclick: () => {
        newColor = c;
        if (selectedColorEl) selectedColorEl.style.border = '2px solid transparent';
        dot.style.border = '2px solid ' + T.text;
        selectedColorEl = dot;
      },
      style: {
        width: '26px', height: '26px', borderRadius: '50%', background: c, cursor: 'pointer',
        border: c === newColor ? '2px solid ' + T.text : '2px solid transparent',
        transition: 'border 0.15s',
      },
    });
    if (c === newColor) selectedColorEl = dot;
    colorsRow.appendChild(dot);
  });
  colorWrap.appendChild(colorsRow);
  row.appendChild(colorWrap);

  row.appendChild(el('button', {
    onclick: async () => {
      if (!newName.trim()) { alert('Digite um nome.'); return; }
      if (STATE.people.some(p => p.name.toLowerCase() === newName.trim().toLowerCase())) {
        alert('Já existe uma pessoa com esse nome.'); return;
      }
      const person = { id: newId(), name: newName.trim(), color: newColor };
      STATE.people.push(person);
      upsertPerson(person).catch(() => {});
      render();
    },
    style: {
      background: T.success, border: 'none', color: '#0a0a0f',
      padding: '9px 20px', borderRadius: '4px', fontSize: '13px',
      cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit',
    },
  }, '+ Adicionar'));
  form.appendChild(row);
  wrap.appendChild(form);

  const listCard = el('div', {
    style: { background: T.surface, border: '1px solid ' + T.border, borderRadius: '4px', padding: '14px 16px' },
  });
  listCard.appendChild(el('div', {
    style: { fontSize: '12px', color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', fontWeight: 500 },
  }, 'Pessoas cadastradas · ' + STATE.people.length));

  if (STATE.people.length === 0) {
    listCard.appendChild(el('div', { style: { padding: '24px', color: T.textMute, fontSize: '13px', textAlign: 'center' } },
      'Nenhuma pessoa cadastrada. Adicione acima.'));
  } else {
    STATE.people.forEach((p, idx) => {
      const all = [...STATE.pix, ...STATE.credit];
      const myTxns = all.filter(t => t.people && t.people.includes(p.id));
      const total = myTxns.filter(t => t.amount < 0).reduce((s, t) => s + (t.amount / t.people.length), 0);

      const item = el('div', {
        style: {
          padding: '12px 0',
          borderBottom: idx < STATE.people.length - 1 ? '1px solid ' + T.border : 'none',
          display: 'flex', alignItems: 'center', gap: '12px',
        },
      });
      item.appendChild(el('div', {
        style: {
          width: '32px', height: '32px', borderRadius: '50%', background: p.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#0a0a0f', fontSize: '13px', fontWeight: 500, flexShrink: 0,
        },
      }, p.name.slice(0, 1).toUpperCase()));
      item.appendChild(el('div', { style: { flex: 1, minWidth: 0 } }, [
        el('div', { style: { fontSize: '14px', color: T.text, fontWeight: 500 } }, p.name),
        el('div', { style: { fontSize: '11px', color: T.textMute, marginTop: '2px' } },
          myTxns.length + ' lançamentos · ' + fmt(-total) + ' em gastos'),
      ]));
      item.appendChild(el('button', {
        onclick: () => {
          const nv = prompt('Novo nome para ' + p.name + ':', p.name);
          if (nv && nv.trim()) { p.name = nv.trim(); upsertPerson(p).catch(() => {}); render(); }
        },
        style: {
          background: 'transparent', border: '1px solid ' + T.borderHi, color: T.textDim,
          padding: '5px 10px', borderRadius: '4px', fontSize: '11px',
          cursor: 'pointer', fontFamily: 'inherit',
        },
      }, 'Renomear'));
      item.appendChild(el('button', {
        onclick: async () => {
          if (myTxns.length > 0) {
            if (!confirm('Esta pessoa tem ' + myTxns.length + ' lançamentos. Apagar pessoa e desatribuir?')) return;
          } else { if (!confirm('Apagar ' + p.name + '?')) return; }
          [...STATE.pix, ...STATE.credit].forEach(t => {
            if (t.people) t.people = t.people.filter(pid => pid !== p.id);
          });
          STATE.people = STATE.people.filter(pp => pp.id !== p.id);
          await deletePerson(p.id);
          render();
        },
        style: {
          background: 'transparent', border: '1px solid ' + T.danger + '80', color: T.danger,
          padding: '5px 10px', borderRadius: '4px', fontSize: '11px',
          cursor: 'pointer', fontFamily: 'inherit',
        },
      }, 'Excluir'));
      listCard.appendChild(item);
    });
  }
  wrap.appendChild(listCard);
  return wrap;
}
