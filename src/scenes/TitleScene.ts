import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/game';

export class TitleScene extends Phaser.Scene {
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
  }
}
