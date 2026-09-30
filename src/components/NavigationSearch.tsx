import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CornerDownLeft, Search, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Dialog from './Dialog';
import { normalizeSearch } from '../lib/managementUi';

export interface NavigationEntry { to: string; label: string; group: string; description: string; icon: LucideIcon }
export default function NavigationSearch({ entries, loading, error, retry }: { entries: NavigationEntry[]; loading: boolean; error?: string; retry: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(value => !value); }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  return <>
    <button className="global-search-trigger" onClick={() => setOpen(true)} aria-keyshortcuts="Control+k Meta+k"><Search size={17} /><span>Buscar secciones y pestañas</span><kbd>Ctrl K</kbd></button>
    {open && <SearchDialog entries={entries} loading={loading} error={error} retry={retry} onClose={() => setOpen(false)} />}
  </>;
}
function SearchDialog({ entries, onClose, loading, error, retry }: { entries: NavigationEntry[]; onClose: () => void; loading: boolean; error?: string; retry: () => void }) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  const results = entries.filter(e => words.every(word => normalizeSearch(`${e.label} ${e.group} ${e.description}`).includes(word)));
  const activeIndex = Math.min(index, Math.max(0, results.length - 1));
  useEffect(() => { list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [activeIndex, query]);
  function go(entry: NavigationEntry) { navigate(entry.to); onClose(); }
  return <Dialog title="Ir a una sección" onClose={onClose}>
    <div className="command-input"><Search size={22} aria-hidden="true" /><input autoFocus role="combobox" aria-label="Buscar secciones y pestañas" aria-expanded="true" aria-controls="navigation-results" aria-autocomplete="list" aria-activedescendant={results.length ? `navigation-result-${activeIndex}` : undefined} placeholder="Busca viajes, usuarios, rutas…" value={query} onChange={e => { setQuery(e.target.value); setIndex(0); }} onKeyDown={e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (results.length) setIndex((activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length); }
      if (e.key === 'Enter' && results[activeIndex]) { e.preventDefault(); go(results[activeIndex]); }
    }} /></div>
    {loading && <p className="command-message" role="status">Cargando pestañas de logística…</p>}
    {error && <p className="command-message" role="alert">{error} <button className="btn" onClick={retry}>Reintentar</button></p>}
    <div className="command-results" ref={list} role="listbox" id="navigation-results" aria-label="Destinos disponibles">
      {results.map((entry, i) => <div key={entry.to}>
        {(i === 0 || results[i - 1].group !== entry.group) && <p className="command-group">{entry.group}</p>}
        <div role="option" aria-selected={i === activeIndex} id={`navigation-result-${i}`} className="command-result" onMouseMove={() => setIndex(i)} onClick={() => go(entry)}>
          <span className="module-icon"><entry.icon size={21} /></span><span><strong>{entry.label}</strong><small>{entry.description}</small></span><ArrowUpRight size={17} />
        </div>
      </div>)}
    </div>
    {!results.length && <div className="workspace-empty"><Search size={30} /><strong>No encontramos esa pestaña</strong><p>Prueba con otro nombre o con el nombre de una sección.</p></div>}
    <footer className="command-footer"><span>↑ ↓ Navegar</span><span><CornerDownLeft size={13} /> Abrir</span><span><kbd>Esc</kbd> Cerrar</span><small>{results.length} destinos</small></footer>
  </Dialog>;
}
