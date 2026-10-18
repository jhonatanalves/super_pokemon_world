import Phaser from 'phaser';
import { ASSETS } from '../config/assets';

/** Carrega assets e passa para o título. Na F2: o mapa de teste e o tileset provisório. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.tilemapTiledJSON(ASSETS.testLevel.key, ASSETS.testLevel.url);
    this.load.image(ASSETS.testTiles.key, ASSETS.testTiles.url);
  }

  create(): void {
    this.scene.start('TitleScene');
  }
}
