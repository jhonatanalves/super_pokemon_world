import { WORLD_MAP, type WorldMapConfig } from '../config/worldMap';
import { FIXED_DT } from '../config/physics';
import type { Point } from './level';
import {
  leavingDirection,
  pathCorners,
  pathsAt,
  type Direction,
  type WorldsData,
} from './worldMap';

/**
 * O herói andando no mapa-múndi (F5b), sem Phaser: escolher o caminho pela direção, andar
 * por ele até o outro nó e os pontos que desenham um caminho (também o que está aparecendo).
 */

/** Andando por um caminho: `forward` vai de `from` para `to`; `distance` em px. */
export interface Walk {
  readonly path: string;
  readonly forward: boolean;
  readonly distance: number;
}

/** O herói no mapa: parado num nó, ou saindo dele por um caminho. */
export interface Walker {
  readonly node: string;
  readonly walk: Walk | null;
}

/** Centro de uma célula da grade, em px. */
export function cellCenter(p: Point, c: WorldMapConfig = WORLD_MAP): Point {
  return { x: (p.x + 0.5) * c.cell, y: (p.y + 0.5) * c.cell };
}

/** Pontos do caminho em px, do nó `from` ao `to`. */
export function pathPixels(
  data: WorldsData,
  pathId: string,
  c: WorldMapConfig = WORLD_MAP,
): Point[] {
  const path = data.paths.get(pathId);
  if (!path) throw new Error(`caminho "${pathId}" não existe no mapa`);
  return pathCorners(data, path).map((p) => cellCenter(p, c));
}

export function polylineLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

/** Ponto a `distance` px do começo da linha (preso entre as pontas). */
export function pointAlong(points: readonly Point[], distance: number): Point {
  let left = Math.max(distance, 0);
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= length && length > 0) {
      const t = left / length;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    left -= length;
  }
  return points[points.length - 1];
}

/** Pontos a cada `spacing` px ao longo da linha, do começo até `upTo` px. */
export function pathDots(points: readonly Point[], spacing: number, upTo = Infinity): Point[] {
  const length = Math.min(polylineLength(points), upTo);
  const dots: Point[] = [];
  for (let d = 0; d <= length; d += spacing) dots.push(pointAlong(points, d));
  return dots;
}

/** Caminho aberto que sai do nó na direção apertada; null se não há. */
export function choosePath(
  data: WorldsData,
  open: ReadonlySet<string>,
  nodeId: string,
  dir: Direction,
): Walk | null {
  const path = pathsAt(data, nodeId).find(
    (p) => open.has(p.id) && leavingDirection(data, p, nodeId) === dir,
  );
  return path ? { path: path.id, forward: path.from === nodeId, distance: 0 } : null;
}

/** Pontos do caminho na ordem em que o herói anda nele. */
function walkPoints(data: WorldsData, walk: Walk, c: WorldMapConfig): Point[] {
  const points = pathPixels(data, walk.path, c);
  return walk.forward ? points : points.reverse();
}

/** Um passo: anda pelo caminho e, ao chegar ao fim, para no outro nó. */
export function stepWalker(
  walker: Walker,
  data: WorldsData,
  dt = FIXED_DT,
  c: WorldMapConfig = WORLD_MAP,
): Walker {
  const { walk } = walker;
  if (!walk) return walker;
  const distance = walk.distance + c.walkSpeed * dt;
  if (distance < polylineLength(walkPoints(data, walk, c))) {
    return { ...walker, walk: { ...walk, distance } };
  }
  const path = data.paths.get(walk.path);
  if (!path) throw new Error(`caminho "${walk.path}" não existe no mapa`);
  return { node: walk.forward ? path.to : path.from, walk: null };
}

/** Onde o herói está, em px. */
export function walkerPosition(
  walker: Walker,
  data: WorldsData,
  c: WorldMapConfig = WORLD_MAP,
): Point {
  if (walker.walk) return pointAlong(walkPoints(data, walker.walk, c), walker.walk.distance);
  const node = data.nodes.get(walker.node);
  if (!node) throw new Error(`nó "${walker.node}" não existe no mapa`);
  return cellCenter(node, c);
}

/**
 * Caminho recém-aberto aparecendo a partir do nó vencido `fromNode`: os pontos que já
 * apareceram depois de `steps` passos (passada a pausa `revealDelay`).
 */
export function revealedDots(
  data: WorldsData,
  pathId: string,
  fromNode: string,
  steps: number,
  dt = FIXED_DT,
  c: WorldMapConfig = WORLD_MAP,
): { dots: Point[]; done: boolean } {
  const path = data.paths.get(pathId);
  if (!path) throw new Error(`caminho "${pathId}" não existe no mapa`);
  const points = pathPixels(data, pathId, c);
  if (path.from !== fromNode) points.reverse();
  const shown = Math.max(steps * dt - c.revealDelay, 0) * c.revealSpeed;
  return {
    dots: pathDots(points, c.dotSpacing, shown),
    done: shown >= polylineLength(points),
  };
}
