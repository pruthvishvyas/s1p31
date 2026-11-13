import { DataError } from './errors.js';

export const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export const humanize = key =>
  String(key === null || key === undefined ? '' : key).replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase());

export const asNumber = v => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined || typeof v === 'boolean') return null;
  const cleaned = String(v).replace(/[,\s$\u20ac\u00a3\u00a5%]/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

export const asText = (v, fallback = '') => {
  if (v === null || v === undefined) return fallback;
  if (Array.isArray(v)) return v.map(x => asText(x)).join(', ');
  if (isObj(v)) return Object.entries(v).map(([k, x]) => humanize(k) + ': ' + asText(x)).join('; ');
  return String(v);
};

export const firstOf = (o, keys) => {
  if (!isObj(o)) return undefined;
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};

const rowsOf = raw => {
  if (Array.isArray(raw)) return raw;
  if (!isObj(raw)) return null;
  for (const k of ['items', 'rows', 'data', 'records', 'results']) if (Array.isArray(raw[k])) return raw[k];
  return Object.values(raw).find(v => Array.isArray(v) && v.length > 0 && isObj(v[0])) || null;
};
const listOf = raw => rowsOf(raw);
const peek = raw => {
  if (Array.isArray(raw)) return 'a list of ' + raw.length + (raw.length && isObj(raw[0]) ? ' rows with keys ' + Object.keys(raw[0]).slice(0, 8).join(', ') : ' values');
  if (isObj(raw)) return 'an object with keys ' + Object.keys(raw).slice(0, 10).join(', ');
  return typeof raw;
};
const shape = message => new DataError('shape', message);
const PERSONAL = /(e[-_]?mail|phone|mobile|full[-_]?name|first[-_]?name|last[-_]?name)/i;

function guessFormat(key, value) {
  const k = asText(key).toLowerCase();
  if (/(rate|share|pct|percent|ratio)/.test(k)) return 'percent';
  if (/(revenue|sales|cost|price|mrr|arr|profit|amount|spend|value_total|margin_amt)/.test(k)) return 'currency';
  if (typeof value === 'number' && Number.isInteger(value)) return 'integer';
  if (typeof value === 'number') return 'decimal';
  return 'text';
}

const FORMATS = ['currency', 'percent', 'integer', 'decimal', 'text'];
function normFormat(f) {
  const s = asText(f).toLowerCase();
  if (FORMATS.includes(s)) return s;
  if (/(pct|%|percent)/.test(s)) return 'percent';
  if (/(usd|money|cur)/.test(s)) return 'currency';
  if (/(int|count|whole)/.test(s)) return 'integer';
  if (/(float|num|dec)/.test(s)) return 'decimal';
  return '';
}

function normSeverity(v) {
  const s = asText(v).toLowerCase();
  if (/(high|critical|urgent|severe|p1)/.test(s)) return 'HIGH';
  if (/(medium|moderate|warn|p2|p3)/.test(s)) return 'MEDIUM';
  return 'LOW';
}
const SEVERITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function normPriority(v) {
  const s = asText(v).toLowerCase();
  if (/(p1|urgent|critical)/.test(s)) return 'P1_URGENT';
  if (/(p2|high)/.test(s)) return 'P2_HIGH';
  if (/(p3|medium|moderate)/.test(s)) return 'P3_MEDIUM';
  return 'P4_ROUTINE';
}

function normStatus(v, hasTarget) {
  if (!hasTarget) return 'no_target';
  const s = asText(v).toLowerCase().replace(/[\s-]+/g, '_');
  if (/(off|miss|below|behind|fail|red)/.test(s)) return 'off_track';
  if (/(risk|amber|warn|watch)/.test(s)) return 'at_risk';
  if (/(no_target|none|n_a)/.test(s)) return 'no_target';
  if (/(on|met|ahead|good|green|achiev)/.test(s)) return 'on_track';
  return 'at_risk';
}

// ---------------------------------------------------------------- contract and meta
export function adaptContract(raw) {
  if (!isObj(raw)) throw shape('The data contract has an unexpected shape, found ' + peek(raw));
  const project = isObj(raw.project) ? raw.project : {};
  const t = isObj(raw.terminology) ? raw.terminology : {};
  const out = isObj(raw.outcomes) ? raw.outcomes : {};
  const pick = k => (isObj(out[k]) ? out[k] : {});
  return {
    schemaVersion: asText(raw.schema_version, '1'),
    generatedAt: asText(raw.generated_at),
    project: {
      name: asText(project.name, 'Dashboard'),
      domain: asText(project.domain),
      clientId: asText(project.client_id, asText(project.name, 'project')),
      description: asText(project.description),
    },
    terminology: {
      revenue: asText(t.revenue, 'Revenue'),
      customer: asText(t.customer, 'Customer'),
      product: asText(t.product, 'Product'),
      transaction: asText(t.transaction, 'Transaction'),
    },
    source: isObj(raw.source) ? raw.source : {},
    outcomes: { understand: pick('understand'), decide: pick('decide'), monitor: pick('monitor'), meta: pick('meta') },
    model: isObj(raw.model) ? raw.model : {},
    forecaster: isObj(raw.forecaster) ? raw.forecaster : {},
    frontend: isObj(raw.frontend) ? raw.frontend : {},
    files: Array.isArray(raw.files) ? raw.files : [],
  };
}

export function adaptSummary(raw) {
  if (!isObj(raw)) throw shape('The summary file has an unexpected shape, found ' + peek(raw));
  const range = isObj(raw.date_range) ? raw.date_range : {};
  const cur = isObj(raw.currency) && raw.currency.code ? { code: asText(raw.currency.code), symbol: asText(raw.currency.symbol) } : null;
  return {
    domain: asText(raw.domain),
    rows: asNumber(raw.rows),
    start: asText(range.start !== undefined ? range.start : raw.first_date),
    end: asText(range.end !== undefined ? range.end : raw.last_date),
    sites: asText(raw.sites),
    lastRun: asText(firstOf(raw, ['last_run', 'generated_at'])),
    currency: cur,
    locale: asText(raw.locale, 'en-US'),
    source: asText(raw.source),
  };
}

export function adaptRunLog(raw) {
  if (!isObj(raw)) throw shape('The run log has an unexpected shape, found ' + peek(raw));
  const runs = (Array.isArray(raw.runs) ? raw.runs : []).filter(isObj).map(r => ({
    started: asText(r.started),
    finished: asText(r.finished),
    stages: (Array.isArray(r.stages) ? r.stages : []).filter(isObj).map(s => ({
      name: asText(s.name), status: asText(s.status), seconds: asNumber(s.seconds), reason: asText(s.reason),
    })),
  }));
  return { runs };
}

// ---------------------------------------------------------------- understand
export function adaptKpis(raw) {
  let rows = listOf(raw);
  if (!rows && isObj(raw)) {
    rows = Object.entries(raw)
      .filter(([k, v]) => !k.startsWith('_') && k !== 'generated_at' && ['number', 'string', 'boolean'].includes(typeof v))
      .map(([key, value]) => ({ key, value }));
  }
  if (!rows) throw shape('The key numbers file has an unexpected shape, found ' + peek(raw));
  const out = rows
    .map((k, i) => {
      if (!isObj(k)) return null;
      const key = asText(firstOf(k, ['key', 'id', 'label', 'name', 'metric']), 'kpi_' + i);
      let value = typeof k.value === 'boolean' ? (k.value ? 'Yes' : 'No') : k.value;
      if (value === undefined || value === null) return null;
      const given = normFormat(k.format);
      let format = given || guessFormat(key, value);
      const n = asNumber(value);
      if (format !== 'text' && n === null) format = 'text';
      if (!given && format === 'percent' && n !== null && Math.abs(n) <= 1) value = n * 100;
      return {
        key: key + '-' + i,
        label: asText(firstOf(k, ['label', 'name', 'metric']), humanize(key)),
        value, format,
        trend: asNumber(firstOf(k, ['trend', 'change', 'delta', 'change_pct'])),
        note: asText(firstOf(k, ['note', 'description'])),
      };
    })
    .filter(Boolean);
  if (out.length === 0) throw shape('No usable key numbers found, found ' + peek(raw));
  return out;
}

function seriesRows(raw) {
  const pair = (a, b) => (Array.isArray(a) && Array.isArray(b) ? a.map((x, i) => ({ label: x, x, value: b[i], y: b[i] })) : null);
  const d = raw.data !== undefined ? raw.data : raw.rows !== undefined ? raw.rows : raw.points;
  if (Array.isArray(d) && d.length && isObj(d[0]) && Array.isArray(d[0].x) && Array.isArray(d[0].y)) return pair(d[0].x, d[0].y);
  if (Array.isArray(d) && d.length && Array.isArray(d[0])) return d.map(r => ({ label: r[0], x: r[0], value: r[1], y: r[1] }));
  if (Array.isArray(d)) return d;
  if (isObj(d)) {
    const p = pair(d.x, d.y) || pair(d.labels, d.values) || pair(d.categories, d.values);
    if (p) return p;
    const entries = Object.entries(d);
    if (entries.length && entries.every(([, v]) => asNumber(v) !== null)) return entries.map(([k, v]) => ({ label: k, x: k, value: v, y: v }));
  }
  return pair(raw.x, raw.y) || pair(raw.labels, raw.values) || pair(raw.categories, raw.values) || pair(raw.x, raw.values) || null;
}

function matrixRows(m, xs, ys) {
  const out = [];
  m.forEach((line, i) => {
    if (!Array.isArray(line)) return;
    line.forEach((v, j) => {
      const value = asNumber(v);
      if (value === null) return;
      out.push({ row: asText(ys && ys[i] !== undefined ? ys[i] : i + 1), col: asText(xs && xs[j] !== undefined ? xs[j] : j + 1), value });
    });
  });
  return out;
}

function heatRows(raw) {
  const d = [raw.data, raw.rows, raw.matrix, raw.z, raw.values, raw.correlation].find(v => v !== undefined && v !== null);
  const xs = [raw.columns, raw.x_labels, raw.labels, raw.x].find(Array.isArray);
  const ys = [raw.index, raw.y_labels, raw.y].find(Array.isArray) || xs;
  if (Array.isArray(d) && d.length && isObj(d[0]) && Array.isArray(d[0].z)) return matrixRows(d[0].z, d[0].x || xs, d[0].y || ys);
  if (isObj(d) && Array.isArray(d.z)) return matrixRows(d.z, d.x || d.columns || xs, d.y || d.index || ys);
  if (isObj(d) && Array.isArray(d.matrix)) return matrixRows(d.matrix, d.labels || d.columns || xs, d.labels || d.index || ys);
  if (Array.isArray(d) && d.length && Array.isArray(d[0])) return matrixRows(d, xs, ys);
  if (Array.isArray(d) && d.length && isObj(d[0])) {
    const f = d[0];
    const rk = ['row', 'y', 'a', 'var1', 'feature_1', 'measure_1', 'measure_a'].find(k => f[k] !== undefined);
    const ck = ['col', 'column', 'x', 'b', 'var2', 'feature_2', 'measure_2', 'measure_b'].find(k => f[k] !== undefined && k !== rk);
    const vk = ['value', 'corr', 'correlation', 'z', 'r'].find(k => f[k] !== undefined);
    if (rk && ck && vk) return d.map(r => ({ row: asText(r[rk]), col: asText(r[ck]), value: asNumber(r[vk]) }));
    const labelKey = ['index', 'measure', 'variable', 'name', 'metric', 'feature', 'label'].find(k => typeof f[k] === 'string')
      || Object.keys(f).find(k => typeof f[k] === 'string' && asNumber(f[k]) === null);
    const out = [];
    d.forEach((r, i) => {
      for (const [k, v] of Object.entries(r)) {
        if (k === labelKey || asNumber(v) === null) continue;
        out.push({ row: asText(labelKey && r[labelKey] !== undefined ? r[labelKey] : i + 1), col: k, value: asNumber(v) });
      }
    });
    return out;
  }
  if (isObj(d)) {
    const out = [];
    for (const [rk, inner] of Object.entries(d)) {
      if (!isObj(inner)) return null;
      for (const [ck, v] of Object.entries(inner)) out.push({ row: rk, col: ck, value: asNumber(v) });
    }
    return out;
  }
  return null;
}

function normType(t) {
  const s = asText(t, 'bar').toLowerCase();
  if (/(line|area|trend|time)/.test(s)) return 'line';
  if (/hist/.test(s)) return 'histogram';
  if (/scatter/.test(s)) return 'scatter';
  if (/(heat|corr|matrix)/.test(s)) return 'heatmap';
  if (/(donut|doughnut)/.test(s)) return 'doughnut';
  if (/pie/.test(s)) return 'pie';
  return 'bar';
}

function labelValue(r) {
  if (!isObj(r)) return { label: '', value: asNumber(r) };
  const label = firstOf(r, ['label', 'x', 'name', 'category', 'date', 'bucket', 'bin', 'week', 'month', 'day']);
  const value = firstOf(r, ['value', 'y', 'count', 'total', 'amount', 'n']);
  if (label !== undefined && value !== undefined) return { label: asText(label), value: asNumber(value) };
  const entries = Object.entries(r);
  const strEntry = entries.find(([, v]) => typeof v === 'string' && asNumber(v) === null);
  const numEntry = entries.find(([k, v]) => (!strEntry || k !== strEntry[0]) && asNumber(v) !== null);
  return {
    label: asText(label !== undefined ? label : strEntry ? strEntry[1] : ''),
    value: asNumber(value !== undefined ? value : numEntry ? numEntry[1] : null),
  };
}

export function adaptChart(raw) {
  if (!isObj(raw)) throw shape('A chart file has an unexpected shape, found ' + peek(raw));
  const type = normType(raw.type !== undefined ? raw.type : raw.chart_type);
  const rows = type === 'heatmap' ? (heatRows(raw) || seriesRows(raw)) : seriesRows(raw);
  if (!rows) throw shape('Chart has no data, found ' + peek(raw));
  let cleaned;
  if (type === 'scatter') {
    cleaned = rows.map(r => ({ x: asNumber(r && r.x), y: asNumber(r && r.y), label: asText(r && r.label) }))
      .filter(r => r.x !== null && r.y !== null).slice(0, 1500);
  } else if (type === 'heatmap') {
    cleaned = rows.map(r => ({ row: asText(r && r.row), col: asText(r && r.col), value: asNumber(r && r.value) }))
      .filter(r => r.value !== null);
  } else {
    cleaned = rows.map(labelValue).filter(r => r.value !== null);
  }
  if (cleaned.length === 0) throw shape('Chart has no plottable rows');
  const known = ['bar', 'line', 'histogram', 'scatter', 'heatmap', 'pie', 'doughnut'];
  return {
    id: asText(raw.id, 'chart'),
    title: asText(firstOf(raw, ['title', 'name', 'id']), 'Chart'),
    type: known.includes(type) ? type : 'bar',
    question: asText(raw.question),
    outcome: asText(raw.outcome),
    tab: asText(raw.tab),
    pending: false,
    xLabel: asText(raw.x_label),
    yLabel: asText(raw.y_label),
    rows: cleaned,
  };
}

export function adaptChartFile(raw, stub) {
  let body = Array.isArray(raw) ? { data: raw } : raw;
  if (isObj(body) && seriesRows(body) === null && heatRows(body) === null && isObj(body.chart)) body = body.chart;
  if (isObj(body) && seriesRows(body) === null && heatRows(body) === null && isObj(body.spec)) body = body.spec;
  if (!isObj(body)) throw shape('A chart file has an unexpected shape, found ' + peek(raw));
  const base = stub ? { id: stub.id, title: stub.title, type: stub.type, question: stub.question, tab: stub.tab } : {};
  const merged = { ...base };
  for (const [k, v] of Object.entries(body)) if (v !== undefined && v !== null && v !== '') merged[k] = v;
  return adaptChart(merged);
}

export function adaptCharts(raw) {
  const rows = listOf(raw);
  if (!rows) throw shape('The charts file has an unexpected shape, found ' + peek(raw));
  const out = [];
  const seen = new Set();
  let lastError = '';
  for (const r of rows) {
    try {
      const chart = isObj(r) && seriesRows(r) === null && heatRows(r) === null && typeof r.file === 'string' && r.file
        ? { pending: true, id: asText(r.id, 'chart'), title: asText(firstOf(r, ['title', 'name', 'id']), 'Chart'), type: r.type, question: asText(r.question), tab: asText(r.tab), file: r.file }
        : adaptChart(r);
      if (seen.has(chart.id)) chart.id = chart.id + '-' + out.length;
      seen.add(chart.id);
      out.push(chart);
    } catch (err) { lastError = err.message; /* one bad chart never hides the others */ }
  }
  if (out.length === 0) throw shape('No usable charts found (' + lastError + ')');
  return out;
}

export function adaptSegments(raw) {
  const rows = listOf(raw) || (isObj(raw) && Array.isArray(raw.segments) ? raw.segments : null);
  if (!rows) throw shape('The segments file has an unexpected shape, found ' + peek(raw));
  const SIZE_KEYS = ['size', 'count', 'n', 'members', 'customers', 'accounts', 'records', 'rows', 'orders', 'days', 'n_days', 'num_days', 'total', 'volume', 'observations', 'population', 'n_records'];
  const SKIP = /^(share|pct|percent|id|cluster|segment_id|name|segment|label|description|profile)$/;
  const items = rows.map((s, i) => {
    if (!isObj(s)) return null;
    const flat = {};
    for (const [k, v] of Object.entries(s)) {
      if (isObj(v)) for (const [k2, v2] of Object.entries(v)) flat[k2] = v2;
      else flat[k] = v;
    }
    const numeric = Object.keys(flat).filter(k => typeof flat[k] !== 'boolean' && asNumber(flat[k]) !== null && !SKIP.test(k));
    const sizeKey = SIZE_KEYS.find(k => numeric.includes(k)) || numeric.find(k => /(count|^n_|_n$|size|days|orders|records|rows|number)/.test(k));
    const summary = {};
    for (const k of numeric) if (k !== sizeKey) summary[humanize(k)] = asNumber(flat[k]);
    const words = ['rule', 'range', 'criteria', 'definition', 'band'].map(k => flat[k]).filter(v => typeof v === 'string' && v);
    return {
      id: 'segment-' + i,
      name: asText(firstOf(s, ['name', 'segment', 'label', 'cluster', 'tier', 'level']), 'Segment ' + (i + 1)),
      size: sizeKey ? asNumber(flat[sizeKey]) : null,
      sizeLabel: sizeKey ? humanize(sizeKey) : '',
      share: asNumber(firstOf(flat, ['share', 'pct', 'percent'])),
      description: asText(firstOf(s, ['description', 'summary_text', 'profile']), words.join('. ')),
      summary,
    };
  }).filter(Boolean);
  if (items.length === 0) throw shape('No usable segments found, found ' + peek(raw));
  const sizeTotal = items.reduce((a, s) => a + (s.size || 0), 0);
  const shareTotal = items.reduce((a, s) => a + (s.share || 0), 0);
  for (const s of items) {
    if (s.share === null && s.size !== null && sizeTotal > 0) s.share = (s.size / sizeTotal) * 100;
    else if (s.share !== null && shareTotal > 0 && shareTotal <= 1.5) s.share = s.share * 100;
  }
  return items;
}

export function adaptAnomalies(raw) {
  const rows = listOf(raw) || (isObj(raw) && Array.isArray(raw.rows) ? raw.rows : null);
  if (!rows) throw shape('The anomalies file has an unexpected shape, found ' + peek(raw));
  const cleaned = rows.filter(isObj).map((r, i) => {
    const row = { _i: i };
    for (const [k, v] of Object.entries(r)) {
      if (PERSONAL.test(k)) continue;
      if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) row[k] = v;
    }
    return row;
  });
  const preferred = ['date', 'id', 'metric', 'value', 'expected', 'score', 'reason'];
  const keys = [];
  for (const row of cleaned.slice(0, 50)) for (const k of Object.keys(row)) if (k !== '_i' && !keys.includes(k)) keys.push(k);
  keys.sort((a, b) => {
    const ia = preferred.indexOf(a);
    const ib = preferred.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const given = isObj(raw) ? asNumber(firstOf(raw, ['count', 'total'])) : null;
  return {
    total: given !== null ? given : cleaned.length,
    rate: isObj(raw) ? asNumber(raw.rate) : null,
    method: isObj(raw) ? asText(raw.method) : '',
    rows: cleaned,
    columns: keys.slice(0, 8),
  };
}

export function adaptCube(raw) {
  if (!isObj(raw) || !Array.isArray(raw.dimensions) || !Array.isArray(raw.metrics) || !Array.isArray(raw.rows)) {
    throw shape('The explorer file has an unexpected shape, found ' + peek(raw));
  }
  const dimensions = raw.dimensions.filter(d => isObj(d) && d.key).map(d => ({
    key: asText(d.key), label: asText(d.label, humanize(d.key)), values: (Array.isArray(d.values) ? d.values : []).map(v => asText(v)),
  }));
  const metrics = raw.metrics.filter(m => isObj(m) && m.key).map(m => ({
    key: asText(m.key), label: asText(m.label, humanize(m.key)), agg: asText(m.agg, 'sum'),
    format: normFormat(m.format) || 'decimal', num: asText(m.num), den: asText(m.den),
  }));
  const rows = raw.rows.filter(r => isObj(r) && r.t !== undefined && r.t !== null && isObj(r.m)).map(r => ({
    d: isObj(r.d) ? r.d : {}, t: asText(r.t), m: r.m,
  }));
  if (metrics.length === 0 || rows.length === 0) throw shape('The explorer file has no usable rows');
  return { dimensions, metrics, rows, time: isObj(raw.time) ? raw.time : {} };
}

// ---------------------------------------------------------------- decide
export function adaptInsights(raw) {
  const rows = listOf(raw);
  if (!rows) throw shape('The insights file has an unexpected shape, found ' + peek(raw));
  const items = rows.filter(isObj).map((r, i) => ({
    id: 'insight-' + i,
    severity: normSeverity(r.severity),
    category: asText(firstOf(r, ['category', 'area', 'type'])),
    finding: asText(firstOf(r, ['finding', 'insight', 'title', 'message']), asText(Object.values(r).filter(v => typeof v === 'string').sort((a, b) => b.length - a.length)[0])),
    evidence: asText(firstOf(r, ['evidence', 'detail', 'details'])),
    action: asText(firstOf(r, ['action', 'recommendation', 'next_step'])),
    outcome: asText(r.outcome),
  })).filter(r => r.finding);
  if (items.length === 0) throw shape('No usable insights found, found ' + peek(raw));
  return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export function adaptRecommendations(raw) {
  const rows = listOf(raw) || (isObj(raw) && Array.isArray(raw.rows) ? raw.rows : null);
  if (!rows) throw shape('The recommendations file has an unexpected shape, found ' + peek(raw));
  const items = rows.filter(isObj).map((r, i) => ({
    id: 'rec-' + i,
    priority: normPriority(firstOf(r, ['priority', 'level', 'severity'])),
    title: asText(firstOf(r, ['title', 'recommendation', 'name', 'issue', 'action']), asText(Object.values(r).filter(v => typeof v === 'string').sort((a, b) => b.length - a.length)[0])),
    action: asText(firstOf(r, ['action', 'recommendation', 'description'])),
    evidence: asText(firstOf(r, ['evidence', 'detail', 'reason'])),
    impact: asText(firstOf(r, ['impact', 'expected_impact'])),
    when: asText(firstOf(r, ['when', 'timing', 'due'])),
    count: asNumber(r.count),
  })).filter(r => r.title);
  if (items.length === 0) throw shape('No usable recommendations found, found ' + peek(raw));
  return items.sort((a, b) => a.priority.localeCompare(b.priority));
}

export function adaptSimulationIndex(raw) {
  const rows = listOf(raw) || (isObj(raw) && Array.isArray(raw.simulations) ? raw.simulations : null);
  if (!rows) throw shape('The simulations file has an unexpected shape, found ' + peek(raw));
  const items = rows.filter(isObj).map((r, i) => {
    const id = asText(firstOf(r, ['id', 'key', 'name']), 'simulation_' + i);
    let file = asText(firstOf(r, ['file', 'path']));
    if (!file || file.includes('..') || !file.endsWith('.json')) file = 'decide/simulations/' + id + '.json';
    file = file.replace(/^\/+/, '');
    if (!file.includes('/')) file = 'decide/simulations/' + file;
    return { id, title: asText(r.title, humanize(id)), file };
  });
  if (items.length === 0) throw shape('No simulations listed');
  return items;
}

function assumptionList(v) {
  if (Array.isArray(v)) return v.map(x => asText(x)).filter(Boolean);
  if (isObj(v)) return Object.entries(v).map(([k, x]) => humanize(k) + ': ' + asText(x));
  return v ? [asText(v)] : [];
}

export function adaptSimulation(raw) {
  if (!isObj(raw)) throw shape('A simulation file has an unexpected shape, found ' + peek(raw));
  const pts = Array.isArray(raw.table) ? raw.table : Array.isArray(raw.points) ? raw.points : null;
  if (!pts) throw shape('This simulation has no points');
  const v = raw.variable;
  let xKey = isObj(v) && v.key ? asText(v.key) : (typeof v === 'string' ? v : null);
  const sample = pts.find(isObj);
  if (!sample) throw shape('This simulation has no usable points');
  if (!isObj(sample.values) && (!xKey || sample[xKey] === undefined)) {
    xKey = sample.x !== undefined ? 'x' : (Object.keys(sample).find(k => asNumber(sample[k]) !== null) || null);
  }
  const table = [];
  for (const p of pts) {
    if (!isObj(p)) continue;
    const values = {};
    let x = null;
    if (isObj(p.values) && p.x !== undefined) {
      x = asNumber(p.x);
      for (const [k, val] of Object.entries(p.values)) if (asNumber(val) !== null) values[k] = asNumber(val);
    } else if (xKey) {
      x = asNumber(p[xKey]);
      for (const [k, val] of Object.entries(p)) if (k !== xKey && asNumber(val) !== null && !/^(id|index)$/.test(k)) values[k] = asNumber(val);
    }
    if (x !== null && Object.keys(values).length > 0) table.push({ x, values });
  }
  table.sort((a, b) => a.x - b.x);
  if (table.length < 2 || table[0].x === table[table.length - 1].x) throw shape('This simulation needs at least two different points');
  const keys = [];
  for (const row of table) for (const k of Object.keys(row.values)) if (!keys.includes(k)) keys.push(k);
  const given = Array.isArray(raw.outputs) ? raw.outputs.filter(o => isObj(o) && o.key) : [];
  const outputs = (given.length ? given.map(o => asText(o.key)).filter(k => keys.includes(k)) : keys).map(k => {
    const meta = given.find(o => asText(o.key) === k) || {};
    return { key: k, label: asText(meta.label, humanize(k)), format: normFormat(meta.format) || guessFormat(k, table[0].values[k]) };
  });
  if (outputs.length === 0) throw shape('This simulation has no outputs');
  const first = table[0].x;
  const last = table[table.length - 1].x;
  const vm = isObj(v) ? v : {};
  const min = asNumber(vm.min) !== null ? asNumber(vm.min) : first;
  const max = asNumber(vm.max) !== null ? asNumber(vm.max) : last;
  let def = asNumber(vm.default);
  if (def === null) def = min <= 0 && max >= 0 ? table.reduce((b, r) => (Math.abs(r.x) < Math.abs(b.x) ? r : b), table[0]).x : table[Math.floor(table.length / 2)].x;
  let step = asNumber(vm.step);
  if (!step || step <= 0) {
    const gaps = table.slice(1).map((r, i) => r.x - table[i].x).filter(g => g > 0);
    step = gaps.length ? Math.min(...gaps) : (max - min) / 50 || 1;
  }
  const xFormat = normFormat(vm.format) || guessFormat(xKey, first);
  return {
    id: asText(raw.id, 'simulation'),
    title: asText(raw.title, 'Simulation'),
    description: asText(raw.description),
    periodTotal: asNumber(raw.period_total_revenue),
    variable: {
      key: asText(xKey), label: asText(vm.label, humanize(xKey)), unit: asText(vm.unit),
      min, max, step, default: def,
      format: xFormat === 'percent' && Math.max(Math.abs(min), Math.abs(max)) <= 1 ? 'decimal' : xFormat,
    },
    outputs, table,
    assumptions: assumptionList(raw.assumptions),
  };
}

export function adaptGoals(raw) {
  let rows = listOf(raw);
  if (!rows && isObj(raw)) {
    rows = Object.entries(raw)
      .filter(([k, v]) => !k.startsWith('_') && k !== 'generated_at' && v !== undefined)
      .map(([key, v]) => (isObj(v) ? { key, ...v } : { key, target: v }));
  }
  if (!rows) throw shape('The goals file has an unexpected shape, found ' + peek(raw));
  const items = rows.filter(isObj).map((g, i) => {
    const key = asText(firstOf(g, ['key', 'id', 'name']), 'goal_' + i);
    const target = asNumber(firstOf(g, ['target', 'value']));
    let unit = asText(g.unit).toLowerCase();
    if (!unit) unit = /(_pct|percent|rate)/.test(key) ? 'percent' : /(revenue|sales|cost)/.test(key) ? 'currency' : /(horizon|days|window)/.test(key) ? 'days' : 'number';
    return {
      key,
      label: asText(g.label, humanize(key.replace(/_pct$/, ''))),
      target, unit,
      description: asText(g.description),
      clientSets: Boolean(g.client_sets) || target === null,
    };
  });
  if (items.length === 0) throw shape('No goals found');
  return items;
}

export function adaptGoalProgress(raw) {
  if (!isObj(raw)) throw shape('The goal progress file has an unexpected shape, found ' + peek(raw));
  const meta = {
    asOf: asText(raw.as_of),
    windowDays: asNumber(raw.window_days),
    p1Count: asNumber(raw.p1_count),
    revenueChange: asNumber(raw.revenue_change_pct),
    marginChange: asNumber(raw.margin_change_pts),
  };
  const rows = listOf(raw);
  let items;
  if (rows) {
    items = rows.filter(isObj).map(r => {
      const target = asNumber(r.target);
      const actual = asNumber(r.actual);
      let pct = asNumber(r.pct);
      if (pct === null && target && actual !== null) pct = (actual / target) * 100;
      return {
        key: asText(r.key), label: asText(r.label, humanize(r.key)), target, actual,
        unit: asText(r.unit, 'number').toLowerCase(), pct, status: normStatus(r.status, target !== null),
      };
    });
  } else {
    const build = (key, label, actualKey, targetKey, statusKey, unit) => {
      let actual = asNumber(raw[actualKey]);
      const target = asNumber(raw[targetKey]);
      if (unit === 'percent' && actual !== null && target !== null && actual <= 1 && target > 1) actual *= 100;
      const pct = target && actual !== null ? (actual / target) * 100 : null;
      return { key, label, target, actual, unit, pct, status: normStatus(raw[statusKey], target !== null) };
    };
    items = [
      build('revenue', 'Revenue', 'revenue_actual', 'revenue_target', 'revenue_status', 'currency'),
      build('margin', 'Margin', 'margin_pct_actual', 'margin_target_pct', 'margin_status', 'percent'),
      build('on_time', 'On-time delivery', 'on_time_actual', 'on_time_target_pct', 'on_time_status', 'percent'),
    ].filter(i => i.actual !== null || i.target !== null);
  }
  if (items.length === 0) throw shape('No usable goal progress found, found ' + peek(raw));
  return { items, ...meta };
}

export function adaptAlerts(raw) {
  const rows = listOf(raw) || (isObj(raw) && Array.isArray(raw.alerts) ? raw.alerts : null);
  if (!rows) throw shape('The alerts file has an unexpected shape, found ' + peek(raw));
  const items = rows.filter(isObj).map((r, i) => ({
    id: 'alert-' + i,
    severity: normSeverity(firstOf(r, ['severity', 'level', 'priority'])),
    title: asText(firstOf(r, ['title', 'alert', 'name', 'metric']), 'Alert'),
    message: asText(firstOf(r, ['message', 'description', 'detail'])),
    metric: asText(r.metric),
    value: asNumber(r.value),
    threshold: asNumber(r.threshold),
    since: asText(firstOf(r, ['since', 'date', 'detected_at', 'timestamp'])),
  }));
  return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

// ---------------------------------------------------------------- monitor
const TIME_KEYS = ['t', 'date', 'ds', 'day', 'week', 'month', 'period', 'timestamp', 'time'];
const ACTUAL_KEYS = ['actual', 'history', 'observed', 'actuals', 'y'];
const FORECAST_KEYS = ['forecast', 'yhat', 'prediction', 'predicted', 'pred', 'forecast_value'];
const LOW_KEYS = ['low', 'lower', 'yhat_lower', 'lower_bound', 'lo', 'p10', 'lower_ci'];
const HIGH_KEYS = ['high', 'upper', 'yhat_upper', 'upper_bound', 'hi', 'p90', 'upper_ci'];

function numberFrom(row, keys) {
  for (const k of keys) {
    const n = asNumber(row[k]);
    if (n !== null) return n;
  }
  return null;
}

function seriesToRows(series) {
  if (Array.isArray(series)) return series;
  if (!isObj(series)) return [];
  const tk = TIME_KEYS.find(k => Array.isArray(series[k]));
  if (tk) {
    return series[tk].map((t, i) => {
      const row = {};
      for (const [k, col] of Object.entries(series)) if (Array.isArray(col)) row[k] = col[i];
      return row;
    });
  }
  const hist = ['history', 'actual', 'actuals', 'observed'].map(k => series[k]).find(Array.isArray);
  const fut = ['forecast', 'predicted', 'predictions', 'future'].map(k => series[k]).find(Array.isArray);
  if (hist || fut) {
    return [
      ...(hist || []).map(r => (isObj(r) ? { ...r, __kind: 'history' } : r)),
      ...(fut || []).map(r => (isObj(r) ? { ...r, __kind: 'forecast' } : r)),
    ];
  }
  return Object.values(series).find(Array.isArray) || [];
}

function timeLabel(v) {
  const s = asText(v);
  return /^\d{4}-\d{2}-\d{2}T00:00:00/.test(s) ? s.slice(0, 10) : s;
}

export function adaptForecast(raw) {
  if (!raw || typeof raw !== 'object') throw shape('The forecast file has an unexpected shape, found ' + peek(raw));
  const rows = seriesToRows(Array.isArray(raw) ? raw : raw.series !== undefined ? raw.series : raw);
  const history = [];
  const future = [];
  const both = [];
  for (const r of rows) {
    if (!isObj(r)) continue;
    const tKey = TIME_KEYS.find(k => r[k] !== undefined && r[k] !== null);
    if (!tKey) continue;
    const t = timeLabel(r[tKey]);
    const actual = numberFrom(r, ACTUAL_KEYS);
    const fc = numberFrom(r, FORECAST_KEYS);
    const low = numberFrom(r, LOW_KEYS);
    const high = numberFrom(r, HIGH_KEYS);
    if (actual === null && fc === null) {
      const generic = asNumber(r.value);
      if (generic === null) continue;
      const marker = asText(firstOf(r, ['__kind', 'type', 'kind', 'split', 'set'])).toLowerCase();
      const isFuture = r.is_forecast === true || /(forecast|pred|future)/.test(marker);
      if (isFuture) future.push({ t, value: generic, low, high });
      else history.push({ t, value: generic });
      continue;
    }
    if (actual !== null) history.push({ t, value: actual });
    if (fc !== null && (actual === null || /(forecast|future|pred)/.test(asText(r.__kind)) || r.is_forecast === true)) {
      future.push({ t, value: fc, low, high });
    } else if (fc !== null) {
      both.push({ t, value: fc, low, high });
    }
  }
  const forecast = future.length ? future : both;
  if (history.length === 0 && forecast.length === 0) throw shape('The forecast file has no usable series');
  let m = isObj(raw.metrics) ? raw.metrics : isObj(raw.error) ? raw.error : null;
  if (m && m.mae === undefined && m.mape === undefined && m.MAE === undefined && m.MAPE === undefined) {
    const inner = Object.values(m).find(isObj);
    if (inner) m = inner;
  }
  let error = null;
  if (m) {
    const mae = asNumber(firstOf(m, ['mae', 'MAE']));
    let mape = asNumber(firstOf(m, ['mape', 'MAPE', 'mape_pct']));
    if (mape !== null && Math.abs(mape) <= 1) mape *= 100;
    if (mae !== null || mape !== null) {
      error = {
        mae, mape,
        baselineMae: asNumber(firstOf(m, ['baseline_mae', 'naive_mae', 'baseline'])),
        period: asText(firstOf(m, ['period', 'holdout', 'test_period'])),
      };
    }
  }
  const info = isObj(raw) ? raw : {};
  const mi = m || {};
  return {
    metric: asText(firstOf(info, ['metric', 'target']), asText(firstOf(mi, ['metric', 'target']), 'Forecast')),
    unit: asText(firstOf(info, ['unit']), asText(mi.unit)).toLowerCase(),
    horizon: asText(firstOf(info, ['horizon', 'forecast_horizon']), String(forecast.length)),
    method: asText(firstOf(info, ['method', 'model']), asText(firstOf(mi, ['method', 'model']))),
    history, forecast, error,
    note: asText(info.note),
  };
}

export function adaptForecastLookup(raw) {
  const table = raw && Array.isArray(raw.table) ? raw.table : null;
  if (!table) throw shape('The lookup file has an unexpected shape, found ' + peek(raw));
  const rows = table
    .map(r => ({ x: asNumber(r && r.x), value: asNumber(r && r.value), low: asNumber(r && r.low), high: asNumber(r && r.high) }))
    .filter(r => r.x !== null && r.value !== null)
    .sort((a, b) => a.x - b.x);
  if (rows.length === 0) throw shape('The lookup table has no usable rows');
  return { inputLabel: asText(raw.input_label, 'Input'), outputLabel: asText(raw.output_label, 'Result'), table: rows };
}

export function adaptScorer(raw) {
  if (!raw || typeof raw !== 'object') throw shape('The scoring file has an unexpected shape, found ' + peek(raw));
  const type = asText(raw.type).toLowerCase();
  if (type !== 'linear' && type !== 'knn') throw shape('Scoring type must be linear or knn');
  const task = asText(raw.task, 'classification').toLowerCase() === 'regression' ? 'regression' : 'classification';
  const fields = (Array.isArray(raw.fields) ? raw.fields : []).map(f => {
    if (!f || typeof f !== 'object' || !f.key) return null;
    const ftype = ['number', 'category', 'boolean'].includes(f.type) ? f.type : 'number';
    const options = ftype === 'boolean' ? ['No', 'Yes'] : (Array.isArray(f.options) ? f.options.map(o => asText(o)) : []);
    if (ftype !== 'number' && options.length === 0) return null;
    return {
      key: asText(f.key), label: asText(f.label, humanize(f.key)), type: ftype, unit: asText(f.unit),
      min: asNumber(f.min), max: asNumber(f.max), step: asNumber(f.step) || 1,
      default: ftype === 'number' ? asNumber(f.default) : (f.default === undefined || f.default === null ? null : asText(f.default)),
      options, help: asText(f.help),
    };
  }).filter(Boolean);
  if (fields.length === 0) throw shape('The scoring file lists no input fields');
  const keys = new Set(fields.map(f => f.key));
  const out = {
    type, task, fields,
    target: { label: asText(raw.target && raw.target.label, 'Predicted value'), format: asText(raw.target && raw.target.format, task === 'classification' ? 'percent' : 'decimal'), positive: asText(raw.target && raw.target.positive_label) },
    riskLevels: (Array.isArray(raw.risk_levels) ? raw.risk_levels : []).map(l => ({ max: asNumber(l && l.max), label: asText(l && l.label) })).filter(l => l.max !== null && l.label).sort((a, b) => a.max - b.max),
    fidelity: raw.fidelity && typeof raw.fidelity === 'object' ? { metric: asText(raw.fidelity.metric), value: asNumber(raw.fidelity.value), n: asNumber(raw.fidelity.n), quality: asText(raw.fidelity.quality), note: asText(raw.fidelity.note) } : null,
    note: asText(raw.note),
  };
  if (type === 'linear') {
    const lin = raw.linear;
    const terms = lin && Array.isArray(lin.terms) ? lin.terms : null;
    if (!lin || asNumber(lin.intercept) === null || !terms) throw shape('Linear scoring needs an intercept and terms');
    out.linear = {
      intercept: asNumber(lin.intercept), link: asText(lin.link, 'identity') === 'logit' ? 'logit' : 'identity',
      terms: terms.map(t => {
        if (!t || !keys.has(asText(t.field)) || asNumber(t.coef) === null) throw shape('A scoring term refers to an unknown field');
        const categorical = t.value !== undefined && t.value !== null;
        return { field: asText(t.field), coef: asNumber(t.coef), value: categorical ? asText(t.value) : null, mean: asNumber(t.mean) || 0, scale: asNumber(t.scale) || 1 };
      }),
    };
  } else {
    const knn = raw.knn;
    const ref = knn && Array.isArray(knn.reference) ? knn.reference : null;
    if (!ref) throw shape('Neighbour scoring needs a reference table');
    const reference = ref.map(r => ({ x: r && r.x && typeof r.x === 'object' ? r.x : null, y: asNumber(r && r.y) })).filter(r => r.x && r.y !== null);
    if (reference.length < 5) throw shape('The reference table is too small to predict from');
    const std = {};
    for (const f of fields) if (f.type === 'number') std[f.key] = asNumber(knn.std && knn.std[f.key]) || 1;
    out.knn = { k: Math.max(1, Math.round(asNumber(knn.k) || 25)), std, reference };
  }
  return out;
}
