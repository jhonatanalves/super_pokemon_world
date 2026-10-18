import { ENEMIES } from '../../config/enemies';
import { stepsFor } from '../../logic/heroMotion';
import type { Point } from '../../logic/level';
import { moveBody } from '../../logic/tileCollision';
import type { TransitionTable } from '../../systems/StateMachine';
import { centerX, enterState, tick, type EnemyBase, type EnemyContext } from './EnemyBase';

/**
 * Pendurado, cai quando o herói passa embaixo, espera no chão e volta subindo (papel do
 * Thwomp). Machuca em qualquer lado; não pode ser pisado nem morto pela concha.
 */
export type DropperState = 'wait' | 'fall' | 'land' | 'rise';

export const DROPPER_TRANSITIONS: TransitionTable<DropperState> = {
  wait: ['fall'],
  fall: ['land'],
  land: ['rise'],
  rise: ['wait'],
};

export interface DropperEnemy extends EnemyBase {
  readonly behavior: 'dropper';
  readonly state: DropperState;
  /** y do ponto em que fica pendurado. */
  readonly homeY: number;
  readonly vy: number;
}

export function createDropper(id: number, creature: string, foot: Point): DropperEnemy {
  const { width, height } = ENEMIES.dropper;
  const y = foot.y - height;
  return {
    behavior: 'dropper',
    id,
    creature,
    x: foot.x - width / 2,
    y,
    width,
    height,
    active: false,
    state: 'wait',
    stateSteps: 0,
    homeY: y,
    vy: 0,
  };
}

export function stepDropper(e: DropperEnemy, ctx: EnemyContext): DropperEnemy {
  const c = ENEMIES.dropper;
  switch (e.state) {
    case 'wait': {
      const below = ctx.hero.y >= e.y + e.height;
      const near = Math.abs(centerX(ctx.hero) - centerX(e)) < c.trigger;
      return below && near ? enterState(e, DROPPER_TRANSITIONS, 'fall') : tick(e);
    }
    case 'fall': {
      const vy = Math.min(e.vy + c.gravity * ctx.dt, c.maxFallSpeed);
      const moved = moveBody(ctx.level, e, 0, vy * ctx.dt, { grounded: false, stepUp: 0, snap: 0 });
      const next = { ...e, y: moved.y, vy };
      return moved.contacts.ground
        ? { ...enterState(next, DROPPER_TRANSITIONS, 'land'), vy: 0 }
        : tick(next);
    }
    case 'land':
      return e.stateSteps >= stepsFor(c.groundTime, ctx.dt)
        ? enterState(e, DROPPER_TRANSITIONS, 'rise')
        : tick(e);
    case 'rise': {
      const y = Math.max(e.y - c.riseSpeed * ctx.dt, e.homeY);
      const next = { ...e, y };
      return y <= e.homeY ? enterState(next, DROPPER_TRANSITIONS, 'wait') : tick(next);
    }
  }
}
