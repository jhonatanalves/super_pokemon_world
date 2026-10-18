/** Configuração base do jogo. Sem import do Phaser para poder ser testada em Node. */
export const GAME_CONFIG = {
  width: 256,
  height: 224,
  pixelArt: true,
  backgroundColor: '#1a1c2c',
  /** Zoom mínimo aceito; o zoom real é sempre inteiro (ver src/logic/scale.ts). */
  minZoom: 1,
  /** Lado de um tile, em px. */
  tileSize: 16,
  /** Caixa de colisão do herói pequeno, em px. */
  heroWidth: 16,
  heroHeight: 16,
  /** Altura do herói grande (e dos estados especiais), em px. F4. */
  bigHeroHeight: 32,
} as const;
