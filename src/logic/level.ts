/** Leitura e validação de uma fase exportada do Tiled (JSON). Sem Phaser, para ser testada em Node. */

/** Nomes das camadas que toda fase precisa ter no Tiled. */
export const LEVEL_LAYERS = {
  terrain: 'terreno',
  background: 'fundo',
  objects: 'objetos',
} as const;

/**
 * Forma de colisão de um tile, vinda da propriedade "shape" do tileset.
 * Numa ladeira, `left` e `right` são as alturas do piso (px, a partir da base do tile)
 * nas bordas esquerda e direita. `hidden` é o bloco invisível (F3): só bloqueia quem sobe
 * por baixo dele; não vem do tileset, e sim dos blocos da camada de objetos. `water` (F4c)
 * não bloqueia nada: quem está nela nada (src/logic/water.ts).
 */
export type TileShape =
  | { readonly kind: 'empty' }
  | { readonly kind: 'solid' }
  | { readonly kind: 'oneWay' }
  | { readonly kind: 'hidden' }
  | { readonly kind: 'water' }
  | { readonly kind: 'slope'; readonly left: number; readonly right: number };

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Régua de altura (F1): marcas a cada tile acima de `base`, que fica no chão. */
export interface Ruler {
  readonly base: Point;
  readonly tiles: number;
}

/**
 * Objeto da camada de objetos que não é o início nem a régua (F3): inimigo, bloco, moeda,
 * checkpoint. Quem o interpreta é o mundo (src/logic/world.ts) e a fábrica de entidades.
 */
export interface LevelObject {
  readonly type: string;
  /** Retângulo do Tiled em px; (x, y) é o canto superior esquerdo. Um ponto tem tamanho 0. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly properties: ReadonlyMap<string, unknown>;
}

export interface Level {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  /** Largura e altura em px. */
  readonly width: number;
  readonly height: number;
  /** terrain[row][col] */
  readonly terrain: readonly (readonly TileShape[])[];
  /** Ponto dos pés do herói no início (centro, base). */
  readonly spawn: Point;
  readonly ruler: Ruler | null;
  /** Demais objetos, na ordem do Tiled. */
  readonly objects: readonly LevelObject[];
  /** Nome do tileset no Tiled, para o Phaser ligar a imagem. */
  readonly tilesetName: string;
}

/** Ponto dos pés de quem nasce no objeto: centro da base do retângulo. */
export function objectFoot(o: LevelObject): Point {
  return { x: o.x + o.width / 2, y: o.y + o.height };
}

export const EMPTY_TILE: TileShape = { kind: 'empty' };

/** Bits que o Tiled usa no gid para espelhar ou girar o tile. */
const FLIP_FLAGS = 0xe0000000;

type Json = Record<string, unknown>;

function fail(message: string): never {
  throw new Error(`Mapa inválido: ${message}`);
}

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function obj(value: unknown, what: string): Json {
  if (!isObject(value)) fail(`${what} não é um objeto`);
  return value;
}

function num(o: Json, key: string, what: string): number {
  const value = o[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${what}.${key} não é um número`);
  return value;
}

function str(o: Json, key: string, what: string): string {
  const value = o[key];
  if (typeof value !== 'string') fail(`${what}.${key} não é um texto`);
  return value;
}

function list(o: Json, key: string, what: string): unknown[] {
  const value = o[key];
  if (!Array.isArray(value)) fail(`${what}.${key} não é uma lista`);
  return value;
}

/** Propriedades personalizadas do Tiled (lista de { name, value }) como um dicionário. */
function properties(o: Json, what: string): Map<string, unknown> {
  const result = new Map<string, unknown>();
  if (o.properties === undefined) return result;
  for (const item of list(o, 'properties', what)) {
    const p = obj(item, `${what}.properties[]`);
    result.set(str(p, 'name', `${what}.properties[]`), p.value);
  }
  return result;
}

function findLayer(layers: readonly Json[], name: string, type: string): Json {
  const found = layers.filter((l) => l.name === name);
  if (found.length !== 1) fail(`precisa de exatamente 1 camada "${name}"; tem ${found.length}`);
  if (found[0].type !== type) fail(`a camada "${name}" deveria ser do tipo ${type}`);
  return found[0];
}

function parseShape(props: Map<string, unknown>, tileSize: number, what: string): TileShape {
  const shape = props.get('shape');
  switch (shape) {
    case 'solid':
    case 'oneWay':
    case 'water':
      return { kind: shape };
    case 'slope': {
      const left = props.get('left');
      const right = props.get('right');
      const valid = (h: unknown): h is number => typeof h === 'number' && h >= 0 && h <= tileSize;
      if (!valid(left) || !valid(right)) {
        fail(`${what}: ladeira precisa de "left" e "right" entre 0 e ${tileSize}`);
      }
      return { kind: 'slope', left, right };
    }
    default:
      fail(`${what}: "shape" desconhecido (${String(shape)})`);
  }
}

/** Formas de colisão por gid, lidas das propriedades do tileset. */
function parseTileset(
  map: Json,
  tileSize: number,
): { name: string; shapes: Map<number, TileShape> } {
  const tilesets = list(map, 'tilesets', 'mapa');
  if (tilesets.length !== 1) fail(`precisa de exatamente 1 tileset; tem ${tilesets.length}`);
  const ts = obj(tilesets[0], 'tileset');
  if (ts.source !== undefined) fail('o tileset precisa estar embutido no mapa (sem arquivo .tsx)');
  const firstGid = num(ts, 'firstgid', 'tileset');
  const shapes = new Map<number, TileShape>();
  for (const item of ts.tiles === undefined ? [] : list(ts, 'tiles', 'tileset')) {
    const tile = obj(item, 'tileset.tiles[]');
    const id = num(tile, 'id', 'tileset.tiles[]');
    const props = properties(tile, `tile ${id}`);
    if (props.has('shape')) shapes.set(firstGid + id, parseShape(props, tileSize, `tile ${id}`));
  }
  return { name: str(ts, 'name', 'tileset'), shapes };
}

function layerData(layer: Json, cols: number, rows: number): number[] {
  const what = `camada "${String(layer.name)}"`;
  if (layer.encoding !== undefined && layer.encoding !== 'csv') {
    fail(`${what}: exporte os dados como CSV, não ${String(layer.encoding)}`);
  }
  const data = list(layer, 'data', what);
  if (data.length !== cols * rows)
    fail(`${what} tem ${data.length} tiles; esperado ${cols * rows}`);
  return data.map((gid, i) => {
    if (typeof gid !== 'number' || !Number.isInteger(gid) || gid < 0) {
      fail(`${what}: tile ${i} não é um gid válido`);
    }
    if ((gid & FLIP_FLAGS) !== 0) fail(`${what}: tiles espelhados ou girados não são suportados`);
    return gid;
  });
}

/** Tamanho opcional de um objeto (pontos não têm). */
function size(o: Json, key: string): number {
  const value = o[key];
  if (value === undefined) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail(`objeto.${key} não é um tamanho válido`);
  }
  return value;
}

function parseObjects(layer: Json): {
  spawn: Point;
  ruler: Ruler | null;
  others: LevelObject[];
} {
  const spawns: Point[] = [];
  const rulers: Ruler[] = [];
  const others: LevelObject[] = [];
  for (const item of list(layer, 'objects', 'camada de objetos')) {
    const o = obj(item, 'objeto');
    // O Tiled 1.9 chamou o campo de "class"; versões antes e depois usam "type".
    const type = typeof o.type === 'string' && o.type !== '' ? o.type : o.class;
    const point = { x: num(o, 'x', 'objeto'), y: num(o, 'y', 'objeto') };
    if (type === 'spawn') spawns.push(point);
    else if (type === 'ruler') {
      const tiles = properties(o, 'régua').get('tiles');
      if (typeof tiles !== 'number' || !Number.isInteger(tiles) || tiles < 1) {
        fail('a régua precisa da propriedade inteira "tiles" ≥ 1');
      }
      rulers.push({ base: point, tiles });
    } else {
      if (typeof type !== 'string' || type === '') fail('objeto sem "type"');
      others.push({
        type,
        ...point,
        width: size(o, 'width'),
        height: size(o, 'height'),
        properties: properties(o, `objeto "${type}"`),
      });
    }
  }
  if (spawns.length !== 1) fail(`precisa de exatamente 1 objeto "spawn"; tem ${spawns.length}`);
  if (rulers.length > 1) fail(`no máximo 1 objeto "ruler"; tem ${rulers.length}`);
  return { spawn: spawns[0], ruler: rulers[0] ?? null, others };
}

/** Valida o JSON do Tiled e devolve a fase com a colisão de cada tile. */
export function parseLevel(raw: unknown, tileSize: number): Level {
  const map = obj(raw, 'mapa');
  if (map.orientation !== 'orthogonal') fail('o mapa precisa ser ortogonal');
  if (map.infinite === true) fail('mapas infinitos não são suportados');
  if (num(map, 'tilewidth', 'mapa') !== tileSize || num(map, 'tileheight', 'mapa') !== tileSize) {
    fail(`os tiles precisam ter ${tileSize} x ${tileSize} px`);
  }
  const cols = num(map, 'width', 'mapa');
  const rows = num(map, 'height', 'mapa');

  const layers = list(map, 'layers', 'mapa').map((l) => obj(l, 'camada'));
  const terrainLayer = findLayer(layers, LEVEL_LAYERS.terrain, 'tilelayer');
  layerData(findLayer(layers, LEVEL_LAYERS.background, 'tilelayer'), cols, rows);
  const objects = parseObjects(findLayer(layers, LEVEL_LAYERS.objects, 'objectgroup'));

  const tileset = parseTileset(map, tileSize);
  const data = layerData(terrainLayer, cols, rows);
  const terrain = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col): TileShape => {
      const gid = data[row * cols + col];
      if (gid === 0) return EMPTY_TILE;
      const shape = tileset.shapes.get(gid);
      if (!shape) fail(`tile ${gid} do terreno (linha ${row}, coluna ${col}) não tem "shape"`);
      return shape;
    }),
  );

  const width = cols * tileSize;
  const height = rows * tileSize;
  const inside = (p: Point): boolean => p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height;
  if (!inside(objects.spawn)) fail('o início do herói está fora do mapa');
  if (objects.ruler && !inside(objects.ruler.base)) fail('a régua está fora do mapa');
  for (const o of objects.others) {
    if (!inside(o) || !inside({ x: o.x + o.width, y: o.y + o.height })) {
      fail(`o objeto "${o.type}" em (${o.x}, ${o.y}) está fora do mapa`);
    }
  }

  return {
    cols,
    rows,
    tileSize,
    width,
    height,
    terrain,
    spawn: objects.spawn,
    ruler: objects.ruler,
    objects: objects.others,
    tilesetName: tileset.name,
  };
}

/** Tile na posição; fora do mapa é vazio (as laterais são limitadas à parte, e o fundo é buraco). */
export function tileAt(level: Level, col: number, row: number): TileShape {
  if (row < 0 || row >= level.rows || col < 0 || col >= level.cols) return EMPTY_TILE;
  return level.terrain[row][col];
}
