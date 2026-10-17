import Phaser from 'phaser';
import { PHYSICS } from '../config/physics';
import { DEBUG_COLORS } from '../config/placeholder';
import type { Player } from '../entities/Player';
import { isPMeterFull, stepsFor } from '../logic/heroMotion';

const DEPTH = 1000;

/** Painel de debug (F1): estado, velocidade, P-meter, FPS e caixas de colisão. */
export class DebugPanel {
  private readonly text: Phaser.GameObjects.Text;
  private readonly heroBox: Phaser.GameObjects.Graphics;
  private readonly tileFaces: Phaser.GameObjects.Graphics;
  private shown = false;

  constructor(
    private readonly scene: Phaser.Scene,
    layer: Phaser.Tilemaps.TilemapLayer,
  ) {
    this.text = scene.add
      .text(2, 2, '', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: DEBUG_COLORS.text,
        backgroundColor: DEBUG_COLORS.textBackground,
        padding: { x: 2, y: 1 },
      })
      .setScrollFactor(0)
      .setDepth(DEPTH);
    this.heroBox = scene.add.graphics().setDepth(DEPTH);
    this.tileFaces = scene.add.graphics().setDepth(DEPTH);
    layer.renderDebug(this.tileFaces, {
      tileColor: null,
      collidingTileColor: null,
      faceColor: Phaser.Display.Color.IntegerToColor(DEBUG_COLORS.tileFaces),
    });
    this.setShown(false);
  }

  toggle(): void {
    this.setShown(!this.shown);
  }

  update(player: Player): void {
    if (!this.shown) return;
    const m = player.motion;
    const pPercent = Math.round((m.pMeter / stepsFor(PHYSICS.pMeterChargeTime)) * 100);
    this.text.setText([
      `estado ${m.state}`,
      `vx ${m.vx.toFixed(1)}  vy ${m.vy.toFixed(1)}`,
      `P ${pPercent}%${isPMeterFull(m) ? ' cheio' : ''}  chão ${m.airSteps === 0 ? 'sim' : 'não'}`,
      `fps ${Math.round(this.scene.game.loop.actualFps)}`,
    ]);

    const b = player.body;
    this.heroBox.clear();
    this.heroBox.lineStyle(1, DEBUG_COLORS.heroBox);
    // Graphics ignora roundPixels; arredonda para coincidir com o herói desenhado.
    this.heroBox.strokeRect(
      Math.round(b.x) + 0.5,
      Math.round(b.y) + 0.5,
      b.width - 1,
      b.height - 1,
    );
  }

  private setShown(shown: boolean): void {
    this.shown = shown;
    this.text.setVisible(shown);
    this.heroBox.setVisible(shown).clear();
    this.tileFaces.setVisible(shown);
  }
}
