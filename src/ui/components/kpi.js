import { el, T } from './el.js';

export function kpi(label, value, sub, color, isHero) {
  return el('div', {
    style: {
      background: T.surface,
      border: '1px solid ' + T.border,
      borderRadius: '2px',
      padding: isHero ? '18px 20px' : '14px 16px',
      borderLeft: '2px solid ' + (color || T.accent),
      position: 'relative', overflow: 'hidden',
    },
  }, [
    el('div', { className: 'label-caps', style: { marginBottom: isHero ? '10px' : '8px' } }, label),
    el('div', {
      className: 'num',
      style: {
        fontSize: isHero ? '32px' : '18px',
        fontWeight: 600,
        color: T.text,
        marginBottom: '4px',
        letterSpacing: isHero ? '-0.03em' : '-0.01em',
        lineHeight: 1,
      },
    }, value),
    el('div', {
      style: {
        fontSize: '10px', color: color || T.textDim,
        textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500,
      },
    }, sub),
  ]);
}
