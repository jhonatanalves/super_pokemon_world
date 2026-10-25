import { ENEMIES } from '../../config/enemies';
import { stepsFor } from '../../logic/heroMotion';
import { awayFrom, turnAtWalls, walkAndFall } from '../../logic/enemyMotion';
import type { Point } from '../../logic/level';
import type { TransitionTable } from '../../systems/StateMachine';
import { centerX, enterState, tick, type EnemyBase, type EnemyContext } from './EnemyBase';

/**
 * Anda como o WalkerEnemy (papel do Koopa). O pisão o fecha na concha; a concha parada é
 * chutada ao ser tocada e desliza, matando os inimigos no caminho e voltando ao bater na parede.
 */
export type ShellState = 'walk' | 'shell' | 'slide' | 'dead';

export const SHELL_TRANSITIONS: TransitionTable<ShellState> = {
  walk: ['shell', 'dead'],
  shell: ['slide', 'dead'],
  slide: ['shell', 'dead'],
  dead: [],
};

export interface ShellEnemy extends EnemyBase {
  readonly behavior: 'shell';
  readonly state: ShellState;
  readonly dir: 1 | -1;
  readonly vy: number;
  readonly ground: boolean;
  /**
   * Passos em que a concha recém-chutada ainda não machuca o herói, e a recém-fechada ainda
   * não é chutada por ele (o herói quica para longe dela).
   */
  readonly graceSteps: number;
}

export function createShell(id: number, creature: string, foot: Point): ShellEnemy {
  const { width, height } = ENEMIES.shell;
  return {
    behavior: 'shell',
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
    graceSteps: 0,
  };
}

function speedOf(state: ShellState): number {
  if (state === 'walk') return ENEMIES.shell.speed;
  if (state === 'slide') return ENEMIES.shell.slideSpeed;
  return 0;
}

export function stepShell(e: ShellEnemy, ctx: EnemyContext): ShellEnemy {
  if (e.state === 'dead') return tick(e);
  const moved = walkAndFall(e, e.dir * speedOf(e.state), ctx.level, ctx.dt);
  return tick({
    ...e,
    x: moved.x,
    y: moved.y,
    vy: moved.vy,
    ground: moved.contacts.ground,
    dir: turnAtWalls(e.dir, moved.contacts),
    graceSteps: Math.max(e.graceSteps - 1, 0),
  });
}

/** Chuta a concha parada para longe do herói. */
export function kickShell(e: ShellEnemy, heroX: number): ShellEnemy {
  if (e.state !== 'shell') return e;
  return throwShell(e, awayFrom(heroX, centerX(e)));
}

/** Concha parada que sai deslizando para `dir`: chutada, ou arremessada por quem a carregava (F5a). */
export function throwShell(e: ShellEnemy, dir: 1 | -1): ShellEnemy {
  return {
    ...enterState(e, SHELL_TRANSITIONS, 'slide'),
    dir,
    graceSteps: stepsFor(ENEMIES.shell.kickGrace),
  };
}

/** Largada parada por quem a carregava (F5a): o herói, ainda encostado, não a chuta. */
export function dropShell(e: ShellEnemy): ShellEnemy {
  return { ...e, graceSteps: stepsFor(ENEMIES.shell.kickGrace) };
}

/** Pisão: andando vira concha; concha parada é chutada; concha deslizando para. */
export function stompShell(e: ShellEnemy, heroX: number): ShellEnemy {
  switch (e.state) {
    case 'walk':
    case 'slide':
      return {
        ...enterState(e, SHELL_TRANSITIONS, 'shell'),
        graceSteps: stepsFor(ENEMIES.shell.kickGrace),
      };
    case 'shell':
      return kickShell(e, heroX);
    case 'dead':
      return e;
  }
}

export function killShell(e: ShellEnemy): ShellEnemy {
  return enterState(e, SHELL_TRANSITIONS, 'dead');
}
