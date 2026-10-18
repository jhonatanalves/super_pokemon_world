import Phaser from 'phaser';
import { HUD_STYLE } from '../config/placeholder';
import { applyHudEvent, EMPTY_HUD, HUD_EVENTS, hudText, type HudState } from '../logic/hud';
import { gameEvents } from '../systems/EventBus';

/**
 * HUD por cima da fase: vidas, moedas e Moedas Pokébola. Só escuta eventos do EventBus;
 * nunca consulta a fase.
 */
export class HudScene extends Phaser.Scene {
  private state: HudState = EMPTY_HUD;
  private text!: Phaser.GameObjects.Text;

  constructor() {
    super('HudScene');
  }

  create(): void {
    this.state = EMPTY_HUD;
    this.text = this.add.text(2, 2, '', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: HUD_STYLE.text,
      backgroundColor: HUD_STYLE.textBackground,
      padding: { x: 2, y: 1 },
    });
    const unsubscribe = HUD_EVENTS.map((type) =>
      gameEvents.on(type, (event) => {
        this.state = applyHudEvent(this.state, event);
        this.text.setText(hudText(this.state));
      }),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => unsubscribe.forEach((off) => off()));
  }
}
