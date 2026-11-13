import { useMemo } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { useChartColors } from '../../hooks/useChartColors.js';
import { mergeSeries } from '../../utils/predict.js';
import { clip } from '../../utils/text.js';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';

export function Forecaster() {
  const query = useDataset('forecast');
  const fmt = useFormat();
  const colors = useChartColors();
  const data = useMemo(() => (query.data ? mergeSeries(query.data) : []), [query.data]);
  if (query.loading || query.error) {
    return <DataState query={query} label="forecast" skeleton={<SkeletonCard count={1} height={320} />} />;
  }
  const f = query.data;
  const format = ['currency', 'percent', 'integer'].includes(f.unit) ? f.unit : 'decimal';
  const hasBand = f.forecast.some(r => r.low !== null && r.high !== null);
  const axis = { stroke: colors.grid, tick: { fill: colors.text, fontSize: 12 } };
  return (
    <div className="stack">
      <article className="card chart-card">
        <h3 className="chart-title">{f.metric}</h3>
        <p className="muted">{'History and the expected values for the next ' + f.horizon + ' periods.'}</p>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
              <XAxis dataKey="t" {...axis} tickFormatter={v => clip(v, 10)} minTickGap={28} />
              <YAxis {...axis} tickFormatter={v => fmt.compact(v)} width={56} />
              <Tooltip contentStyle={{ background: colors.surface, border: '1px solid ' + colors.grid, color: colors.textPrimary }} formatter={v => (Array.isArray(v) ? fmt.value(v[0], format) + ' to ' + fmt.value(v[1], format) : fmt.value(v, format))} />
              <Legend />
              {hasBand ? <Area type="monotone" dataKey="band" name="Likely range" stroke="none" fill={colors.series[1]} fillOpacity={0.2} connectNulls /> : null}
              <Line type="monotone" dataKey="history" name="History" stroke={colors.series[0]} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="forecast" name="Forecast" stroke={colors.series[1]} strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="muted small">This is a forecast, not a guarantee.</p>
      </article>
      <div className="grid">
        {f.error && f.error.mape !== null ? <article className="card kpi"><p className="kpi-label">Typical error (percent)</p><p className="kpi-value">{fmt.percent(f.error.mape)}</p><p className="muted small">How far off the forecast was on recent history it had not seen.</p></article> : null}
        {f.error && f.error.mae !== null ? <article className="card kpi"><p className="kpi-label">Typical error (average miss)</p><p className="kpi-value">{fmt.value(f.error.mae, format)}</p>{f.error.period ? <p className="muted small">{'Tested on ' + f.error.period}</p> : null}</article> : null}
        {f.error && f.error.baselineMae !== null ? <article className="card kpi"><p className="kpi-label">Simple rule for comparison</p><p className="kpi-value">{fmt.value(f.error.baselineMae, format)}</p><p className="muted small">Average miss of a basic yardstick forecast.</p></article> : null}
        <article className="card kpi"><p className="kpi-label">Horizon</p><p className="kpi-value">{f.horizon}</p>{f.method ? <p className="muted small">{'Method: ' + f.method}</p> : null}</article>
      </div>
      {f.note ? <p className="muted">{f.note}</p> : null}
      <p><a href="#/monitor/predict">Try your own numbers on the Predict page</a></p>
    </div>
  );
}
