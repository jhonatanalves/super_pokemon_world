import { FIXED_DT, PHYSICS, type PhysicsConfig } from '../config/physics';
import { stepsFor } from './heroMotion';

/** Invencibilidade depois de tomar dano. */
export interface HurtState {
  /** Passos que ainda faltam; 0 = pode tomar dano. */
  readonly invincibleSteps: number;
}

export const NOT_HURT: HurtState = { invincibleSteps: 0 };

/** `ignored`: estava invencível. `survived`: perdeu o power-up. `died`: morreu. */
export type DamageOutcome = 'ignored' | 'survived' | 'died';

export function isInvincible(state: HurtState): boolean {
  return state.invincibleSteps > 0;
}

/**
 * Aplica um dano. `survives` diz se o herói aguenta o toque: na F3 é sempre falso (o herói é
 * sempre pequeno e morre); a partir da F4 vem do power-up atual. Quem aguenta fica invencível
 * por `hurtInvincibilityTime`.
 */
export function takeDamage(
  state: HurtState,
  survives: boolean,
  dt: number = FIXED_DT,
  p: PhysicsConfig = PHYSICS,
): { state: HurtState; outcome: DamageOutcome } {
  if (isInvincible(state)) return { state, outcome: 'ignored' };
  if (!survives) return { state, outcome: 'died' };
  return {
    state: { invincibleSteps: stepsFor(p.hurtInvincibilityTime, dt) },
    outcome: 'survived',
  };
}

/** Um passo fixo da contagem de invencibilidade. */
export function tickHurt(state: HurtState): HurtState {
  return state.invincibleSteps > 0 ? { invincibleSteps: state.invincibleSteps - 1 } : state;
}
