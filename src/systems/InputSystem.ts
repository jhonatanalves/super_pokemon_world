import Phaser from 'phaser';
import { GAMEPAD, KEYBOARD } from '../config/controls';
import type { HeroInput } from '../logic/heroMotion';

type Action = keyof typeof KEYBOARD;

/** Junta teclado e o primeiro gamepad nas ações do jogo. */
export class InputSystem {
  private readonly keys: { [A in Action]: Phaser.Input.Keyboard.Key[] };
  private readonly wasDown = new Map<Action, boolean>();

  constructor(private readonly scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Teclado indisponível no Phaser');
    const addKeys = (action: Action): Phaser.Input.Keyboard.Key[] =>
      KEYBOARD[action].map((name) => keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[name]));
    this.keys = {
      left: addKeys('left'),
      right: addKeys('right'),
      up: addKeys('up'),
      down: addKeys('down'),
      jump: addKeys('jump'),
      run: addKeys('run'),
      reserve: addKeys('reserve'),
      debug: addKeys('debug'),
      start: addKeys('start'),
    };
  }

  /** Estado do herói neste passo. */
  readHero(): HeroInput {
    return {
      left: this.isDown('left'),
      right: this.isDown('right'),
      down: this.isDown('down'),
      jump: this.isDown('jump'),
      run: this.isDown('run'),
      reserve: this.isDown('reserve'),
    };
  }

  /** Verdadeiro só no quadro em que a ação foi apertada. Chamar uma vez por quadro por ação. */
  justPressed(action: Action): boolean {
    const down = this.isDown(action);
    const pressed = down && !this.wasDown.get(action);
    this.wasDown.set(action, down);
    return pressed;
  }

  isDown(action: Action): boolean {
    return this.keys[action].some((key) => key.isDown) || this.padDown(action);
  }

  private padDown(action: Action): boolean {
    const pad: Phaser.Input.Gamepad.Gamepad | undefined = this.scene.input.gamepad?.getPad(0);
    if (!pad) return false;
    switch (action) {
      case 'left':
        return this.padButtons(pad, GAMEPAD.left) || pad.leftStick.x <= -GAMEPAD.stickThreshold;
      case 'right':
        return this.padButtons(pad, GAMEPAD.right) || pad.leftStick.x >= GAMEPAD.stickThreshold;
      case 'up':
        return this.padButtons(pad, GAMEPAD.up) || pad.leftStick.y <= -GAMEPAD.stickThreshold;
      case 'down':
        return this.padButtons(pad, GAMEPAD.down) || pad.leftStick.y >= GAMEPAD.stickThreshold;
      case 'jump':
        return this.padButtons(pad, GAMEPAD.jump);
      case 'run':
        return this.padButtons(pad, GAMEPAD.run);
      case 'reserve':
        return this.padButtons(pad, GAMEPAD.reserve);
      case 'start':
        return this.padButtons(pad, GAMEPAD.start);
      case 'debug':
        return false;
    }
  }

  private padButtons(pad: Phaser.Input.Gamepad.Gamepad, buttons: readonly number[]): boolean {
    // Controles fora do padrão podem ter menos botões; isButtonDown quebraria.
    return buttons.some((index) => index < pad.buttons.length && pad.buttons[index].pressed);
  }
}
