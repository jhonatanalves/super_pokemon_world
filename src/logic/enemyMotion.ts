import { PHYSICS, type PhysicsConfig } from '../config/physics';
import type { Level } from './level';
import { moveBody, type Box, type TileContacts } from './tileCollision';

/** Corpo de inimigo que anda no chão e cai com gravidade. */
export interface WalkingBody extends Box {
  readonly vy: number;
  readonly ground: boolean;
}

/**
 * Anda `vx` (px/s) com gravidade pela grade de tiles, como o herói: sobe ladeiras, gruda na
 * descida e para nas paredes. Usa a gravidade e a queda máxima do herói.
 */
export function walkAndFall(
  body: WalkingBody,
  vx: number,
  level: Level,
  dt: number,
  p: PhysicsConfig = PHYSICS,
): { x: number; y: number; vy: number; contacts: TileContacts } {
  const vy = Math.min((body.ground ? 0 : body.vy) + p.gravityDown * dt, p.maxFallSpeed);
  const moved = moveBody(level, body, vx * dt, vy * dt, {
    grounded: body.ground,
    stepUp: p.slopeStepUp,
    snap: p.groundSnap,
  });
  return { x: moved.x, y: moved.y, vy: moved.contacts.ground ? 0 : vy, contacts: moved.contacts };
}

/** Vira ao bater numa parede na direção em que anda. */
export function turnAtWalls(dir: 1 | -1, contacts: TileContacts): 1 | -1 {
  if (dir < 0 && contacts.wallLeft) return 1;
  if (dir > 0 && contacts.wallRight) return -1;
  return dir;
}

/** Direção para longe de `fromX` (ex.: a concha chutada foge do herói). */
export function awayFrom(fromX: number, centerX: number): 1 | -1 {
  return centerX >= fromX ? 1 : -1;
}
