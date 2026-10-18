import Phaser from 'phaser';
import { EFFECTS, OBJECT_COLORS } from '../config/placeholder';
import { isDefeated, type Enemy } from '../entities/enemies/Enemy';
import { piperVisibleBox } from '../entities/enemies/PiperEnemy';
import { stepsFor } from '../logic/heroMotion';
import type { Block } from '../logic/blocks';
import type { Creatures } from '../logic/creatures';
import type { Box } from '../logic/tileCollision';
import type { World } from '../logic/world';

/**
 * Desenha blocos, itens, checkpoint e inimigos como retângulos provisórios (até os sprites da
 * F7). Redesenha tudo a cada quadro a partir do World; não guarda estado do jogo.
 */
export class WorldView {
  private readonly g: Phaser.GameObjects.Graphics;
  private showHidden = false;

  constructor(
    scene: Phaser.Scene,
    private readonly creatures: Creatures,
  ) {
    this.g = scene.add.graphics();
  }

  /** Mostra os blocos invisíveis (painel de debug). */
  setShowHidden(show: boolean): void {
    this.showHidden = show;
  }

  render(world: World): void {
    const g = this.g;
    const s = world.level.tileSize;
    g.clear();

    if (world.checkpoint) {
      const color = world.session.checkpoint
        ? OBJECT_COLORS.checkpointReached
        : OBJECT_COLORS.checkpoint;
      const { box } = world.checkpoint;
      // Faixa do meio da fase: dois postes e a fita entre eles.
      g.fillStyle(color);
      g.fillRect(box.x, box.y, 2, box.height);
      g.fillRect(box.x + box.width - 2, box.y, 2, box.height);
      if (!world.session.checkpoint) g.fillRect(box.x, box.y + box.height / 2, box.width, 2);
    }

    for (const block of world.blocks) this.drawBlock(block, s);

    for (const item of world.items) {
      const { x, y, width, height } = item.box;
      if (item.kind === 'coin') {
        g.fillStyle(OBJECT_COLORS.coin).fillRect(x + width / 4, y + 2, width / 2, height - 4);
      } else {
        g.fillStyle(OBJECT_COLORS.pokeballTop).fillRect(x + 2, y + 2, width - 4, height / 2 - 2);
        g.fillStyle(OBJECT_COLORS.pokeballBottom).fillRect(
          x + 2,
          y + height / 2,
          width - 4,
          height / 2 - 2,
        );
      }
    }

    const popTotal = stepsFor(EFFECTS.coinPopTime);
    for (const pop of world.popups) {
      const rise = EFFECTS.coinPopHeight * (1 - pop.steps / popTotal);
      g.fillStyle(OBJECT_COLORS.coin).fillRect(
        pop.x + s / 4,
        Math.round(pop.y - s - rise),
        s / 2,
        s - 4,
      );
    }

    for (const enemy of world.enemies) this.drawEnemy(enemy);
  }

  private drawBlock(block: Block, s: number): void {
    const g = this.g;
    const lift = block.bumpSteps > 0 ? EFFECTS.blockBumpHeight : 0;
    const x = block.col * s;
    const y = block.row * s - lift;
    switch (block.kind) {
      case 'question':
        g.fillStyle(OBJECT_COLORS.question).fillRect(x, y, s, s);
        g.fillStyle(OBJECT_COLORS.questionMark).fillRect(x + s / 2 - 2, y + 3, 4, 6);
        g.fillRect(x + s / 2 - 2, y + s - 5, 4, 2);
        break;
      case 'brick':
        g.fillStyle(OBJECT_COLORS.brick).fillRect(x, y, s, s);
        g.fillStyle(OBJECT_COLORS.brickLine);
        g.fillRect(x, y + s / 2, s, 1);
        g.fillRect(x + s / 2, y, 1, s / 2);
        break;
      case 'note':
        g.fillStyle(OBJECT_COLORS.note).fillRect(x, y, s, s);
        g.fillStyle(OBJECT_COLORS.noteMark).fillRect(x + s / 2 - 3, y + s / 2, 4, 4);
        g.fillRect(x + s / 2, y + 3, 1, s / 2);
        break;
      case 'used':
        g.fillStyle(OBJECT_COLORS.used).fillRect(x, y, s, s);
        break;
      case 'hidden':
        if (this.showHidden)
          g.lineStyle(1, OBJECT_COLORS.hidden).strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
        break;
    }
  }

  private drawEnemy(e: Enemy): void {
    const creature = this.creatures.get(e.creature);
    const full = { x: e.x, y: e.y, width: e.width, height: e.height };
    let box = e.behavior === 'piper' ? piperVisibleBox(e) : full;
    if (!creature || !box) return;
    // Pisado fica achatado; a concha fica mais baixa que o inimigo andando.
    const shrink =
      e.state === 'squashed'
        ? EFFECTS.squashedHeight
        : e.behavior === 'shell' && (e.state === 'shell' || e.state === 'slide')
          ? EFFECTS.shellHeight
          : 1;
    if (shrink < 1) box = bottomPart(box, shrink);
    const x = Math.round(box.x);
    const y = Math.round(box.y);
    this.g.fillStyle(OBJECT_COLORS.enemyOutline).fillRect(x, y, box.width, box.height);
    this.g
      .fillStyle(creature.color, isDefeated(e) ? EFFECTS.defeatedAlpha : 1)
      .fillRect(x + 1, y + 1, box.width - 2, box.height - 2);
  }
}

/** Parte de baixo da caixa, com `fraction` da altura. */
function bottomPart(box: Box, fraction: number): Box {
  const height = Math.round(box.height * fraction);
  return { ...box, y: box.y + box.height - height, height };
}
