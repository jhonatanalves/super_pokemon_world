/**
 * Todos os números de física do herói. Unidades: px, segundos, px/s e px/s²,
 * na resolução interna de 256 x 224. Valores da tabela "Física e controles" do planejamento.
 */
export const PHYSICS = {
  /** Passos fixos de física por segundo. */
  stepsPerSecond: 60,

  walkSpeed: 90,
  /** Segurando o botão de correr. */
  runSpeed: 150,
  /** Com o P-meter cheio. */
  pMeterSpeed: 180,
  /** Tempo correndo na velocidade máxima até o P-meter encher. */
  pMeterChargeTime: 1,

  groundAccel: 600,
  /** Ao soltar a direção (e ao agachar em movimento). */
  groundDecel: 800,
  /** Ao virar contra o movimento (derrapagem). */
  skidDecel: 1200,
  /** Velocidade mínima para virar gerar derrapagem. Não está na tabela; aprovado na F1. */
  skidMinSpeed: 60,
  /** Fração da aceleração/desaceleração do chão que vale no ar. */
  airControl: 0.7,

  /** Enquanto sobe com o botão de pulo pressionado. */
  gravityUp: 900,
  /** Caindo, ou subindo sem o botão. */
  gravityDown: 1600,
  jumpImpulse: 330,
  /** Pulo com o P-meter cheio. Não está na tabela; aprovado na F1. */
  pMeterJumpImpulse: 360,
  /** Multiplica a velocidade de subida ao soltar o botão (pulo variável). */
  jumpCutFactor: 0.45,
  maxFallSpeed: 300,

  coyoteTime: 0.1,
  jumpBufferTime: 0.12,

  /**
   * Quanto o piso pode subir num passo sem virar parede (px). Cobre a ladeira de 45° na
   * velocidade máxima e a borda do herói (meia largura) passando por cima da emenda. F2.
   */
  slopeStepUp: 8,
  /** Quanto o herói no chão desce para continuar grudado no piso, como na descida de ladeira (px). F2. */
  groundSnap: 8,
  /** Tempo entre a morte (cair no buraco) e o reinício da fase. F2. */
  deathRestartDelay: 1,
  /** Passos fixos no máximo por quadro; o resto do atraso é descartado (aba em segundo plano). F2. */
  maxStepsPerFrame: 5,

  /** Quique ao pisar num inimigo, sem e com o botão de pulo segurado. F3. */
  stompBounce: 250,
  stompBounceHeld: 380,
  /** Invencibilidade depois de um dano que não mata. Regra da F3; aparece no jogo na F4. */
  hurtInvincibilityTime: 1.5,
  /** Impulso ao pousar num bloco nota. Não está na tabela; aprovado na F3. */
  noteBounce: 450,

  /**
   * Natação básica (F4c, aprovado: opção "a"). Pontos de partida; a F6 completa a natação.
   * Na água o herói afunda devagar, e cada aperto do pulo é uma braçada para cima.
   */
  swimSpeed: 60,
  swimAccel: 300,
  swimDecel: 300,
  swimGravity: 300,
  swimMaxFall: 60,
  swimStroke: 150,
} as const;

export type PhysicsConfig = { readonly [K in keyof typeof PHYSICS]: number };

/**
 * Velocidade máxima na ladeira, como multiplicador da do plano (F2, aprovado: subida lenta,
 * descida rápida). `grade` é a inclinação do tile: 1 = 45°, 0,5 = "22,5°" (1 tile de altura a cada 2).
 * Reforçados após o teste manual: com ×0,875 / ×1,125 a rampa de 22,5° não era percebida.
 * Na descida de 45° com P-meter (243 px/s ≈ 4 px por passo) o herói segue grudado: groundSnap = 8.
 */
export const SLOPE_SPEED = [
  { grade: 0.5, uphill: 0.8, downhill: 1.2 },
  { grade: 1, uphill: 0.65, downhill: 1.35 },
] as const;

export type SlopeSpeedTable = readonly {
  readonly grade: number;
  readonly uphill: number;
  readonly downhill: number;
}[];

/** Duração de um passo fixo, em segundos. */
export const FIXED_DT = 1 / PHYSICS.stepsPerSecond;
