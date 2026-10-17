/** Configuração base do jogo. Sem import do Phaser para poder ser testada em Node. */
export const GAME_CONFIG = {
  width: 256,
  height: 224,
  pixelArt: true,
  backgroundColor: '#1a1c2c',
  /** Zoom mínimo aceito; o zoom real é sempre inteiro (ver src/logic/scale.ts). */
  minZoom: 1,
} as const;
