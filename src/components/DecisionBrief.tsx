import { t as translate } from '../accessibility/i18n';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './decision.css';

export default function DecisionBrief({ title, evidence, action, to, linkLabel }: {
  title: string; evidence: ReactNode; action: string; to: string; linkLabel: string;
}) {
  return <section className="decision-brief" aria-label={translate("Apoyo a la decisión")}>
    <div><span className="dss-kicker">{translate("LECTURA OPERATIVA")}</span><h2>{translate(title)}</h2><p>{translate(evidence)}</p></div>
    <div className="decision-next"><span className="dss-kicker">{translate("SIGUIENTE PASO SUGERIDO")}</span><p>{translate(action)}</p><Link to={to}>{translate(linkLabel)} <span aria-hidden="true">↗</span></Link></div>
  </section>;
}
