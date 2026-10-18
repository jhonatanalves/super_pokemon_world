import { ENEMIES } from '../../config/enemies';
import { turnAtWalls, walkAndFall } from '../../logic/enemyMotion';
import type { Point } from '../../logic/level';
import type { TransitionTable } from '../../systems/StateMachine';
import { enterState, tick, type EnemyBase, type EnemyContext } from './EnemyBase';

/** Anda, vira na parede e cai das bordas (papel do Goomba). Morre com pisão. */
export type WalkerState = 'walk' | 'squashed' | 'dead';

export const WALKER_TRANSITIONS: TransitionTable<WalkerState> = {
  walk: ['squashed', 'dead'],
  squashed: [],
  dead: [],
};

export interface WalkerEnemy extends EnemyBase {
  readonly behavior: 'walker';
  readonly state: WalkerState;
  readonly dir: 1 | -1;
  readonly vy: number;
  readonly ground: boolean;
}

export function createWalker(id: number, creature: string, foot: Point): WalkerEnemy {
  const { width, height } = ENEMIES.walker;
  return {
    behavior: 'walker',
    id,
    creature,
    x: foot.x - width / 2,
    y: foot.y - height,
    width,
    height,
    active: false,
    state: 'walk',
    stateSteps: 0,
    dir: -1,
    vy: 0,
    ground: false,
  };
}

export function stepWalker(e: WalkerEnemy, ctx: EnemyContext): WalkerEnemy {
  if (e.state !== 'walk') return tick(e);
  const moved = walkAndFall(e, e.dir * ENEMIES.walker.speed, ctx.level, ctx.dt);
  return tick({
    ...e,
    x: moved.x,
    y: moved.y,
    vy: moved.vy,
    ground: moved.contacts.ground,
    dir: turnAtWalls(e.dir, moved.contacts),
  });
}

export function stompWalker(e: WalkerEnemy): WalkerEnemy {
  return enterState(e, WALKER_TRANSITIONS, 'squashed');
}

export function killWalker(e: WalkerEnemy): WalkerEnemy {
  return enterState(e, WALKER_TRANSITIONS, 'dead');
}
