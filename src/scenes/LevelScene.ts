import Phaser from 'phaser';
import { ASSETS } from '../config/assets';
import { GAME_CONFIG } from '../config/game';
import { RULER_COLORS } from '../config/placeholder';
import { Player } from '../entities/Player';
import { advanceClock } from '../logic/fixedStep';
import { LEVEL_LAYERS, parseLevel, type Level, type Ruler } from '../logic/level';
import { LevelCamera } from '../systems/Camera';
import { DebugPanel } from '../systems/DebugPanel';
import { InputSystem } from '../systems/InputSystem';
import { Parallax } from '../systems/Parallax';

const MS_PER_SECOND = 1000;

/** Dados passados ao reiniciar a fase. */
interface LevelData {
  /** Mantém o painel de debug como estava antes da morte. */
  readonly debug?: boolean;
}

/** Fase jogável. Na F2, a fase de teste carregada do Tiled. */
export class LevelScene extends Phaser.Scene {
  private level!: Level;
  private player!: Player;
  private camera!: LevelCamera;
  private parallax!: Parallax;
  private controls!: InputSystem;
  private debug!: DebugPanel;
  /** Tempo acumulado que ainda não virou passo fixo, em segundos. */
  private pending = 0;

  constructor() {
    super('LevelScene');
  }

  create(data: LevelData = {}): void {
    const cached = this.cache.tilemap.get(ASSETS.testLevel.key) as { data?: unknown } | undefined;
    this.level = parseLevel(cached?.data, GAME_CONFIG.tileSize);
    this.pending = 0;

    this.parallax = new Parallax(this);
    this.createTiles();
    if (this.level.ruler) this.drawRuler(this.level.ruler);

    this.player = new Player(this, this.level.spawn);
    this.camera = new LevelCamera(this, this.level, this.player.center);
    this.controls = new InputSystem(this);
    this.debug = new DebugPanel(this, this.level, data.debug === true);
  }

  update(_time: number, delta: number): void {
    if (this.controls.justPressed('debug')) this.debug.toggle();

    // Herói e câmera andam no passo fixo; o desenho, uma vez por quadro.
    const clock = advanceClock(this.pending, delta / MS_PER_SECOND);
    this.pending = clock.pending;
    const input = this.controls.readHero();
    for (let i = 0; i < clock.steps; i++) {
      this.player.step(input, this.level);
      this.camera.step(this.player.center);
    }
    if (this.player.shouldRestart()) {
      const restart: LevelData = { debug: this.debug.isShown };
      this.scene.restart(restart);
      return;
    }

    this.player.render();
    this.parallax.update(this.camera.state.scrollX);
    this.debug.update(this.player, this.camera.state);
  }

  /** Camadas de fundo e de terreno do Tiled. A colisão vem do Level, não do Phaser. */
  private createTiles(): void {
    const map = this.make.tilemap({ key: ASSETS.testLevel.key });
    const tileset = map.addTilesetImage(this.level.tilesetName, ASSETS.testTiles.key);
    const background = tileset && map.createLayer(LEVEL_LAYERS.background, tileset);
    const terrain = tileset && map.createLayer(LEVEL_LAYERS.terrain, tileset);
    if (!background || !terrain) throw new Error('Não foi possível criar as camadas da fase');
  }

  /** Régua com marcas a cada tile acima do piso, para conferir a altura do pulo. */
  private drawRuler(ruler: Ruler): void {
    const tile = GAME_CONFIG.tileSize;
    const { x, y: floorY } = ruler.base;
    const g = this.add.graphics().lineStyle(1, RULER_COLORS.line);
    for (let h = 1; h <= ruler.tiles; h++) {
      const y = floorY - h * tile;
      g.lineBetween(x, y + 0.5, x + tile / 2, y + 0.5);
      this.add
        .text(x + tile / 2 + 1, y, String(h), {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: RULER_COLORS.text,
        })
        .setOrigin(0, 0.5);
    }
  }
}
