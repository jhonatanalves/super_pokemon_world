import Phaser from 'phaser';
import { ASSETS } from '../config/assets';

/** Carrega assets e passa para o título: as fases e o tileset provisório. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    for (const [key, url] of Object.entries(ASSETS.levels)) this.load.tilemapTiledJSON(key, url);
    this.load.image(ASSETS.testTiles.key, ASSETS.testTiles.url);
  }

  create(): void {
    this.scene.start('TitleScene');
  }
}
