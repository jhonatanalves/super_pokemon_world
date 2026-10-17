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
};

export const ROOM_COLORS = {
  tileFill: 0x333c57,
  tileEdge: 0x566c86,
  ruler: 0x94b0c2,
  rulerText: '#94b0c2',
} as const;

export const DEBUG_COLORS = {
  heroBox: 0xf4f4f4,
  tileFaces: 0xef7d57,
  text: '#f4f4f4',
  textBackground: '#1a1c2ccc',
} as const;
