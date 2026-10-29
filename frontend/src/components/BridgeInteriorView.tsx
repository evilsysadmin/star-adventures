import { useEffect, useRef } from 'react';
import world from '../../../content/scenes/meridian.json';
import type { BridgePose, createBridgeInterior } from '../bridge/bridgeInterior';

export function BridgeInteriorView({ pose, alert, onUnavailable }: {
  pose: BridgePose; alert: boolean; onUnavailable: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createBridgeInterior> | null>(null);
  const latest = useRef({ pose, alert }); latest.current = { pose, alert };
  useEffect(() => {
    let cancelled = false;
    const node = canvas.current!;
    const unavailable = (event: Event) => { event.preventDefault(); onUnavailable(); };
    node.addEventListener('webglcontextlost', unavailable);
    // Lazy renderer: a saved surface game never loads or mounts the interior.
    import('../bridge/bridgeInterior').then(({ createBridgeInterior }) => {
      if (cancelled) return;
      try {
        renderer.current = createBridgeInterior(node, world.scenes.bridge);
        renderer.current.render(latest.current.pose, latest.current.alert);
      } catch { onUnavailable(); }
    }).catch(() => { if (!cancelled) onUnavailable(); });
    return () => {
      cancelled = true;
      node.removeEventListener('webglcontextlost', unavailable);
      renderer.current?.dispose(); renderer.current = null;
    };
  }, [onUnavailable]);
  useEffect(() => { renderer.current?.render(pose, alert); }, [pose, alert]);
  return <canvas ref={canvas} className="firstperson-canvas bridge-interior-canvas"
    data-testid="bridge-interior" width={960} height={480} role="img"
    aria-label={`Puente en primera persona, posición ${pose.x} ${pose.y}, rumbo ${pose.heading}`} />;
}
