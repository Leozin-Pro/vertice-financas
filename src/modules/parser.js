// Pure parsing functions — no state dependencies.

export const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const MONTHS_FULL = {
  jan:0, fev:1, mar:2, março:2, marco:2, abr:3, mai:4, jun:5,
  jul:6, ago:7, set:8, out:9, nov:10, dez:11,
  janeiro:0, fevereiro:1, abril:3, maio:4, junho:5,
  julho:6, agosto:7, setembro:8, outubro:9, novembro:10, dezembro:11,
};

export function parseDate(s) {
  if (!s) return null;
  s = s.trim().toLowerCase();
  let m;

  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)))
    return { date: s, onlyMonth: false };

  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/))) {
    let d = m[1].padStart(2,'0'), mo = m[2].padStart(2,'0'), y = m[3];
    if (y.length === 2) y = '20'+y;
    if (parseInt(d) > 31 || parseInt(mo) > 12) return null;
    return { date: y+'-'+mo+'-'+d, onlyMonth: false };
  }

  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})$/))) {
    let d = m[1].padStart(2,'0'), mo = m[2].padStart(2,'0');
    if (parseInt(d) > 31 || parseInt(mo) > 12) return null;
    return { date: new Date().getFullYear()+'-'+mo+'-'+d, onlyMonth: false };
  }

  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{4})$/))) {
    let mo = m[1].padStart(2,'0');
    if (parseInt(mo) > 12) return null;
    return { date: m[2]+'-'+mo+'-01', onlyMonth: true };
  }

  if ((m = s.match(/^(\d{4})-(\d{1,2})$/))) {
    let mo = m[2].padStart(2,'0');
    if (parseInt(mo) > 12) return null;
    return { date: m[1]+'-'+mo+'-01', onlyMonth: true };
  }

  const monthMatch = s.match(
    /^(jan|fev|mar|março|marco|abr|mai|jun|jul|ago|set|out|nov|dez|janeiro|fevereiro|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)[\/\s\-.]*(?:de\s+)?(\d{2,4})$/
  );
  if (monthMatch) {
    const mIdx = MONTHS_FULL[monthMatch[1]];
    if (mIdx === undefined) return null;
    let y = monthMatch[2];
    if (y.length === 2) y = '20'+y;
    return { date: y+'-'+String(mIdx+1).padStart(2,'0')+'-01', onlyMonth: true };
  }

  return null;
}

export function parseExtractRaw(text, defaultMonthKey) {
  if (!text) return [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 3);
  const out = [];

  const datePatterns = [
    /^(\d{4}-\d{1,2}-\d{1,2})\b/,
    /^(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b/,
    /^(\d{1,2}[\/\-.]\d{1,2})\b(?!\d)/,
    /^(\d{1,2}[\/\-.]\d{4})\b/,
    /^(\d{4}-\d{1,2})\b/,
    /^((?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|março|janeiro|fevereiro|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)[\/\s\-.]*(?:de\s+)?\d{2,4})\b/i,
  ];
  const moneyRe = /(-?R?\$?\s*-?\s*[\d.]+,\d{2})|(-?\$?\s*-?\s*\d+\.\d{2})(?!\d)/g;
  const defaultDate = defaultMonthKey + '-01';

  for (const line of lines) {
    let dateStr = null;
    for (const re of datePatterns) {
      const mm = line.match(re);
      if (mm) { dateStr = mm[1]; break; }
    }

    let parsedDate, hasDate;
    if (dateStr) {
      parsedDate = parseDate(dateStr);
      hasDate = !!parsedDate;
    } else {
      parsedDate = { date: defaultDate, onlyMonth: true };
      hasDate = false;
    }
    if (!parsedDate) continue;

    const monies = line.match(moneyRe);
    if (!monies || monies.length === 0) continue;

    let raw = monies[monies.length - 1].trim().replace(/[R$\s\-]/g, '');
    let amount = raw.includes(',')
      ? parseFloat(raw.replace(/\./g, '').replace(',', '.'))
      : parseFloat(raw);
    if (isNaN(amount) || amount === 0) continue;
    amount = Math.abs(amount);

    let desc = line;
    if (dateStr) desc = desc.replace(dateStr, '');
    desc = desc.replace(monies[monies.length - 1], '').trim();
    desc = desc.replace(/^[\|\t;,\s]+|[\|\t;,\s]+$/g, '').replace(/\s+/g, ' ');
    if (!desc) desc = '(sem descrição)';

    out.push({ date: parsedDate.date, dateOnlyMonth: parsedDate.onlyMonth, hasOriginalDate: hasDate, desc, rawAmount: amount });
  }
  return out;
}

export function currentMonthKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export function monthKey(dateStr) { return dateStr.slice(0, 7); }

export function addMonths(dateStr, n) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, mo - 1 + n, 1);
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

export function monthLabel(k) {
  const [y, m] = k.split('-');
  return MONTHS[parseInt(m) - 1] + '/' + y.slice(2);
}

export function txnDateLabel(t) {
  if (t.dateOnlyMonth) {
    const [y, m] = t.date.split('-');
    return MONTHS[parseInt(m) - 1] + '/' + y.slice(2);
  }
  return t.date.slice(8, 10) + '/' + t.date.slice(5, 7);
}

export function fmt(n) {
  return (n < 0 ? '-' : '') + 'R$ ' + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtShort(n) {
  const a = Math.abs(n);
  if (a >= 1000) return (n < 0 ? '-' : '') + 'R$ ' + (a / 1000).toFixed(1) + 'k';
  return fmt(n);
}

export function normalizeDesc(d) {
  return (d || '').toLowerCase().replace(/[\d]/g, '').replace(/[^a-zà-ú\s]/gi, '').replace(/\s+/g, ' ').trim().slice(0, 40);
}
