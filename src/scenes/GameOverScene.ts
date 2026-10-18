import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/game';
import { HUD_STYLE } from '../config/placeholder';
import { RULES } from '../config/rules';

const MS_PER_SECOND = 1000;

/** Sem vidas: mostra "Game Over" e volta ao título (na F5, ao mapa). */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(): void {
    this.add
      .text(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2, 'GAME OVER', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: HUD_STYLE.gameOver,
      })
      .setOrigin(0.5);
    this.time.delayedCall(RULES.gameOverTime * MS_PER_SECOND, () => this.scene.start('TitleScene'));
  }
}
