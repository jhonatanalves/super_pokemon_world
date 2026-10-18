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
    }
  /** Moeda coletada (do cenário ou de um bloco). `lives` muda a cada 100 moedas. */
  | { readonly type: 'coin-collected'; readonly coins: number; readonly lives: number }
  | { readonly type: 'pokeball-collected'; readonly pokeballs: number }
  /** O herói levou um toque de inimigo (morrendo ou não). */
  | { readonly type: 'player-damaged' }
  /** O herói morreu (dano ou buraco); `lives` já descontada. */
  | { readonly type: 'player-died'; readonly lives: number }
  | { readonly type: 'checkpoint-reached' }
  /** Fim da fase. Previsto no planejamento; emitido a partir da F5 (fim de fase com fita). */
  | { readonly type: 'level-complete' };

export type GameEventType = GameEvent['type'];

export type EventOf<T extends GameEventType> = Extract<GameEvent, { readonly type: T }>;
