/**
 * Números dos inimigos (F3). Unidades: px, segundos e px/s. Pontos de partida, para afinar jogando.
 * A queda dos que andam usa a gravidade e a velocidade máxima de queda do herói (physics.ts).
 */
export const ENEMIES = {
  /** O inimigo acorda quando chega a esta distância da borda da tela, e não dorme mais. */
  activationMargin: 32,
  /** Tempo que o corpo fica na tela depois de morrer. */
  corpseTime: 0.5,

  /** Anda e vira na parede; morre com pisão. */
  walker: { width: 16, height: 16, speed: 32 },
  /** Anda; o pisão o transforma em concha, que desliza quando chutada. */
  shell: {
    width: 16,
    height: 16,
    speed: 32,
    slideSpeed: 180,
    /** Logo depois do chute, a concha não machuca quem chutou. */
    kickGrace: 0.2,
  },
  /** Voa em onda: vai e volta na horizontal enquanto sobe e desce. */
  flyer: {
    width: 16,
    height: 16,
    speed: 24,
    /** Distância máxima, para cada lado, do ponto inicial. */
    range: 32,
    /** Altura da onda, para cima e para baixo. */
    amplitude: 12,
    /** Duração de uma onda completa. */
    period: 1.5,
  },
  /** Sai do cano em ciclo. */
  piper: {
    width: 16,
    height: 24,
    speed: 32,
    hiddenTime: 1.5,
    outTime: 1.5,
    /** Não sai se o herói estiver a menos disto (entre os centros, na horizontal). */
    safeDistance: 24,
  },
  /** Cai quando o herói passa embaixo, espera no chão e volta subindo. */
  dropper: {
    width: 24,
    height: 24,
    /** Distância horizontal entre os centros que dispara a queda. */
    trigger: 48,
    gravity: 1600,
    maxFallSpeed: 300,
    groundTime: 1,
    riseSpeed: 32,
  },
} as const;

export type EnemiesConfig = typeof ENEMIES;
