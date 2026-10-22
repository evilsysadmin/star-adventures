import { useEffect, useRef, useState } from 'react';
import { mountTacticalCamera, type TacticalCameraProbe as Probe, type TacticalCellHit } from './threeCamera.mjs';
import './tacticalCamera.css';

export default function TacticalCameraProbe() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<Probe | null>(null);
  const [hit, setHit] = useState<TacticalCellHit | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    if (!canvas.current) return;
    try {
      const probe = mountTacticalCamera(canvas.current, setHit);
      controller.current = probe;
      return () => {
        controller.current = null;
        probe.dispose();
      };
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Renderizador WebGL no disponible');
    }
  }, []);

  return (
    <main className="camera-spike-page">
      <header className="camera-spike-heading">
        <span>SHADOWOPS · STAR ADVENTURES</span>
        <h1>Prueba de cámara táctica</h1>
        <p>Escena aislada: cuadrícula 8×8, cámara ortográfica fija y selección real por raycasting.
          No es todavía un combate ni sustituye la exploración en primera persona.</p>
        <a href="/">Regresar a la misión</a>
      </header>
      {failure ? <p role="alert" data-testid="camera-error">{failure}</p> : null}
      <section aria-label="Tablero de prueba" className="camera-spike-stage">
        <canvas className="camera-spike-canvas" data-testid="tactical-canvas" ref={canvas}
          aria-label="Tablero táctico interactivo de 8 por 8 casillas; usa los controles alternativos para teclado"/>
      </section>
      <div className="camera-spike-status" aria-live="polite">
        <span>Selección actual</span>
        <output data-testid="tactical-selected">{hit ? hit.id : 'ninguna'}</output>
        <span data-testid="tactical-status">{hit?.blocked ? 'Terreno bloqueado · se puede inspeccionar' : hit ? 'Casilla libre' : 'Selecciona una casilla'}</span>
      </div>
      <details className="camera-spike-keyboard">
        <summary>Seleccionar casillas con teclado</summary>
        <div role="group" aria-label="64 casillas accesibles" className="camera-spike-cellgrid">
          {Array.from({length: 64}, (_, index) => {
            const col = index % 8, row = Math.floor(index / 8), id = `${col}:${row}`;
            return <button type="button" key={id} data-testid={`tactical-key-${id}`}
              aria-pressed={hit?.id === id}
              onClick={() => controller.current?.selectCell(col, row)}>{id}</button>;
          })}
        </div>
      </details>
      <p className="camera-spike-footnote">Figuras de colores = obstáculos visuales de prueba. El picking consulta exclusivamente el plano lógico.</p>
    </main>
  );
}
