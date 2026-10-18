import Phaser from 'phaser';
import { CAMERA } from '../config/camera';
import { GAME_CONFIG } from '../config/game';
import { PHYSICS } from '../config/physics';
import { DEBUG_COLORS } from '../config/placeholder';
import { enemyHitbox } from '../entities/enemies/Enemy';
import type { CameraState } from '../logic/camera';
import { HERO_SIZE } from '../logic/heroBody';
import { isPMeterFull, stepsFor } from '../logic/heroMotion';
import { tileAt, type Level } from '../logic/level';
import { isExposedFace } from '../logic/tileCollision';
import type { World } from '../logic/world';

const DEPTH = 1000;
/** Abaixo da linha do HUD. */
const TEXT_TOP = 14;

/**
 * Painel de debug (F1): estado, velocidade, P-meter, câmera, FPS e caixas de colisão
 * do herói, do terreno e dos inimigos (F3).
 */
export class DebugPanel {
  private readonly text: Phaser.GameObjects.Text;
  private readonly heroBox: Phaser.GameObjects.Graphics;
  private readonly tileFaces: Phaser.GameObjects.Graphics;
  private shown = false;

  constructor(
    private readonly scene: Phaser.Scene,
    level: Level,
    shown = false,
  ) {
    this.text = scene.add
      .text(2, TEXT_TOP, '', {
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
    drawCollision(this.tileFaces, level);
    this.setShown(shown);
  }

  get isShown(): boolean {
    return this.shown;
  }

  toggle(): void {
    this.setShown(!this.shown);
  }

  update(world: World, camera: CameraState): void {
    if (!this.shown) return;
    const b = world.hero;
    const m = b.motion;
    const c = b.contacts;
    const pPercent = Math.round((m.pMeter / stepsFor(PHYSICS.pMeterChargeTime)) * 100);
    this.text.setText([
      `estado ${m.state}`,
      `vx ${m.vx.toFixed(1)}  vy ${m.vy.toFixed(1)}`,
      `P ${pPercent}%${isPMeterFull(m) ? ' cheio' : ''}  chão ${m.airSteps === 0 ? 'sim' : 'não'}`,
      `ladeira ${c.ground ? c.groundSlope : '-'}`,
      `câmera x ${camera.scrollX}  antecip ${camera.offset}`,
      `fps ${Math.round(this.scene.game.loop.actualFps)}`,
    ]);

    // Graphics ignora roundPixels; arredonda para coincidir com o herói desenhado.
    this.heroBox.clear();
    this.heroBox.lineStyle(1, DEBUG_COLORS.heroBox);
    this.heroBox.strokeRect(
      Math.round(b.x) + 0.5,
      Math.round(b.y) + 0.5,
      HERO_SIZE.width - 1,
      HERO_SIZE.height - 1,
    );
    this.heroBox.lineStyle(1, DEBUG_COLORS.enemyBox);
    for (const enemy of world.enemies) {
      const box = enemyHitbox(enemy);
      if (box && box.width > 0 && box.height > 0) {
        this.heroBox.strokeRect(
          Math.round(box.x) + 0.5,
          Math.round(box.y) + 0.5,
          box.width - 1,
          box.height - 1,
        );
      }
    }
    // Zona morta da câmera: o herói anda entre as duas linhas sem a câmera acompanhar.
    const half = CAMERA.deadZoneWidth / 2;
    const top = camera.scrollY;
    this.heroBox.lineStyle(1, DEBUG_COLORS.deadZone);
    for (const x of [camera.anchor - half, camera.anchor + half]) {
      const px = Math.round(x) + 0.5;
      this.heroBox.lineBetween(px, top, px, top + GAME_CONFIG.height);
    }
  }

  private setShown(shown: boolean): void {
    this.shown = shown;
    this.text.setVisible(shown);
    this.heroBox.setVisible(shown).clear();
    this.tileFaces.setVisible(shown);
  }
}

/** Desenha o que colide: faces expostas dos blocos, topo das plataformas e piso das ladeiras. */
function drawCollision(g: Phaser.GameObjects.Graphics, level: Level): void {
  const s = level.tileSize;
  g.lineStyle(1, DEBUG_COLORS.tileFaces);
  for (let row = 0; row < level.rows; row++) {
    for (let col = 0; col < level.cols; col++) {
      const tile = tileAt(level, col, row);
      const x = col * s;
      const y = row * s;
      if (tile.kind === 'oneWay') {
        g.lineBetween(x, y + 0.5, x + s, y + 0.5);
      } else if (tile.kind === 'slope') {
        g.lineBetween(x, y + s - tile.left, x + s, y + s - tile.right);
      } else if (tile.kind === 'solid') {
        if (isExposedFace(level, col, row, 'top')) g.lineBetween(x, y + 0.5, x + s, y + 0.5);
        if (isExposedFace(level, col, row, 'bottom'))
          g.lineBetween(x, y + s - 0.5, x + s, y + s - 0.5);
        if (isExposedFace(level, col, row, 'left')) g.lineBetween(x + 0.5, y, x + 0.5, y + s);
        if (isExposedFace(level, col, row, 'right'))
          g.lineBetween(x + s - 0.5, y, x + s - 0.5, y + s);
      }
    }
  }
}
