import {
  canBeStomped,
  enemyHitbox,
  hitByAttack,
  isAttackable,
  isSlidingShell,
  stompEnemy,
  touchEnemy,
  type Enemy,
} from '../entities/enemies/Enemy';
import { isStomp } from './stomp';
import { overlaps, type Box } from './tileCollision';

/**
 * Combate da fase, sem Phaser: concha × inimigos, projéteis × inimigos, área de ataque e
 * herói × inimigos. Separado de world.ts (F4c), que só chama na ordem certa.
 */

/** Concha deslizando mata quem encostar nela (e outra concha deslizando também morre). */
export function shellHits(enemies: readonly Enemy[]): Enemy[] {
  const shells = enemies.filter(isSlidingShell);
  return enemies.map((e) => {
    const box = enemyHitbox(e);
    if (!box) return e;
    const hit = shells.some((sh) => {
      const shellBox = sh.id !== e.id ? enemyHitbox(sh) : null;
      return shellBox !== null && overlaps(box, shellBox);
    });
    return hit ? hitByAttack(e) : e;
  });
}

/**
 * Projéteis (faíscas, cuspe da montaria): cada um some no primeiro inimigo que tocar e o
 * derrota; o imune não morre, mas o projétil some do mesmo jeito.
 */
export function projectileHits<P extends Box>(
  enemies: readonly Enemy[],
  projectiles: readonly P[],
): { enemies: Enemy[]; projectiles: P[] } {
  let left = [...projectiles];
  const hit = enemies.map((e) => {
    const box = enemyHitbox(e);
    const i = box ? left.findIndex((pr) => overlaps(pr, box)) : -1;
    if (i < 0) return e;
    left = left.filter((_, j) => j !== i);
    return hitByAttack(e);
  });
  return { enemies: hit, projectiles: left };
}

/** Derrota quem encosta em `area` e pode ser atacado (giro do voador). */
export function attackArea(enemies: readonly Enemy[], area: Box): Enemy[] {
  return enemies.map((e) => {
    const box = enemyHitbox(e);
    return box && isAttackable(e) && overlaps(area, box) ? hitByAttack(e) : e;
  });
}

/**
 * Herói × inimigos: invencível derrota no toque (o imune não machuca); senão pisão, chute da
 * concha ou dano. `stomped` pede o quique; `hurt`, o dano.
 */
export function heroContacts(
  enemies: readonly Enemy[],
  hero: Box,
  vy: number,
  star: boolean,
): { enemies: Enemy[]; stomped: boolean; hurt: boolean } {
  const heroX = hero.x + hero.width / 2;
  let stomped = false;
  let hurt = false;
  const next = enemies.map((e) => {
    const enemyBox = enemyHitbox(e);
    if (!enemyBox || !overlaps(hero, enemyBox)) return e;
    if (star) return hitByAttack(e);
    if (canBeStomped(e) && isStomp(hero, vy, enemyBox)) {
      stomped = true;
      return stompEnemy(e, heroX);
    }
    const touch = touchEnemy(e, heroX);
    if (touch.effect === 'hurt') hurt = true;
    return touch.enemy;
  });
  return { enemies: next, stomped, hurt };
}
