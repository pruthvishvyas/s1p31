import { useState } from 'react';
import { useDataset } from '../../hooks/useDataset.js';
import { useChartFile } from '../../hooks/useChartFile.js';
import { DataState } from '../shared/DataState.jsx';
import { SkeletonCard } from '../shared/SkeletonCard.jsx';
import { ErrorBoundary } from '../shared/ErrorBoundary.jsx';
import { ChartPanel } from './ChartPanel.jsx';

export function ChartLoader({ chart }) {
  const query = useChartFile(chart);
  if (query.loading || query.error) {
    return <DataState query={query} label={'chart "' + chart.title + '"'} skeleton={<SkeletonCard count={1} height={320} />} />;
  }
  return <ChartPanel chart={{ ...query.data, id: chart.id }} />;
}

export function ChartGrid() {
  const query = useDataset('charts');
  const [tab, setTab] = useState('ALL');
  if (query.loading || query.error) {
    return <DataState query={query} label="charts" skeleton={<SkeletonCard count={2} height={320} />} />;
  }
  const tabs = [...new Set(query.data.map(c => c.tab).filter(Boolean))];
  const shown = tab === 'ALL' ? query.data : query.data.filter(c => c.tab === tab);
  return (
    <div>
      {tabs.length > 1 ? (
        <div className="chip-row" role="group" aria-label="Filter charts by topic">
          {['ALL', ...tabs].map(t => (
            <button type="button" key={t} className={'chip' + (tab === t ? ' chip-active' : '')} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t === 'ALL' ? 'All charts' : t}
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid grid-wide">
        {shown.map(chart => (
          <ErrorBoundary key={chart.id} label={chart.title}>
            <ChartLoader chart={chart} />
          </ErrorBoundary>
        ))}
      </div>
    </div>
  );
}
