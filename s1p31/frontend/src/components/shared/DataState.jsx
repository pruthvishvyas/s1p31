import { SkeletonCard } from './SkeletonCard.jsx';
import { refreshHint } from '../../utils/text.js';

export function DataState({ query, label, skeleton }) {
  if (query.loading) return skeleton || <SkeletonCard count={1} height={96} />;
  const err = query.error;
  if (!err) return null;
  const retry = <button type="button" className="btn-secondary" onClick={query.reload}>Retry</button>;
  if (err.kind === 'skipped') {
    return <div className="card state-box" role="status"><p>{'This section was skipped: ' + err.message}</p></div>;
  }
  if (err.kind === 'missing' || err.kind === 'empty') {
    return <div className="card state-box" role="status"><p>{'No ' + label + ' yet. ' + refreshHint()}</p>{retry}</div>;
  }
  if (err.kind === 'network') {
    return <div className="card state-box" role="status"><p>{'Could not load ' + label + '. Check the connection.'}</p>{retry}</div>;
  }
  return (
    <div className="card state-box" role="status">
      <p>{'The ' + label + ' file is not in the expected format.'}</p>
      <p className="muted small">{err.message}</p>
    </div>
  );
}
