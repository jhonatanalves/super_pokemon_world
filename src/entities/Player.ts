import Phaser from 'phaser';
import { HERO_COLORS } from '../config/placeholder';
import { HERO_SIZE, type HeroBody } from '../logic/heroBody';

const TEXTURE = 'placeholder-hero';

/**
 * Herói provisório: quadrado branco tingido pela cor do estado.
 * Movimento e colisão vêm de stepWorld (src/logic/world.ts); aqui só se desenha.
 */
export class Player {
  readonly sprite: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, body: HeroBody) {
    if (!scene.textures.exists(TEXTURE)) {
      const g = scene.make.graphics({}, false);
      g.fillStyle(0xffffff).fillRect(0, 0, HERO_SIZE.width, HERO_SIZE.height);
      g.generateTexture(TEXTURE, HERO_SIZE.width, HERO_SIZE.height);
      g.destroy();
    }
    this.sprite = scene.add.image(0, 0, TEXTURE).setOrigin(0, 0);
    this.render(body);
  }

  /** Atualiza o visual, uma vez por quadro. Arredonda como a câmera, para os dois andarem juntos. */
  render(body: HeroBody): void {
    this.sprite.setPosition(Math.round(body.x), Math.round(body.y));
    this.sprite.setTint(HERO_COLORS[body.motion.state]);
  }
}
