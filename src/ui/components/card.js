import { el, T } from './el.js';
import { savePrefs } from '../../lib/db.js';

// Collapsed state is loaded from Supabase on login and lives here.
// On toggle, we update in-memory AND fire async upsert.
export let collapsedCards = {};

export function setCollapsedCards(obj) {
  collapsedCards = obj || {};
}

function persistCollapsedCards() {
  savePrefs(collapsedCards).catch(() => {});
}

export function buildCard(title, content, extraStyle, opts) {
  opts = opts || {};
  const collapsible = !!opts.collapsible;
  const storageKey = opts.storageKey || title;

  let isCollapsed = false;
  if (collapsible) {
    isCollapsed = storageKey in collapsedCards
      ? !!collapsedCards[storageKey]
      : !!opts.defaultCollapsed;
  }

  const card = el('div', {
    style: Object.assign({
      background: T.surface,
      border: '1px solid ' + T.border,
      borderRadius: '2px',
      padding: '14px 16px 16px',
      transition: 'border-color 0.15s',
    }, extraStyle || {}),
  });

  const headerStyle = {
    display: 'flex', alignItems: 'center', gap: '8px',
    marginBottom: isCollapsed ? '0' : '14px',
    transition: 'margin-bottom 0.2s',
  };
  if (collapsible) { headerStyle.cursor = 'pointer'; headerStyle.userSelect = 'none'; }

  let chevron = null;
  let bodyEl = null;
  let teaserEl = null;

  const headerEl = el('div', {
    style: headerStyle,
    onclick: collapsible ? () => {
      isCollapsed = !isCollapsed;
      collapsedCards[storageKey] = isCollapsed;
      persistCollapsedCards();
      bodyEl.style.display = isCollapsed ? 'none' : '';
      if (teaserEl) teaserEl.style.display = isCollapsed ? '' : 'none';
      headerEl.style.marginBottom = isCollapsed ? '0' : '14px';
      if (chevron) chevron.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0)';
    } : null,
  }, [
    el('div', { style: { width: '4px', height: '10px', background: T.accent, opacity: 0.7 } }),
    el('div', {
      className: 'label-caps',
      style: { fontSize: '10px', color: T.textDim, fontWeight: 600, flex: 1 },
    }, title),
    collapsible ? (() => {
      chevron = el('span', {
        style: {
          fontSize: '10px', color: T.textMute, opacity: 0.7,
          transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)',
          transition: 'transform 0.2s', display: 'inline-block',
          padding: '2px 4px',
        },
      }, '▾');
      return chevron;
    })() : null,
  ]);
  card.appendChild(headerEl);

  if (collapsible && opts.teaser) {
    teaserEl = el('div', {
      style: {
        display: isCollapsed ? '' : 'none',
        marginTop: '8px', paddingTop: '8px',
        borderTop: '1px solid ' + T.border,
        fontSize: '12px', color: T.textDim,
      },
    });
    if (typeof opts.teaser === 'function') opts.teaser(teaserEl);
    else teaserEl.textContent = opts.teaser;
    card.appendChild(teaserEl);
  }

  bodyEl = el('div', { style: { display: isCollapsed ? 'none' : '' } });
  content(bodyEl);
  card.appendChild(bodyEl);
  return card;
}
