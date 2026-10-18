import type { TransitionTable } from '../systems/StateMachine';

/** Estados do herói: parado, andando, correndo, derrapando, agachado, pulando, caindo (F1) e morto (F2). */
export const HERO_STATES = [
  'idle',
  'walk',
  'run',
  'skid',
  'crouch',
  'jump',
  'fall',
  'dead',
] as const;

export type HeroState = (typeof HERO_STATES)[number];

/**
 * Transições válidas. No ar não dá para agachar nem derrapar, e o pulo só termina
 * passando pela queda (não se pousa subindo). Qualquer estado pode morrer; morto não
 * sai do estado (a fase reinicia com um herói novo).
 */
export const HERO_TRANSITIONS: TransitionTable<HeroState> = {
  idle: ['walk', 'run', 'crouch', 'jump', 'fall', 'dead'],
  walk: ['idle', 'run', 'skid', 'crouch', 'jump', 'fall', 'dead'],
  run: ['idle', 'walk', 'skid', 'crouch', 'jump', 'fall', 'dead'],
  skid: ['idle', 'walk', 'run', 'crouch', 'jump', 'fall', 'dead'],
  crouch: ['idle', 'walk', 'run', 'skid', 'jump', 'fall', 'dead'],
  jump: ['fall', 'dead'],
  fall: ['idle', 'walk', 'run', 'skid', 'crouch', 'jump', 'dead'],
  dead: [],
};
