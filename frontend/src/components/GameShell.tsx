import { useEffect, useRef, useState, type ReactNode } from 'react';
import { readGamePreferences, saveGamePreferences, type GamePreferences } from '../gamePreferences';
import { localStorageOrNull } from '../session';
import { playAcceptedTacticalShot, updateTacticalAudio } from '../isoTacticalShotAudio';
import './gameShell.css';

type MenuPage = 'pause' | 'options' | 'audio' | null;

export function useGamePresentation() {
  const [preferences, setPreferences] = useState(() => readGamePreferences(localStorageOrNull()));
  const [menu, setMenu] = useState<MenuPage>(null);
  const [atTitle, setAtTitle] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [pocOpen, setPocOpen] = useState(false);
  const [preferencesSaved, setPreferencesSaved] = useState(true);
  useEffect(() => {
    setPreferencesSaved(saveGamePreferences(localStorageOrNull(), preferences));
    updateTacticalAudio(preferences.volume, preferences.muted);
  }, [preferences]);
  const immersive = preferences.layout === 'game';
  return { preferences, setPreferences, menu, setMenu, atTitle, setAtTitle,
    journalOpen, setJournalOpen, pocOpen, setPocOpen, preferencesSaved, immersive,
    paused: !!menu || atTitle || (immersive && (journalOpen || pocOpen)) };
}
type Presentation = ReturnType<typeof useGamePresentation>;

export function GameShell({ presentation: game, children, location, transportPending, canOpenPoc }: {
  presentation: Presentation; children: ReactNode; location: string;
  transportPending: boolean; canOpenPoc: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenNotice, setFullscreenNotice] = useState('');
  const [audioNotice, setAudioNotice] = useState('');
  const modalOpen = !!game.menu || game.atTitle;
  const change = (patch: Partial<GamePreferences>) => game.setPreferences(before => ({ ...before, ...patch }));
  const resume = () => { game.setMenu(null); game.setAtTitle(false); };
  const back = () => game.setMenu(game.atTitle ? null : 'pause');
  useEffect(() => {
    if (!modalOpen || !dialog.current) return;
    const node = dialog.current;
    const previous = document.activeElement;
    node.showModal();
    return () => {
      node.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [modalOpen]);
  useEffect(() => {
    if (modalOpen) dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [game.menu, game.atTitle, modalOpen]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (!modalOpen && transportPending) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (game.menu === 'options' || game.menu === 'audio') back();
      else if (game.menu) game.setMenu(null);
      else if (game.atTitle) return;
      else if (game.journalOpen) game.setJournalOpen(false);
      else game.setMenu('pause');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [game.menu, game.atTitle, game.journalOpen, modalOpen, transportPending]);
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
      setFullscreenNotice('');
    } catch { setFullscreenNotice('El navegador no permite ampliar esta ventana. La vista de juego sigue disponible.'); }
  };
  const exit = () => {
    game.setMenu(null); game.setAtTitle(true);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  };
  return <div ref={root} className="game-shell" data-interface={game.preferences.layout}
    data-journal-open={game.journalOpen} data-poc-open={game.pocOpen} data-testid="game-shell">
    {game.immersive && <header className="game-toolbar">
      <div className="game-identity"><span aria-hidden="true">◇</span><div>MERIDIAN<small>{location}</small></div></div>
      <nav aria-label="Controles del juego">
        <button type="button" data-testid="game-journal-toggle" aria-expanded={game.journalOpen}
          disabled={game.pocOpen} onClick={() => game.setJournalOpen(open => !open)}>Diario <span aria-hidden="true">↗</span></button>
        <button type="button" className="game-poc-button" data-testid="tactical-lab-toggle"
          disabled={!canOpenPoc} aria-expanded={game.pocOpen} aria-controls="tactical-lab-content"
          onClick={() => { game.setJournalOpen(false); game.setPocOpen(open => !open); }}>
          {game.pocOpen ? 'Volver al puente' : 'Combate táctico'} <small>POC</small>
        </button>
        <button type="button" className="game-menu-button" data-testid="game-menu-open"
          aria-haspopup="dialog" onClick={() => game.setMenu('pause')}><span aria-hidden="true">☰</span> Menú</button>
      </nav>
    </header>}
    <div className="game-content" ref={node => { if (node) node.inert = modalOpen; }}>{children}</div>
    {modalOpen && <dialog ref={dialog} className={`game-menu ${game.atTitle && !game.menu ? 'game-title-menu' : ''}`}
      aria-labelledby="game-menu-title" onCancel={event => { event.preventDefault(); if (!game.atTitle) game.setMenu(null); }}>
      <div className="game-menu-eyebrow">SHADOWOPS · STAR ADVENTURES</div>
      <h2 id="game-menu-title">{game.menu === 'options' ? 'Opciones' : game.menu === 'audio' ? 'Audio'
        : game.atTitle ? 'Ecos en la frontera' : 'Juego en pausa'}</h2>
      {!game.menu && game.atTitle ? <>
        <p>El mando te espera.</p>
        <button type="button" className="game-menu-primary" data-testid="game-continue" onClick={resume}>Continuar partida <span>→</span></button>
        <button type="button" onClick={() => game.setMenu('options')}>Opciones</button>
        <button type="button" onClick={() => game.setMenu('audio')}>Audio</button>
        <small>Tu partida conserva su progreso en este navegador.</small>
      </> : game.menu === 'pause' ? <>
        <p>{location} · Esc para volver</p>
        <button type="button" className="game-menu-primary" data-testid="game-resume" onClick={resume}>Volver al juego <span>→</span></button>
        <button type="button" data-testid="game-options" onClick={() => game.setMenu('options')}>Opciones</button>
        <button type="button" data-testid="game-audio" onClick={() => game.setMenu('audio')}>Audio</button>
        <button type="button" data-testid="game-exit" onClick={exit}>Salir al menú principal</button>
      </> : game.menu === 'options' ? <>
        <button type="button" className="game-menu-back" onClick={back}>← Volver</button>
        <label className="game-setting">Interfaz
          <select data-testid="game-layout" value={game.preferences.layout} onChange={event => change({ layout: event.target.value as GamePreferences['layout'] })}>
            <option value="game">Puesto del capitán</option><option value="journal">Exploración del puente y diario</option>
          </select>
        </label>
        <label className="game-check-setting"><input data-testid="game-hints" type="checkbox" checked={game.preferences.hints}
          onChange={event => change({ hints: event.target.checked })} />Mostrar guía de navegación</label>
        <button type="button" data-testid="game-fullscreen" aria-pressed={fullscreen}
          disabled={!document.fullscreenEnabled} onClick={() => void toggleFullscreen()}>
          {fullscreen ? 'Salir de pantalla completa del navegador' : 'Ampliar al navegador completo'}
        </button>
        {fullscreenNotice && <p role="status">{fullscreenNotice}</p>}
        <p className="game-control-legend">Puente · selecciona un oficial<br />Superficie · flechas o WASD<br />E · usar estación &nbsp; Esc · menú</p>
      </> : game.menu === 'audio' ? <>
        <button type="button" className="game-menu-back" onClick={back}>← Volver</button>
        <label className="game-check-setting"><input type="checkbox" data-testid="game-mute" checked={game.preferences.muted}
          onChange={event => { change({ muted: event.target.checked }); setAudioNotice(''); }} />Silenciar efectos</label>
        <label className="game-setting">Volumen de efectos <output>{Math.round(game.preferences.volume * 100)} %</output>
          <input type="range" min="0" max="1" step="0.05" data-testid="game-volume" value={game.preferences.volume}
            onChange={event => change({ volume: Number(event.target.value) })} />
        </label>
        <button type="button" data-testid="game-audio-preview" disabled={game.preferences.muted || game.preferences.volume === 0}
          onClick={() => setAudioNotice(playAcceptedTacticalShot() ? 'Prueba de efectos reproducida.' : 'El audio no está disponible en este navegador.')}>Probar efectos</button>
        <p role="status">{audioNotice || 'Efectos de combate sintetizados. El audio se activa con tu interacción.'}</p>
      </> : null}
      {!game.preferencesSaved && <p role="status" className="game-save-warning">Opciones temporales · no se han podido guardar.</p>}
    </dialog>}
  </div>;
}
