import { GAME_CONFIG } from '../../src/config/game';
import {
  createHeroBody,
  heroCenter,
  HERO_SIZE,
  stepHeroBody,
  type HeroBody,
} from '../../src/logic/heroBody';
import type { HeroInput } from '../../src/logic/heroMotion';
import { EMPTY_TILE, type Level, type Point, type TileShape } from '../../src/logic/level';

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

/** Fase a partir de texto, uma string por linha de tiles. */
export function asciiLevel(lines: readonly string[]): Level {
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
    tilesetName: 'teste',
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
    return this.body.y + HERO_SIZE.height;
  }

  get centerX(): number {
    return heroCenter(this.body).x;
  }
}
