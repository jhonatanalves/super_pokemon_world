import type { Behavior, Creatures } from '../logic/creatures';
import { objectFoot, type LevelObject, type Point } from '../logic/level';
import { createDropper } from './enemies/DropperEnemy';
import type { Enemy } from './enemies/Enemy';
import { createFlyer } from './enemies/FlyerEnemy';
import { createPiper } from './enemies/PiperEnemy';
import { createShell } from './enemies/ShellEnemy';
import { createWalker } from './enemies/WalkerEnemy';

/** Cria a classe de cada comportamento; o objeto nasce com os pés no centro da base do retângulo. */
const CONSTRUCTORS: {
  readonly [B in Behavior]: (id: number, creature: string, foot: Point) => Enemy;
} = {
  walker: createWalker,
  shell: createShell,
  flyer: createFlyer,
  piper: createPiper,
  dropper: createDropper,
};

export type SpawnResult =
  { readonly ok: true; readonly enemy: Enemy } | { readonly ok: false; readonly error: string };

/**
 * Fábrica de entidades: o `type` do objeto no Tiled é procurado em creatures.json, que diz
 * o comportamento (ex.: "walker" → WalkerEnemy). Um tipo desconhecido
 * vira um erro claro, e não uma exceção: a fase segue sem aquele objeto.
 */
export function createEnemy(object: LevelObject, id: number, creatures: Creatures): SpawnResult {
  const creature = creatures.get(object.type);
  if (!creature) {
    return {
      ok: false,
      error: `Objeto de tipo desconhecido "${object.type}" em (${object.x}, ${object.y}): não está em creatures.json`,
    };
  }
  return { ok: true, enemy: CONSTRUCTORS[creature.behavior](id, object.type, objectFoot(object)) };
}
