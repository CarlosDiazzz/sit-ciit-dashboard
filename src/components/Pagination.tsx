import { t as translate } from '../accessibility/i18n';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import './workspace.css';

export function Pagination({ page, pageSize, total, onPage, onPageSize, disabled = false }: { page: number; pageSize: number; total: number; onPage: (page: number) => void; onPageSize: (size: number) => void; disabled?: boolean }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  const start = Math.max(1, Math.min(current - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  return <nav className="pagination" aria-label={translate("Paginación de registros")}>
    <span className="pagination-summary" aria-live="polite">{translate(total ? `${(current - 1) * pageSize + 1}–${Math.min(current * pageSize, total)} de ${total}` : '0 registros')}</span>
    <label>{translate("Filas ")}<select aria-label={translate("Filas por página")} value={pageSize} disabled={disabled} onChange={e => onPageSize(Number(e.target.value))}>{[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
    <div className="pagination-buttons">
      <button className="btn" aria-label={translate("Primera página")} disabled={disabled || current <= 1} onClick={() => onPage(1)}><ChevronsLeft size={16} /></button>
      <button className="btn" aria-label={translate("Página anterior")} disabled={disabled || current <= 1} onClick={() => onPage(current - 1)}><ChevronLeft size={16} /></button>
      {numbers.map(n => <button key={n} className={`btn${n === current ? ' is-current' : ''}`} aria-label={translate(`Página ${n}`)} aria-current={n === current ? 'page' : undefined} disabled={disabled} onClick={() => onPage(n)}>{n}</button>)}
      <button className="btn" aria-label={translate("Página siguiente")} disabled={disabled || current >= pages} onClick={() => onPage(current + 1)}><ChevronRight size={16} /></button>
      <button className="btn" aria-label={translate("Última página")} disabled={disabled || current >= pages} onClick={() => onPage(pages)}><ChevronsRight size={16} /></button>
    </div>
  </nav>;
}

/** For endpoints returning a bounded list; total refers to the loaded records. */
export function PagedRows<T>({ items, children, label = 'Registros' }: { items: T[]; children: (rows: T[]) => ReactNode; label?: string }) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const current = Math.min(page, Math.max(1, Math.ceil(items.length / size)));
  return <section className="data-table-panel" aria-label={translate(label)}><div className="data-table-caption"><strong>{translate(label)}</strong><span>{items.length}{translate(" registros cargados")}</span></div>{translate(children(items.slice((current - 1) * size, current * size)))}<Pagination page={current} pageSize={size} total={items.length} onPage={setPage} onPageSize={n => { setSize(n); setPage(1); }} /></section>;
}
