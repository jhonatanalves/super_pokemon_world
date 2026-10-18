import { GAME_CONFIG } from '../../src/config/game';
import { createHeroBody, heroCenter, stepHeroBody, type HeroBody } from '../../src/logic/heroBody';
import type { HeroInput } from '../../src/logic/heroMotion';
import {
  EMPTY_TILE,
  type Level,
  type LevelObject,
  type Point,
  type TileShape,
} from '../../src/logic/level';

const T = GAME_CONFIG.tileSize;
const HALF = T / 2;

const slope = (left: number, right: number): TileShape => ({ kind: 'slope', left, right });

/**
 * Caracteres das fases de teste: `S` marca o tile do início (pés na base dele).
 * Ladeiras de 45°: `/` sobe para a direita, `\` desce. De 22,5° (2 tiles por altura):
 * `a` + `b` sobem para a direita, `c` + `d` descem.
 */
const SHAPES: Readonly<Record<string, TileShape>> = {
  '.': EMPTY_TILE,
  S: EMPTY_TILE,
  '#': { kind: 'solid' },
  '=': { kind: 'oneWay' },
  '/': slope(0, T),
  '\\': slope(T, 0),
  a: slope(0, HALF),
  b: slope(HALF, T),
  c: slope(T, HALF),
  d: slope(HALF, 0),
};

/** Fase a partir de texto, uma string por linha de tiles, com objetos opcionais (F3). */
export function asciiLevel(lines: readonly string[], objects: readonly LevelObject[] = []): Level {
  const cols = lines[0].length;
  const spawns: Point[] = [];
  const terrain = lines.map((line, row) => {
    if (line.length !== cols) throw new Error(`linha ${row} com tamanho diferente`);
    return [...line].map((char, col) => {
      const shape = SHAPES[char];
      if (!shape) throw new Error(`caractere desconhecido "${char}"`);
      if (char === 'S') spawns.push({ x: (col + 0.5) * T, y: (row + 1) * T });
      return shape;
    });
  });
  if (spawns.length !== 1) throw new Error('a fase precisa de exatamente 1 "S"');
  const spawn = spawns[0];
  return {
    cols,
    rows: lines.length,
    tileSize: T,
    width: cols * T,
    height: lines.length * T,
    terrain,
    spawn,
    ruler: null,
    objects,
    tilesetName: 'teste',
  };
}

/**
 * Objeto do Tiled ocupando `cols` x `rows` tiles a partir de (col, row). Os inimigos nascem
 * com os pés no centro da base do retângulo.
 */
export function tileObject(
  type: string,
  col: number,
  row: number,
  properties: Record<string, unknown> = {},
  cols = 1,
  rows = 1,
): LevelObject {
  return {
    type,
    x: col * T,
    y: row * T,
    width: cols * T,
    height: rows * T,
    properties: new Map(Object.entries(properties)),
  };
}

/** Herói andando numa fase, passo a passo. */
export class LevelSim {
  body: HeroBody;

  constructor(readonly level: Level) {
    this.body = createHeroBody(level.spawn);
  }

  step(input: HeroInput): HeroBody {
    this.body = stepHeroBody(this.body, input, this.level);
    return this.body;
  }

  hold(input: HeroInput, steps: number): HeroBody[] {
    return Array.from({ length: steps }, () => this.step(input));
  }

  /** y dos pés. */
  get feet(): number {
    return this.body.y + this.body.height;
  }

  get centerX(): number {
    return heroCenter(this.body).x;
  }
}
