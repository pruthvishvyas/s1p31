import { Highlight } from './Highlight.jsx';

export function GlossaryTable({ rows, query }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr><th scope="col">Term</th><th scope="col">Plain meaning</th></tr></thead>
        <tbody>
          {rows.map(([term, meaning]) => (
            <tr key={term}>
              <td><Highlight text={term} query={query} /></td>
              <td><Highlight text={meaning} query={query} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
