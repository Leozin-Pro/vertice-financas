import { el, T } from './el.js';

// openFilterMenu is managed by the filter-bar module and passed in
export function buildDropdown({ type, currentLabel, isDefault, color, showDot, options, onSelect, openFilterMenu, setOpenFilterMenu }) {
  const isOpen = openFilterMenu === type;
  const container = el('div', { style: { position: 'relative' } });

  const trigger = el('div', {
    onclick: (e) => {
      e.stopPropagation();
      setOpenFilterMenu(isOpen ? null : type);
    },
    style: {
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      padding: '6px 12px', borderRadius: '2px',
      background: isDefault ? 'transparent' : color + '18',
      color: isDefault ? T.text : color,
      border: '1px solid ' + (isDefault ? T.border : color + '80'),
      fontSize: '12px', fontWeight: 500, cursor: 'pointer',
      transition: 'border-color 0.12s, background 0.12s',
      minWidth: '140px', justifyContent: 'space-between',
      userSelect: 'none',
    },
  }, [
    el('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } }, [
      showDot ? el('span', { style: { width: '8px', height: '8px', background: color, display: 'inline-block' } }) : null,
      currentLabel,
    ]),
    el('span', {
      style: {
        fontSize: '10px', opacity: 0.7,
        transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
        transition: 'transform 0.15s', display: 'inline-block',
      },
    }, '▾'),
  ]);
  container.appendChild(trigger);

  if (isOpen) {
    const menu = el('div', {
      onclick: (e) => e.stopPropagation(),
      style: {
        position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100,
        minWidth: '180px', maxHeight: '320px', overflowY: 'auto',
        background: T.surfaceHi, border: '1px solid ' + T.borderHi,
        borderRadius: '2px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        padding: '4px',
      },
    });
    options.forEach(opt => {
      const item = el('div', {
        onclick: () => onSelect(opt.id),
        onmouseover: (e) => { if (!opt.active) e.currentTarget.style.background = T.surface; },
        onmouseout: (e) => { if (!opt.active) e.currentTarget.style.background = 'transparent'; },
        style: {
          padding: '7px 10px', cursor: 'pointer', fontSize: '12px',
          display: 'flex', alignItems: 'center', gap: '8px',
          background: opt.active ? (opt.color || T.accent) + '18' : 'transparent',
          color: opt.active ? (opt.color || T.accent) : T.textDim,
          borderLeft: '2px solid ' + (opt.active ? (opt.color || T.accent) : 'transparent'),
          transition: 'background 0.1s',
        },
      }, [
        opt.dot ? el('span', { style: { width: '8px', height: '8px', background: opt.color, display: 'inline-block', flexShrink: 0 } }) : null,
        el('span', { style: { flex: 1 } }, opt.label),
        opt.active ? el('span', { style: { fontSize: '10px', color: opt.color || T.accent } }, '✓') : null,
      ]);
      menu.appendChild(item);
    });
    container.appendChild(menu);
  }
  return container;
}
