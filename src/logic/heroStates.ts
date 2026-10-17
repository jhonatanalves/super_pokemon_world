import type { TransitionTable } from '../systems/StateMachine';

/** Estados do herói na F1: parado, andando, correndo, derrapando, agachado, pulando, caindo. */
export const HERO_STATES = ['idle', 'walk', 'run', 'skid', 'crouch', 'jump', 'fall'] as const;

export type HeroState = (typeof HERO_STATES)[number];

/**
 * Transições válidas. No ar não dá para agachar nem derrapar, e o pulo só termina
 * passando pela queda (não se pousa subindo).
 */
export const HERO_TRANSITIONS: TransitionTable<HeroState> = {
  idle: ['walk', 'run', 'crouch', 'jump', 'fall'],
  walk: ['idle', 'run', 'skid', 'crouch', 'jump', 'fall'],
  run: ['idle', 'walk', 'skid', 'crouch', 'jump', 'fall'],
  skid: ['idle', 'walk', 'run', 'crouch', 'jump', 'fall'],
  crouch: ['idle', 'walk', 'run', 'skid', 'jump', 'fall'],
  jump: ['fall'],
  fall: ['idle', 'walk', 'run', 'skid', 'crouch', 'jump'],
};
