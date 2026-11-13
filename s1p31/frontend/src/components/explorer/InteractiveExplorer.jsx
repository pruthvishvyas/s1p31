import { useMemo, useState } from 'react';
import { BarChart, Bar, LineChart, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDataset } from '../../hooks/useDataset.js';
import { useExplorer } from '../../context/ExplorerContext.jsx';
import { useFormat } from '../../context/FormatContext.jsx';
import { useChartColors } from '../../hooks/useChartColors.js';
import { aggregate, totals } from '../../utils/cube.js';
import { clip } from '../../utils/text.js';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { useChartFile } from '../../hooks/useChartFile.js';
import { FilterBar } from './FilterBar.jsx';
import { ChartPanel } from '../understand/ChartPanel.jsx';
import { DrillDownPanel } from './DrillDownPanel.jsx';

export function InteractiveExplorer() {
  const query = useDataset('explorer');
  if (query.loading) return <SkeletonCard count={2} height={240} />;
  if (query.error) return <ChartExplorer reason={query.error.message} />;
  return <ExplorerBody cube={query.data} />;
}

function ChartExplorer({ reason }) {
  const query = useDataset('charts');
  const fmt = useFormat();
  const [pick, setPick] = useState('');
  const [order, setOrder] = useState('original');
  const [top, setTop] = useState('all');
  const [text, setText] = useState('');
  const stub = query.data ? (query.data.find(c => c.id === pick) || query.data[0]) : null;
  const resolved = useChartFile(stub);
  const chart = resolved.data;
  const plain = Boolean(chart) && chart.type !== 'scatter' && chart.type !== 'heatmap';
  const shaped = useMemo(() => {
    if (!chart || !plain) return chart;
    let rows = chart.rows.filter(r => String(r.label).toLowerCase().includes(text.trim().toLowerCase()));
    if (order === 'desc') rows = [...rows].sort((a, b) => b.value - a.value);
    if (order === 'asc') rows = [...rows].sort((a, b) => a.value - b.value);
    if (top !== 'all') rows = rows.slice(0, Number(top));
    return { ...chart, rows: rows.length ? rows : chart.rows };
  }, [chart, plain, order, top, text]);
  if (query.loading || query.error) {
    return <DataState query={query} label="charts" skeleton={<SkeletonCard count={2} height={240} />} />;
  }
  return (
    <div className="stack">
      <div className="banner" role="status">{'The detailed explorer file was not exported by the backend (' + reason + '), so this view explores the analysis charts instead.'}</div>
      <div className="filter-bar card">
        <div className="field">
          <label htmlFor="cx-chart">Chart</label>
          <select id="cx-chart" value={stub.id} onChange={e => setPick(e.target.value)}>
            {query.data.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        {plain ? (
          <>
            <div className="field">
              <label htmlFor="cx-order">Order</label>
              <select id="cx-order" value={order} onChange={e => setOrder(e.target.value)}>
                <option value="original">As exported</option>
                <option value="desc">Largest first</option>
                <option value="asc">Smallest first</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="cx-top">Show</label>
              <select id="cx-top" value={top} onChange={e => setTop(e.target.value)}>
                <option value="all">All</option>
                <option value="10">Top 10</option>
                <option value="20">Top 20</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="cx-find">Find a label</label>
              <input id="cx-find" type="search" value={text} onChange={e => setText(e.target.value)} />
            </div>
          </>
        ) : null}
      </div>
      {resolved.loading || resolved.error ? (
        <DataState query={resolved} label="this chart" skeleton={<SkeletonCard count={1} height={320} />} />
      ) : (
        <ChartPanel chart={shaped} />
      )}
      {plain ? (
        <div className="card table-wrap">
          <table className="data-table">
            <thead><tr><th scope="col">Label</th><th scope="col">Value</th></tr></thead>
            <tbody>
              {shaped.rows.slice(0, 50).map((r, i) => <tr key={r.label + '-' + i}><td>{r.label}</td><td>{fmt.value(r.value, 'decimal')}</td></tr>)}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function ExplorerBody({ cube }) {
  const ctx = useExplorer();
  const fmt = useFormat();
  const colors = useChartColors();
  const [tableDim, setTableDim] = useState(cube.dimensions.length ? cube.dimensions[0].key : '');
  const [ascending, setAscending] = useState(false);
  const [drill, setDrill] = useState(null);
  const metricKey = ctx.metricKey && cube.metrics.some(m => m.key === ctx.metricKey) ? ctx.metricKey : cube.metrics[0].key;
  const metric = cube.metrics.find(m => m.key === metricKey);
  const months = useMemo(() => [...new Set(cube.rows.map(r => r.t))].sort(), [cube]);
  const series = useMemo(() => aggregate(cube, ctx.filters, '_time', metricKey), [cube, ctx.filters, metricKey]);
  const dims = cube.dimensions.slice(0, 4);
  const tableRows = useMemo(() => {
    if (!tableDim) return [];
    const rows = aggregate(cube, ctx.filters, tableDim, metricKey, tableDim);
    return ascending ? [...rows].reverse() : rows;
  }, [cube, ctx.filters, tableDim, metricKey, ascending]);
  const axis = { stroke: colors.grid, tick: { fill: colors.text, fontSize: 12 } };
  const tip = { contentStyle: { background: colors.surface, border: '1px solid ' + colors.grid, color: colors.textPrimary }, formatter: v => fmt.value(v, metric.format) };
  const dimLabel = key => {
    const found = cube.dimensions.find(d => d.key === key);
    return found ? found.label : key;
  };
  const otherDim = drill ? cube.dimensions.find(d => d.key !== drill.dim) : null;
  const drillFilters = drill ? { ...ctx.filters, [drill.dim]: drill.value } : {};

  return (
    <div className="stack">
      <FilterBar cube={cube} metricKey={metricKey} months={months} />
      <article className="card chart-card">
        <h3 className="chart-title">{metric.label + ' over time'}</h3>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
              <XAxis dataKey="label" {...axis} minTickGap={24} />
              <YAxis {...axis} tickFormatter={v => fmt.compact(v)} width={56} />
              <Tooltip {...tip} />
              <Line type="monotone" dataKey="value" stroke={colors.series[0]} strokeWidth={2} dot={series.length <= 36} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>
      <div className="grid grid-wide">
        {dims.map(dim => {
          const rows = aggregate(cube, ctx.filters, dim.key, metricKey, dim.key).slice(0, 12);
          const active = ctx.filters[dim.key];
          return (
            <article className="card chart-card" key={dim.key}>
              <h3 className="chart-title">{metric.label + ' by ' + dim.label}</h3>
              <p className="muted small">Click a bar to filter every chart.</p>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                    <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="label" {...axis} tickFormatter={v => clip(v, 10)} />
                    <YAxis {...axis} tickFormatter={v => fmt.compact(v)} width={56} />
                    <Tooltip {...tip} />
                    <Bar dataKey="value" onClick={d => ctx.setFilter(dim.key, (d && d.payload ? d.payload : d).label)} cursor="pointer">
                      {rows.map(r => <Cell key={r.label} fill={!active || active === r.label ? colors.series[0] : colors.grid} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          );
        })}
      </div>
      {tableDim ? (
        <article className="card">
          <div className="field">
            <label htmlFor="ex-table-dim">Top groups by</label>
            <select id="ex-table-dim" value={tableDim} onChange={e => setTableDim(e.target.value)}>
              {cube.dimensions.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{dimLabel(tableDim)}</th>
                  <th scope="col" aria-sort={ascending ? 'ascending' : 'descending'}>
                    <button type="button" className="sort-button" onClick={() => setAscending(!ascending)}>{metric.label + (ascending ? ' (asc)' : ' (desc)')}</button>
                  </th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(0, 25).map(r => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td>{fmt.value(r.value, metric.format)}</td>
                    <td><button type="button" className="btn-secondary" onClick={() => setDrill({ dim: tableDim, value: r.label })}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}
      <p className="muted small">Figures are aggregated; no individual records are shown.</p>
      {drill ? (
        <DrillDownPanel title={dimLabel(drill.dim) + ': ' + drill.value} onClose={() => setDrill(null)}>
          <table className="data-table">
            <thead><tr><th scope="col">Measure</th><th scope="col">Value</th></tr></thead>
            <tbody>
              {cube.metrics.map(m => <tr key={m.key}><td>{m.label}</td><td>{fmt.value(totals(cube, drillFilters, m.key), m.format)}</td></tr>)}
            </tbody>
          </table>
          {otherDim ? (
            <div>
              <h3>{'Top 5 by ' + otherDim.label}</h3>
              <table className="data-table">
                <tbody>
                  {aggregate(cube, drillFilters, otherDim.key, metricKey, otherDim.key).slice(0, 5).map(r => <tr key={r.label}><td>{r.label}</td><td>{fmt.value(r.value, metric.format)}</td></tr>)}
                </tbody>
              </table>
            </div>
          ) : null}
        </DrillDownPanel>
      ) : null}
    </div>
  );
}
