const NAMES = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };

export function SeverityBadge({ level }) {
  return <span className={'badge sev-' + String(level).toLowerCase()}>{NAMES[level] || level}</span>;
}
