import { useContract } from '../../hooks/useContract.js';
import { useDataset } from '../../hooks/useDataset.js';
import { useFormat } from '../../context/FormatContext.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';

export function Header() {
  const contract = useContract();
  const summary = useDataset('summary');
  const fmt = useFormat();
  const name = contract.data ? contract.data.project.name : 'Dashboard';
  const domain = contract.data ? contract.data.project.domain : '';
  const stamp = (summary.data && summary.data.lastRun) || (contract.data && contract.data.generatedAt) || '';
  return (
    <header className="app-header">
      <div>
        <strong>{name}</strong>
        {domain ? <span className="muted">{'  ' + domain}</span> : null}
      </div>
      <div className="header-meta">
        {stamp ? <span className="muted small" title={fmt.dateTime(stamp)}>{'Updated ' + fmt.ago(stamp)}</span> : null}
        <ThemeToggle />
      </div>
    </header>
  );
}
