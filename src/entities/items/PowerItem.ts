import { POWERUPS } from '../../config/powerups';
import { awayFrom, turnAtWalls, walkAndFall } from '../../logic/enemyMotion';
import { stepsFor } from '../../logic/heroMotion';
import type { Level, Point } from '../../logic/level';
import type { Power } from '../../logic/powerups';
import type { Box, Cell } from '../../logic/tileCollision';
import type { TransitionTable } from '../../systems/StateMachine';
import { centerX, enterState, tick } from '../enemies/EnemyBase';

/**
 * Item de power-up (F4), sem Phaser, como os inimigos. Sai de dentro de um bloco subindo, ou
 * fica onde foi posto no Tiled. O de crescer anda como o cogumelo; o de invencibilidade anda
 * e quica; os especiais ficam parados. O da caixa de reserva, solto pelo dano, cai do alto da
 * tela (`drop`). Quem o pega é o herói (src/logic/world.ts).
 */
export type PowerItemState = 'emerge' | 'idle' | 'drop';

export const POWER_ITEM_TRANSITIONS: TransitionTable<PowerItemState> = {
  emerge: ['idle'],
  idle: [],
  drop: [],
};

export interface PowerItem extends Box {
  readonly id: number;
  readonly power: Power;
  readonly state: PowerItemState;
  readonly stateSteps: number;
  /** Os postos no Tiled acordam perto da tela, como os inimigos; os dos blocos já nascem acordados. */
  readonly active: boolean;
  readonly dir: 1 | -1;
  readonly vy: number;
  readonly ground: boolean;
  /** y em que termina de sair do bloco. */
  readonly targetY: number;
}

/** Contexto de um passo. */
export interface PowerItemContext {
  readonly level: Level;
  readonly heroX: number;
  readonly dt: number;
}

function moves(power: Power): boolean {
  return power === 'grow' || power === 'star';
}

/** Item posto no Tiled, com os pés no centro da base do retângulo. */
export function createPlacedItem(id: number, power: Power, foot: Point): PowerItem {
  const { width, height } = POWERUPS.item;
  const y = foot.y - height;
  return {
    id,
    power,
    x: foot.x - width / 2,
    y,
    width,
    height,
    state: 'idle',
    stateSteps: 0,
    active: false,
    dir: 1,
    vy: 0,
    ground: false,
    targetY: y,
  };
}

/** Item saindo do bloco em `cell`; os que andam vão para longe do herói. */
export function createBlockItem(
  id: number,
  power: Power,
  cell: Cell,
  tileSize: number,
  heroX: number,
): PowerItem {
  const { width, height } = POWERUPS.item;
  const x = cell.col * tileSize + (tileSize - width) / 2;
  const top = cell.row * tileSize;
  return {
    id,
    power,
    x,
    y: top + tileSize - height,
    width,
    height,
    state: 'emerge',
    stateSteps: 0,
    active: true,
    dir: awayFrom(heroX, x + width / 2),
    vy: 0,
    ground: true,
    targetY: top - height,
  };
}

/**
 * Item da caixa de reserva solto pelo dano: nasce acima do alto da fase, centrado em `centerX`
 * (o meio da tela), e cai devagar atravessando o cenário até ser pego ou sair por baixo.
 */
export function createDroppedItem(id: number, power: Power, centerX: number): PowerItem {
  const { width, height } = POWERUPS.item;
  return {
    id,
    power,
    x: centerX - width / 2,
    y: -height,
    width,
    height,
    state: 'drop',
    stateSteps: 0,
    active: true,
    dir: 1,
    vy: POWERUPS.item.dropSpeed,
    ground: false,
    targetY: -height,
  };
}

export function activateItem(item: PowerItem, heroX: number): PowerItem {
  return { ...item, active: true, dir: awayFrom(heroX, centerX(item)) };
}

export function stepPowerItem(item: PowerItem, ctx: PowerItemContext): PowerItem {
  const c = POWERUPS.item;
  if (!item.active) return item;
  if (item.state === 'emerge') {
    // Sobe um tile inteiro em `emergeTime`.
    const rise = ctx.level.tileSize / stepsFor(c.emergeTime, ctx.dt);
    const y = Math.max(item.y - rise, item.targetY);
    const next = tick({ ...item, y });
    return y <= item.targetY ? enterState(next, POWER_ITEM_TRANSITIONS, 'idle') : next;
  }
  if (item.state === 'drop') return tick({ ...item, y: item.y + item.vy * ctx.dt });
  if (!moves(item.power)) return tick(item);

  const speed = item.power === 'star' ? c.starSpeed : c.walkSpeed;
  const moved = walkAndFall(item, item.dir * speed, ctx.level, ctx.dt);
  // O de invencibilidade quica a cada vez que toca o chão.
  const bounce = item.power === 'star' && moved.contacts.ground;
  return tick({
    ...item,
    x: moved.x,
    y: moved.y,
    vy: bounce ? -c.starBounce : moved.vy,
    ground: bounce ? false : moved.contacts.ground,
    dir: turnAtWalls(item.dir, moved.contacts),
  });
}

/** Caiu num buraco. */
export function isItemGone(item: PowerItem, levelHeight: number): boolean {
  return item.y > levelHeight;
}
