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

  /** Usados a partir da F3. */
  stompBounce: 250,
  stompBounceHeld: 380,
  hurtInvincibilityTime: 1.5,
} as const;

export type PhysicsConfig = { readonly [K in keyof typeof PHYSICS]: number };

/** Duração de um passo fixo, em segundos. */
export const FIXED_DT = 1 / PHYSICS.stepsPerSecond;
