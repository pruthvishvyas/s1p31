import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { useChartColors } from '../../hooks/useChartColors.js';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { DrillDownPanel } from '../explorer/DrillDownPanel.jsx';
import { clip } from '../../utils/text.js';

export function SegmentExplorer() {
  const query = useDataset('segments');
  const fmt = useFormat();
  const colors = useChartColors();
  const [openId, setOpenId] = useState('');
  if (query.loading || query.error) {
    return <DataState query={query} label="segments" skeleton={<SkeletonCard count={3} height={140} />} />;
  }
  const items = query.data;
  const chosen = items.find(s => s.id === openId);
  const hasSize = items.some(s => s.size !== null);
  const common = Object.keys(items[0].summary).find(k => items.every(s => s.summary[k] !== undefined));
  const chartTitle = hasSize ? 'Segment sizes' : common || '';
  const chartRows = hasSize
    ? items.filter(s => s.size !== null).map(s => ({ label: s.name, value: s.size }))
    : common ? items.map(s => ({ label: s.name, value: s.summary[common] })) : [];
  return (
    <div>
      <div className="grid">
        {items.map(s => {
          const metrics = Object.entries(s.summary).slice(0, 4);
          return (
            <button type="button" key={s.id} className="card segment-card" onClick={() => setOpenId(s.id)}>
              <h3>{s.name}</h3>
              {s.size !== null ? <p className="kpi-value">{fmt.value(s.size, 'integer')}</p> : null}
              {s.size !== null && s.sizeLabel ? <p className="muted small">{s.sizeLabel}</p> : null}
              {s.share !== null ? (
                <div>
                  <div className="progress" aria-hidden="true"><div className="progress-fill" style={{ width: Math.min(100, Math.max(0, s.share)) + '%' }} /></div>
                  <p className="muted small">{fmt.percent(s.share) + ' of the total'}</p>
                </div>
              ) : null}
              {metrics.length > 0 ? (
                <dl className="metric-list">
                  {metrics.map(([label, v]) => (
                    <div key={label}><dt className="muted small">{label}</dt><dd>{fmt.value(v, 'decimal')}</dd></div>
                  ))}
                </dl>
              ) : null}
              {s.description ? <p className="muted small">{s.description}</p> : null}
              {s.size === null && metrics.length === 0 && !s.description ? <p className="muted small">No measures were exported for this segment.</p> : null}
            </button>
          );
        })}
      </div>
      {chartRows.length > 0 ? (
        <article className="card chart-card">
          <h3 className="chart-title">{chartTitle}</h3>
          <p className="muted">{hasSize ? 'How many records fall in each segment.' : 'Compared across segments.'}</p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke={colors.grid} tick={{ fill: colors.text, fontSize: 12 }} tickFormatter={v => clip(v, 14)} />
                <YAxis stroke={colors.grid} tick={{ fill: colors.text, fontSize: 12 }} tickFormatter={v => fmt.compact(v)} width={56} />
                <Tooltip contentStyle={{ background: colors.surface, border: '1px solid ' + colors.grid, color: colors.textPrimary }} formatter={v => fmt.value(v, 'decimal')} />
                <Bar dataKey="value" fill={colors.series[0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      ) : null}
      {chosen ? (
        <DrillDownPanel title={chosen.name} onClose={() => setOpenId('')}>
          {chosen.description ? <p>{chosen.description}</p> : null}
          <table className="data-table">
            <thead><tr><th scope="col">Measure</th><th scope="col">Value</th></tr></thead>
            <tbody>
              {chosen.size !== null ? <tr><td>{chosen.sizeLabel || 'Size'}</td><td>{fmt.value(chosen.size, 'integer')}</td></tr> : null}
              {chosen.share !== null ? <tr><td>Share</td><td>{fmt.percent(chosen.share)}</td></tr> : null}
              {Object.entries(chosen.summary).map(([label, v]) => <tr key={label}><td>{label}</td><td>{fmt.value(v, 'decimal')}</td></tr>)}
            </tbody>
          </table>
        </DrillDownPanel>
      ) : null}
    </div>
  );
}
