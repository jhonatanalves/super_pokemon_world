import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/game';
import { InputSystem } from '../systems/InputSystem';

export class TitleScene extends Phaser.Scene {
  private controls!: InputSystem;

  constructor() {
    super('TitleScene');
  }

  create(): void {
    this.add
      .text(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2, 'Poké Platform World', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_CONFIG.width / 2, GAME_CONFIG.height * 0.75, 'Z ou Enter: sala de teste', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#94b0c2',
      })
      .setOrigin(0.5);
    this.controls = new InputSystem(this);
  }

  update(): void {
    if (this.controls.justPressed('start')) this.scene.start('LevelScene');
  }
}
