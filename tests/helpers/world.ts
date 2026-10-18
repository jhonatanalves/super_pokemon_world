import creaturesJson from '../../src/content/creatures.json';
import { parseCreatures } from '../../src/logic/creatures';
import type { GameEvent } from '../../src/logic/events';
import type { HeroInput } from '../../src/logic/heroMotion';
import type { LevelObject } from '../../src/logic/level';
import { newSession, type Session } from '../../src/logic/session';
import { createWorld, stepWorld, type View, type World } from '../../src/logic/world';
import { asciiLevel } from './asciiLevel';

export const CREATURES = parseCreatures(creaturesJson);

/** Tela infinita: todo inimigo acorda no primeiro passo. */
export const EVERYWHERE: View = { left: -Infinity, right: Infinity };

/** World a partir de uma fase em texto; falha se algum objeto der erro. */
export function makeWorld(
  lines: readonly string[],
  objects: readonly LevelObject[] = [],
  session: Session = newSession(),
): World {
  const built = createWorld(asciiLevel(lines, objects), CREATURES, session);
  if (built.errors.length > 0) throw new Error(built.errors.join('\n'));
  return built.world;
}

/** Fase andando passo a passo, guardando todos os eventos emitidos. */
export class WorldSim {
  readonly events: GameEvent[] = [];

  constructor(
    public world: World,
    private readonly view: View = EVERYWHERE,
  ) {}

  step(input: HeroInput): World {
    const result = stepWorld(this.world, input, this.view);
    this.world = result.world;
    this.events.push(...result.events);
    return this.world;
  }

  hold(input: HeroInput, steps: number): World[] {
    return Array.from({ length: steps }, () => this.step(input));
  }

  /** Repete `input` até `done` ou até `max` passos; devolve se chegou. */
  until(input: HeroInput, done: (w: World) => boolean, max: number): boolean {
    for (let i = 0; i < max; i++) {
      if (done(this.step(input))) return true;
    }
    return false;
  }

  /** Coloca o herói com o canto superior esquerdo em (x, y), mantendo o resto. */
  placeHero(x: number, y: number): void {
    this.world = { ...this.world, hero: { ...this.world.hero, x, y } };
  }

  eventsOf<T extends GameEvent['type']>(type: T): Extract<GameEvent, { type: T }>[] {
    return this.events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
  }
}
