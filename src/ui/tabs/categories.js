import { el, T } from '../components/el.js';
import { STATE, newId } from '../../modules/state.js';
import { getAllCategories } from '../../modules/categorize.js';
import { upsertCategory, deleteCategory } from '../../lib/db.js';

export function buildCategoriesView(render) {
  const wrap = el('div', { style: { padding: '24px', background: T.bg } });

  wrap.appendChild(el('div', {
    style: {
      padding: '12px 14px', background: T.accent + '10',
      borderLeft: '3px solid ' + T.accent, borderRadius: '4px',
      marginBottom: '16px', fontSize: '12px', color: T.textDim, lineHeight: '1.6',
    },
  }, [
    el('strong', { style: { color: T.accent, display: 'block', marginBottom: '4px' } }, 'Categorias personalizadas'),
    'Crie suas próprias categorias (ex: "Filhos", "Manutenção do carro", "Hobby"). Aparecem nos dropdowns junto das categorias padrão.',
  ]));

  const form = el('div', {
    style: { background: T.surface, border: '1px solid ' + T.border, borderRadius: '4px', padding: '14px 16px', marginBottom: '16px' },
  });
  form.appendChild(el('div', {
    style: { fontSize: '12px', color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', fontWeight: 500 },
  }, 'Adicionar categoria'));

  let newName = '', newType = 'expense';
  let newColor = T.palette[((STATE.customCategories || []).length) % T.palette.length];

  const row = el('div', { style: { display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' } });

  const nameWrap = el('div', { style: { flex: '1 1 200px' } });
  nameWrap.appendChild(el('label', { style: { fontSize: '11px', color: T.textMute, display: 'block', marginBottom: '4px' } }, 'Nome'));
  nameWrap.appendChild(el('input', {
    type: 'text', placeholder: 'Ex: Filhos, Hobby...',
    oninput: (e) => { newName = e.target.value; },
    style: {
      width: '100%', background: T.surfaceHi, color: T.text,
      border: '1px solid ' + T.border, borderRadius: '4px',
      padding: '8px 12px', fontSize: '13px', fontFamily: 'inherit', outline: 'none',
    },
  }));
  row.appendChild(nameWrap);

  const typeWrap = el('div');
  typeWrap.appendChild(el('label', { style: { fontSize: '11px', color: T.textMute, display: 'block', marginBottom: '4px' } }, 'Tipo'));
  const typeSel = el('select', {
    onchange: (e) => { newType = e.target.value; },
    style: {
      background: T.surfaceHi, color: T.text, border: '1px solid ' + T.border,
      borderRadius: '4px', padding: '8px 12px', fontSize: '13px', fontFamily: 'inherit', outline: 'none',
    },
  });
  typeSel.appendChild(el('option', { value: 'expense' }, 'Saída'));
  typeSel.appendChild(el('option', { value: 'income' }, 'Entrada'));
  typeWrap.appendChild(typeSel);
  row.appendChild(typeWrap);

  const colorWrap = el('div');
  colorWrap.appendChild(el('label', { style: { fontSize: '11px', color: T.textMute, display: 'block', marginBottom: '4px' } }, 'Cor'));
  const colorsRow = el('div', { style: { display: 'flex', gap: '5px', flexWrap: 'wrap' } });
  let selectedColorEl = null;
  T.palette.forEach(c => {
    const dot = el('div', {
      onclick: () => {
        newColor = c;
        if (selectedColorEl) selectedColorEl.style.border = '2px solid transparent';
        dot.style.border = '2px solid ' + T.text;
        selectedColorEl = dot;
      },
      style: {
        width: '24px', height: '24px', borderRadius: '50%', background: c, cursor: 'pointer',
        border: c === newColor ? '2px solid ' + T.text : '2px solid transparent', transition: 'border 0.15s',
      },
    });
    if (c === newColor) selectedColorEl = dot;
    colorsRow.appendChild(dot);
  });
  colorWrap.appendChild(colorsRow);
  row.appendChild(colorWrap);

  row.appendChild(el('button', {
    onclick: () => {
      if (!newName.trim()) { alert('Digite um nome.'); return; }
      const exists = getAllCategories(newType === 'income').some(c => c.toLowerCase() === newName.trim().toLowerCase());
      if (exists) { alert('Já existe uma categoria com esse nome para esse tipo.'); return; }
      if (!STATE.customCategories) STATE.customCategories = [];
      const cat = { id: newId(), name: newName.trim(), type: newType, color: newColor };
      STATE.customCategories.push(cat);
      upsertCategory(cat).catch(() => {});
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
  }, 'Categorias personalizadas · ' + (STATE.customCategories || []).length));

  if (!STATE.customCategories || STATE.customCategories.length === 0) {
    listCard.appendChild(el('div', { style: { padding: '24px', color: T.textMute, fontSize: '13px', textAlign: 'center' } },
      'Nenhuma categoria personalizada ainda. As categorias padrão continuam disponíveis nos dropdowns.'));
  } else {
    STATE.customCategories.forEach((c, idx) => {
      const all = [...STATE.pix, ...STATE.credit];
      const usage = all.filter(t => t.category === c.name).length;

      const item = el('div', {
        style: {
          padding: '12px 0',
          borderBottom: idx < STATE.customCategories.length - 1 ? '1px solid ' + T.border : 'none',
          display: 'flex', alignItems: 'center', gap: '12px',
        },
      });
      item.appendChild(el('div', { style: { width: '12px', height: '12px', borderRadius: '3px', background: c.color, flexShrink: 0 } }));
      item.appendChild(el('div', { style: { flex: 1, minWidth: 0 } }, [
        el('div', { style: { fontSize: '13px', color: T.text, fontWeight: 500 } }, c.name),
        el('div', { style: { fontSize: '11px', color: T.textMute, marginTop: '2px' } },
          (c.type === 'income' ? 'Entrada' : 'Saída') + ' · ' + usage + ' lançamentos'),
      ]));
      item.appendChild(el('button', {
        onclick: () => {
          const nv = prompt('Novo nome para "' + c.name + '":', c.name);
          if (nv && nv.trim() && nv.trim() !== c.name) {
            const oldName = c.name;
            c.name = nv.trim();
            [...STATE.pix, ...STATE.credit].forEach(t => { if (t.category === oldName) t.category = c.name; });
            upsertCategory(c).catch(() => {});
            render();
          }
        },
        style: {
          background: 'transparent', border: '1px solid ' + T.borderHi, color: T.textDim,
          padding: '5px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit',
        },
      }, 'Renomear'));
      item.appendChild(el('button', {
        onclick: async () => {
          if (usage > 0) {
            if (!confirm('Esta categoria tem ' + usage + ' lançamentos. Excluir e mover esses lançamentos para "Outros"?')) return;
            [...STATE.pix, ...STATE.credit].forEach(t => {
              if (t.category === c.name) t.category = c.type === 'income' ? 'Outras Entradas' : 'Outros';
            });
          } else { if (!confirm('Apagar "' + c.name + '"?')) return; }
          STATE.customCategories = STATE.customCategories.filter(cc => cc.id !== c.id);
          await deleteCategory(c.id);
          render();
        },
        style: {
          background: 'transparent', border: '1px solid ' + T.danger + '80', color: T.danger,
          padding: '5px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit',
        },
      }, 'Excluir'));
      listCard.appendChild(item);
    });
  }
  wrap.appendChild(listCard);
  return wrap;
}
