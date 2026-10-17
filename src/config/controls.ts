import type Phaser from 'phaser';

export type KeyName = keyof typeof Phaser.Input.Keyboard.KeyCodes;

/** Teclas de cada ação; qualquer uma da lista aciona a ação. */
export const KEYBOARD = {
  left: ['LEFT', 'A'],
  right: ['RIGHT', 'D'],
  down: ['DOWN', 'S'],
  jump: ['Z'],
  run: ['X'],
  debug: ['F1'],
  start: ['Z', 'ENTER'],
} as const satisfies Record<string, readonly KeyName[]>;

/** Índices de botão no layout padrão (0 = A, 2 = X, 12-15 = direcional). */
export const GAMEPAD = {
  left: [14],
  right: [15],
  down: [13],
  jump: [0],
  run: [2],
  start: [0, 9],
  /** Quanto o analógico precisa inclinar para contar como direção. */
  stickThreshold: 0.5,
} as const;
