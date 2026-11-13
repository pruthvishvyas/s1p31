import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';

const GROUPS = [
  ['P1_URGENT', 'Urgent'],
  ['P2_HIGH', 'High'],
  ['P3_MEDIUM', 'Medium'],
  ['P4_ROUTINE', 'Routine'],
];

export function RecommendationEngine() {
  const query = useDataset('recommendations');
  const fmt = useFormat();
  if (query.loading || query.error) {
    return <DataState query={query} label="recommendations" skeleton={<SkeletonCard count={3} height={140} />} />;
  }
  const items = query.data;
  return (
    <div>
      {GROUPS.map(([key, name]) => {
        const group = items.filter(i => i.priority === key);
        if (group.length === 0) return null;
        return (
          <section key={key} className="stack">
            <h2 className={'group-title prio-' + key.slice(0, 2).toLowerCase()}>{name + ' (' + group.length + ')'}</h2>
            {group.map(r => (
              <article className="card" key={r.id}>
                <h3>{r.title}</h3>
                {r.action && r.action !== r.title ? <p>{r.action}</p> : null}
                {r.evidence ? <p className="muted">{'Evidence: ' + r.evidence}</p> : null}
                {r.impact ? <p className="muted">{'Impact: ' + r.impact}</p> : null}
                {r.when ? <p className="muted">{'When: ' + r.when}</p> : null}
                {r.count !== null ? <p className="muted">{'Affected records: ' + fmt.value(r.count, 'integer')}</p> : null}
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
