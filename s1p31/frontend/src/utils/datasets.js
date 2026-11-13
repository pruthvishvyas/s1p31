import * as A from './adapters.js';

export const CONTRACT_PATH = '/data/frontend_contract.json';

export const DATASETS = {
  summary:         { outcome: 'meta',       key: 'summary',         fallback: 'meta/summary.json',                 adapt: A.adaptSummary },
  runLog:          { outcome: 'meta',       key: 'run_log',         fallback: 'meta/run_log.json',                 adapt: A.adaptRunLog },
  kpis:            { outcome: 'understand', key: 'kpis',            fallback: 'understand/kpis.json',              adapt: A.adaptKpis },
  charts:          { outcome: 'understand', key: 'charts',          fallback: 'understand/charts.json',            adapt: A.adaptCharts },
  segments:        { outcome: 'understand', key: 'segments',        fallback: 'understand/segments.json',          adapt: A.adaptSegments },
  anomalies:       { outcome: 'understand', key: 'anomalies',       fallback: 'understand/anomalies.json',         adapt: A.adaptAnomalies },
  explorer:        { outcome: 'understand', key: 'explorer',        fallback: 'understand/explorer.json',          adapt: A.adaptCube },
  insights:        { outcome: 'decide',     key: 'insights',        fallback: 'decide/insights.json',              adapt: A.adaptInsights },
  recommendations: { outcome: 'decide',     key: 'recommendations', fallback: 'decide/recommendations.json',       adapt: A.adaptRecommendations },
  simulations:     { outcome: 'decide',     key: 'simulations',     fallback: 'decide/simulations/index.json',     adapt: A.adaptSimulationIndex },
  goals:           { outcome: 'decide',     key: 'goals',           fallback: 'decide/goals.json',                 adapt: A.adaptGoals },
  forecast:        { outcome: 'monitor',    key: 'forecast',        fallback: 'monitor/forecast.json',             adapt: A.adaptForecast },
  forecastLookup:  { outcome: 'monitor',    key: 'forecast_lookup', fallback: 'monitor/forecast_lookup.json',      adapt: A.adaptForecastLookup },
  scorer:          { outcome: 'monitor',    key: 'scorer',          fallback: 'monitor/scorer.json',               adapt: A.adaptScorer },
  goalProgress:    { outcome: 'monitor',    key: 'goal_progress',   fallback: 'monitor/goal_progress.json',        adapt: A.adaptGoalProgress },
  alerts:          { outcome: 'monitor',    key: 'alerts',          fallback: 'monitor/alerts.json',               adapt: A.adaptAlerts },
};

export function resolveDatasetPath(contract, def) {
  const rel = contract && contract.outcomes && contract.outcomes[def.outcome] && contract.outcomes[def.outcome][def.key];
  const ok = typeof rel === 'string' && rel.endsWith('.json') && !rel.includes('..');
  return '/data/' + String(ok ? rel : def.fallback).replace(/^\/+/, '');
}

export function chartCandidates(file) {
  const f = String(file || '').replace(/^\/+/, '').replace(/^output\//, '');
  if (!f || f.includes('..')) return [];
  const list = [f];
  if (!f.startsWith('understand/')) list.push('understand/' + f);
  if (!f.includes('/')) list.push('understand/charts/' + f);
  return [...new Set(list)].map(x => '/data/' + x);
}

export function dataFilePath(file) {
  const rel = String(file || '');
  return rel.includes('..') ? null : '/data/' + rel.replace(/^\/+/, '');
}
