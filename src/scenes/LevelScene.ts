import Phaser from 'phaser';
import creaturesJson from '../content/creatures.json';
import { ASSETS } from '../config/assets';
import { GAME_CONFIG } from '../config/game';
import { RULER_COLORS } from '../config/placeholder';
import { Player } from '../entities/Player';
import { spinBox } from '../logic/attacks';
import { parseContent, type GameContent } from '../logic/creatures';
import type { GameEvent } from '../logic/events';
import { advanceClock } from '../logic/fixedStep';
import { heroBox, heroCenter, shouldRestart } from '../logic/heroBody';
import { LEVEL_LAYERS, parseLevel, type Ruler } from '../logic/level';
import { isGameOver, newSession, type Session } from '../logic/session';
import { createWorld, levelStartedEvent, stepWorld, type World } from '../logic/world';
import { LevelCamera } from '../systems/Camera';
import { DebugPanel } from '../systems/DebugPanel';
import { gameEvents } from '../systems/EventBus';
import { InputSystem } from '../systems/InputSystem';
import { Parallax } from '../systems/Parallax';
import { WorldView } from '../systems/WorldView';

const MS_PER_SECOND = 1000;

/**
 * Dados passados ao (re)começar a fase. Sempre passe um objeto ao iniciar a cena: sem dados,
 * o Phaser reaproveita os do último restart (e a sessão da tentativa anterior voltaria).
 */
export interface LevelData {
  /** Mantém o painel de debug como estava antes da morte. */
  readonly debug?: boolean;
  /** Vidas, moedas e checkpoint da tentativa anterior; sem ele, começa um jogo novo. */
  readonly session?: Session;
}

/**
 * Fase jogável. Na F4, a fase de teste com inimigos, blocos e power-ups. A lógica toda está
 * em stepWorld (src/logic/world.ts); aqui ela roda no passo fixo, os eventos vão para o
 * EventBus e o resultado é desenhado.
 */
export class LevelScene extends Phaser.Scene {
  private content!: GameContent;
  private world!: World;
  private player!: Player;
  private view!: WorldView;
  private camera!: LevelCamera;
  private parallax!: Parallax;
  private controls!: InputSystem;
  private debug!: DebugPanel;
  /** Tempo acumulado que ainda não virou passo fixo, em segundos. */
  private pending = 0;
  /** O HUD já recebeu o estado inicial desta tentativa. */
  private announced = false;

  constructor() {
    super('LevelScene');
  }

  create(data: LevelData = {}): void {
    const cached = this.cache.tilemap.get(ASSETS.testLevel.key) as { data?: unknown } | undefined;
    const level = parseLevel(cached?.data, GAME_CONFIG.tileSize);
    this.content = parseContent(creaturesJson);
    const built = createWorld(level, this.content, data.session ?? newSession());
    for (const error of built.errors) console.error(error);
    this.world = built.world;
    this.pending = 0;
    this.announced = false;

    this.parallax = new Parallax(this);
    this.createTiles();
    if (level.ruler) this.drawRuler(level.ruler);

    this.view = new WorldView(this, this.content);
    this.player = new Player(this, this.content.forms);
    this.camera = new LevelCamera(this, level, heroCenter(this.world.hero));
    this.controls = new InputSystem(this);
    this.debug = new DebugPanel(this, this.world.collision, data.debug === true);
    // O HUD continua rodando entre as tentativas; só é aberto na primeira.
    if (!this.scene.isActive('HudScene')) this.scene.launch('HudScene');
  }

  update(_time: number, delta: number): void {
    // No primeiro quadro o HUD já foi criado e está escutando.
    if (!this.announced) {
      gameEvents.emit(levelStartedEvent(this.world));
      this.announced = true;
    }
    if (this.controls.justPressed('debug')) this.debug.toggle();

    // Fase e câmera andam no passo fixo; o desenho, uma vez por quadro.
    const clock = advanceClock(this.pending, delta / MS_PER_SECOND);
    this.pending = clock.pending;
    const input = this.controls.readHero();
    const events: GameEvent[] = [];
    for (let i = 0; i < clock.steps; i++) {
      const left = this.camera.state.scrollX;
      const step = stepWorld(this.world, input, { left, right: left + GAME_CONFIG.width });
      this.world = step.world;
      events.push(...step.events);
      this.camera.step(heroCenter(this.world.hero));
    }
    for (const event of events) gameEvents.emit(event);

    if (shouldRestart(this.world.hero)) {
      if (isGameOver(this.world.session)) {
        this.scene.stop('HudScene');
        this.scene.start('GameOverScene');
      } else {
        const restart: LevelData = { debug: this.debug.isShown, session: this.world.session };
        this.scene.restart(restart);
      }
      return;
    }

    this.view.setShowHidden(this.debug.isShown);
    this.view.render(this.world);
    this.player.render(this.world.hero, this.world.power, this.world.hurt);
    this.player.renderSpin(this.world.spinSteps > 0 ? spinBox(heroBox(this.world.hero)) : null);
    this.parallax.update(this.camera.state.scrollX);
    this.debug.update(this.world, this.camera.state);
  }

  /** Camadas de fundo e de terreno do Tiled. A colisão vem do Level, não do Phaser. */
  private createTiles(): void {
    const map = this.make.tilemap({ key: ASSETS.testLevel.key });
    const tileset = map.addTilesetImage(this.world.level.tilesetName, ASSETS.testTiles.key);
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
