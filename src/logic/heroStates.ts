import type { TransitionTable } from '../systems/StateMachine';

/**
 * Estados do herói: parado, andando, correndo, derrapando, agachado, pulando, caindo (F1),
 * morto (F2) e nadando (F4c).
 */
export const HERO_STATES = [
  'idle',
  'walk',
  'run',
  'skid',
  'crouch',
  'jump',
  'fall',
  'dead',
  'swim',
] as const;

export type HeroState = (typeof HERO_STATES)[number];

/**
 * Transições válidas. No ar não dá para agachar nem derrapar, e o pulo só termina
 * passando pela queda (não se pousa subindo). Qualquer estado pode morrer; morto não
 * sai do estado (a fase reinicia com um herói novo). Agachado não entra direto na água,
 * e nadando não se agacha nem derrapa.
 */
export const HERO_TRANSITIONS: TransitionTable<HeroState> = {
  idle: ['walk', 'run', 'crouch', 'jump', 'fall', 'dead', 'swim'],
  walk: ['idle', 'run', 'skid', 'crouch', 'jump', 'fall', 'dead', 'swim'],
  run: ['idle', 'walk', 'skid', 'crouch', 'jump', 'fall', 'dead', 'swim'],
  skid: ['idle', 'walk', 'run', 'crouch', 'jump', 'fall', 'dead', 'swim'],
  crouch: ['idle', 'walk', 'run', 'skid', 'jump', 'fall', 'dead'],
  jump: ['fall', 'dead', 'swim'],
  fall: ['idle', 'walk', 'run', 'skid', 'crouch', 'jump', 'dead', 'swim'],
  dead: [],
  swim: ['idle', 'walk', 'run', 'jump', 'fall', 'dead'],
};
