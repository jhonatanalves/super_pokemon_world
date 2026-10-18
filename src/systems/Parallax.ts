import Phaser from 'phaser';
import { CAMERA } from '../config/camera';
import { GAME_CONFIG } from '../config/game';
import { PARALLAX_ART } from '../config/placeholder';

const DEPTH = -10;

interface Layer {
  readonly sprite: Phaser.GameObjects.TileSprite;
  readonly factor: number;
}

/**
 * Duas camadas de fundo provisórias (montanhas e morros) presas à tela, cujo desenho
 * rola uma fração da câmera. A rolagem é arredondada para o desenho não tremer.
 */
export class Parallax {
  private readonly layers: Layer[];

  constructor(scene: Phaser.Scene) {
    const far = PARALLAX_ART.far;
    const near = PARALLAX_ART.near;
    this.layers = [
      this.addLayer(scene, 'parallax-far', far, CAMERA.parallaxFar, DEPTH, (g) =>
        g.fillTriangle(0, far.height, far.period / 2, 0, far.period, far.height),
      ),
      this.addLayer(scene, 'parallax-near', near, CAMERA.parallaxNear, DEPTH + 1, (g) =>
        g.fillEllipse(near.period / 2, near.height, near.period, near.height * 2),
      ),
    ];
  }

  update(scrollX: number): void {
    for (const layer of this.layers)
      layer.sprite.tilePositionX = Math.round(scrollX * layer.factor);
  }

  private addLayer(
    scene: Phaser.Scene,
    key: string,
    art: {
      readonly color: number;
      readonly top: number;
      readonly height: number;
      readonly period: number;
    },
    factor: number,
    depth: number,
    draw: (g: Phaser.GameObjects.Graphics) => void,
  ): Layer {
    if (!scene.textures.exists(key)) {
      const g = scene.make.graphics({}, false);
      g.fillStyle(art.color);
      draw(g);
      g.generateTexture(key, art.period, art.height);
      g.destroy();
    }
    const sprite = scene.add
      .tileSprite(0, art.top, GAME_CONFIG.width, art.height, key)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(depth);
    return { sprite, factor };
  }
}
