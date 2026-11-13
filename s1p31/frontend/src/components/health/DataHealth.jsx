import { useDataset } from '../../hooks/useDataset.js';
import { useContract } from '../../hooks/useContract.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { DataState } from '../shared/DataState.jsx';

const NAMES = ['summary', 'runLog', 'kpis', 'charts', 'segments', 'anomalies', 'explorer', 'insights', 'recommendations', 'simulations', 'goals', 'forecast', 'forecastLookup', 'scorer', 'goalProgress', 'alerts'];

function stateOf(query) {
  if (query.loading) return 'Loading';
  if (!query.error) return 'Loaded';
  const kind = query.error.kind;
  if (kind === 'skipped') return 'Skipped: ' + query.error.message;
  if (kind === 'missing' || kind === 'empty') return 'Missing';
  return 'Invalid: ' + query.error.message;
}

function DatasetRow({ name }) {
  const query = useDataset(name);
  const state = stateOf(query);
  return <tr><td>{name}</td><td>{state}</td></tr>;
}

function PredictMode() {
  const scorer = useDataset('scorer');
  const lookup = useDataset('forecastLookup');
  const forecast = useDataset('forecast');
  if (scorer.loading || lookup.loading || forecast.loading) return <p className="muted">Checking the Predict page.</p>;
  let text = 'unavailable. The Predict page explains why and shows a disabled form.';
  if (scorer.data) text = 'model scoring (' + (scorer.data.type === 'linear' ? 'linear' : 'nearest neighbours') + ')';
  else if (lookup.data) text = 'lookup table';
  else if (forecast.data && forecast.data.forecast.length > 0) text = 'forecast period';
  return <p>{'Predict page mode: ' + text}</p>;
}

export function DataHealth() {
  const contract = useContract();
  const summary = useDataset('summary');
  const runLog = useDataset('runLog');
  const fmt = useFormat();
  const s = summary.data;
  const latest = runLog.data && runLog.data.runs.length > 0 ? runLog.data.runs[0] : null;
  return (
    <div className="stack">
      <article className="card">
        <h2>Latest run</h2>
        {contract.data ? <p>{'Contract version ' + contract.data.schemaVersion + ', generated ' + fmt.dateTime(contract.data.generatedAt) + ' (' + fmt.ago(contract.data.generatedAt) + ')'}</p> : null}
        {contract.data && contract.data.source.type ? <p className="muted">{'Data source: ' + contract.data.source.type}</p> : null}
        {s ? (
          <div>
            {s.rows !== null ? <p>{'Rows analysed: ' + fmt.value(s.rows, 'integer')}</p> : null}
            {s.start || s.end ? <p>{'Date range: ' + fmt.date(s.start) + ' to ' + fmt.date(s.end)}</p> : null}
            {s.sites ? <p className="muted">{'Sites: ' + s.sites}</p> : null}
          </div>
        ) : <DataState query={summary} label="summary" />}
        <PredictMode />
      </article>
      <article className="card">
        <h2>Run stages</h2>
        {latest ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th scope="col">Stage</th><th scope="col">Status</th><th scope="col">Seconds</th><th scope="col">Reason</th></tr></thead>
              <tbody>
                {latest.stages.map((st, i) => <tr key={st.name + '-' + i}><td>{st.name}</td><td>{st.status}</td><td>{st.seconds === null ? '-' : fmt.value(st.seconds, 'decimal')}</td><td>{st.reason || '-'}</td></tr>)}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">No run log is available.</p>}
      </article>
      <article className="card">
        <h2>Datasets</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th scope="col">Dataset</th><th scope="col">State</th></tr></thead>
            <tbody>
              {NAMES.map(name => <DatasetRow key={name} name={name} />)}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
