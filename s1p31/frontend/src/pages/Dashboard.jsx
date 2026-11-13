import { PageSection } from '../components/shared/PageSection.jsx';
import { KPICards } from '../components/understand/KPICards.jsx';
import { ChartGrid } from '../components/understand/ChartGrid.jsx';
import { SegmentExplorer } from '../components/understand/SegmentExplorer.jsx';
import { AnomalyTable } from '../components/understand/AnomalyTable.jsx';
import { InsightCards } from '../components/decide/InsightCards.jsx';
import { RecommendationEngine } from '../components/decide/RecommendationEngine.jsx';
import { WhatIfSimulator } from '../components/decide/WhatIfSimulator.jsx';
import { GoalTracker } from '../components/decide/GoalTracker.jsx';
import { Forecaster } from '../components/monitor/Forecaster.jsx';
import { Predictor } from '../components/monitor/Predictor.jsx';
import { GoalProgress } from '../components/monitor/GoalProgress.jsx';
import { AlertCenter } from '../components/monitor/AlertCenter.jsx';
import { InteractiveExplorer } from '../components/explorer/InteractiveExplorer.jsx';
import { UserManual } from '../components/manual/UserManual.jsx';
import { DataHealth } from '../components/health/DataHealth.jsx';

const PAGES = {
  'understand/overview': { title: 'Overview', lead: 'The key numbers and what they show.', body: () => (<><KPICards /><ChartGrid /></>) },
  'understand/segments': { title: 'Segments', lead: 'Groups of similar records and how large each one is.', body: () => <SegmentExplorer /> },
  'understand/anomalies': { title: 'Anomalies', lead: 'Unusual days or records that do not match normal behavior.', body: () => <AnomalyTable /> },
  'decide/insights': { title: 'Insights', lead: 'What the data says, with the evidence and what to do.', body: () => <InsightCards /> },
  'decide/recommendations': { title: 'Recommendations', lead: 'Actions in order of priority.', body: () => <RecommendationEngine /> },
  'decide/what-if': { title: 'What-if', lead: 'Move the slider to see how a change would play out.', body: () => <WhatIfSimulator /> },
  'decide/goals': { title: 'Goals', lead: 'Targets for the business.', body: () => <GoalTracker /> },
  'monitor/forecast': { title: 'Forecast', lead: 'An estimate of the coming period based on past patterns.', body: () => <Forecaster /> },
  'monitor/predict': { title: 'Predict', lead: 'Enter your own numbers and see an estimate.', body: () => <Predictor /> },
  'monitor/progress': { title: 'Progress', lead: 'How the latest period compares with the targets.', body: () => <GoalProgress /> },
  'monitor/alerts': { title: 'Alerts', lead: 'Things that need attention now.', body: () => <AlertCenter /> },
  explore: { title: 'Explore', lead: 'Filter and compare the data by any dimension.', body: () => <InteractiveExplorer /> },
  guide: { title: 'Guide', lead: 'A plain-English manual for this dashboard.', body: () => <UserManual /> },
  health: { title: 'Data health', lead: 'What loaded, what was skipped and why.', body: () => <DataHealth /> },
};

export const PAGE_IDS = Object.keys(PAGES);
export const DEFAULT_PAGE = 'understand/overview';

export function Dashboard({ route }) {
  const page = PAGES[route] || PAGES[DEFAULT_PAGE];
  return <PageSection title={page.title} lead={page.lead}>{page.body()}</PageSection>;
}
