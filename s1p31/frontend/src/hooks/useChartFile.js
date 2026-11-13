import { useData } from './useData.js';
import { adaptChartFile } from '../utils/adapters.js';
import { chartCandidates } from '../utils/datasets.js';

// Charts listed without data point to their own file; this loads it (trying the usual folders)
export function useChartFile(chart) {
  const pending = Boolean(chart && chart.pending);
  const found = pending ? chartCandidates(chart.file) : [];
  const first = found[0] || null;
  const second = found[1] || null;
  const adapt = raw => adaptChartFile(raw, chart);
  const a = useData(first, adapt, pending);
  const viaSecond = pending && Boolean(second) && Boolean(a.error) && a.error.kind === 'missing';
  const b = useData(second, adapt, viaSecond);
  if (!pending) return { data: chart, loading: false, error: null, reload: a.reload };
  return viaSecond ? b : a;
}
