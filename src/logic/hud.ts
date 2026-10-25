import type { FormCatalog } from './creatures';
import type { GameEvent, GameEventType } from './events';
import type { LevelExit } from './goal';
import type { Form, Reserve } from './powerups';

/** O que o HUD mostra. Muda só com eventos (applyHudEvent). */
export interface HudState {
  readonly lives: number;
  readonly coins: number;
  readonly pokeballs: number;
  readonly pokeballsTotal: number;
  /** Forma do herói e invencibilidade (F4b). */
  readonly form: Form;
  readonly star: boolean;
  /** Item da caixa de reserva, no centro do HUD (F4b). */
  readonly reserve: Reserve;
  /** Estrelas das fitas somadas (F5a). */
  readonly stars: number;
  /** A fase acabou (F5a): saída usada e o bônus da fita, para a mensagem no meio da tela. */
  readonly clear: { readonly exit: LevelExit; readonly stars: number } | null;
}

export const EMPTY_HUD: HudState = {
  lives: 0,
  coins: 0,
  pokeballs: 0,
  pokeballsTotal: 0,
  form: 'small',
  star: false,
  reserve: null,
  stars: 0,
  clear: null,
};

/** Eventos que mudam o HUD. */
export const HUD_EVENTS = [
  'level-started',
  'coin-collected',
  'pokeball-collected',
  'player-died',
  'power-changed',
  'reserve-changed',
  'level-complete',
] as const satisfies readonly GameEventType[];

export function applyHudEvent(state: HudState, event: GameEvent): HudState {
  switch (event.type) {
    case 'level-started':
      return {
        lives: event.lives,
        coins: event.coins,
        pokeballs: event.pokeballs,
        pokeballsTotal: event.pokeballsTotal,
        form: event.form,
        star: event.star,
        reserve: event.reserve,
        stars: event.stars,
        clear: null,
      };
    case 'coin-collected':
      return { ...state, coins: event.coins, lives: event.lives };
    case 'pokeball-collected':
      return { ...state, pokeballs: event.pokeballs };
    case 'player-died':
      return { ...state, lives: event.lives };
    case 'power-changed':
      return { ...state, form: event.form, star: event.star };
    case 'reserve-changed':
      return { ...state, reserve: event.reserve };
    case 'level-complete':
      return { ...state, stars: event.totalStars, clear: { exit: event.exit, stars: event.stars } };
    default:
      return state;
  }
}

/** Primeira linha, à esquerda da caixa de reserva: vidas e moedas. */
export function hudText(state: HudState): string {
  const coins = String(state.coins).padStart(2, '0');
  return `VIDAS ${state.lives}  MOEDAS ${coins}`;
}

/** Primeira linha, à direita da caixa de reserva. */
export function hudPokeballText(state: HudState): string {
  return `POKÉBOLAS ${state.pokeballs}/${state.pokeballsTotal}`;
}

/** Segunda linha: o nome da forma atual (de creatures.json) e a invencibilidade. */
export function hudFormText(state: HudState, forms: FormCatalog): string {
  return forms[state.form].name.toUpperCase() + (state.star ? '  INVENCÍVEL' : '');
}

/** Segunda linha, à direita: as estrelas das fitas (F5a). */
export function hudStarText(state: HudState): string {
  return `ESTRELAS ${String(state.stars).padStart(2, '0')}`;
}

/** Mensagem no meio da tela no fim da fase (F5a); null durante a fase. */
export function hudClearText(state: HudState): string | null {
  if (!state.clear) return null;
  if (state.clear.exit === 'secret') return 'SAÍDA SECRETA!';
  return `FASE CONCLUÍDA!\n+${state.clear.stars} ESTRELAS`;
}
