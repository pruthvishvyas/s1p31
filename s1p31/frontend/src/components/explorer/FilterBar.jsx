import { useState } from 'react';
import { useExplorer } from '../../context/ExplorerContext.jsx';
import { useFormat } from '../../context/FormatContext.jsx';
import { totals } from '../../utils/cube.js';

export function FilterBar({ cube, metricKey, months }) {
  const ctx = useExplorer();
  const fmt = useFormat();
  const [copyState, setCopyState] = useState('');
  const setRange = (key, value) => ctx.setFilter(key, value);
  const onCopy = () => {
    const lines = [];
    for (const [dim, value] of Object.entries(ctx.filters)) if (value) lines.push('Filter ' + dim + ': ' + value);
    for (const m of cube.metrics) lines.push(m.label + ': ' + fmt.value(totals(cube, ctx.filters, m.key), m.format));
    try {
      navigator.clipboard.writeText(lines.join('\n')).then(() => setCopyState('Copied'), () => setCopyState('Copy not available'));
    } catch {
      setCopyState('Copy not available');
    }
  };
  return (
    <div className="filter-bar card">
      <div className="field">
        <label htmlFor="ex-metric">Metric</label>
        <select id="ex-metric" value={metricKey} onChange={e => ctx.setMetricKey(e.target.value)}>
          {cube.metrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="ex-from">From</label>
        <select id="ex-from" value={ctx.filters._from || ''} onChange={e => setRange('_from', e.target.value)}>
          <option value="">Start</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="ex-to">To</label>
        <select id="ex-to" value={ctx.filters._to || ''} onChange={e => setRange('_to', e.target.value)}>
          <option value="">End</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      {cube.dimensions.map(dim => (
        <div className="field" key={dim.key}>
          <label htmlFor={'ex-' + dim.key}>{dim.label}</label>
          <select id={'ex-' + dim.key} value={ctx.filters[dim.key] || ''} onChange={e => ctx.setFilter(dim.key, e.target.value)}>
            <option value="">All</option>
            {dim.values.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      ))}
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={ctx.clearFilters}>{'Clear filters (' + ctx.activeCount + ')'}</button>
        <button type="button" className="btn-secondary" onClick={onCopy}>Copy summary</button>
        {copyState ? <span className="muted small" role="status">{copyState}</span> : null}
      </div>
    </div>
  );
}
