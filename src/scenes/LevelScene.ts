import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/game';
import { ROOM_COLORS } from '../config/placeholder';
import testRoom from '../content/testRoom.json';
import { Player } from '../entities/Player';
import { parseRoom, surfaceRow, type Room } from '../logic/room';
import { DebugPanel } from '../systems/DebugPanel';
import { InputSystem } from '../systems/InputSystem';

const TILE_TEXTURE = 'placeholder-tile';
const SOLID_TILE = 0;
const EMPTY_TILE = -1;

/** Fase jogável. Na F1, a sala de teste de movimento. */
export class LevelScene extends Phaser.Scene {
  private player!: Player;
  private controls!: InputSystem;
  private debug!: DebugPanel;

  constructor() {
    super('LevelScene');
  }

  create(): void {
    const room = parseRoom(testRoom.rows);
    const tile = GAME_CONFIG.tileSize;
    const width = room.cols * tile;
    const height = room.rows * tile;

    const layer = this.createTiles(room);
    this.drawRuler(room, testRoom.ruler.col, testRoom.ruler.tiles);

    this.physics.world.setBounds(0, 0, width, height);
    this.player = new Player(this, (room.spawn.col + 0.5) * tile, (room.spawn.row + 0.5) * tile);
    this.physics.add.collider(this.player.sprite, layer);

    // Só acompanha o herói dentro da sala. Zona morta e antecipação ficam para a F2.
    this.cameras.main.setBounds(0, 0, width, height);
    this.cameras.main.startFollow(this.player.sprite, true);

    this.controls = new InputSystem(this);
    this.debug = new DebugPanel(this, layer);

    // A lógica do herói roda a cada passo fixo da física, não a cada quadro desenhado.
    const world = this.physics.world;
    const onStep = (dt: number): void => this.player.step(this.controls.readHero(), dt);
    world.on(Phaser.Physics.Arcade.Events.WORLD_STEP, onStep);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      world.off(Phaser.Physics.Arcade.Events.WORLD_STEP, onStep);
    });
  }

  update(): void {
    if (this.controls.justPressed('debug')) this.debug.toggle();
    this.player.render();
    this.debug.update(this.player);
  }

  private createTiles(room: Room): Phaser.Tilemaps.TilemapLayer {
    const tile = GAME_CONFIG.tileSize;
    if (!this.textures.exists(TILE_TEXTURE)) {
      const g = this.make.graphics({}, false);
      g.fillStyle(ROOM_COLORS.tileEdge).fillRect(0, 0, tile, tile);
      g.fillStyle(ROOM_COLORS.tileFill).fillRect(1, 1, tile - 2, tile - 2);
      g.generateTexture(TILE_TEXTURE, tile, tile);
      g.destroy();
    }
    const data = room.solid.map((row) => row.map((solid) => (solid ? SOLID_TILE : EMPTY_TILE)));
    const map = this.make.tilemap({ data, tileWidth: tile, tileHeight: tile });
    const tileset = map.addTilesetImage(TILE_TEXTURE, TILE_TEXTURE, tile, tile, 0, 0);
    const layer = tileset && map.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error('Não foi possível criar a camada de tiles da sala');
    layer.setCollision(SOLID_TILE);
    return layer;
  }

  /** Régua com marcas a cada tile acima do piso, para conferir a altura do pulo. */
  private drawRuler(room: Room, col: number, tiles: number): void {
    const tile = GAME_CONFIG.tileSize;
    const floorY = surfaceRow(room, col) * tile;
    const x = col * tile;
    const g = this.add.graphics().lineStyle(1, ROOM_COLORS.ruler);
    for (let h = 1; h <= tiles; h++) {
      const y = floorY - h * tile;
      g.lineBetween(x, y + 0.5, x + tile / 2, y + 0.5);
      this.add
        .text(x + tile / 2 + 1, y, String(h), {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: ROOM_COLORS.rulerText,
        })
        .setOrigin(0, 0.5);
    }
  }
}
