import { Icon } from './Icon.jsx';

const GROUPS = [
  { title: 'Understand', items: [
    { id: 'understand/overview', label: 'Overview', icon: 'overview' },
    { id: 'understand/segments', label: 'Segments', icon: 'segments' },
    { id: 'understand/anomalies', label: 'Anomalies', icon: 'anomalies' },
  ] },
  { title: 'Decide', items: [
    { id: 'decide/insights', label: 'Insights', icon: 'insights' },
    { id: 'decide/recommendations', label: 'Recommendations', icon: 'recs' },
    { id: 'decide/what-if', label: 'What-if', icon: 'whatif' },
    { id: 'decide/goals', label: 'Goals', icon: 'goals' },
  ] },
  { title: 'Monitor', items: [
    { id: 'monitor/forecast', label: 'Forecast', icon: 'forecast' },
    { id: 'monitor/predict', label: 'Predict', icon: 'predict' },
    { id: 'monitor/progress', label: 'Progress', icon: 'progress' },
    { id: 'monitor/alerts', label: 'Alerts', icon: 'alerts' },
  ] },
  { title: 'More', items: [
    { id: 'explore', label: 'Explore', icon: 'explore' },
    { id: 'guide', label: 'Guide', icon: 'guide' },
    { id: 'health', label: 'Data health', icon: 'health' },
  ] },
];

export function Sidebar({ route }) {
  return (
    <nav className="sidebar" aria-label="Main">
      {GROUPS.map(group => (
        <div className="nav-group" key={group.title}>
          <p className="nav-title">{group.title}</p>
          {group.items.map(item => (
            <a key={item.id} href={'#/' + item.id} className={'nav-link' + (route === item.id ? ' active' : '')} aria-current={route === item.id ? 'page' : undefined}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}
