import type { HeroState } from '../logic/heroStates';

/** Cores da arte provisória (retângulos), da paleta Sweetie 16. Substituídas por sprites na F7. */
export const HERO_COLORS: { readonly [K in HeroState]: number } = {
  idle: 0xffcd75,
  walk: 0xa7f070,
  run: 0x38b764,
  skid: 0xef7d57,
  crouch: 0xb13e53,
  jump: 0x41a6f6,
  fall: 0x73eff7,
  dead: 0x5d275d,
};

export const RULER_COLORS = {
  line: 0x94b0c2,
  text: '#94b0c2',
} as const;

/**
 * Camadas de fundo provisórias: um período de desenho que se repete na horizontal.
 * `top` e `height` em px na tela; a base fica atrás do chão da fase de teste.
 */
export const PARALLAX_ART = {
  /** Montanhas pontudas, ao longe. */
  far: { color: 0x29366f, top: 80, height: 112, period: 128 },
  /** Morros redondos, mais perto. */
  near: { color: 0x257179, top: 136, height: 56, period: 96 },
} as const;

export const DEBUG_COLORS = {
  heroBox: 0xf4f4f4,
  tileFaces: 0xef7d57,
  deadZone: 0xffcd75,
  text: '#f4f4f4',
  textBackground: '#1a1c2ccc',
} as const;
