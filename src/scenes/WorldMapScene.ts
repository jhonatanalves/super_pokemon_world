import Phaser from 'phaser';
import creaturesJson from '../content/creatures.json';
import worldsJson from '../content/worlds.json';
import { ASSETS } from '../config/assets';
import { GAME_CONFIG } from '../config/game';
import { HUD_LAYOUT, MAP_ART } from '../config/placeholder';
import { WORLD_MAP } from '../config/worldMap';
import { parseContent, type FormCatalog } from '../logic/creatures';
import { advanceClock } from '../logic/fixedStep';
import { newGame, returnFromLevel, type GameState, type LevelOutcome } from '../logic/game';
import {
  cellCenter,
  choosePath,
  pathDots,
  pathPixels,
  revealedDots,
  stepWalker,
  walkerPosition,
  type Walker,
} from '../logic/mapWalk';
import type { Point } from '../logic/level';
import {
  isCleared,
  openPaths,
  parseWorlds,
  type Direction,
  type MapNode,
  type WorldsData,
} from '../logic/worldMap';
import { InputSystem } from '../systems/InputSystem';
import type { LevelData } from './LevelScene';

const MS_PER_SECOND = 1000;
const DIRECTIONS: readonly Direction[] = ['left', 'right', 'up', 'down'];

/**
 * Dados ao abrir o mapa. Sem `game`, é um jogo novo. Com `outcome`, o herói volta de uma
 * fase: a vitória abre os caminhos novos, que aparecem com animação.
 */
export interface MapData {
  readonly game?: GameState;
  readonly outcome?: LevelOutcome;
}

/** Caminhos recém-abertos aparecendo um de cada vez, a partir do nó vencido. */
interface Reveal {
  readonly paths: readonly string[];
  readonly from: string;
  readonly steps: number;
}

/**
 * Mapa-múndi (F5b): nós e caminhos de worlds.json. O herói anda pelos caminhos abertos com
 * as setas e entra na fase do nó com Z ou Enter. A lógica está em src/logic/worldMap.ts,
 * game.ts e mapWalk.ts; aqui ela roda no passo fixo e é desenhada com formas provisórias.
 */
export class WorldMapScene extends Phaser.Scene {
  private worlds!: WorldsData;
  private forms!: FormCatalog;
  private state!: GameState;
  private walker!: Walker;
  private reveal: Reveal | null = null;
  private controls!: InputSystem;
  private g!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private pending = 0;

  constructor() {
    super('WorldMapScene');
  }

  create(data: MapData = {}): void {
    this.worlds = parseWorlds(worldsJson, Object.keys(ASSETS.levels));
    this.forms = parseContent(creaturesJson).forms;
    let state = data.game ?? newGame(this.worlds);
    let opened: readonly string[] = [];
    if (data.game && data.outcome) {
      const back = returnFromLevel(this.worlds, data.game, data.outcome);
      state = back.state;
      opened = back.opened;
    }
    this.state = state;
    this.walker = { node: state.node, walk: null };
    this.reveal = opened.length > 0 ? { paths: opened, from: state.node, steps: 0 } : null;
    this.pending = 0;

    this.g = this.add.graphics();
    const { margin } = HUD_LAYOUT;
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: MAP_ART.text,
      backgroundColor: MAP_ART.textBackground,
      padding: { x: 2, y: 1 },
    };
    this.title = this.add.text(margin, margin, '', style);
    this.status = this.add.text(GAME_CONFIG.width - margin, margin, '', style).setOrigin(1, 0);
    this.hint = this.add
      .text(GAME_CONFIG.width / 2, GAME_CONFIG.height - margin, '', {
        ...style,
        color: MAP_ART.hint,
      })
      .setOrigin(0.5, 1);
    this.controls = new InputSystem(this);
  }

  update(_time: number, delta: number): void {
    // Cada ação é lida uma vez por quadro (justPressed guarda o estado anterior).
    const pressed = DIRECTIONS.filter((d) => this.controls.justPressed(d));
    const enter = this.controls.justPressed('start');

    const clock = advanceClock(this.pending, delta / MS_PER_SECOND);
    this.pending = clock.pending;
    for (let i = 0; i < clock.steps; i++) this.step();

    const idle = !this.reveal && !this.walker.walk;
    if (idle && pressed.length > 0) {
      const open = openPaths(this.worlds, this.state.cleared);
      const walk = choosePath(this.worlds, open, this.walker.node, pressed[0]);
      if (walk) this.walker = { ...this.walker, walk };
    } else if (idle && enter) {
      const node = this.currentNode();
      if (node.level !== null) {
        const level: LevelData = { game: this.state, level: node.level };
        this.scene.start('LevelScene', level);
        return;
      }
    }
    this.draw();
  }

  /** Um passo fixo: o caminho novo aparecendo, ou o herói andando. */
  private step(): void {
    const reveal = this.reveal;
    if (reveal) {
      const shown = revealedDots(this.worlds, reveal.paths[0], reveal.from, reveal.steps + 1);
      if (!shown.done) this.reveal = { ...reveal, steps: reveal.steps + 1 };
      else
        this.reveal =
          reveal.paths.length > 1 ? { ...reveal, paths: reveal.paths.slice(1), steps: 0 } : null;
      return;
    }
    this.walker = stepWalker(this.walker, this.worlds);
    if (!this.walker.walk && this.walker.node !== this.state.node) {
      this.state = { ...this.state, node: this.walker.node };
    }
  }

  private currentNode(): MapNode {
    const node = this.worlds.nodes.get(this.walker.node);
    if (!node) throw new Error(`nó "${this.walker.node}" não existe no mapa`);
    return node;
  }

  private draw(): void {
    const g = this.g.clear();
    g.fillStyle(MAP_ART.background).fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);

    // Caminhos abertos; os que ainda vão aparecer ficam escondidos.
    const waiting = new Set(this.reveal ? this.reveal.paths : []);
    const shownPaths = [...openPaths(this.worlds, this.state.cleared)].filter(
      (id) => !waiting.has(id),
    );
    const dots = shownPaths.flatMap((id) =>
      pathDots(pathPixels(this.worlds, id), WORLD_MAP.dotSpacing),
    );
    if (this.reveal) {
      const { paths, from, steps } = this.reveal;
      dots.push(...revealedDots(this.worlds, paths[0], from, steps).dots);
    }
    const dot = MAP_ART.dotSize;
    g.fillStyle(MAP_ART.dot);
    for (const p of dots)
      g.fillRect(Math.round(p.x - dot / 2), Math.round(p.y - dot / 2), dot, dot);

    // Nós: o início e as pontas dos caminhos já mostrados.
    const visible = new Set([this.worlds.start, this.state.node]);
    for (const id of shownPaths) {
      const path = this.worlds.paths.get(id);
      if (path) [path.from, path.to].forEach((n) => visible.add(n));
    }
    for (const id of visible) {
      const node = this.worlds.nodes.get(id);
      if (node) this.drawNode(node);
    }

    // Herói na cor da forma.
    const at: Point = walkerPosition(this.walker, this.worlds);
    const { width, height } = MAP_ART.hero;
    const x = Math.round(at.x - width / 2);
    const y = Math.round(at.y - height + 2);
    g.fillStyle(MAP_ART.outline).fillRect(x - 1, y - 1, width + 2, height + 2);
    g.fillStyle(this.forms[this.state.session.form].color).fillRect(x, y, width, height);

    const node = this.currentNode();
    const moving = this.walker.walk !== null;
    const world = this.worlds.worlds.get(node.world) ?? '';
    this.title.setText(
      moving ? world.toUpperCase() : `${world.toUpperCase()}  ${node.name.toUpperCase()}`,
    );
    const { lives, stars } = this.state.session;
    this.status.setText(`VIDAS ${lives}  ESTRELAS ${String(stars).padStart(2, '0')}`);
    const hint = moving || this.reveal ? '' : this.hintFor(node);
    this.hint.setText(hint).setVisible(hint !== '');
  }

  private hintFor(node: MapNode): string {
    if (node.kind === 'soon') return 'EM BREVE';
    if (node.level === null) return 'SETAS: ANDAR';
    return isCleared(this.state.cleared, node.id) ? 'VENCIDA  Z: JOGAR DE NOVO' : 'Z: ENTRAR';
  }

  private drawNode(node: MapNode): void {
    const g = this.g;
    const center = cellCenter(node);
    const size = node.kind === 'start' ? MAP_ART.startNode : MAP_ART.node;
    const height = node.kind === 'castle' ? MAP_ART.castleHeight : size;
    const color =
      node.kind === 'castle'
        ? MAP_ART.castle
        : node.kind === 'soon'
          ? MAP_ART.soon
          : node.kind === 'start'
            ? MAP_ART.start
            : isCleared(this.state.cleared, node.id)
              ? MAP_ART.cleared
              : MAP_ART.level;
    const x = Math.round(center.x - size / 2);
    const y = Math.round(center.y + size / 2 - height);
    g.fillStyle(MAP_ART.outline).fillRect(x - 1, y - 1, size + 2, height + 2);
    g.fillStyle(color).fillRect(x, y, size, height);
  }
}
