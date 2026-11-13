import { useMemo, useState } from 'react';
import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { humanize } from '../../utils/adapters.js';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';

const PAGE_SIZE = 25;

function compare(a, b) {
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

export function AnomalyTable() {
  const query = useDataset('anomalies');
  const fmt = useFormat();
  const [sortKey, setSortKey] = useState('');
  const [direction, setDirection] = useState('desc');
  const [page, setPage] = useState(0);
  const data = query.data;
  const sorted = useMemo(() => {
    if (!data) return [];
    if (!sortKey) return data.rows;
    const copy = [...data.rows].sort((a, b) => compare(a[sortKey], b[sortKey]));
    return direction === 'asc' ? copy : copy.reverse();
  }, [data, sortKey, direction]);
  if (query.loading || query.error) {
    return <DataState query={query} label="anomalies" skeleton={<SkeletonCard count={1} height={240} />} />;
  }
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = sorted.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const onSort = key => {
    if (key === sortKey) setDirection(direction === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setDirection('desc');
    }
    setPage(0);
  };
  const cell = v => {
    if (v === null || v === undefined || v === '') return '-';
    if (typeof v === 'number') return fmt.value(v, 'decimal');
    return String(v);
  };
  return (
    <div>
      <div className="grid">
        <article className="card kpi"><p className="kpi-label">Flagged records</p><p className="kpi-value">{fmt.value(data.total, 'integer')}</p></article>
        <article className="card kpi"><p className="kpi-label">Share of all records</p><p className="kpi-value">{data.rate === null ? '-' : fmt.percent(data.rate)}</p></article>
      </div>
      {data.method ? <p className="muted small">{'Method: ' + data.method}</p> : null}
      {data.rows.length === 0 ? (
        <div className="card state-box"><p>No unusual records were flagged.</p></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {data.columns.map(key => (
                    <th key={key} scope="col" aria-sort={sortKey === key ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" className="sort-button" onClick={() => onSort(key)}>
                        {humanize(key) + (sortKey === key ? (direction === 'asc' ? ' (asc)' : ' (desc)') : '')}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map(row => (
                  <tr key={row._i}>{data.columns.map(key => <td key={key}>{cell(row[key])}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <button type="button" className="btn-secondary" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
            <span className="muted">{'Page ' + (current + 1) + ' of ' + pages}</span>
            <button type="button" className="btn-secondary" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
