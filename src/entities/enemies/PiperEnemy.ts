import { ENEMIES } from '../../config/enemies';
import { stepsFor } from '../../logic/heroMotion';
import type { Point } from '../../logic/level';
import type { Box } from '../../logic/tileCollision';
import type { TransitionTable } from '../../systems/StateMachine';
import { centerX, enterState, tick, type EnemyBase, type EnemyContext } from './EnemyBase';

/**
 * Sai do cano em ciclo (papel da Planta Piranha): escondido, subindo, fora, descendo. Não sai
 * com o herói perto do cano. Não pode ser pisado; só a concha o mata.
 */
export type PiperState = 'hidden' | 'rising' | 'out' | 'sinking' | 'dead';

export const PIPER_TRANSITIONS: TransitionTable<PiperState> = {
  hidden: ['rising', 'dead'],
  rising: ['out', 'dead'],
  out: ['sinking', 'dead'],
  sinking: ['hidden', 'dead'],
  dead: [],
};

export interface PiperEnemy extends EnemyBase {
  readonly behavior: 'piper';
  readonly state: PiperState;
  /** Boca do cano (y do topo dele): a base do inimigo quando está todo fora. */
  readonly baseY: number;
  /** Quanto está fora do cano, de 0 a `height`. */
  readonly rise: number;
}

/** `foot` é o centro da boca do cano. */
export function createPiper(id: number, creature: string, foot: Point): PiperEnemy {
  const { width, height } = ENEMIES.piper;
  return {
    behavior: 'piper',
    id,
    creature,
    x: foot.x - width / 2,
    y: foot.y,
    width,
    height,
    active: false,
    state: 'hidden',
    stateSteps: 0,
    baseY: foot.y,
    rise: 0,
  };
}

/** Parte fora do cano, que pode ser tocada; null se está todo dentro. */
export function piperVisibleBox(e: PiperEnemy): Box | null {
  if (e.rise <= 0) return null;
  return { x: e.x, y: e.baseY - e.rise, width: e.width, height: e.rise };
}

export function stepPiper(e: PiperEnemy, ctx: EnemyContext): PiperEnemy {
  const c = ENEMIES.piper;
  const move = c.speed * ctx.dt;
  let next: PiperEnemy = e;
  switch (e.state) {
    case 'hidden': {
      const heroNear = Math.abs(centerX(ctx.hero) - centerX(e)) < c.safeDistance;
      if (e.stateSteps >= stepsFor(c.hiddenTime, ctx.dt) && !heroNear) {
        next = enterState(e, PIPER_TRANSITIONS, 'rising');
      }
      break;
    }
    case 'rising': {
      const rise = Math.min(e.rise + move, e.height);
      next = { ...e, rise };
      if (rise >= e.height) next = enterState(next, PIPER_TRANSITIONS, 'out');
      break;
    }
    case 'out':
      if (e.stateSteps >= stepsFor(c.outTime, ctx.dt)) {
        next = enterState(e, PIPER_TRANSITIONS, 'sinking');
      }
      break;
    case 'sinking': {
      const rise = Math.max(e.rise - move, 0);
      next = { ...e, rise };
      if (rise <= 0) next = enterState(next, PIPER_TRANSITIONS, 'hidden');
      break;
    }
    case 'dead':
      break;
  }
  // Ao entrar num estado novo o contador já está em 0.
  next = next.state === e.state ? tick(next) : next;
  return { ...next, y: next.baseY - next.rise };
}

export function killPiper(e: PiperEnemy): PiperEnemy {
  return enterState(e, PIPER_TRANSITIONS, 'dead');
}
