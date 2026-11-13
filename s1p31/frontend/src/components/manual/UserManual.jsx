import { useState } from 'react';
import { useTerm } from '../../context/TerminologyContext.jsx';
import { useContract } from '../../hooks/useContract.js';
import { Highlight } from './Highlight.jsx';
import { GlossaryTable } from './GlossaryTable.jsx';

export function UserManual() {
  const term = useTerm();
  const contract = useContract();
  const [query, setQuery] = useState('');
  const revenue = term('revenue', { lower: true });
  const customer = term('customer', { lower: true, plural: true });
  const product = term('product', { lower: true, plural: true });
  const transaction = term('transaction', { lower: true, plural: true });
  const domain = contract.data && contract.data.project.domain ? contract.data.project.domain : 'your business';

  const sections = [
    { id: 'start', title: 'How to use this dashboard', blocks: [
      ['What you see', 'This dashboard turns the daily records for ' + domain + ' into answers. It has three parts. Understand shows what is happening. Decide shows what to do about it. Monitor shows how things are moving and warns you early.'],
      ['What it means', 'Every number comes from the latest analysis run. Nothing is entered by hand, except targets that you type yourself on the Goals page.'],
      ['What to do', 'Start on Overview, then work down the menu on the left. Use Data health if a section looks empty.'],
    ] },
    { id: 'overview', title: 'Overview', blocks: [
      ['What you see', 'Key number cards and charts. Each chart has a title and the question it answers.'],
      ['What it means', 'Cards show the latest value, and an arrow shows the change against the previous period when it is known. Total ' + revenue + ', ' + transaction + ' and service levels are typical examples.'],
      ['What to do', 'Look for numbers that moved the wrong way, then open Insights to see why.'],
    ] },
    { id: 'segments', title: 'Segments', blocks: [
      ['What you see', 'Groups of similar records, with their size and share of the total.'],
      ['What it means', 'Segments help you treat different ' + customer + ' or ' + product + ' differently instead of averaging them together.'],
      ['What to do', 'Click a segment to see its details. Focus on the biggest groups first.'],
    ] },
    { id: 'anomalies', title: 'Anomalies', blocks: [
      ['What you see', 'A table of unusual days or records, with the value found and the reason it was flagged.'],
      ['What it means', 'An anomaly is an unusual day or record that does not match normal behavior. It is a prompt to look closer, not proof of a problem.'],
      ['What to do', 'Sort by a column, check the biggest gaps, and confirm whether there was a real cause.'],
    ] },
    { id: 'insights', title: 'Insights and recommendations', blocks: [
      ['What you see', 'Findings with the evidence behind them, and actions in order of priority.'],
      ['What it means', 'Severity is High, Medium or Low. Priority is Urgent, High, Medium or Routine. Words and colors are used together so nothing depends on color alone.'],
      ['What to do', 'Deal with High and Urgent items first, then plan the rest.'],
    ] },
    { id: 'whatif', title: 'What-if tool', blocks: [
      ['What you see', 'A slider and a comparison of the baseline against your scenario.'],
      ['What it means', 'The tool reads between points the analysis calculated in advance. It lists the assumptions it relies on.'],
      ['What to do', 'Move the slider, compare the change, and read the assumptions before acting on a result.'],
    ] },
    { id: 'forecast', title: 'Forecast and Predict', blocks: [
      ['What you see', 'A line of history and an estimate of the coming period. The Predict page lets you enter your own numbers.'],
      ['What it means', 'A forecast is an estimate of the future based on past patterns. Typical error is how far off the forecast was when tested on recent history it had not seen. The simple rule shown beside it is a yardstick to beat.'],
      ['What to do', 'Use the forecast for planning, keep the typical error in mind, and treat every result as an estimate, not a guarantee.'],
    ] },
    { id: 'progress', title: 'Progress and alerts', blocks: [
      ['What you see', 'Progress bars against targets and a list of active alerts.'],
      ['What it means', 'Status is On track, At risk, Off track or No target. An empty alert list is good news.'],
      ['What to do', 'Check Alerts each day and open the matching insight for anything marked High.'],
    ] },
    { id: 'explore', title: 'Explore', blocks: [
      ['What you see', 'Filters, a trend chart, comparison bars and a table of top groups.'],
      ['What it means', 'The figures are already summed up, so no individual records are shown. Click a bar to filter every chart, click it again to clear.'],
      ['What to do', 'Use Copy summary to paste the current totals into an email or note.'],
    ] },
    { id: 'health', title: 'Data health', blocks: [
      ['What you see', 'When the analysis last ran, the date range, and whether each part loaded.'],
      ['What it means', 'Skipped means that step did not run. Missing means the file was not found. Invalid means the file was not in the expected format.'],
      ['What to do', 'Share this page with the person who maintains the analysis if something looks wrong.'],
    ] },
    { id: 'charts', title: 'How to read the charts', blocks: [
      ['Bar and histogram', 'Taller bars mean larger values. A histogram groups numbers into ranges.'],
      ['Line', 'Read left to right to see how a value changes over time.'],
      ['Scatter and heatmap', 'A scatter chart shows how two numbers move together. A heatmap uses darker cells for larger values.'],
    ] },
  ];
  const glossary = [
    ['Anomaly', 'An unusual day or record that does not match normal behavior.'],
    ['Forecast', 'An estimate of the future based on past patterns.'],
    ['Typical error', 'How far off the forecast was when tested on recent history it had not seen.'],
    ['Baseline', 'A simple rule used as a yardstick.'],
    ['Segment', 'A group of similar records.'],
    ['Margin', 'What is left of ' + revenue + ' after the costs of fulfilling it, as a share of ' + revenue + '.'],
    ['Backlog', 'Work that has been received but is not yet finished.'],
    ['Severity', 'How serious a finding or alert is: High, Medium or Low.'],
  ];
  const q = query.trim().toLowerCase();
  const shown = q
    ? sections.filter(s => (s.title + ' ' + s.blocks.map(b => b[0] + ' ' + b[1]).join(' ')).toLowerCase().includes(q))
    : sections;
  const glossaryShown = q ? glossary.filter(g => (g[0] + ' ' + g[1]).toLowerCase().includes(q)) : glossary;

  return (
    <div className="manual stack">
      <div className="manual-tools">
        <div className="field">
          <label htmlFor="manual-search">Search the guide</label>
          <input id="manual-search" type="search" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <button type="button" className="btn-secondary" onClick={() => window.print()}>Print</button>
      </div>
      {shown.length === 0 && glossaryShown.length === 0 ? <div className="card state-box"><p>Nothing matches that search.</p></div> : null}
      {shown.map(s => (
        <article className="card" key={s.id}>
          <h2><Highlight text={s.title} query={q} /></h2>
          {s.blocks.map(b => (
            <div key={b[0]}>
              <h3>{b[0]}</h3>
              <p><Highlight text={b[1]} query={q} /></p>
            </div>
          ))}
        </article>
      ))}
      {glossaryShown.length > 0 ? (
        <article className="card">
          <h2>Glossary</h2>
          <GlossaryTable rows={glossaryShown} query={q} />
        </article>
      ) : null}
    </div>
  );
}
