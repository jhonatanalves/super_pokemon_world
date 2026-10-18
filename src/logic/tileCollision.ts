import { tileAt, type Level, type TileShape } from './level';

/** Caixa de colisão; (x, y) é o canto superior esquerdo. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** As duas caixas se sobrepõem (encostar na borda não conta). */
export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Posição de um tile na grade. */
export interface Cell {
  readonly col: number;
  readonly row: number;
}

/** Lados em que o cenário bloqueou o corpo no último passo. */
export interface TileContacts {
  readonly ground: boolean;
  readonly ceiling: boolean;
  readonly wallLeft: boolean;
  readonly wallRight: boolean;
  /**
   * Inclinação do piso sob o corpo: quanto ele sobe (px) por px andado para a direita.
   * 0 no plano; 1 numa ladeira de 45° subindo para a direita; -0,5 numa de 22,5° descendo.
   */
  readonly groundSlope: number;
}

export const NO_TILE_CONTACTS: TileContacts = {
  ground: false,
  ceiling: false,
  wallLeft: false,
  wallRight: false,
  groundSlope: 0,
};

export interface MoveOptions {
  /** O corpo estava no chão no passo anterior: pode subir ladeiras e grudar na descida. */
  readonly grounded: boolean;
  /** Quanto o piso pode subir num passo sem virar parede (px). */
  readonly stepUp: number;
  /** Quanto o corpo no chão desce para continuar grudado no piso (px). */
  readonly snap: number;
}

export interface MoveResult {
  readonly x: number;
  readonly y: number;
  readonly contacts: TileContacts;
  /** Tile em que a cabeça bateu ao subir (o de maior sobreposição com o corpo); null se não bateu. */
  readonly ceilingCell: Cell | null;
}

type Side = 'left' | 'right' | 'top' | 'bottom';

const OPPOSITE: { readonly [S in Side]: Side } = {
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top',
};

const NEIGHBOR: { readonly [S in Side]: readonly [number, number] } = {
  left: [-1, 0],
  right: [1, 0],
  top: [0, -1],
  bottom: [0, 1],
};

/** Tolerância de ponto flutuante nas comparações de borda (px). Não é ajuste de jogo. */
const EPSILON = 1e-6;

/** A borda do tile neste lado é toda preenchida? */
function fullEdge(tile: TileShape, side: Side, tileSize: number): boolean {
  switch (tile.kind) {
    case 'solid':
      return true;
    case 'slope':
      return (
        side === 'bottom' ||
        (side === 'left' && tile.left === tileSize) ||
        (side === 'right' && tile.right === tileSize)
      );
    default:
      return false;
  }
}

/**
 * A face de um tile pode bloquear se o vizinho daquele lado não a cobre. Assim a emenda
 * entre uma ladeira e o bloco ao lado, ou o enchimento sob a ladeira, não vira parede.
 */
export function isExposedFace(level: Level, col: number, row: number, side: Side): boolean {
  const [dc, dr] = NEIGHBOR[side];
  return !fullEdge(tileAt(level, col + dc, row + dr), OPPOSITE[side], level.tileSize);
}

/** Altura (y) do piso de uma ladeira em `x`, no mundo. */
export function slopeSurface(
  tile: Extract<TileShape, { kind: 'slope' }>,
  col: number,
  row: number,
  x: number,
  tileSize: number,
): number {
  const local = Math.min(Math.max(x - col * tileSize, 0), tileSize);
  return (row + 1) * tileSize - (tile.left + ((tile.right - tile.left) * local) / tileSize);
}

/** Primeira e última linha (ou coluna) de tiles que o intervalo [start, start + length) ocupa. */
function tileSpan(start: number, length: number, tileSize: number): [number, number] {
  return [Math.floor(start / tileSize), Math.floor((start + length - EPSILON) / tileSize)];
}

/** Move na horizontal e para na primeira parede (face lateral exposta de um bloco sólido). */
function moveX(level: Level, box: Box, dx: number): { x: number; left: boolean; right: boolean } {
  const s = level.tileSize;
  const [rowTop, rowBottom] = tileSpan(box.y, box.height, s);
  const blocks = (col: number, side: Side): boolean => {
    for (let row = rowTop; row <= rowBottom; row++) {
      if (tileAt(level, col, row).kind === 'solid' && isExposedFace(level, col, row, side)) {
        return true;
      }
    }
    return false;
  };

  let x = box.x + dx;
  let left = false;
  let right = false;
  if (dx > 0) {
    const first = Math.floor((box.x + box.width - EPSILON) / s) + 1;
    const last = Math.floor((x + box.width - EPSILON) / s);
    for (let col = first; col <= last; col++) {
      if (blocks(col, 'left')) {
        x = col * s - box.width;
        right = true;
        break;
      }
    }
  } else if (dx < 0) {
    const first = Math.floor((box.x + EPSILON) / s) - 1;
    const last = Math.floor(x / s);
    for (let col = first; col >= last; col--) {
      if (blocks(col, 'right')) {
        x = (col + 1) * s;
        left = true;
        break;
      }
    }
  }

  // Bordas laterais da fase.
  if (x < 0) {
    x = 0;
    left = true;
  } else if (x + box.width > level.width) {
    x = level.width - box.width;
    right = true;
  }
  return { x, left, right };
}

/**
 * Subindo: para no primeiro teto (face de baixo exposta de um bloco, ladeira ou bloco
 * invisível) e diz em qual tile bateu.
 */
function moveUp(level: Level, box: Box, dy: number): { y: number; cell: Cell | null } {
  const s = level.tileSize;
  const [colLeft, colRight] = tileSpan(box.x, box.width, s);
  const newTop = box.y + dy;
  // Só linhas inteiras acima do topo atual: a face de baixo delas fica em y ≤ topo.
  for (let row = Math.floor((box.y + EPSILON) / s) - 1; row >= Math.floor(newTop / s); row--) {
    let hit: Cell | null = null;
    let hitOverlap = 0;
    for (let col = colLeft; col <= colRight; col++) {
      const kind = tileAt(level, col, row).kind;
      const hard = kind === 'solid' || kind === 'slope' || kind === 'hidden';
      if (!hard || !isExposedFace(level, col, row, 'bottom')) continue;
      const overlap = Math.min(box.x + box.width, (col + 1) * s) - Math.max(box.x, col * s);
      if (!hit || overlap > hitOverlap) {
        hit = { col, row };
        hitOverlap = overlap;
      }
    }
    if (hit) return { y: (row + 1) * s, cell: hit };
  }
  return { y: newTop, cell: null };
}

interface Ground {
  readonly surface: number;
  readonly slope: number;
}

/** Faixa vertical (y) em que se procura o piso. */
interface Range {
  readonly from: number;
  readonly to: number;
}

function inRange(y: number, range: Range): boolean {
  return y >= range.from - EPSILON && y <= range.to + EPSILON;
}

/**
 * Piso mais alto dentro da faixa. Ladeiras contam só sob o centro do corpo, para ele
 * subir e descer suave; blocos e plataformas contam sob a largura toda.
 */
function findGround(
  level: Level,
  left: number,
  width: number,
  slopes: Range,
  flats: Range,
): Ground | null {
  const s = level.tileSize;
  const centerX = left + width / 2;
  const centerCol = Math.floor(centerX / s);

  let best: Ground | null = null;
  for (let row = Math.floor(slopes.from / s); row <= Math.floor(slopes.to / s); row++) {
    const tile = tileAt(level, centerCol, row);
    if (tile.kind !== 'slope') continue;
    const surface = slopeSurface(tile, centerCol, row, centerX, s);
    if (inRange(surface, slopes) && (!best || surface < best.surface)) {
      best = { surface, slope: (tile.right - tile.left) / s };
    }
  }
  if (best) return best;

  const [colLeft, colRight] = tileSpan(left, width, s);
  for (let row = Math.floor(flats.from / s); row <= Math.floor(flats.to / s); row++) {
    const top = row * s;
    if (!inRange(top, flats)) continue;
    for (let col = colLeft; col <= colRight; col++) {
      const tile = tileAt(level, col, row);
      const floor =
        tile.kind === 'oneWay' || (tile.kind === 'solid' && isExposedFace(level, col, row, 'top'));
      if (floor) return { surface: top, slope: 0 };
    }
  }
  return null;
}

/**
 * Move o corpo (dx, dy) pela grade de tiles: primeiro na horizontal, depois na vertical.
 * Plataformas de mão única só seguram quem vem de cima; ladeiras não são parede.
 */
export function moveBody(
  level: Level,
  box: Box,
  dx: number,
  dy: number,
  options: MoveOptions,
): MoveResult {
  const h = moveX(level, box, dx);
  const base = { wallLeft: h.left, wallRight: h.right };

  if (dy < 0) {
    const v = moveUp(level, { ...box, x: h.x }, dy);
    return {
      x: h.x,
      y: v.y,
      contacts: { ...NO_TILE_CONTACTS, ...base, ceiling: v.cell !== null },
      ceilingCell: v.cell,
    };
  }

  const bottom = box.y + box.height;
  const to = bottom + dy + (options.grounded ? options.snap : 0);
  // A ladeira sobe sob o centro ao andar, mesmo no ar: a tolerância vale sempre,
  // senão quem cai andando sobre uma ladeira que sobe a atravessaria.
  const slopes = { from: bottom - options.stepUp, to };
  // Blocos e plataformas só seguram quem já estava acima do topo deles.
  const flats = { from: bottom - (options.grounded ? options.stepUp : 0), to };
  const ground = findGround(level, h.x, box.width, slopes, flats);
  if (!ground) {
    return {
      x: h.x,
      y: box.y + dy,
      contacts: { ...NO_TILE_CONTACTS, ...base },
      ceilingCell: null,
    };
  }
  return {
    x: h.x,
    y: ground.surface - box.height,
    contacts: { ...NO_TILE_CONTACTS, ...base, ground: true, groundSlope: ground.slope },
    ceilingCell: null,
  };
}
