/**
 * Números das montarias (F4c). Unidades: px, segundos, px/s. Pontos de partida, para afinar
 * jogando. `water` é a montaria das fases aquáticas e `land` a de terra; quem é quem está em
 * creatures.json.
 */
export const MOUNTS = {
  width: 16,
  height: 16,
  /** Caixa de colisão do herói montado (montaria + herói), qualquer que seja a forma. */
  riderHeight: 32,
  /** Pulos extras no ar a cada vez que sai do chão. */
  airJumps: 1,
  /** Impulso do pulo extra no ar. */
  airJumpImpulse: 300,
  /** Depois de desmontar, a montaria não aceita o herói de volta por este tempo. */
  remountDelay: 0.5,
  /** Ao tomar dano, a montaria foge a esta velocidade, atravessando o cenário. */
  fleeSpeed: 120,
  /** Alcance da boca, à frente do herói montado, para engolir um inimigo. */
  tongueReach: 24,
  /** Inimigo cuspido pela montaria aquática: anda reto e derrota quem toca. */
  shot: { width: 12, height: 10, speed: 200 },

  /** Aquática: anda devagar na terra, rápido sobre a água, e não afunda. */
  water: { landSpeed: 0.6, waterSpeed: 1.2, jumpImpulse: 330 },
  /** De terra: mais rápida e pula mais alto; engolir dá mais um pulo no ar. */
  land: { landSpeed: 1.25, jumpImpulse: 360, maxBonusJumps: 1 },
} as const;

export type MountsConfig = typeof MOUNTS;
