import Phaser from 'phaser';
import creaturesJson from '../content/creatures.json';
import { GAME_CONFIG } from '../config/game';
import { HUD_LAYOUT, HUD_STYLE } from '../config/placeholder';
import { parseContent, powerColor, type GameContent } from '../logic/creatures';
import {
  applyHudEvent,
  EMPTY_HUD,
  HUD_EVENTS,
  hudClearText,
  hudFormText,
  hudPokeballText,
  hudStarText,
  hudText,
  type HudState,
} from '../logic/hud';
import { gameEvents } from '../systems/EventBus';

/**
 * HUD por cima da fase: vidas, moedas, Moedas Pokébola, a forma do herói, a caixa de
 * reserva no centro (F4b), as estrelas e a mensagem do fim da fase (F5a). Só escuta eventos
 * do EventBus; nunca consulta a fase.
 */
export class HudScene extends Phaser.Scene {
  private state: HudState = EMPTY_HUD;
  private content!: GameContent;
  private left!: Phaser.GameObjects.Text;
  private right!: Phaser.GameObjects.Text;
  private form!: Phaser.GameObjects.Text;
  private stars!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private box!: Phaser.GameObjects.Graphics;

  constructor() {
    super('HudScene');
  }

  create(): void {
    this.state = EMPTY_HUD;
    this.content = parseContent(creaturesJson);
    const { margin, line } = HUD_LAYOUT;
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: HUD_STYLE.text,
      backgroundColor: HUD_STYLE.textBackground,
      padding: { x: 2, y: 1 },
    };
    this.left = this.add.text(margin, margin, '', style);
    this.right = this.add.text(GAME_CONFIG.width - margin, margin, '', style).setOrigin(1, 0);
    this.form = this.add.text(margin, margin + line, '', style);
    this.stars = this.add
      .text(GAME_CONFIG.width - margin, margin + line, '', style)
      .setOrigin(1, 0);
    this.message = this.add
      .text(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2, '', { ...style, align: 'center' })
      .setOrigin(0.5);
    this.box = this.add.graphics();
    this.redraw();

    const unsubscribe = HUD_EVENTS.map((type) =>
      gameEvents.on(type, (event) => {
        this.state = applyHudEvent(this.state, event);
        this.redraw();
      }),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => unsubscribe.forEach((off) => off()));
  }

  private redraw(): void {
    this.left.setText(hudText(this.state));
    this.right.setText(hudPokeballText(this.state));
    this.form.setText(hudFormText(this.state, this.content.forms));
    this.stars.setText(hudStarText(this.state));
    const message = hudClearText(this.state);
    this.message.setText(message ?? '').setVisible(message !== null);

    // Caixa de reserva no centro, com o item guardado dentro.
    const { boxSize, boxItem, margin } = HUD_LAYOUT;
    const x = (GAME_CONFIG.width - boxSize) / 2;
    const g = this.box.clear();
    g.fillStyle(HUD_STYLE.boxBackground, HUD_STYLE.boxAlpha).fillRect(x, margin, boxSize, boxSize);
    g.lineStyle(1, HUD_STYLE.boxBorder).strokeRect(x + 0.5, margin + 0.5, boxSize - 1, boxSize - 1);
    const color = this.state.reserve ? powerColor(this.content.items, this.state.reserve) : null;
    if (color !== null) {
      const inset = (boxSize - boxItem) / 2;
      g.fillStyle(color).fillRect(x + inset, margin + inset, boxItem, boxItem);
    }
  }
}
