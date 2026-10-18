import type { GameEvent, GameEventType } from './events';

/** O que o HUD mostra. Muda só com eventos (applyHudEvent). */
export interface HudState {
  readonly lives: number;
  readonly coins: number;
  readonly pokeballs: number;
  readonly pokeballsTotal: number;
}

export const EMPTY_HUD: HudState = { lives: 0, coins: 0, pokeballs: 0, pokeballsTotal: 0 };

/** Eventos que mudam o HUD. */
export const HUD_EVENTS = [
  'level-started',
  'coin-collected',
  'pokeball-collected',
  'player-died',
] as const satisfies readonly GameEventType[];

export function applyHudEvent(state: HudState, event: GameEvent): HudState {
  switch (event.type) {
    case 'level-started':
      return {
        lives: event.lives,
        coins: event.coins,
        pokeballs: event.pokeballs,
        pokeballsTotal: event.pokeballsTotal,
      };
    case 'coin-collected':
      return { ...state, coins: event.coins, lives: event.lives };
    case 'pokeball-collected':
      return { ...state, pokeballs: event.pokeballs };
    case 'player-died':
      return { ...state, lives: event.lives };
    default:
      return state;
  }
}

export function hudText(state: HudState): string {
  const coins = String(state.coins).padStart(2, '0');
  return `VIDAS ${state.lives}   MOEDAS ${coins}   POKÉBOLAS ${state.pokeballs}/${state.pokeballsTotal}`;
}
