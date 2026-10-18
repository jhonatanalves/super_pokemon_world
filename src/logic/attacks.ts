import { PHYSICS } from '../config/physics';
import { POWERUPS, type PowerUpsConfig } from '../config/powerups';
import type { Level } from './level';
import { moveBody, type Box } from './tileCollision';

/**
 * Ataques das formas especiais (F4): a faísca do elétrico, que anda reto, cai e quica no chão,
 * e o giro do voador no ar. Quem eles derrotam está em Enemy.ts (hitByAttack).
 */
export interface Spark extends Box {
  readonly vx: number;
  readonly vy: number;
}

/** Faísca saindo da frente do herói, na altura do meio dele. */
export function createSpark(hero: Box, facing: 1 | -1, c: PowerUpsConfig = POWERUPS): Spark {
  const { width, height, speed } = c.spark;
  return {
    x: facing > 0 ? hero.x + hero.width : hero.x - width,
    y: hero.y + (hero.height - height) / 2,
    width,
    height,
    vx: facing * speed,
    vy: 0,
  };
}

/**
 * Um passo da faísca. Some (null) ao bater numa parede ou cair num buraco; ao tocar o chão,
 * quica com `bounce`.
 */
export function stepSpark(
  spark: Spark,
  level: Level,
  dt: number,
  c: PowerUpsConfig = POWERUPS,
): Spark | null {
  const s = c.spark;
  const moved = moveBody(level, spark, spark.vx * dt, spark.vy * dt, {
    grounded: false,
    stepUp: PHYSICS.slopeStepUp,
    snap: 0,
  });
  const k = moved.contacts;
  if (k.wallLeft || k.wallRight || moved.y > level.height) return null;
  let vy = k.ceiling ? 0 : spark.vy;
  vy = k.ground ? -s.bounce : Math.min(vy + s.gravity * dt, s.maxFallSpeed);
  return { ...spark, x: moved.x, y: moved.y, vy };
}

/** Pode soltar outra faísca: há menos de `max` na tela. */
export function canShoot(sparks: readonly Spark[], c: PowerUpsConfig = POWERUPS): boolean {
  return sparks.length < c.spark.max;
}

/** Área do giro: a caixa do herói alargada `reach` para cada lado. */
export function spinBox(hero: Box, c: PowerUpsConfig = POWERUPS): Box {
  const reach = c.spin.reach;
  return { ...hero, x: hero.x - reach, width: hero.width + 2 * reach };
}
