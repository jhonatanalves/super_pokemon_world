import { MOUNTS, type MountsConfig } from '../../config/mounts';
import type { PhysicsConfig } from '../../config/physics';
import type { MountKind } from '../../logic/creatures';
import { walkAndFall } from '../../logic/enemyMotion';
import type { HeroMods } from '../../logic/heroBody';
import { stepsFor } from '../../logic/heroMotion';
import type { Level, Point } from '../../logic/level';
import type { Box } from '../../logic/tileCollision';
import { withWaterFloor } from '../../logic/water';
import type { TransitionTable } from '../../systems/StateMachine';
import { enterState, tick } from '../enemies/EnemyBase';

/**
 * Montaria (F4c, papel do Yoshi), sem Phaser. Espera parada até o herói cair em cima dela;
 * montada, segue o herói; com o dano, cai até o chão e foge pela tela atravessando as
 * paredes, até sumir.
 * A aquática fica sobre a superfície da água; a de terra cai na água como qualquer corpo.
 */
export type MountState = 'wait' | 'ridden' | 'flee';

export const MOUNT_TRANSITIONS: TransitionTable<MountState> = {
  wait: ['ridden'],
  ridden: ['wait', 'flee'],
  flee: [],
};

export interface Mount extends Box {
  readonly id: number;
  /** Tipo do objeto no Tiled; chave em creatures.json (nome e cor). */
  readonly creature: string;
  readonly kind: MountKind;
  readonly state: MountState;
  readonly stateSteps: number;
  readonly dir: 1 | -1;
  readonly vy: number;
  readonly ground: boolean;
  /** A aquática guarda o inimigo engolido para cuspir. */
  readonly stomach: boolean;
  /** A de terra ganha pulos no ar ao digerir um inimigo. */
  readonly bonusJumps: number;
  /** Passos até aceitar o herói de novo, depois de desmontar. */
  readonly graceSteps: number;
}

/** Montaria esperando, com os pés no centro da base do retângulo do Tiled. */
export function createMount(id: number, creature: string, kind: MountKind, foot: Point): Mount {
  const { width, height } = MOUNTS;
  return {
    id,
    creature,
    kind,
    x: foot.x - width / 2,
    y: foot.y - height,
    width,
    height,
    state: 'wait',
    stateSteps: 0,
    dir: 1,
    vy: 0,
    ground: false,
    stomach: false,
    bonusJumps: 0,
    graceSteps: 0,
  };
}

/**
 * Esperando, cai até o chão. Fugindo, também cai (o dano no ar não a deixa voando) e corre
 * para o lado atravessando as paredes. A aquática para na superfície da água.
 */
export function stepMount(m: Mount, level: Level, dt: number, c: MountsConfig = MOUNTS): Mount {
  const next = { ...m, graceSteps: Math.max(m.graceSteps - 1, 0) };
  if (m.state === 'ridden') return tick(next);
  const floor = m.kind === 'water' ? withWaterFloor(level) : level;
  const fall = walkAndFall(next, 0, floor, dt);
  const x = m.state === 'flee' ? m.x + m.dir * c.fleeSpeed * dt : fall.x;
  return tick({ ...next, x, y: fall.y, vy: fall.vy, ground: fall.contacts.ground });
}

export function canRide(m: Mount): boolean {
  return m.state === 'wait' && m.graceSteps === 0;
}

export function rideMount(m: Mount): Mount {
  return enterState(m, MOUNT_TRANSITIONS, 'ridden');
}

/** Montada, fica sob o herói (a base dela é a base da caixa dele) e olha para o mesmo lado. */
export function followRider(m: Mount, rider: Box, facing: 1 | -1): Mount {
  return { ...m, x: rider.x, y: rider.y + rider.height - m.height, dir: facing };
}

/** O herói desmontou: a montaria fica onde está e não aceita o herói por um tempo. */
export function leaveMount(m: Mount, dt: number, c: MountsConfig = MOUNTS): Mount {
  return {
    ...enterState(m, MOUNT_TRANSITIONS, 'wait'),
    vy: 0,
    ground: false,
    graceSteps: stepsFor(c.remountDelay, dt),
  };
}

/** O herói tomou dano montado: a montaria foge na direção `dir`. */
export function fleeMount(m: Mount, dir: 1 | -1): Mount {
  return { ...enterState(m, MOUNT_TRANSITIONS, 'flee'), dir, vy: 0, ground: false };
}

/**
 * Física do herói montado: velocidades e pulo da montaria. A aquática anda devagar na terra
 * e rápido sobre a água (`onWater`).
 */
export function riderPhysics(
  kind: MountKind,
  onWater: boolean,
  p: PhysicsConfig,
  c: MountsConfig = MOUNTS,
): PhysicsConfig {
  const speed =
    kind === 'water' ? (onWater ? c.water.waterSpeed : c.water.landSpeed) : c.land.landSpeed;
  const jump = kind === 'water' ? c.water.jumpImpulse : c.land.jumpImpulse;
  return {
    ...p,
    walkSpeed: p.walkSpeed * speed,
    runSpeed: p.runSpeed * speed,
    pMeterSpeed: p.pMeterSpeed * speed,
    jumpImpulse: jump,
    pMeterJumpImpulse: jump + (p.pMeterJumpImpulse - p.jumpImpulse),
  };
}

/** A aquática não afunda: a superfície da água segura quem a monta. */
export function riderMods(kind: MountKind): HeroMods {
  return { waterFloor: kind === 'water', swimSpeed: 1 };
}

/** Área da boca: à frente do herói montado, na altura da montaria. */
export function tongueBox(rider: Box, facing: 1 | -1, c: MountsConfig = MOUNTS): Box {
  const y = rider.y + rider.height - c.height;
  const x = facing > 0 ? rider.x + rider.width : rider.x - c.tongueReach;
  return { x, y, width: c.tongueReach, height: c.height };
}

/** Saiu da tela fugindo. */
export function isMountGone(
  m: Mount,
  viewLeft: number,
  viewRight: number,
  margin: number,
): boolean {
  return m.state === 'flee' && (m.x + m.width < viewLeft - margin || m.x > viewRight + margin);
}
