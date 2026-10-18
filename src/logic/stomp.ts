import { PHYSICS, type PhysicsConfig } from '../config/physics';
import type { Box } from './tileCollision';

/**
 * Regra do pisão (planejamento): vale quando o herói está caindo e o pé dele está acima do
 * centro do inimigo. Subindo, ou de lado, o toque é dano.
 */
export function isStomp(hero: Box, heroVy: number, enemy: Box): boolean {
  return heroVy > 0 && hero.y + hero.height < enemy.y + enemy.height / 2;
}

/** Velocidade do quique depois do pisão: maior com o botão de pulo segurado. */
export function stompBounceSpeed(jumpHeld: boolean, p: PhysicsConfig = PHYSICS): number {
  return jumpHeld ? p.stompBounceHeld : p.stompBounce;
}
