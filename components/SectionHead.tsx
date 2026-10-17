export function SectionHead({ en, title, icon, id }: { en: string; title: string; icon: React.ReactNode; id?: string }) {
  return (
    <div className="section-head reveal">
      <span className="section-head__icon">{icon}</span>
      <div>
        <span className="section-head__en">{en}</span>
        <h2 id={id}>{title}</h2>
      </div>
      <span className="section-head__rule" aria-hidden="true" />
    </div>
  );
}
