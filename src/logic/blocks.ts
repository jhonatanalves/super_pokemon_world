import { EFFECTS } from '../config/placeholder';
import type { ItemCatalog } from './creatures';
import { stepsFor } from './heroMotion';
import { tileAt, type Level, type LevelObject, type TileShape } from './level';
import type { Power } from './powerups';
import type { Box, Cell } from './tileCollision';

/** Tipo de cada bloco na camada de objetos do Tiled. */
export const BLOCK_TYPES = {
  'question-block': 'question',
  'brick-block': 'brick',
  'note-block': 'note',
  'hidden-block': 'hidden',
} as const;

/** `used` é o bloco ? (ou invisível) depois de soltar o conteúdo. */
export type BlockKind = (typeof BLOCK_TYPES)[keyof typeof BLOCK_TYPES] | 'used';

/** Valor de `content` para a moeda; os demais são tipos de item de creatures.json (F4). */
export const COIN_CONTENT = 'coin';

/** O que o bloco solta: uma moeda ou o efeito de um item (F4). */
export type BlockContent = typeof COIN_CONTENT | Power;

export interface Block extends Cell {
  readonly kind: BlockKind;
  readonly content: BlockContent | null;
  /** Passos que faltam da animação de batida (só visual). */
  readonly bumpSteps: number;
}

function isBlockType(type: string): type is keyof typeof BLOCK_TYPES {
  return Object.hasOwn(BLOCK_TYPES, type);
}

/**
 * Bloco a partir de um objeto do Tiled: retângulo de 1 tile alinhado à grade. Devolve null se
 * o objeto não é bloco. ? e invisível soltam `content`: "coin" (o padrão) ou o tipo de um item.
 */
export function parseBlock(
  o: LevelObject,
  tileSize: number,
  items: ItemCatalog = new Map(),
): Block | null {
  if (!isBlockType(o.type)) return null;
  const where = `Mapa inválido: bloco "${o.type}" em (${o.x}, ${o.y})`;
  const aligned = o.x % tileSize === 0 && o.y % tileSize === 0;
  if (o.width !== tileSize || o.height !== tileSize || !aligned) {
    throw new Error(`${where} precisa ser um retângulo de 1 tile alinhado à grade`);
  }
  const kind = BLOCK_TYPES[o.type];
  const raw = o.properties.get('content');
  let content: BlockContent | null = null;
  if (kind === 'question' || kind === 'hidden') {
    const value = raw ?? COIN_CONTENT;
    const item = typeof value === 'string' ? items.get(value) : undefined;
    if (value !== COIN_CONTENT && !item) {
      const known = [COIN_CONTENT, ...items.keys()].join(', ');
      throw new Error(`${where}: conteúdo "${String(value)}" desconhecido (${known})`);
    }
    content = item ? item.power : COIN_CONTENT;
  } else if (raw !== undefined) {
    throw new Error(`${where}: só o bloco ? e o invisível têm conteúdo`);
  }
  return { col: o.x / tileSize, row: o.y / tileSize, kind, content, bumpSteps: 0 };
}

export function blockShape(kind: BlockKind): TileShape {
  return kind === 'hidden' ? { kind: 'hidden' } : { kind: 'solid' };
}

/** Terreno com os blocos por cima. Um bloco precisa ficar num tile vazio do terreno. */
export function withBlocks(level: Level, blocks: readonly Block[]): Level {
  const terrain = level.terrain.map((row) => [...row]);
  for (const b of blocks) {
    if (tileAt(level, b.col, b.row).kind !== 'empty') {
      throw new Error(`Mapa inválido: bloco na linha ${b.row}, coluna ${b.col} sobre o terreno`);
    }
    terrain[b.row][b.col] = blockShape(b.kind);
  }
  return { ...level, terrain };
}

export function blockIndexAt(blocks: readonly Block[], cell: Cell): number {
  return blocks.findIndex((b) => b.col === cell.col && b.row === cell.row);
}

/**
 * Cabeçada por baixo. ? e invisível soltam o conteúdo e viram bloco usado; o tijolo quebra
 * com o herói grande (`block` null) e só balança com o pequeno; a nota só balança; o usado
 * não reage.
 */
export function hitBlock(
  block: Block,
  big: boolean,
): { block: Block | null; released: BlockContent | null } {
  if (block.kind === 'used') return { block, released: null };
  if (block.kind === 'brick' && big) return { block: null, released: null };
  const bump = stepsFor(EFFECTS.blockBumpTime);
  if (block.kind === 'question' || block.kind === 'hidden') {
    return {
      block: { ...block, kind: 'used', content: null, bumpSteps: bump },
      released: block.content,
    };
  }
  return { block: { ...block, bumpSteps: bump }, released: null };
}

/** O corpo (no chão) está em pé sobre um bloco nota. */
export function isOnNoteBlock(blocks: readonly Block[], box: Box, tileSize: number): boolean {
  const feet = box.y + box.height;
  if (feet % tileSize !== 0) return false;
  const row = feet / tileSize;
  return blocks.some(
    (b) =>
      b.kind === 'note' &&
      b.row === row &&
      b.col * tileSize < box.x + box.width &&
      box.x < (b.col + 1) * tileSize,
  );
}

/** Um passo das animações de batida. */
export function tickBlocks(blocks: readonly Block[]): readonly Block[] {
  return blocks.some((b) => b.bumpSteps > 0)
    ? blocks.map((b) => (b.bumpSteps > 0 ? { ...b, bumpSteps: b.bumpSteps - 1 } : b))
    : blocks;
}
