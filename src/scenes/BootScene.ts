import Phaser from 'phaser';

/** Carrega assets e passa para o título. Na F0 não há assets. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.scene.start('TitleScene');
  }
}
