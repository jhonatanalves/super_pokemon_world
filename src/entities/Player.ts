import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/game';
import { HERO_COLORS } from '../config/placeholder';
import { createHeroMotion, stepHero, type HeroInput, type HeroMotion } from '../logic/heroMotion';

const TEXTURE = 'placeholder-hero';

/**
 * Herói provisório: quadrado branco tingido pela cor do estado, com corpo Arcade.
 * O Arcade só resolve colisão; velocidade e gravidade vêm de stepHero (src/logic/heroMotion.ts).
 * Usa imagem, não Rectangle, porque só objetos com textura respeitam roundPixels.
 */
export class Player {
  readonly sprite: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
  private current: HeroMotion = createHeroMotion();

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const size = GAME_CONFIG.tileSize;
    if (!scene.textures.exists(TEXTURE)) {
      const g = scene.make.graphics({}, false);
      g.fillStyle(0xffffff).fillRect(0, 0, size, size);
      g.generateTexture(TEXTURE, size, size);
      g.destroy();
    }
    this.sprite = scene.physics.add.image(x, y, TEXTURE);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setCollideWorldBounds(true);
    this.render();
  }

  get body(): Phaser.Physics.Arcade.Body {
    return this.sprite.body;
  }

  get motion(): HeroMotion {
    return this.current;
  }

  /** Um passo fixo: lê os contatos do passo do Arcade e define a velocidade do próximo. */
  step(input: HeroInput, dt: number): void {
    const { blocked } = this.body;
    this.current = stepHero(
      this.current,
      input,
      {
        ground: blocked.down,
        ceiling: blocked.up,
        wallLeft: blocked.left,
        wallRight: blocked.right,
      },
      dt,
    );
    this.body.setVelocity(this.current.vx, this.current.vy);
    // O Arcade só zera os contatos no primeiro passo de cada quadro; zerar aqui faz
    // cada passo extra do mesmo quadro ler apenas os próprios contatos.
    this.body.resetFlags();
  }

  /** Atualiza o visual, uma vez por quadro. */
  render(): void {
    this.sprite.setTint(HERO_COLORS[this.current.state]);
  }
}
