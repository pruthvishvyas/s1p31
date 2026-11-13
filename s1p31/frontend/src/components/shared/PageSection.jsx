export function PageSection({ title, lead, children }) {
  return (
    <section className="page-section">
      <h1 className="page-title">{title}</h1>
      {lead ? <p className="page-lead">{lead}</p> : null}
      {children}
    </section>
  );
}
