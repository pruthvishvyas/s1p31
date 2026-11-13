import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';

const STATUS = { on_track: 'On track', at_risk: 'At risk', off_track: 'Off track', no_target: 'No target' };

export function GoalProgress() {
  const query = useDataset('goalProgress');
  const fmt = useFormat();
  if (query.loading || query.error) {
    return <DataState query={query} label="goal progress" skeleton={<SkeletonCard count={3} height={140} />} />;
  }
  const d = query.data;
  const show = (v, unit) => {
    if (v === null || v === undefined) return '-';
    if (unit === 'percent') return fmt.percent(v);
    if (unit === 'currency') return fmt.value(v, 'currency');
    return fmt.value(v, 'decimal');
  };
  const sign = n => (n > 0 ? '+' : '');
  return (
    <div className="stack">
      <p className="muted">
        {d.asOf ? 'As of ' + fmt.date(d.asOf) + '. ' : ''}
        {d.windowDays !== null ? 'Window: last ' + d.windowDays + ' days.' : ''}
      </p>
      <div className="grid">
        {d.items.map(g => (
          <article className="card" key={g.key}>
            <h3>{g.label}</h3>
            <p className={'status status-' + g.status}>{STATUS[g.status]}</p>
            <p className="kpi-value">{show(g.actual, g.unit)}</p>
            <p className="muted">{'Target ' + show(g.target, g.unit)}</p>
            {g.pct !== null ? (
              <div>
                <div className="progress" aria-hidden="true"><div className={'progress-fill fill-' + g.status} style={{ width: Math.min(100, Math.max(0, g.pct)) + '%' }} /></div>
                <p className="muted small">{fmt.percent(g.pct) + ' of target'}</p>
              </div>
            ) : null}
          </article>
        ))}
      </div>
      <div className="grid">
        {d.revenueChange !== null ? <article className="card kpi"><p className="kpi-label">Revenue change</p><p className={'kpi-value ' + (d.revenueChange >= 0 ? 'up' : 'down')}>{sign(d.revenueChange) + fmt.percent(d.revenueChange)}</p></article> : null}
        {d.marginChange !== null ? <article className="card kpi"><p className="kpi-label">Margin change (points)</p><p className={'kpi-value ' + (d.marginChange >= 0 ? 'up' : 'down')}>{sign(d.marginChange) + fmt.value(d.marginChange, 'decimal')}</p></article> : null}
        {d.p1Count !== null ? <article className="card kpi"><p className="kpi-label">Urgent items open</p><p className="kpi-value">{fmt.value(d.p1Count, 'integer')}</p></article> : null}
      </div>
    </div>
  );
}
