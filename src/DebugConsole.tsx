import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ExternalLink, PanelBottom, PanelBottomClose, PanelLeft, PanelRight, SquareTerminal, Trash2 } from 'lucide-react';
import { useI18n } from './i18n';

export type DebugLevel = 'info' | 'success' | 'warning' | 'error';
export type DebugEntry = { id: number; timestamp: number; level: DebugLevel; message: string; detail?: string };
export type DockPosition = 'left' | 'right' | 'bottom';

type DebugPanelProps = {
  entries: DebugEntry[];
  mode: 'docked' | 'window';
  onClear: () => void;
  onPopout?: () => void;
  onDock?: () => void;
  dockPosition?: DockPosition;
  onDockPositionChange?: (position: DockPosition) => void;
  onResizeStart?: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export function DebugPanel({ entries, mode, onClear, onPopout, onDock, dockPosition = 'bottom', onDockPositionChange, onResizeStart }: DebugPanelProps) {
  const { language, t } = useI18n();
  return <section className={`debug-panel ${mode} ${mode === 'docked' ? dockPosition : ''}`} aria-label={t('debug.title')}>
    {mode === 'docked' && (
      <div className="debug-resize-handle" aria-hidden="true" onPointerDown={onResizeStart}/>
    )}
    <header className="debug-heading">
      <div><SquareTerminal size={16}/><span><strong>{t('debug.title')}</strong><small>{t('debug.session', { count: entries.length })}</small></span></div>
      <div className="debug-actions">
        {mode === 'docked' && <div className="dock-position-actions" aria-label="Dock position">
          <button className={dockPosition === 'left' ? 'active' : ''} aria-label="Dock debug console left" title="Dock left" onClick={() => onDockPositionChange?.('left')}><PanelLeft size={15}/></button>
          <button className={dockPosition === 'bottom' ? 'active' : ''} aria-label="Dock debug console bottom" title="Dock bottom" onClick={() => onDockPositionChange?.('bottom')}><PanelBottom size={15}/></button>
          <button className={dockPosition === 'right' ? 'active' : ''} aria-label="Dock debug console right" title="Dock right" onClick={() => onDockPositionChange?.('right')}><PanelRight size={15}/></button>
        </div>}
        {mode === 'docked' && <button aria-label="Pop out debug console" title="Pop out" onClick={onPopout}><ExternalLink size={15}/></button>}
        {mode === 'window' && <button aria-label="Dock debug console" title="Dock in main window" onClick={onDock}><PanelBottomClose size={16}/></button>}
        <button aria-label="Clear debug console" title="Clear" onClick={onClear}><Trash2 size={15}/></button>
      </div>
    </header>
    <div className="debug-list" aria-live="polite">
      {entries.length === 0 && <div className="debug-empty">{t('debug.empty')}</div>}
      {[...entries].reverse().map((entry) => <article className={`debug-entry ${entry.level}`} key={entry.id}>
        <time>{new Date(entry.timestamp).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
        <span className="debug-level">{entry.level}</span>
        <div><strong>{entry.message}</strong>{entry.detail && <p>{entry.detail}</p>}</div>
      </article>)}
    </div>
  </section>;
}

export default function DebugConsole() {
  const [entries, setEntries] = useState<DebugEntry[]>([]);

  useEffect(() => {
    let active = true;
    window.mediaRenamer?.getDebugEntries().then((initial) => { if (active) setEntries(initial); });
    const unsubscribe = window.mediaRenamer?.onDebugEntries(setEntries);
    return () => { active = false; unsubscribe?.(); };
  }, []);

  return <main className="debug-window"><DebugPanel entries={entries} mode="window" onClear={() => void window.mediaRenamer?.clearDebugEntries()} onDock={() => void window.mediaRenamer?.dockDebugConsole()}/></main>;
}
