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

/** Animações provisórias (F3). Tempos em segundos, alturas em px. Não mudam o jogo. */
export const EFFECTS = {
  /** Bloco sobe e desce ao levar uma cabeçada. */
  blockBumpTime: 0.15,
  blockBumpHeight: 4,
  /** Moeda que sai do bloco e some subindo. */
  coinPopTime: 0.4,
  coinPopHeight: 24,
  /** Inimigo pisado aparece achatado com esta fração da altura. */
  squashedHeight: 0.5,
  /** A concha aparece mais baixa que o inimigo andando, com esta fração da altura. */
  shellHeight: 0.75,
  /** Opacidade do corpo do inimigo derrotado. */
  defeatedAlpha: 0.5,
} as const;

/** Blocos, itens e checkpoint provisórios (F3). */
export const OBJECT_COLORS = {
  question: 0xffcd75,
  questionMark: 0xb13e53,
  brick: 0xef7d57,
  brickLine: 0x5d275d,
  note: 0xf4f4f4,
  noteMark: 0x3b5dc9,
  used: 0x566c86,
  /** Só aparece com o painel de debug. */
  hidden: 0x94b0c2,
  coin: 0xffcd75,
  pokeballTop: 0xb13e53,
  pokeballBottom: 0xf4f4f4,
  checkpoint: 0x94b0c2,
  checkpointReached: 0x38b764,
  /** Contorno escuro dos inimigos, para separá-los do herói. */
  enemyOutline: 0x1a1c2c,
} as const;

export const HUD_STYLE = {
  text: '#f4f4f4',
  textBackground: '#1a1c2c99',
  gameOver: '#b13e53',
} as const;

export const DEBUG_COLORS = {
  enemyBox: 0xb13e53,
  heroBox: 0xf4f4f4,
  tileFaces: 0xef7d57,
  deadZone: 0xffcd75,
  text: '#f4f4f4',
  textBackground: '#1a1c2ccc',
} as const;
