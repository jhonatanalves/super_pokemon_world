import Phaser from 'phaser';
import { HERO_COLORS } from '../config/placeholder';
import type { HeroInput, HeroMotion } from '../logic/heroMotion';
import {
  createHeroBody,
  heroCenter,
  HERO_SIZE,
  shouldRestart,
  stepHeroBody,
  type HeroBody,
} from '../logic/heroBody';
import type { Level, Point } from '../logic/level';

const TEXTURE = 'placeholder-hero';

/**
 * Herói provisório: quadrado branco tingido pela cor do estado.
 * Movimento e colisão vêm de stepHeroBody (src/logic/heroBody.ts); aqui só se desenha.
 */
export class Player {
  readonly sprite: Phaser.GameObjects.Image;
  private current: HeroBody;

  constructor(scene: Phaser.Scene, spawn: Point) {
    if (!scene.textures.exists(TEXTURE)) {
      const g = scene.make.graphics({}, false);
      g.fillStyle(0xffffff).fillRect(0, 0, HERO_SIZE.width, HERO_SIZE.height);
      g.generateTexture(TEXTURE, HERO_SIZE.width, HERO_SIZE.height);
      g.destroy();
    }
    this.current = createHeroBody(spawn);
    this.sprite = scene.add.image(0, 0, TEXTURE).setOrigin(0, 0);
    this.render();
  }

  get body(): HeroBody {
    return this.current;
  }

  get motion(): HeroMotion {
    return this.current.motion;
  }

  get center(): Point {
    return heroCenter(this.current);
  }

  /** Um passo fixo de movimento e colisão. */
  step(input: HeroInput, level: Level): void {
    this.current = stepHeroBody(this.current, input, level);
  }

  shouldRestart(): boolean {
    return shouldRestart(this.current);
  }

  /** Atualiza o visual, uma vez por quadro. Arredonda como a câmera, para os dois andarem juntos. */
  render(): void {
    this.sprite.setPosition(Math.round(this.current.x), Math.round(this.current.y));
    this.sprite.setTint(HERO_COLORS[this.current.motion.state]);
  }
}
