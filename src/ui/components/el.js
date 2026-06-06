// DOM builder helper — identical to original el() helper.
export function el(tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      if (k === 'style') Object.assign(e.style, attrs[k]);
      else if (k === 'onclick') e.onclick = attrs[k];
      else if (k === 'oninput') e.oninput = attrs[k];
      else if (k === 'onchange') e.onchange = attrs[k];
      else if (k === 'onmouseover') e.onmouseover = attrs[k];
      else if (k === 'onmouseout') e.onmouseout = attrs[k];
      else if (k === 'className') e.className = attrs[k];
      else if (k === 'id') e.id = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
  }
  if (children) {
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
  }
  return e;
}

// Theme colors — single source of truth for inline styles
export const T = {
  bg: '#07070b', surface: '#0e0e14', surfaceHi: '#16161e', surfaceLow: '#0a0a0f',
  border: '#1f1f2a', borderHi: '#2d2d3a',
  text: '#f4f4f5', textDim: '#a1a1aa', textMute: '#71717a',
  accent: '#a78bfa', accentHi: '#c4b5fd',
  success: '#34d399', danger: '#f87171', warning: '#fbbf24',
  pix: '#22d3ee', credit: '#a78bfa',
  palette: ['#a78bfa','#60a5fa','#22d3ee','#34d399','#fbbf24','#f87171','#fb923c','#f472b6','#818cf8','#2dd4bf','#facc15','#94a3b8'],
};

export const PERSON_COLORS = ['#60a5fa','#a78bfa','#22d3ee','#34d399','#fbbf24','#fb923c','#f472b6','#818cf8'];

export function btnSmall(label, onclick, color) {
  return el('button', {
    onclick,
    style: {
      background: 'transparent',
      border: '1px solid ' + (color || T.borderHi),
      color: color || T.textDim,
      padding: '5px 10px', borderRadius: '2px',
      fontSize: '10px', cursor: 'pointer',
      fontFamily: 'var(--font-mono)',
      letterSpacing: '0.06em', fontWeight: 500,
      transition: 'background 0.12s, color 0.12s',
    },
    onmouseover: (e) => {
      e.currentTarget.style.background = (color || T.borderHi) + '12';
      e.currentTarget.style.color = (color === T.danger || color === T.accent) ? color : T.text;
    },
    onmouseout: (e) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.color = color || T.textDim;
    },
  }, label);
}
