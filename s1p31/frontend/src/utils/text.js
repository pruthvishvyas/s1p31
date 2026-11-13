export function refreshHint() {
  const dev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
  return dev
    ? 'In the backend folder run main.py and then export_for_frontend.py, then run npm run check in this folder.'
    : 'The analysis data for this section was not published with this site. Run the backend steps again and publish a new version.';
}

// Splits text into parts so a search term can be highlighted without touching HTML
export function splitMatches(text, query) {
  const q = String(query || '').trim();
  const source = String(text);
  if (!q) return [{ text: source, hit: false }];
  const lower = source.toLowerCase();
  const needle = q.toLowerCase();
  const parts = [];
  let from = 0;
  let at = lower.indexOf(needle, from);
  while (at !== -1) {
    if (at > from) parts.push({ text: source.slice(from, at), hit: false });
    parts.push({ text: source.slice(at, at + needle.length), hit: true });
    from = at + needle.length;
    at = lower.indexOf(needle, from);
  }
  if (from < source.length) parts.push({ text: source.slice(from), hit: false });
  return parts;
}

export function clip(value, max) {
  const s = String(value);
  return s.length > max ? s.slice(0, max - 1) + '...' : s;
}
