import { objectFoot, type LevelObject, type Point } from './level';
import type { Box } from './tileCollision';

/** Tipo de cada item na camada de objetos do Tiled. */
export const ITEM_TYPES = {
  coin: 'coin',
  'pokeball-coin': 'pokeball',
} as const;

export const CHECKPOINT_TYPE = 'checkpoint';

/** Moeda comum ou Moeda Pokébola (5 por fase). */
export type ItemKind = (typeof ITEM_TYPES)[keyof typeof ITEM_TYPES];

export interface Item {
  readonly kind: ItemKind;
  /** Área de coleta: o retângulo do objeto no Tiled. */
  readonly box: Box;
}

/** Ponto do meio da fase: tocado, a próxima tentativa começa nele. */
export interface Checkpoint {
  readonly box: Box;
  /** Pés do herói ao reaparecer: centro da base do retângulo. */
  readonly respawn: Point;
}

function isItemType(type: string): type is keyof typeof ITEM_TYPES {
  return Object.hasOwn(ITEM_TYPES, type);
}

function areaOf(o: LevelObject): Box {
  if (o.width <= 0 || o.height <= 0) {
    throw new Error(`Mapa inválido: "${o.type}" em (${o.x}, ${o.y}) precisa ser um retângulo`);
  }
  return { x: o.x, y: o.y, width: o.width, height: o.height };
}

/** Item a partir de um objeto do Tiled; null se o objeto não é item. */
export function parseItem(o: LevelObject): Item | null {
  return isItemType(o.type) ? { kind: ITEM_TYPES[o.type], box: areaOf(o) } : null;
}

/** Checkpoint a partir de um objeto do Tiled; null se o objeto não é checkpoint. */
export function parseCheckpoint(o: LevelObject): Checkpoint | null {
  return o.type === CHECKPOINT_TYPE ? { box: areaOf(o), respawn: objectFoot(o) } : null;
}
