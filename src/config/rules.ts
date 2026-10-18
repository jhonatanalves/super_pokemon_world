/** Regras de vidas, moedas e fim de jogo (F3). */
export const RULES = {
  /** Vidas no começo do jogo. Aprovado na F3. */
  startLives: 5,
  /** Moedas que valem uma vida extra; o contador volta a 0. */
  coinsPerLife: 100,
  /** Moedas Pokébola escondidas em cada fase. */
  pokeballsPerLevel: 5,
  /** Tempo da tela de Game Over antes de voltar ao título, em segundos. */
  gameOverTime: 3,
} as const;

export type RulesConfig = { readonly [K in keyof typeof RULES]: number };
