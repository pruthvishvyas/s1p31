import { useState } from 'react';
import { useDataset } from '../../hooks/useDataset.js';
import { useContract } from '../../hooks/useContract.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';

function loadStored(id) {
  try {
    const raw = localStorage.getItem('goals:' + id);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStored(id, value) {
  try {
    localStorage.setItem('goals:' + id, JSON.stringify(value));
  } catch { /* storage blocked: the target lasts for this visit only */ }
}

export function GoalTracker() {
  const goals = useDataset('goals');
  const progress = useDataset('goalProgress');
  const contract = useContract();
  if (goals.loading || contract.loading || progress.loading || goals.error) {
    return <DataState query={goals.error ? goals : { loading: true }} label="goals" skeleton={<SkeletonCard count={3} height={120} />} />;
  }
  const clientId = contract.data ? contract.data.project.clientId : 'project';
  return <GoalList goals={goals.data} progress={progress.data} clientId={clientId} />;
}

function GoalList({ goals, progress, clientId }) {
  const fmt = useFormat();
  const [stored, setStored] = useState(() => loadStored(clientId));
  const show = (v, unit) => {
    if (v === null || v === undefined) return '-';
    if (unit === 'percent') return fmt.percent(v);
    if (unit === 'currency') return fmt.value(v, 'currency');
    if (unit === 'days') return fmt.value(v, 'integer') + ' days';
    return fmt.value(v, 'decimal');
  };
  const onTarget = (key, text) => {
    const next = { ...stored };
    if (text === '' || !Number.isFinite(Number(text))) delete next[key];
    else next[key] = Number(text);
    setStored(next);
    saveStored(clientId, next);
  };
  return (
    <div className="grid">
      {goals.map(g => {
        const match = progress ? progress.items.find(p => g.key.startsWith(p.key)) : null;
        const target = stored[g.key] !== undefined ? stored[g.key] : g.target;
        const actual = match ? match.actual : null;
        const pct = target && actual !== null && actual !== undefined ? (actual / target) * 100 : null;
        const id = 'goal-' + g.key;
        return (
          <article className="card" key={g.key}>
            <h3>{g.label}</h3>
            <p className="kpi-value">{show(target, g.unit)}</p>
            {g.description ? <p className="muted small">{g.description}</p> : null}
            {actual !== null && actual !== undefined ? <p className="muted">{'Latest actual: ' + show(actual, g.unit)}</p> : null}
            {pct !== null ? (
              <div>
                <div className="progress" aria-hidden="true"><div className="progress-fill" style={{ width: Math.min(100, Math.max(0, pct)) + '%' }} /></div>
                <p className="muted small">{fmt.percent(pct) + ' of target'}</p>
              </div>
            ) : null}
            {g.clientSets ? (
              <div className="field">
                <label htmlFor={id}>Set your own target</label>
                <input id={id} type="number" inputMode="decimal" value={stored[g.key] === undefined ? '' : stored[g.key]} onChange={e => onTarget(g.key, e.target.value)} />
                <p className="field-help">Saved on this device only.</p>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
