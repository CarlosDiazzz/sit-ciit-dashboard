import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import './workspace.css';

export default function Dialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`workspace-dialog${wide ? ' workspace-dialog-wide' : ''}`} aria-label={title}
    onCancel={e => { e.preventDefault(); close.current(); }}
    onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close.current(); } }}>
    <div className="workspace-dialog-head"><h2>{title}</h2><button type="button" className="icon-action" aria-label="Cerrar ventana" onClick={onClose}><X size={19} /></button></div>
    {children}
  </dialog>;
}
