import Phaser from 'phaser';
import { MOUNTS } from '../config/mounts';
import { EFFECTS, HERO_COLORS, POWER_COLORS } from '../config/placeholder';
import type { FormCatalog } from '../logic/creatures';
import { isInvincible, type HurtState } from '../logic/damage';
import { HERO_SIZE, type HeroBody } from '../logic/heroBody';
import { stepsFor } from '../logic/heroMotion';
import { heroHeightFor, type PowerState } from '../logic/powerups';
import type { Box } from '../logic/tileCollision';

/**
 * Herói provisório: retângulo na cor da forma (creatures.json), com uma faixa no topo na cor
 * do estado de movimento. Pisca depois do dano e no fim da invencibilidade, e troca de cor
 * durante ela. Movimento e colisão vêm de stepWorld (src/logic/world.ts); aqui só se desenha.
 */
export class Player {
  private readonly g: Phaser.GameObjects.Graphics;
  /** Quadros desenhados, para o pisca e a troca de cores. */
  private frame = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly forms: FormCatalog,
  ) {
    this.g = scene.add.graphics();
  }

  /**
   * Atualiza o visual, uma vez por quadro. Arredonda como a câmera, para os dois andarem
   * juntos. Montado (F4c), o herói aparece na altura da forma, em cima da montaria (que o
   * WorldView desenha na parte de baixo da caixa).
   */
  render(body: HeroBody, power: PowerState, hurt: HurtState, riding: boolean): void {
    this.frame++;
    const g = this.g.clear();
    const { width } = HERO_SIZE;
    const height = riding ? heroHeightFor(power.form) : body.height;
    const top = riding ? body.y + body.height - MOUNTS.height - height : body.y;
    const x = Math.round(body.x);
    const y = Math.round(top);

    const steps = (seconds: number): number => Math.max(stepsFor(seconds), 1);
    const blinkOn = Math.floor(this.frame / steps(EFFECTS.blinkPeriod)) % 2 === 0;
    const starEnding = power.starSteps > 0 && power.starSteps <= stepsFor(EFFECTS.starWarningTime);
    if ((isInvincible(hurt) || starEnding) && !blinkOn) return;

    const cycle = POWER_COLORS.starCycle;
    const color =
      power.starSteps > 0
        ? cycle[Math.floor(this.frame / steps(EFFECTS.starCyclePeriod)) % cycle.length]
        : this.forms[power.form].color;
    g.fillStyle(color).fillRect(x, y, width, height);
    g.fillStyle(HERO_COLORS[body.motion.state]).fillRect(x, y, width, EFFECTS.heroStateBand);
  }

  /** Giro do voador: uma barra que alcança os dois lados do herói. */
  renderSpin(area: Box | null): void {
    if (!area) return;
    const y = Math.round(area.y + area.height / 2) - 1;
    this.g.fillStyle(POWER_COLORS.spin).fillRect(Math.round(area.x), y, area.width, 2);
  }
}
