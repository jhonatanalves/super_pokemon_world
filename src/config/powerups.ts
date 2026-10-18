/**
 * Números dos power-ups (F4). Unidades: px, segundos, px/s e px/s². Pontos de partida, para
 * afinar jogando. A queda dos itens que andam usa a gravidade do herói (physics.ts).
 */
export const POWERUPS = {
  /** Duração da invencibilidade (item `star`). */
  starTime: 10,

  /** Item solto por um bloco ou posto no Tiled. */
  item: {
    width: 16,
    height: 16,
    /** Tempo para sair de dentro do bloco, subindo. */
    emergeTime: 0.5,
    /** O que faz crescer anda como o cogumelo. */
    walkSpeed: 48,
    /** O de invencibilidade anda mais rápido e quica. */
    starSpeed: 64,
    starBounce: 300,
    /** O item da reserva solto pelo dano cai do alto da tela devagar, atravessando o cenário. F4b. */
    dropSpeed: 48,
  },

  /** Faísca do estado elétrico: anda reto, cai e quica no chão. */
  spark: {
    width: 8,
    height: 8,
    speed: 180,
    gravity: 900,
    maxFallSpeed: 300,
    bounce: 180,
    /** Faíscas na tela ao mesmo tempo. */
    max: 2,
  },

  /** Estado voador: segurando o pulo na queda, cai no máximo a esta velocidade. */
  glideFallSpeed: 60,
  /** Giro de ataque no ar (botão de correr/atacar). */
  spin: {
    time: 0.3,
    /** Quanto o giro alcança além de cada lado do herói. */
    reach: 8,
  },
} as const;

export type PowerUpsConfig = typeof POWERUPS;
