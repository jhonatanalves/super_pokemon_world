import { tileAt, type Level } from './level';
import type { Box } from './tileCollision';

/**
 * Água (F4c). O tile de água não bloqueia nada: quem tem o centro dentro dela nada. Para quem
 * anda sobre a água (montaria aquática, Surfista), a superfície vira uma plataforma de mão única.
 */

export function isWaterAt(level: Level, x: number, y: number): boolean {
  const s = level.tileSize;
  return tileAt(level, Math.floor(x / s), Math.floor(y / s)).kind === 'water';
}

/** O corpo está nadando: o centro dele está na água. */
export function inWater(level: Level, box: Box): boolean {
  return isWaterAt(level, box.x + box.width / 2, box.y + box.height / 2);
}

/** Nadando com a cabeça fora d'água: o pulo daqui sai da água. */
export function atSurface(level: Level, box: Box): boolean {
  return inWater(level, box) && !isWaterAt(level, box.x + box.width / 2, box.y);
}

/** Em pé sobre a superfície da água (com a superfície valendo como chão). */
export function onWaterSurface(level: Level, box: Box): boolean {
  return isWaterAt(level, box.x + box.width / 2, box.y + box.height);
}

const floors = new WeakMap<Level, Level>();

/**
 * A mesma fase com a superfície da água como plataforma de mão única: o tile de água que não
 * tem água acima dele segura quem vem de cima. Por baixo, dá para subir nadando através dela.
 */
export function withWaterFloor(level: Level): Level {
  const cached = floors.get(level);
  if (cached) return cached;
  const terrain = level.terrain.map((row, r) =>
    row.map((tile, c) =>
      tile.kind === 'water' && tileAt(level, c, r - 1).kind !== 'water'
        ? ({ kind: 'oneWay' } as const)
        : tile,
    ),
  );
  const floor = { ...level, terrain };
  floors.set(level, floor);
  return floor;
}
