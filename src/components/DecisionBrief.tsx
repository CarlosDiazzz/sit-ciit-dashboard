import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './decision.css';

export default function DecisionBrief({ title, evidence, action, to, linkLabel }: {
  title: string; evidence: ReactNode; action: string; to: string; linkLabel: string;
}) {
  return <section className="decision-brief" aria-label="Apoyo a la decisión">
    <div><span className="dss-kicker">LECTURA OPERATIVA</span><h2>{title}</h2><p>{evidence}</p></div>
    <div className="decision-next"><span className="dss-kicker">SIGUIENTE PASO SUGERIDO</span><p>{action}</p><Link to={to}>{linkLabel} <span aria-hidden="true">↗</span></Link></div>
  </section>;
}
