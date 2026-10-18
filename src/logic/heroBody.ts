import { GAME_CONFIG } from '../config/game';
import { FIXED_DT, PHYSICS, type PhysicsConfig } from '../config/physics';
import {
  createHeroMotion,
  killHero,
  NO_CONTACTS,
  stepHero,
  stepsFor,
  type HeroContacts,
  type HeroInput,
  type HeroMotion,
} from './heroMotion';
import type { Level, Point } from './level';
import { moveBody, type Box, type Cell } from './tileCollision';

/** O herói na fase: movimento (heroMotion), posição e contatos com o cenário. */
export interface HeroBody {
  readonly motion: HeroMotion;
  /** Canto superior esquerdo da caixa de colisão, em px. */
  readonly x: number;
  readonly y: number;
  /** Altura da caixa: a do pequeno ou a do grande (F4). A largura é sempre a mesma. */
  readonly height: number;
  readonly contacts: HeroContacts;
  /** Tile em que a cabeça bateu neste passo (para os blocos da F3); null se não bateu. */
  readonly bumped: Cell | null;
  /** Passos desde a morte; 0 enquanto vivo. */
  readonly deadSteps: number;
}

/** Tamanho do herói pequeno. */
export const HERO_SIZE = { width: GAME_CONFIG.heroWidth, height: GAME_CONFIG.heroHeight } as const;

/** Herói com os pés em `spawn` (centro, base). */
export function createHeroBody(spawn: Point, height: number = HERO_SIZE.height): HeroBody {
  return {
    motion: createHeroMotion(),
    x: spawn.x - HERO_SIZE.width / 2,
    y: spawn.y - height,
    height,
    contacts: NO_CONTACTS,
    bumped: null,
    deadSteps: 0,
  };
}

export function heroBox(body: HeroBody): Box {
  return { x: body.x, y: body.y, width: HERO_SIZE.width, height: body.height };
}

export function heroCenter(body: HeroBody): Point {
  return { x: body.x + HERO_SIZE.width / 2, y: body.y + body.height / 2 };
}

/** Muda a altura (crescer ou encolher) mantendo os pés no mesmo lugar. */
export function resizeHero(body: HeroBody, height: number): HeroBody {
  if (height === body.height) return body;
  return { ...body, y: body.y + body.height - height, height };
}

/**
 * Um passo fixo: a lógica define a velocidade a partir dos contatos do passo anterior,
 * o corpo anda pela grade de tiles e, se passar do limite de baixo da fase, morre.
 */
export function stepHeroBody(
  prev: HeroBody,
  input: HeroInput,
  level: Level,
  dt: number = FIXED_DT,
  p: PhysicsConfig = PHYSICS,
): HeroBody {
  if (prev.motion.state === 'dead') return { ...prev, deadSteps: prev.deadSteps + 1 };

  const motion = stepHero(prev.motion, input, prev.contacts, dt, p);
  const moved = moveBody(level, heroBox(prev), motion.vx * dt, motion.vy * dt, {
    grounded: prev.contacts.ground,
    stepUp: p.slopeStepUp,
    snap: p.groundSnap,
  });

  // Buraco: o corpo inteiro passou da borda de baixo da fase.
  if (moved.y > level.height) {
    return {
      motion: killHero(motion),
      x: moved.x,
      y: moved.y,
      height: prev.height,
      contacts: NO_CONTACTS,
      bumped: null,
      deadSteps: 0,
    };
  }
  return {
    motion,
    x: moved.x,
    y: moved.y,
    height: prev.height,
    contacts: moved.contacts,
    bumped: moved.ceilingCell,
    deadSteps: 0,
  };
}

/** Já passou o tempo de morte e a fase deve reiniciar. */
export function shouldRestart(
  body: HeroBody,
  dt: number = FIXED_DT,
  p: PhysicsConfig = PHYSICS,
): boolean {
  return body.motion.state === 'dead' && body.deadSteps >= stepsFor(p.deathRestartDelay, dt);
}
