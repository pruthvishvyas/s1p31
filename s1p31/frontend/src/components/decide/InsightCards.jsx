import { useState } from 'react';
import { useDataset } from '../../hooks/useDataset.js';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { SeverityBadge } from '../shared/SeverityBadge.jsx';

const LEVELS = [['ALL', 'All'], ['HIGH', 'High'], ['MEDIUM', 'Medium'], ['LOW', 'Low']];

export function InsightCards() {
  const query = useDataset('insights');
  const [level, setLevel] = useState('ALL');
  if (query.loading || query.error) {
    return <DataState query={query} label="insights" skeleton={<SkeletonCard count={3} height={140} />} />;
  }
  const items = query.data;
  const count = key => (key === 'ALL' ? items.length : items.filter(i => i.severity === key).length);
  const shown = level === 'ALL' ? items : items.filter(i => i.severity === level);
  return (
    <div>
      <div className="chip-row" role="group" aria-label="Filter by severity">
        {LEVELS.map(([key, label]) => (
          <button type="button" key={key} className={'chip' + (level === key ? ' chip-active' : '')} aria-pressed={level === key} onClick={() => setLevel(key)}>
            {label + ' (' + count(key) + ')'}
          </button>
        ))}
      </div>
      {shown.length === 0 ? <div className="card state-box"><p>No insights at this level.</p></div> : null}
      <div className="stack">
        {shown.map(i => (
          <article className="card" key={i.id}>
            <p><SeverityBadge level={i.severity} />{i.category ? <span className="muted">{'  ' + i.category}</span> : null}</p>
            <h3>{i.finding}</h3>
            {i.evidence ? <p className="muted">{i.evidence}</p> : null}
            {i.action ? <p><strong>What to do this week: </strong>{i.action}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
