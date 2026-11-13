function safeLocale(locale) {
  try {
    return Intl.NumberFormat.supportedLocalesOf([locale || 'en-US']).length ? (locale || 'en-US') : 'en-US';
  } catch {
    return 'en-US';
  }
}

export function createFormatter(summary) {
  const locale = safeLocale(summary && summary.locale);
  const cur = summary && summary.currency ? summary.currency : null;
  const grouped = (v, digits) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(v);

  const currency = v => {
    if (!cur) return grouped(v, 0);
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: cur.code, maximumFractionDigits: 0 }).format(v);
    } catch {
      return (cur.symbol || '') + grouped(v, 0);
    }
  };
  const percent = v => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '-';
    return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n) + '%';
  };
  const compact = v => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '-';
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  };
  const value = (v, format) => {
    if (v === null || v === undefined || v === '') return '-';
    if (format === 'text') return String(v);
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    if (format === 'currency') return currency(n);
    if (format === 'percent') return percent(n);
    if (format === 'integer') return grouped(Math.round(n), 0);
    return grouped(n, 2);
  };
  const toDate = iso => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const date = iso => {
    const d = toDate(iso);
    return d ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d) : String(iso || '');
  };
  const dateTime = iso => {
    const d = toDate(iso);
    return d ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d) : String(iso || '');
  };
  const ago = iso => {
    const d = toDate(iso);
    if (!d) return String(iso || '');
    const seconds = Math.round((d.getTime() - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const steps = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [unit, size] of steps) {
      if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
    }
    return rtf.format(seconds, 'second');
  };
  return { value, compact, percent, date, dateTime, ago };
}
