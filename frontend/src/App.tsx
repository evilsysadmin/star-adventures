import { useEffect, useMemo, useState } from 'react';
import episode from '../../content/episodes/border-signal.json';
import { startEpisode, choose, currentNode } from '../../src/episode.mjs';
import { BridgeScene } from './components/BridgeScene';

const outcomeText: Record<string, string> = {
  'peaceful-resolution': 'Paz negociada',
  'tactical-resolution': 'Victoria táctica',
  withdrawal: 'Retirada estratégica',
};
const choiceKinds: Record<string, string> = {
  scan: 'CIENCIA', broadcast: 'CIENCIA', hail: 'DIPLOMACIA', mediate: 'DIPLOMACIA',
  intercept: 'TÁCTICA', disable: 'TÁCTICA', disengage: 'NAVEGACIÓN', withdraw: 'NAVEGACIÓN', ultimatum: 'MANDO',
};
const spanishText: Record<string, string> = {
  distress: 'Una nave científica dañada emite una advertencia junto a la frontera disputada. La tripulación espera tus órdenes.',
  analysis: 'Los sensores revelan que el supuesto disparo es una descarga natural. Ambas naves reaccionan a datos erróneos.',
  parley: 'Los dos capitanes aceptan un alto el fuego si consigues establecer un canal neutral.',
  intervention: 'Tu intervención protege a la tripulación civil, pero una descarga alcanza el casco de tu nave.',
  peace: 'La ciencia y el diálogo evitan el enfrentamiento. Ambas tripulaciones sobreviven.',
  costly: 'La amenaza termina, aunque los daños obligan a reparar la nave.',
  withdrawal: 'Tu nave escapa. La disputa sigue sin resolverse.',
};
const spanishChoices: Record<string, string> = {
  scan: 'Analizar las lecturas anómalas',
  hail: 'Abrir un canal diplomático',
  intercept: 'Interponer la nave para proteger a los civiles',
  broadcast: 'Enviar los hallazgos a ambas naves',
  withdraw: 'Retirarse con las pruebas',
  mediate: 'Coordinar un rescate conjunto',
  ultimatum: 'Presentar un ultimátum',
  disable: 'Inutilizar los motores del agresor',
  disengage: 'Romper contacto y escapar',
};

export function App() {
  const [state, setState] = useState(() => startEpisode(episode));
  const node = currentNode(episode, state);
  const terminal = typeof node.outcome === 'string';
  const choices = useMemo(() => node.choices ?? [], [node]);
  const restart = () => setState(startEpisode(episode));
  const select = (id: string) => setState(prev => choose(episode, prev, id));

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName))) return;
      if (terminal && event.key.toLowerCase() === 'r') { event.preventDefault(); restart(); return; }
      const index = Number(event.key) - 1;
      if (event.key >= '1' && event.key <= '9' && choices[index]) {
        event.preventDefault();
        select(choices[index].id);
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [choices, terminal]);

  const last = state.log.at(-1);
  const showDamage = state.stats.shipDamage > 0;

  return (
    <div className="app-shell">
      <a href="#orders" className="skip-link">Ir a las órdenes</a>
      <header className="masthead">
        <div className="brand-mark" aria-hidden="true">✦</div>
        <div className="brand-block"><div className="brand-name">STAR <span>ADVENTURES</span></div><div className="brand-caption">SHADOWOPS · PROTOTIPO DE CAMPAÑA</div></div>
        <div className="masthead-right"><span className="status-dot" /> SISTEMAS OPERATIVOS <span className="masthead-separator">/</span> V 0.1</div>
      </header>

      <main className="bridge-layout">
        <section className="hero-panel" aria-labelledby="mission-title">
          <div className="eyebrow"><span className="eyebrow-line" /> MISIÓN 001 <span className="eyebrow-muted">/ SECTOR DISPUTADO</span></div>
          <h1 id="mission-title">Ecos en la <em>frontera</em></h1>
          <p className="mission-summary">Un SOS en territorio disputado. Dos capitanes al borde del combate. El próximo movimiento es tuyo.</p>
          <BridgeScene alert={showDamage} terminal={terminal} />
          <div className="stat-band" aria-label="Estado de la expedición">
            <div className="stat"><div className="stat-heading">CIENCIA</div><div className="stat-value" data-testid="science-score">{state.stats.science.toString().padStart(2, '0')}</div><span className="stat-sub">EVIDENCIA</span></div>
            <div className="stat"><div className="stat-heading">DIPLOMACIA</div><div className="stat-value" data-testid="diplomacy-score">{state.stats.diplomacy.toString().padStart(2, '0')}</div><span className="stat-sub">INFLUENCIA</span></div>
            <div className={`stat ${showDamage ? 'stat-warning' : ''}`}><div className="stat-heading">DAÑO RECIBIDO</div><div className="stat-value" data-testid="damage-score">{state.stats.shipDamage.toString().padStart(2, '0')}</div><span className="stat-sub">CASCO / SISTEMAS</span></div>
          </div>
        </section>

        <section className="orders-panel" id="orders" aria-labelledby="orders-title">
          <div className="panel-topline"><span>01 / ÓRDENES DEL CAPITÁN</span><span className="panel-diamond" aria-hidden="true">◆</span></div>
          <div className="officer"><span className="officer-avatar" aria-hidden="true">C</span><div><div className="officer-role">OFICIAL DE GUARDIA</div><div className="officer-name">Puente de mando</div></div><span className="comms-live" aria-label="Canal activo">ENLACE ABIERTO</span></div>
          <div className="divider-fine" />
          <div aria-live="polite" aria-atomic="true" className="narrative" data-testid="narrative">
            <div className="panel-label">{terminal ? 'INFORME FINAL' : 'SITUACIÓN ACTUAL'}</div>
            <h2 id="orders-title">{terminal ? outcomeText[node.outcome!] : 'Esperando instrucciones'}</h2>
            <p>{spanishText[state.nodeId] ?? node.text}</p>
          </div>
          <div className="decision-section">
            <div className="decision-heading"><span>{terminal ? 'MISIÓN COMPLETADA' : 'SELECCIONA UNA ORDEN'}</span>{!terminal && <span>{choices.length} OPCIONES</span>}</div>
            {terminal ? (
              <div className="ending" data-testid="ending"><span className="ending-icon" aria-hidden="true">✧</span><div><strong>Registro de misión cerrado</strong><p>{state.log.length} decisiones · {outcomeText[node.outcome!]}</p></div></div>
            ) : (
              <div className="choice-list">
                {choices.map((choice, index) => (
                  <button key={choice.id} type="button" className="choice" onClick={() => select(choice.id)} data-testid={`choice-${choice.id}`}>
                    <span className="choice-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="choice-copy"><span className="choice-kind">{choiceKinds[choice.id] ?? 'MANDO'}</span><span className="choice-title">{spanishChoices[choice.id] ?? choice.label}</span></span>
                    <span className="choice-arrow" aria-hidden="true">↗</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="orders-footer"><span className="shortcut-hint">{terminal ? 'R · REINICIAR MISIÓN' : 'TECLAS 1–3 · ELEGIR ORDEN'}</span><button className="restart-button" type="button" onClick={restart}>{terminal ? 'Nueva misión ↗' : 'Reiniciar ↺'}</button></div>
        </section>
      </main>

      <footer className="footer-line"><span>✦ SHADOWOPS <span className="footer-muted">/ UNIVERSO EN CONSTRUCCIÓN</span></span><span aria-live="polite">{last ? `ÚLTIMA ORDEN: ${spanishChoices[last.choiceId] ?? last.choiceId}` : 'BITÁCORA · SIN ÓRDENES EMITIDAS'}</span></footer>
    </div>
  );
}
