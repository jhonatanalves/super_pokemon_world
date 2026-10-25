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
import { enterLevel, type GameState, type LevelOutcome } from '../logic/game';
import { isClearDone } from '../logic/goal';
import { heroBox, heroCenter, shouldRestart } from '../logic/heroBody';
import { LEVEL_LAYERS, parseLevel, type Ruler } from '../logic/level';
import { isGameOver } from '../logic/session';
import { createWorld, levelStartedEvent, stepWorld, type World } from '../logic/world';
import { LevelCamera } from '../systems/Camera';
import { DebugPanel } from '../systems/DebugPanel';
import { gameEvents } from '../systems/EventBus';
import { InputSystem } from '../systems/InputSystem';
import { Parallax } from '../systems/Parallax';
import { WorldView } from '../systems/WorldView';
import type { MapData } from './WorldMapScene';

const MS_PER_SECOND = 1000;

/** Dados ao entrar na fase, vindos do mapa (F5b). */
export interface LevelData {
  /** O jogo no mapa: a fase começa com a sessão dele e volta a ele no fim. */
  readonly game: GameState;
  /** Fase a jogar: chave em ASSETS.levels (o worlds.json é validado contra elas). */
  readonly level: string;
}

/**
 * Fase jogável, carregada pela chave (F5a). A lógica toda está em stepWorld
 * (src/logic/world.ts); aqui ela roda no passo fixo, os eventos vão para o EventBus e o
 * resultado é desenhado. Vencer ou morrer volta ao mapa (F5b), passando pelo Game Over se
 * as vidas acabaram.
 */
export class LevelScene extends Phaser.Scene {
  /** O jogo no mapa, como estava ao entrar (`game` já é do Phaser). */
  private gameState!: GameState;
  private levelKey = '';
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

  create(data: LevelData): void {
    this.gameState = data.game;
    this.levelKey = data.level;
    const cached = this.cache.tilemap.get(this.levelKey) as { data?: unknown } | undefined;
    const level = parseLevel(cached?.data, GAME_CONFIG.tileSize);
    this.content = parseContent(creaturesJson);
    const built = createWorld(level, this.content, enterLevel(data.game, data.game.node));
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
    this.debug = new DebugPanel(this, this.world.collision);
    this.scene.launch('HudScene');
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

    // Morte ou fim da fase: volta ao mapa, que aplica o resultado (src/logic/game.ts).
    const session = this.world.session;
    const { clear } = this.world;
    let outcome: LevelOutcome | null = null;
    if (shouldRestart(this.world.hero)) outcome = { kind: 'death', session };
    else if (clear && isClearDone(clear)) outcome = { kind: 'clear', exit: clear.exit, session };
    if (outcome) {
      const back: MapData = { game: this.gameState, outcome };
      this.scene.stop('HudScene');
      const gameOver = outcome.kind === 'death' && isGameOver(session);
      this.scene.start(gameOver ? 'GameOverScene' : 'WorldMapScene', back);
      return;
    }

    this.view.setShowHidden(this.debug.isShown);
    this.view.render(this.world);
    const riding = this.world.mounts.some((m) => m.state === 'ridden');
    this.player.render(this.world.hero, this.world.power, this.world.hurt, riding);
    this.player.renderSpin(this.world.spinSteps > 0 ? spinBox(heroBox(this.world.hero)) : null);
    this.parallax.update(this.camera.state.scrollX);
    this.debug.update(this.world, this.camera.state);
  }

  /** Camadas de fundo e de terreno do Tiled. A colisão vem do Level, não do Phaser. */
  private createTiles(): void {
    const map = this.make.tilemap({ key: this.levelKey });
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
