import { useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, ScatterChart, Scatter, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useChartColors } from '../../hooks/useChartColors.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { clip } from '../../utils/text.js';

function prepare(chart) {
  let rows = chart.rows;
  let truncated = false;
  if (chart.type === 'bar' && rows.length > 40) {
    rows = [...rows].sort((a, b) => b.value - a.value).slice(0, 40);
    truncated = true;
  }
  const longLabels = chart.type === 'bar' && rows.some(r => String(r.label).length > 14) && rows.length <= 20;
  return { rows, truncated, horizontal: longLabels };
}

function HeatGrid({ rows }) {
  const rowNames = [...new Set(rows.map(r => r.row))];
  const colNames = [...new Set(rows.map(r => r.col))];
  const lookup = new Map(rows.map(r => [r.row + '|' + r.col, r.value]));
  const max = Math.max(...rows.map(r => Math.abs(r.value)), 1);
  return (
    <div>
      <div className="heat-grid" style={{ gridTemplateColumns: 'repeat(' + (colNames.length + 1) + ', minmax(3rem, 1fr))' }}>
        <span />
        {colNames.map(c => <span key={c} className="heat-head">{clip(c, 10)}</span>)}
        {rowNames.map(r => (
          <HeatRow key={r} name={r} cols={colNames} lookup={lookup} max={max} />
        ))}
      </div>
      <table className="sr-only">
        <caption>Heatmap values</caption>
        <thead><tr><th>Row</th><th>Column</th><th>Value</th></tr></thead>
        <tbody>
          {rows.map(r => <tr key={r.row + '|' + r.col}><td>{r.row}</td><td>{r.col}</td><td>{r.value}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function HeatRow({ name, cols, lookup, max }) {
  return (
    <>
      <span className="heat-head">{clip(name, 14)}</span>
      {cols.map(c => {
        const v = lookup.get(name + '|' + c);
        const pct = v === undefined ? 0 : Math.round((Math.abs(v) / max) * 85) + 5;
        const tone = v !== undefined && v < 0 ? 'var(--color-danger)' : 'var(--color-accent)';
        return (
          <span key={c} className="heat-cell" title={name + ' / ' + c + ': ' + (v === undefined ? '-' : v)}
            style={{ background: 'color-mix(in srgb, ' + tone + ' ' + pct + '%, transparent)' }}>
            {v === undefined ? '' : Math.round(v * 100) / 100}
          </span>
        );
      })}
    </>
  );
}

export function ChartPanel({ chart }) {
  const colors = useChartColors();
  const fmt = useFormat();
  const prepared = useMemo(() => prepare(chart), [chart]);
  const axis = { stroke: colors.grid, tick: { fill: colors.text, fontSize: 12 } };
  const tip = {
    contentStyle: { background: colors.surface, border: '1px solid ' + colors.grid, color: colors.textPrimary, borderRadius: 8 },
    labelStyle: { color: colors.textPrimary },
    itemStyle: { color: colors.textPrimary },
    formatter: v => fmt.value(v, 'decimal'),
  };
  const tick = v => clip(v, 14);
  const rows = prepared.rows;
  const notes = [chart.xLabel ? 'X: ' + chart.xLabel : '', chart.yLabel ? 'Y: ' + chart.yLabel : ''].filter(Boolean).join(' | ');
  let body;
  if (chart.type === 'heatmap') {
    body = <HeatGrid rows={rows} />;
  } else {
    let inner;
    if (chart.type === 'line') {
      inner = (
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
          <XAxis dataKey="label" {...axis} tickFormatter={tick} minTickGap={24} />
          <YAxis {...axis} tickFormatter={v => fmt.compact(v)} width={56} />
          <Tooltip {...tip} />
          <Line type="monotone" dataKey="value" stroke={colors.series[0]} strokeWidth={2} dot={rows.length <= 60} />
        </LineChart>
      );
    } else if (chart.type === 'scatter') {
      inner = (
        <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" name={chart.xLabel || 'x'} {...axis} tickFormatter={v => fmt.compact(v)} />
          <YAxis type="number" dataKey="y" name={chart.yLabel || 'y'} {...axis} tickFormatter={v => fmt.compact(v)} width={56} />
          <Tooltip {...tip} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={rows} fill={colors.series[0]} />
        </ScatterChart>
      );
    } else if (chart.type === 'pie' || chart.type === 'doughnut') {
      inner = (
        <PieChart>
          <Tooltip {...tip} />
          <Pie data={rows} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={chart.type === 'doughnut' ? '55%' : 0} outerRadius="80%">
            {rows.map((r, i) => <Cell key={r.label + '-' + i} fill={colors.series[i % colors.series.length]} />)}
          </Pie>
        </PieChart>
      );
    } else if (prepared.horizontal) {
      inner = (
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
          <XAxis type="number" {...axis} tickFormatter={v => fmt.compact(v)} />
          <YAxis type="category" dataKey="label" {...axis} tickFormatter={tick} width={110} />
          <Tooltip {...tip} />
          <Bar dataKey="value" fill={colors.series[0]} />
        </BarChart>
      );
    } else {
      inner = (
        <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 0 }} barCategoryGap={chart.type === 'histogram' ? 0 : '20%'}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
          <XAxis dataKey="label" {...axis} tickFormatter={tick} minTickGap={12} />
          <YAxis {...axis} tickFormatter={v => fmt.compact(v)} width={56} />
          <Tooltip {...tip} />
          <Bar dataKey="value" fill={colors.series[0]} />
        </BarChart>
      );
    }
    body = <div className="chart-box"><ResponsiveContainer width="100%" height="100%">{inner}</ResponsiveContainer></div>;
  }
  return (
    <article className="card chart-card">
      <h3 className="chart-title">{chart.title}</h3>
      {chart.question ? <p className="muted">{chart.question}</p> : null}
      {body}
      {notes ? <p className="muted small">{notes}</p> : null}
      {prepared.truncated ? <p className="muted small">Showing the top 40 categories by value.</p> : null}
    </article>
  );
}
