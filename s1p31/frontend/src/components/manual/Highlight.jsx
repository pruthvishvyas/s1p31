import { splitMatches } from '../../utils/text.js';

export function Highlight({ text, query }) {
  const parts = splitMatches(text, query);
  return (
    <>
      {parts.map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
    </>
  );
}
