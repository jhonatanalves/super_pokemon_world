import type { PhysicsConfig } from '../config/physics';
import { carriedBox, type Carried } from './carry';
import type { GameEvent } from './events';
import { checkExit, type LevelClear } from './goal';
import { heroBox, stepHeroBody, type HeroBody } from './heroBody';
import { NO_INPUT } from './heroMotion';
import type { Item } from './items';
import type { Form } from './powerups';
import { addCoins, addStars, loseLife, reachCheckpoint, type Session } from './session';
import { overlaps } from './tileCollision';
import type { World } from './worldState';

/**
 * Fim do passo da fase, separado de world.ts (F5a) para os dois arquivos ficarem pequenos:
 * moedas, Moedas Pokébola, checkpoint, morte e fim da fase; e o passo depois do fim.
 */

export interface ProgressStep {
  readonly items: readonly Item[];
  readonly pokeballs: number;
  readonly session: Session;
  readonly carry: Carried | null;
  readonly clear: LevelClear | null;
}

/** Soma uma moeda e avisa o HUD. */
export function gainCoins(session: Session, amount: number, events: GameEvent[]): Session {
  const next = addCoins(session, amount);
  events.push({ type: 'coin-collected', coins: next.coins, lives: next.lives });
  return next;
}

/**
 * Moedas e Moedas Pokébola tocadas, checkpoint e, por fim, a morte (perde uma vida) ou o fim
 * da fase: a fita soma as estrelas, a forma `form` vai para a próxima fase (F5b) e ela começa
 * sem checkpoint. Os eventos vão para `events`.
 */
export function stepProgress(
  world: World,
  hero: HeroBody,
  start: Session,
  form: Form,
  carry: Carried | null,
  events: GameEvent[],
  dt: number,
): ProgressStep {
  const box = heroBox(hero);
  let session = start;
  let pokeballs = world.pokeballs;
  const items = world.items.filter((item) => {
    if (!overlaps(box, item.box)) return true;
    if (item.kind === 'coin') session = gainCoins(session, 1, events);
    else {
      pokeballs++;
      events.push({ type: 'pokeball-collected', pokeballs });
    }
    return false;
  });
  if (world.checkpoint && !session.checkpoint && overlaps(box, world.checkpoint.box)) {
    session = reachCheckpoint(session);
    events.push({ type: 'checkpoint-reached' });
  }

  if (hero.motion.state === 'dead') {
    session = loseLife(session);
    events.push({ type: 'player-died', lives: session.lives });
    return { items, pokeballs, session, carry, clear: null };
  }
  const carriedKey = carry?.kind === 'key' ? carriedBox(carry) : null;
  const clear = checkExit(world, world.steps, box, carriedKey, dt);
  if (!clear) return { items, pokeballs, session, carry, clear };
  session = { ...addStars(session, clear.stars), checkpoint: false, form };
  const { exit, stars } = clear;
  events.push({ type: 'level-complete', exit, stars, totalStars: session.stars });
  return { items, pokeballs, session, carry: null, clear };
}

/**
 * Depois do fim: pela fita, o herói anda sozinho para a direita; pela fechadura, congela
 * junto com o resto, como no SMW.
 */
export function stepClear(world: World, clear: LevelClear, dt: number, p: PhysicsConfig): World {
  const hero =
    clear.exit === 'normal'
      ? stepHeroBody(world.hero, { ...NO_INPUT, right: true }, world.collision, dt, p)
      : world.hero;
  return { ...world, hero, clear: { ...clear, steps: clear.steps + 1 } };
}
