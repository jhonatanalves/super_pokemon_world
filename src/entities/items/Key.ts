import { CARRY } from '../../config/goal';
import { walkAndFall } from '../../logic/enemyMotion';
import type { Level, Point } from '../../logic/level';
import type { Box } from '../../logic/tileCollision';

/**
 * Chave da saída secreta (F5a), sem Phaser. Solta no chão, cai com gravidade e fica parada;
 * o herói a carrega segurando o botão de correr (src/logic/carry.ts) até a fechadura.
 */
export interface Key extends Box {
  readonly vy: number;
  readonly ground: boolean;
}

/** Chave posta no Tiled, com os pés no centro da base do retângulo. */
export function createKey(foot: Point): Key {
  const { width, height } = CARRY.key;
  return { x: foot.x - width / 2, y: foot.y - height, width, height, vy: 0, ground: false };
}

/** Solta: cai até o chão. */
export function stepKey(key: Key, level: Level, dt: number): Key {
  const moved = walkAndFall(key, 0, level, dt);
  return { ...key, x: moved.x, y: moved.y, vy: moved.vy, ground: moved.contacts.ground };
}

/** Caiu num buraco. */
export function isKeyGone(key: Key, levelHeight: number): boolean {
  return key.y > levelHeight;
}
