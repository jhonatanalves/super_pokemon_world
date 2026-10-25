import { GOAL, type GoalConfig } from '../config/goal';
import { FIXED_DT } from '../config/physics';
import { stepsFor } from './heroMotion';
import { objectFoot, type LevelObject, type Point } from './level';
import { overlaps, type Box } from './tileCollision';

/**
 * Fim de fase (F5a), sem Phaser: a fita com bônus de estrelas pela altura e a saída secreta
 * (chave levada até a fechadura). Quem anda o passo é o mundo (src/logic/world.ts).
 */

/** Tipos dos objetos do Tiled. */
export const EXIT_TYPES = { goal: 'goal', key: 'key', keyhole: 'keyhole' } as const;

/** Saída usada: a fita no fim da fase, ou a fechadura aberta com a chave. */
export type LevelExit = 'normal' | 'secret';

/** Objetos de saída de uma fase. A chave e a fechadura vêm juntas, ou nenhuma das duas. */
export interface LevelExits {
  /** Área da fita: postes nas bordas; a fita sobe e desce entre o topo e a base. */
  readonly goal: Box | null;
  /** Pés da chave (centro, base). */
  readonly key: Point | null;
  readonly keyhole: Box | null;
}

/** A fase acabou: o herói anda sozinho (ou fica parado, na secreta) até `clearSteps`. */
export interface LevelClear {
  readonly exit: LevelExit;
  readonly stars: number;
  /** Passos desde o fim. */
  readonly steps: number;
}

function fail(message: string): never {
  throw new Error(`Mapa inválido: ${message}`);
}

function area(o: LevelObject): Box {
  if (o.width <= 0 || o.height <= 0)
    fail(`"${o.type}" em (${o.x}, ${o.y}) precisa ser um retângulo`);
  return { x: o.x, y: o.y, width: o.width, height: o.height };
}

export function isExitObject(o: LevelObject): boolean {
  return Object.values(EXIT_TYPES).some((t) => t === o.type);
}

/** Lê fita, chave e fechadura dos objetos do Tiled; no máximo 1 de cada. */
export function parseExits(objects: readonly LevelObject[]): LevelExits {
  const of = (type: string): LevelObject | null => {
    const found = objects.filter((o) => o.type === type);
    if (found.length > 1) fail(`no máximo 1 "${type}"; tem ${found.length}`);
    return found[0] ?? null;
  };
  const goal = of(EXIT_TYPES.goal);
  const key = of(EXIT_TYPES.key);
  const keyhole = of(EXIT_TYPES.keyhole);
  if ((key === null) !== (keyhole === null)) fail('a chave e a fechadura precisam vir juntas');
  return {
    goal: goal && area(goal),
    key: key && objectFoot(key),
    keyhole: keyhole && area(keyhole),
  };
}

/** Distância que a fita percorre do topo à base. */
function tapeRange(goal: Box, c: GoalConfig): number {
  return Math.max(goal.height - c.tapeHeight, 0);
}

/** Altura (y do topo) da fita `steps` passos depois do começo: sai da base e vai e volta. */
export function tapeY(goal: Box, steps: number, dt = FIXED_DT, c: GoalConfig = GOAL): number {
  const range = tapeRange(goal, c);
  const bottom = goal.y + range;
  if (range === 0) return bottom;
  const d = (steps * dt * c.tapeSpeed) % (2 * range);
  return bottom - (d <= range ? d : 2 * range - d);
}

export function tapeBox(goal: Box, steps: number, dt = FIXED_DT, c: GoalConfig = GOAL): Box {
  return { x: goal.x, y: tapeY(goal, steps, dt, c), width: goal.width, height: c.tapeHeight };
}

/** Bônus de estrelas com a fita em `y`: 0 na base, `maxStars` no topo, proporcional entre eles. */
export function tapeStars(goal: Box, y: number, c: GoalConfig = GOAL): number {
  const range = tapeRange(goal, c);
  if (range === 0) return 0;
  const height = Math.min(Math.max(goal.y + range - y, 0), range);
  return Math.round((c.maxStars * height) / range);
}

/**
 * O herói chegou ao fim: tocar a fita dá as estrelas da altura dela; passar pela linha do
 * meio dos postes sem tocar dá 0. null se ainda não chegou.
 */
export function goalReached(
  goal: Box,
  steps: number,
  hero: Box,
  dt = FIXED_DT,
  c: GoalConfig = GOAL,
): number | null {
  const tape = tapeBox(goal, steps, dt, c);
  if (overlaps(hero, tape)) return tapeStars(goal, tape.y, c);
  return hero.x + hero.width / 2 >= goal.x + goal.width / 2 ? 0 : null;
}

/**
 * Fim da fase neste passo: a chave carregada (`key`) ou o herói encostando na fechadura abre
 * a saída secreta; senão, a fita. null se a fase continua.
 */
export function checkExit(
  exits: Pick<LevelExits, 'goal' | 'keyhole'>,
  steps: number,
  hero: Box,
  key: Box | null,
  dt = FIXED_DT,
  c: GoalConfig = GOAL,
): LevelClear | null {
  const { goal, keyhole } = exits;
  if (key && keyhole && (overlaps(key, keyhole) || overlaps(hero, keyhole))) {
    return { exit: 'secret', stars: 0, steps: 0 };
  }
  const stars = goal ? goalReached(goal, steps, hero, dt, c) : null;
  return stars === null ? null : { exit: 'normal', stars, steps: 0 };
}

/** Já passou o tempo do fim da fase. */
export function isClearDone(clear: LevelClear, dt = FIXED_DT, c: GoalConfig = GOAL): boolean {
  const time = clear.exit === 'normal' ? c.clearTime : c.secretClearTime;
  return clear.steps >= stepsFor(time, dt);
}
