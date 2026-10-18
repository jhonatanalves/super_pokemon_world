import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/game';
import { createCamera, stepCamera, type CameraState, type Size } from '../logic/camera';
import type { Level, Point } from '../logic/level';

const VIEW: Size = { width: GAME_CONFIG.width, height: GAME_CONFIG.height };

/**
 * Liga a câmera da lógica (src/logic/camera.ts) à câmera principal do Phaser.
 * Anda no passo fixo, junto com o herói, e não usa o startFollow do Phaser.
 */
export class LevelCamera {
  private current: CameraState;
  private readonly world: Size;

  constructor(
    private readonly scene: Phaser.Scene,
    level: Level,
    target: Point,
  ) {
    this.world = { width: level.width, height: level.height };
    this.current = createCamera(target, VIEW, this.world);
    this.apply();
  }

  get state(): CameraState {
    return this.current;
  }

  step(target: Point): void {
    this.current = stepCamera(this.current, target, VIEW, this.world);
    this.apply();
  }

  private apply(): void {
    this.scene.cameras.main.setScroll(this.current.scrollX, this.current.scrollY);
  }
}
