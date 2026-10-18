import { EFFECTS } from '../config/placeholder';
import { stepsFor } from './heroMotion';
import { tileAt, type Level, type LevelObject, type TileShape } from './level';
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

/** O que o bloco solta. Na F3 só moeda; os power-ups entram na F4. */
export const BLOCK_CONTENTS = ['coin'] as const;
export type BlockContent = (typeof BLOCK_CONTENTS)[number];

export interface Block extends Cell {
  readonly kind: BlockKind;
  readonly content: BlockContent | null;
  /** Passos que faltam da animação de batida (só visual). */
  readonly bumpSteps: number;
}

function isBlockType(type: string): type is keyof typeof BLOCK_TYPES {
  return Object.hasOwn(BLOCK_TYPES, type);
}

function isContent(value: unknown): value is BlockContent {
  return BLOCK_CONTENTS.some((c) => c === value);
}

/**
 * Bloco a partir de um objeto do Tiled: retângulo de 1 tile alinhado à grade. Devolve null se
 * o objeto não é bloco. ? e invisível soltam `content` (padrão: moeda).
 */
export function parseBlock(o: LevelObject, tileSize: number): Block | null {
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
    const value = raw ?? 'coin';
    if (!isContent(value)) {
      throw new Error(`${where}: conteúdo "${String(value)}" desconhecido (${BLOCK_CONTENTS})`);
    }
    content = value;
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
 * Cabeçada por baixo. ? e invisível soltam o conteúdo e viram bloco usado; tijolo e nota só
 * balançam (o tijolo quebra só com o herói grande, na F4); o usado não reage.
 */
export function hitBlock(block: Block): { block: Block; released: BlockContent | null } {
  if (block.kind === 'used') return { block, released: null };
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
