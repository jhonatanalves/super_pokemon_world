/**
 * Fim de fase (F5a): fita, estrelas e saída secreta. Unidades: px, segundos e px/s. Pontos de
 * partida, para afinar jogando.
 */
export const GOAL = {
  /** A fita sobe e desce entre o topo e a base da área do objeto `goal` do Tiled. */
  tapeSpeed: 64,
  /** Espessura da fita: é a área que o herói precisa tocar. */
  tapeHeight: 4,
  /** Estrelas com a fita no topo; na base, 0. Entre os dois, proporcional à altura. */
  maxStars: 50,
  /** Depois de tocar a fita ou cruzar a linha, o herói anda sozinho até a fase acabar. */
  clearTime: 3,
  /** Depois de abrir a fechadura com a chave, a fase congela por este tempo e acaba. */
  secretClearTime: 2,
} as const;

export type GoalConfig = { readonly [K in keyof typeof GOAL]: number };

/** Carregar a chave e as conchas (F5a), segurando o botão de correr, como no SMW. */
export const CARRY = {
  /** Quanto o objeto carregado entra na frente da caixa do herói (px). */
  overlap: 4,
  /** Chave da saída secreta (px). */
  key: { width: 16, height: 16 },
} as const;

export type CarryConfig = typeof CARRY;
