import { useState } from 'react';
import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { SeverityBadge } from '../shared/SeverityBadge.jsx';

const LEVELS = [['ALL', 'All'], ['HIGH', 'High'], ['MEDIUM', 'Medium'], ['LOW', 'Low']];

export function AlertCenter() {
  const query = useDataset('alerts');
  const fmt = useFormat();
  const [level, setLevel] = useState('ALL');
  if (query.loading || query.error) {
    return <DataState query={query} label="alerts" skeleton={<SkeletonCard count={2} height={110} />} />;
  }
  const items = query.data;
  if (items.length === 0) {
    return <div className="card state-box" role="status"><p>No active alerts</p></div>;
  }
  const count = key => (key === 'ALL' ? items.length : items.filter(i => i.severity === key).length);
  const shown = level === 'ALL' ? items : items.filter(i => i.severity === level);
  const when = since => {
    const parsed = new Date(since);
    return Number.isNaN(parsed.getTime()) ? since : fmt.ago(since);
  };
  return (
    <div>
      <div className="chip-row" role="group" aria-label="Filter by severity">
        {LEVELS.map(([key, label]) => (
          <button type="button" key={key} className={'chip' + (level === key ? ' chip-active' : '')} aria-pressed={level === key} onClick={() => setLevel(key)}>
            {label + ' (' + count(key) + ')'}
          </button>
        ))}
      </div>
      <div className="stack">
        {shown.map(a => (
          <article className="card" key={a.id}>
            <p><SeverityBadge level={a.severity} />{a.since ? <span className="muted small">{'  since ' + when(a.since)}</span> : null}</p>
            <h3>{a.title}</h3>
            {a.message ? <p>{a.message}</p> : null}
            {a.value !== null ? <p className="muted small">{'Value ' + fmt.value(a.value, 'decimal') + (a.threshold !== null ? ' against a threshold of ' + fmt.value(a.threshold, 'decimal') : '')}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
