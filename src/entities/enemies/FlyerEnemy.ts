import { ENEMIES } from '../../config/enemies';
import type { Point } from '../../logic/level';
import type { TransitionTable } from '../../systems/StateMachine';
import { enterState, tick, type EnemyBase, type EnemyContext } from './EnemyBase';

/**
 * Voa em onda senoidal (papel do Para-Koopa): vai e volta na horizontal em torno do ponto
 * inicial enquanto sobe e desce. Atravessa o cenário. Morre com pisão.
 */
export type FlyerState = 'fly' | 'dead';

export const FLYER_TRANSITIONS: TransitionTable<FlyerState> = {
  fly: ['dead'],
  dead: [],
};

export interface FlyerEnemy extends EnemyBase {
  readonly behavior: 'flyer';
  readonly state: FlyerState;
  /** Canto superior esquerdo no ponto inicial, centro da onda. */
  readonly homeX: number;
  readonly homeY: number;
  /** Deslocamento horizontal atual em relação a homeX. */
  readonly offset: number;
  readonly dir: 1 | -1;
}

export function createFlyer(id: number, creature: string, foot: Point): FlyerEnemy {
  const { width, height } = ENEMIES.flyer;
  const x = foot.x - width / 2;
  const y = foot.y - height;
  return {
    behavior: 'flyer',
    id,
    creature,
    x,
    y,
    width,
    height,
    active: false,
    state: 'fly',
    stateSteps: 0,
    homeX: x,
    homeY: y,
    offset: 0,
    dir: -1,
  };
}

export function stepFlyer(e: FlyerEnemy, ctx: EnemyContext): FlyerEnemy {
  if (e.state !== 'fly') return tick(e);
  const { speed, range, amplitude, period } = ENEMIES.flyer;
  let offset = e.offset + e.dir * speed * ctx.dt;
  let dir = e.dir;
  if (Math.abs(offset) >= range) {
    offset = Math.sign(offset) * range;
    dir = dir > 0 ? -1 : 1;
  }
  const time = (e.stateSteps + 1) * ctx.dt;
  return tick({
    ...e,
    offset,
    dir,
    x: e.homeX + offset,
    y: e.homeY + amplitude * Math.sin((2 * Math.PI * time) / period),
  });
}

export function killFlyer(e: FlyerEnemy): FlyerEnemy {
  return enterState(e, FLYER_TRANSITIONS, 'dead');
}
