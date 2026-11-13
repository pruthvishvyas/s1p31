import { useState } from 'react';
import { useDataset, useDataFile } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { adaptSimulation } from '../../utils/adapters.js';
import { dataFilePath } from '../../utils/datasets.js';
import { interpolate } from '../../utils/sim.js';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';

export function WhatIfSimulator() {
  const query = useDataset('simulations');
  const [selected, setSelected] = useState('');
  if (query.loading || query.error) {
    return <DataState query={query} label="simulations" skeleton={<SkeletonCard count={1} height={200} />} />;
  }
  const items = query.data;
  const current = items.find(i => i.id === selected) || items[0];
  return (
    <div>
      <div className="chip-row" role="group" aria-label="Choose a simulation">
        {items.map(i => (
          <button type="button" key={i.id} className={'chip' + (i.id === current.id ? ' chip-active' : '')} aria-pressed={i.id === current.id} onClick={() => setSelected(i.id)}>
            {i.title}
          </button>
        ))}
      </div>
      <SimulationView key={current.id} item={current} />
    </div>
  );
}

function SimulationView({ item }) {
  const sim = useDataFile(dataFilePath(item.file), adaptSimulation);
  const fmt = useFormat();
  const [chosen, setChosen] = useState(null);
  if (sim.loading || sim.error) {
    return <DataState query={sim} label="simulation" skeleton={<SkeletonCard count={1} height={200} />} />;
  }
  const s = sim.data;
  const x = chosen === null ? s.variable.default : chosen;
  const base = interpolate(s.table, s.variable.default);
  const scenario = interpolate(s.table, x);
  const sign = n => (n > 0 ? '+' : '');
  return (
    <div className="stack">
      <article className="card">
        <h2>{s.title}</h2>
        {s.description ? <p className="muted">{s.description}</p> : null}
        <div className="field">
          <label htmlFor="sim-slider">{s.variable.label + (s.variable.unit ? ' (' + s.variable.unit + ')' : '')}</label>
          <input id="sim-slider" type="range" className="sim-slider" min={s.variable.min} max={s.variable.max} step={s.variable.step} value={x} onChange={e => setChosen(Number(e.target.value))} />
          <p className="result-value">{fmt.value(x, s.variable.format)}</p>
          <p className="muted small">{'Baseline setting: ' + fmt.value(s.variable.default, s.variable.format)}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => setChosen(null)}>Reset to baseline</button>
      </article>
      <div className="grid">
        {s.outputs.map(o => {
          const b = base ? base[o.key] : null;
          const v = scenario ? scenario[o.key] : null;
          const diff = b === null || v === null || b === undefined || v === undefined ? null : v - b;
          return (
            <article className="card kpi" key={o.key}>
              <p className="kpi-label">{o.label}</p>
              <p className="kpi-value">{fmt.value(v, o.format)}</p>
              <p className="muted small">{'Baseline ' + fmt.value(b, o.format)}</p>
              {diff !== null ? <p className={'kpi-trend ' + (diff >= 0 ? 'up' : 'down')}>{'Change ' + sign(diff) + fmt.value(diff, o.format)}</p> : null}
            </article>
          );
        })}
      </div>
      {s.periodTotal !== null ? <p className="muted">{'Period total in the underlying data: ' + fmt.value(s.periodTotal, 'currency')}</p> : null}
      {s.assumptions.length > 0 ? (
        <article className="card">
          <h3>Assumptions</h3>
          <ul>{s.assumptions.map(a => <li key={a}>{a}</li>)}</ul>
        </article>
      ) : null}
    </div>
  );
}
