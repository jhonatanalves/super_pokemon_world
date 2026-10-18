/** Números da câmera da fase e do parallax (F2). Unidades: px e px/s. */
export const CAMERA = {
  /** Largura da zona morta: o herói anda isso sem a câmera acompanhar. */
  deadZoneWidth: 16,
  /** Quanto a câmera se adianta na direção em que o herói avança. */
  lookahead: 32,
  /**
   * Velocidade com que a antecipação muda. Com 60 passos por segundo, 120 dá 2 px por passo:
   * mantenha um múltiplo de 60 para a antecipação andar em px inteiros e o herói não tremer na tela.
   */
  lookaheadSpeed: 120,
  /** Fração da rolagem da câmera aplicada a cada camada de fundo (0 = parada, 1 = junto com a fase). */
  parallaxFar: 0.25,
  parallaxNear: 0.5,
} as const;

export type CameraConfig = { readonly [K in keyof typeof CAMERA]: number };
