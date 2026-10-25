/** Mapa-múndi (F5b). Unidades: px, segundos e px/s. Pontos de partida, para afinar jogando. */
export const WORLD_MAP = {
  /** Lado de uma célula da grade do mapa (as posições do worlds.json são em células). */
  cell: 16,
  /** Velocidade do herói andando de um nó a outro. */
  walkSpeed: 96,
  /** Velocidade com que um caminho recém-aberto aparece, ponto a ponto. */
  revealSpeed: 48,
  /** Pausa no mapa antes de o caminho novo começar a aparecer. */
  revealDelay: 0.4,
  /** Distância entre os pontos desenhados de um caminho. */
  dotSpacing: 6,
} as const;

export type WorldMapConfig = { readonly [K in keyof typeof WORLD_MAP]: number };
