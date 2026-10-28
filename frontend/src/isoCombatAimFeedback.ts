// Human-readable feedback for the real tactical aim gate, never hit authority.
import type { CombatAim } from './isoScenarioCombatAim.ts';

export function describeCombatAim(aim: CombatAim | null): string {
  if (!aim) return 'Selecciona un contacto enemigo.';
  switch (aim.reason) {
    case 'ready': return 'Objetivo a tiro · línea despejada.';
    case 'out-of-range': return 'Fuera de alcance (máximo 7,5 casillas) · acerca al oficial.';
    case 'terrain-blocked': return 'Línea bloqueada por cobertura o muro en '+aim.blocker+' · cambia de posición.';
    case 'ally-blocked': return 'Un compañero bloquea el disparo en '+aim.blocker+' · cambia de posición.';
    case 'contact-blocked': return 'Otro enemigo bloquea el disparo en '+aim.blocker+' · busca otro ángulo.';
    case 'no-action-points': return 'Sin órdenes disponibles · termina el turno.';
    case 'incapacitated': return 'Este oficial está incapacitado · selecciona otro.';
    case 'encounter-ended': return 'El encuentro ha terminado.';
    default: return 'No se puede disparar a este objetivo.';
  }
}

/** Short, readable in-board command label. The same authoritative aim gate
 * supplies the detailed explanation; presentation cannot authorize a shot. */
export function compactCombatFireLabel(
  aim: CombatAim | null, target: string | null, enabled: boolean, truce = false,
): string {
  if (truce) return 'ALTO EL FUEGO';
  if (!target) return 'APUNTAR · elige enemigo';
  if (enabled) return 'DISPARAR · ' + target;
  switch (aim?.reason) {
    case 'out-of-range': return 'FUERA DE ALCANCE';
    case 'terrain-blocked': return 'COBERTURA · ' + (aim.blocker ?? '?');
    case 'ally-blocked': return 'ALIADO EN LÍNEA';
    case 'contact-blocked': return 'ENEMIGO EN LÍNEA';
    case 'no-action-points': return 'SIN ÓRDENES';
    case 'incapacitated': return 'OFICIAL INCAPACITADO';
    case 'encounter-ended': return 'ENCUENTRO TERMINADO';
    default: return 'ORDEN NO DISPONIBLE';
  }
}
