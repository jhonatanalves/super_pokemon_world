import type { LevelExit } from './goal';
import type { Form, Reserve } from './powerups';

/**
 * Eventos do jogo (F3). A fase emite; quem precisa saber (o HUD) só escuta, nunca consulta a
 * fase. Cada evento leva os totais novos, para quem escuta não precisar perguntar nada.
 */
export type GameEvent =
  /** A fase (re)começou: estado inicial do HUD. */
  | {
      readonly type: 'level-started';
      readonly lives: number;
      readonly coins: number;
      readonly pokeballs: number;
      readonly pokeballsTotal: number;
      readonly form: Form;
      readonly star: boolean;
      readonly reserve: Reserve;
      /** Estrelas das fitas somadas até aqui (F5a). */
      readonly stars: number;
    }
  /** A forma do herói mudou, ou a invencibilidade começou ou acabou (F4b). */
  | { readonly type: 'power-changed'; readonly form: Form; readonly star: boolean }
  /** O item da caixa de reserva mudou: guardado, usado ou solto pelo dano (F4b). */
  | { readonly type: 'reserve-changed'; readonly reserve: Reserve }
  /** Moeda coletada (do cenário ou de um bloco). `lives` muda a cada 100 moedas. */
  | { readonly type: 'coin-collected'; readonly coins: number; readonly lives: number }
  | { readonly type: 'pokeball-collected'; readonly pokeballs: number }
  /** O herói levou um toque de inimigo (morrendo ou não). */
  | { readonly type: 'player-damaged' }
  /** O herói morreu (dano ou buraco); `lives` já descontada. */
  | { readonly type: 'player-died'; readonly lives: number }
  | { readonly type: 'checkpoint-reached' }
  /**
   * Fim da fase (F5a): pela fita (`normal`, com o bônus de estrelas da altura dela) ou pela
   * fechadura (`secret`, sem estrelas). `totalStars` já inclui o bônus.
   */
  | {
      readonly type: 'level-complete';
      readonly exit: LevelExit;
      readonly stars: number;
      readonly totalStars: number;
    };

export type GameEventType = GameEvent['type'];

export type EventOf<T extends GameEventType> = Extract<GameEvent, { readonly type: T }>;
