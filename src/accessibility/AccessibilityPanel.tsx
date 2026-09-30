import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Settings } from 'lucide-react';
import Dialog from '../components/Dialog';
import { defaults, setPreferences, usePreferences } from './preferences';
import { t } from './i18n';

export default function AccessibilityPanel({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const preferences = usePreferences();
  return <>
    <button type="button" className={`accessibility-trigger${compact ? ' accessibility-trigger-compact' : ''}`} onClick={() => setOpen(true)} aria-label={t('Accesibilidad')} aria-haspopup="dialog">
      <Settings size={20} aria-hidden="true" /><span>{t('Accesibilidad')}</span>
    </button>
    {open && createPortal(<Dialog title={t('Accesibilidad')} onClose={() => setOpen(false)}>
      <div className="accessibility-panel">
        <p>{t('Ajusta la interfaz a tus necesidades. Las preferencias se guardan en este navegador.')}</p>
        <label className="accessibility-option"><span><strong>{t('Idioma')}</strong><small>{t('Idioma de la interfaz')}</small></span>
          <select value={preferences.language} onChange={event => setPreferences({ language: event.target.value === 'en' ? 'en' : 'es' })}>
            <option value="es" lang="es">Español</option><option value="en" lang="en">English</option>
          </select>
        </label>
        <label className="accessibility-option"><span><strong>{t('Contraste alto')}</strong><small>{t('Texto y bordes más definidos.')}</small></span><input type="checkbox" checked={preferences.highContrast} onChange={event => setPreferences({ highContrast: event.target.checked })} /></label>
        <label className="accessibility-option"><span><strong>{t('Texto grande')}</strong><small>{t('Aumenta el tamaño de la letra un 25 %.')}</small></span><input type="checkbox" checked={preferences.largeText} onChange={event => setPreferences({ largeText: event.target.checked })} /></label>
        <label className="accessibility-option"><span><strong>{t('Reducir movimiento')}</strong><small>{t('Desactiva destellos y animaciones decorativas.')}</small></span><input type="checkbox" checked={preferences.reducedMotion} onChange={event => setPreferences({ reducedMotion: event.target.checked })} /></label>
        <p className="accessibility-help">{t('Puedes navegar con Tab y cerrar esta ventana con Escape. También puedes ampliar la página con el zoom del navegador.')}</p>
        <button type="button" className="btn" onClick={() => setPreferences(defaults)}>{t('Restablecer preferencias')}</button>
      </div>
    </Dialog>, document.body)}
  </>;
}
