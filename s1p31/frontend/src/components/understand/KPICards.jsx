import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { Icon } from '../shared/Icon.jsx';

export function KPICards() {
  const query = useDataset('kpis');
  const fmt = useFormat();
  if (query.loading || query.error) {
    return <DataState query={query} label="key numbers" skeleton={<SkeletonCard count={4} height={112} />} />;
  }
  return (
    <div className="grid">
      {query.data.map(k => (
        <article className="card kpi" key={k.key}>
          <p className="kpi-label">{k.label}</p>
          <p className="kpi-value">{fmt.value(k.value, k.format)}</p>
          {k.trend !== null ? (
            <p className={'kpi-trend ' + (k.trend >= 0 ? 'up' : 'down')}>
              <Icon name={k.trend >= 0 ? 'up' : 'down'} size={14} />
              {' ' + (k.trend >= 0 ? '+' : '-') + fmt.percent(Math.abs(k.trend)) + ' vs previous period'}
            </p>
          ) : null}
          {k.note ? <p className="muted small">{k.note}</p> : null}
        </article>
      ))}
    </div>
  );
}
