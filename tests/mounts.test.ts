import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { MOUNTS } from '../src/config/mounts';
import { PHYSICS } from '../src/config/physics';
import { canTransition } from '../src/systems/StateMachine';
import { MOUNT_TRANSITIONS, riderPhysics, type Mount } from '../src/entities/mounts/Mount';
import { resizeHero } from '../src/logic/heroBody';
import { NO_INPUT, stepsFor, type HeroInput } from '../src/logic/heroMotion';
import type { LevelObject } from '../src/logic/level';
import { heroHeightFor, type Form } from '../src/logic/powerups';
import type { View, World } from '../src/logic/world';
import { tileObject } from './helpers/asciiLevel';
import { makeWorld, WorldSim } from './helpers/world';

const T = GAME_CONFIG.tileSize;
const RIGHT: HeroInput = { ...NO_INPUT, right: true };
const JUMP: HeroInput = { ...NO_INPUT, jump: true };
const ATTACK: HeroInput = { ...NO_INPUT, run: true };
const SCREEN: View = { left: 0, right: GAME_CONFIG.width };

const FIELD = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  'S...............................',
  '################################',
];

// Piscina com a superfície em y = 48 (linha 3); a montaria aquática boia nela.
const POOL = [
  'S...........................',
  '............................',
  '............................',
  '##~~~~~~~~~~~~~~~~~~~~~~~~##',
  '##~~~~~~~~~~~~~~~~~~~~~~~~##',
  '############################',
];

const ridden = (w: World): Mount | undefined => w.mounts.find((m) => m.state === 'ridden');

/** Fase com o herói caindo em cima da montaria; anda até montar. */
function mountedSim(
  lines: readonly string[],
  mount: LevelObject,
  others: LevelObject[] = [],
  view?: View,
  form: Form = 'small',
): WorldSim {
  const world = makeWorld(lines, [mount, ...others]);
  const sim = new WorldSim(
    { ...world, power: { form, starSteps: 0 }, hero: resizeHero(world.hero, heroHeightFor(form)) },
    view,
  );
  sim.step(NO_INPUT);
  const m = sim.world.mounts[0];
  sim.placeHero(m.x, m.y - 2 * T);
  if (!sim.until(NO_INPUT, (w) => ridden(w) !== undefined, stepsFor(2))) {
    throw new Error('o herói não montou');
  }
  sim.until(NO_INPUT, (w) => w.hero.contacts.ground, stepsFor(1));
  return sim;
}

/** Aperta um botão uma vez (solta antes, para o aperto contar). */
function press(sim: WorldSim, input: HeroInput): void {
  sim.step(NO_INPUT);
  sim.step(input);
}

describe('montar', () => {
  it('cair em cima da montaria monta: a caixa passa a ser a do herói montado', () => {
    const sim = mountedSim(FIELD, tileObject('rapidash', 6, 5));
    const m = ridden(sim.world)!;
    expect(sim.world.hero.height).toBe(MOUNTS.riderHeight);
    expect(sim.world.hero.y + sim.world.hero.height).toBe(m.y + m.height);
    expect(sim.world.hero.y + sim.world.hero.height).toBe(6 * T);
  });

  it('encostar de lado não monta', () => {
    const sim = new WorldSim(makeWorld(FIELD, [tileObject('rapidash', 4, 5)]));
    sim.hold(RIGHT, stepsFor(2));
    expect(ridden(sim.world)).toBeUndefined();
  });

  it('a máquina de estados da montaria recusa voltar da fuga', () => {
    expect(canTransition(MOUNT_TRANSITIONS, 'flee', 'wait')).toBe(false);
    expect(canTransition(MOUNT_TRANSITIONS, 'wait', 'flee')).toBe(false);
    expect(canTransition(MOUNT_TRANSITIONS, 'ridden', 'flee')).toBe(true);
  });
});

describe('F4-A10: herói montado', () => {
  it('a montaria segue o herói', () => {
    const sim = mountedSim(FIELD, tileObject('rapidash', 3, 5));
    sim.hold(RIGHT, stepsFor(1));
    const m = ridden(sim.world)!;
    expect(m.x).toBe(sim.world.hero.x);
    expect(m.y + m.height).toBe(sim.world.hero.y + sim.world.hero.height);
    expect(m.x).toBeGreaterThan(3 * T);
  });

  it('o pulo no ar usa o pulo extra da montaria, uma vez por pulo', () => {
    const sim = mountedSim(FIELD, tileObject('rapidash', 3, 5));
    press(sim, JUMP);
    sim.until(JUMP, (w) => w.hero.motion.vy > -100, stepsFor(1));
    press(sim, JUMP);
    expect(sim.world.hero.motion.vy).toBe(-MOUNTS.airJumpImpulse);
    expect(sim.world.airJumps).toBe(0);
    // Sem pulos sobrando, outro aperto no ar não faz nada.
    sim.until(JUMP, (w) => w.hero.motion.vy > 0, stepsFor(1));
    press(sim, JUMP);
    expect(sim.world.hero.motion.vy).toBeGreaterThan(0);
    // Ao pousar, o pulo extra volta.
    sim.until(NO_INPUT, (w) => w.hero.contacts.ground, stepsFor(2));
    sim.step(NO_INPUT);
    expect(sim.world.airJumps).toBe(MOUNTS.airJumps);
  });

  it('a de terra corre mais e pula mais alto', () => {
    const land = riderPhysics('land', false, PHYSICS);
    expect(land.walkSpeed).toBe(PHYSICS.walkSpeed * MOUNTS.land.landSpeed);
    expect(land.jumpImpulse).toBe(MOUNTS.land.jumpImpulse);
    const sim = mountedSim(FIELD, tileObject('rapidash', 3, 5));
    const vx = sim.hold(RIGHT, stepsFor(1)).map((w) => w.hero.motion.vx);
    expect(Math.max(...vx)).toBe(PHYSICS.walkSpeed * MOUNTS.land.landSpeed);
  });

  it('a aquática anda devagar na terra e mais rápido sobre a água', () => {
    const water = riderPhysics('water', true, PHYSICS);
    const land = riderPhysics('water', false, PHYSICS);
    expect(water.walkSpeed).toBeGreaterThan(PHYSICS.walkSpeed);
    expect(land.walkSpeed).toBeLessThan(PHYSICS.walkSpeed);
  });

  it('montado, o baixo não agacha e o botão de ataque não solta faísca', () => {
    const sim = mountedSim(FIELD, tileObject('rapidash', 3, 5), [], undefined, 'electric');
    sim.hold({ ...NO_INPUT, down: true }, 10);
    expect(sim.world.hero.motion.state).not.toBe('crouch');
    press(sim, ATTACK);
    expect(sim.world.sparks).toHaveLength(0);
  });
});

describe('engolir', () => {
  it('a de terra engole o inimigo à frente e ganha mais um pulo no ar', () => {
    const sim = mountedSim(FIELD, tileObject('rapidash', 3, 5), [tileObject('rattata', 6, 5)]);
    sim.until(
      NO_INPUT,
      (w) => w.enemies[0].x < ridden(w)!.x + T + MOUNTS.tongueReach - 4,
      stepsFor(3),
    );
    sim.world = {
      ...sim.world,
      hero: { ...sim.world.hero, motion: { ...sim.world.hero.motion, facing: 1 } },
    };
    press(sim, ATTACK);
    expect(sim.world.enemies).toHaveLength(0);
    expect(ridden(sim.world)!.bonusJumps).toBe(1);
    // Dois pulos no ar: o normal e o ganho.
    press(sim, JUMP);
    sim.until(JUMP, (w) => w.hero.motion.vy > -100, stepsFor(1));
    press(sim, JUMP);
    sim.until(JUMP, (w) => w.hero.motion.vy > -100, stepsFor(1));
    press(sim, JUMP);
    expect(sim.world.hero.motion.vy).toBe(-MOUNTS.airJumpImpulse);
    expect(ridden(sim.world)!.bonusJumps).toBe(0);
  });

  it('a aquática guarda o inimigo e o cospe no aperto seguinte; o cuspe derrota outro', () => {
    const objects = [tileObject('rattata', 6, 5), tileObject('rattata', 20, 5)];
    const sim = mountedSim(FIELD, tileObject('lapras', 3, 5), objects);
    sim.until(
      NO_INPUT,
      (w) => w.enemies[0].x < ridden(w)!.x + T + MOUNTS.tongueReach - 4,
      stepsFor(3),
    );
    sim.world = {
      ...sim.world,
      hero: { ...sim.world.hero, motion: { ...sim.world.hero.motion, facing: 1 } },
    };
    press(sim, ATTACK);
    expect(sim.world.enemies).toHaveLength(1);
    expect(ridden(sim.world)!.stomach).toBe(true);
    press(sim, ATTACK);
    expect(sim.world.shots).toHaveLength(1);
    expect(ridden(sim.world)!.stomach).toBe(false);
    expect(sim.until(NO_INPUT, (w) => w.enemies[0]?.state === 'dead', stepsFor(3))).toBe(true);
    expect(sim.world.shots).toHaveLength(0);
  });

  it('não engole o que cai do teto', () => {
    const sim = mountedSim(FIELD, tileObject('rapidash', 3, 5), [tileObject('geodude', 5, 5)]);
    press(sim, ATTACK);
    expect(sim.world.enemies).toHaveLength(1);
  });
});

describe('F4-A11: dano montado', () => {
  it('o herói desmonta sem perder nada; a montaria foge e some', () => {
    const sim = mountedSim(
      FIELD,
      tileObject('rapidash', 3, 5),
      [tileObject('rattata', 9, 5)],
      SCREEN,
      'big',
    );
    sim.world = {
      ...sim.world,
      hero: { ...sim.world.hero, motion: { ...sim.world.hero.motion, facing: 1 } },
    };
    expect(sim.until(NO_INPUT, (w) => !ridden(w), stepsFor(3))).toBe(true);
    expect(sim.eventsOf('player-damaged')).toHaveLength(1);
    expect(sim.world.power.form).toBe('big');
    expect(sim.world.hero.height).toBe(heroHeightFor('big'));
    expect(sim.world.hero.motion.state).not.toBe('dead');
    expect(sim.world.mounts[0].state).toBe('flee');
    expect(sim.until(NO_INPUT, (w) => w.mounts.length === 0, stepsFor(4))).toBe(true);
  });

  it('dano no ar: a montaria cai até o chão enquanto foge, em vez de fugir voando', () => {
    // Depois de montar, o Zubat é posto acima do herói: ele pula e bate nele por baixo.
    const sim = mountedSim(
      FIELD,
      tileObject('rapidash', 3, 5),
      [tileObject('zubat', 25, 2)],
      SCREEN,
    );
    const x = sim.world.hero.x;
    sim.world = {
      ...sim.world,
      enemies: sim.world.enemies.map((e) =>
        e.behavior === 'flyer' ? { ...e, active: true, x, homeX: x, offset: 0 } : e,
      ),
    };
    press(sim, JUMP);
    expect(sim.until(JUMP, (w) => !ridden(w), stepsFor(2))).toBe(true);
    const fled = sim.world.mounts[0];
    expect(fled.state).toBe('flee');
    expect(fled.y + fled.height).toBeLessThan(6 * T);
    // Cai até o chão (y = 96) enquanto corre para o lado.
    expect(
      sim.until(NO_INPUT, (w) => (w.mounts[0]?.y ?? 0) + MOUNTS.height === 6 * T, stepsFor(1)),
    ).toBe(true);
    expect(sim.world.mounts[0].x).not.toBe(fled.x);
  });

  it('a pé, o mesmo toque volta a fazer o herói perder o power-up', () => {
    const sim = new WorldSim(makeWorld(FIELD, [tileObject('rattata', 6, 5)]));
    sim.world = {
      ...sim.world,
      power: { form: 'big', starSteps: 0 },
      hero: resizeHero(sim.world.hero, heroHeightFor('big')),
    };
    expect(sim.until(RIGHT, (w) => w.power.form === 'small', stepsFor(3))).toBe(true);
  });
});

describe('F4-A12: Lapras na água', () => {
  it('o herói montado boia na superfície e não afunda', () => {
    const sim = mountedSim(POOL, tileObject('lapras', 5, 2));
    const surface = 3 * T;
    expect(ridden(sim.world)!.kind).toBe('water');
    const feet = sim.hold(RIGHT, stepsFor(3)).map((w) => w.hero.y + w.hero.height);
    expect(feet.every((y) => y === surface)).toBe(true);
    expect(sim.world.hero.motion.state).not.toBe('swim');
    expect(sim.world.hero.x).toBeGreaterThan(5 * T);
  });

  it('esperando, a aquática boia; a de terra afunda', () => {
    const sim = new WorldSim(
      makeWorld(POOL, [tileObject('lapras', 5, 2), tileObject('rapidash', 12, 2)]),
    );
    sim.hold(NO_INPUT, stepsFor(2));
    const [water, land] = sim.world.mounts;
    expect(water.y + water.height).toBe(3 * T);
    expect(land.y + land.height).toBe(5 * T);
  });
});

describe('desmontar', () => {
  it('baixo + pulo: o herói sai por cima e a montaria fica esperando', () => {
    const sim = mountedSim(FIELD, tileObject('rapidash', 3, 5));
    press(sim, { ...NO_INPUT, down: true, jump: true });
    expect(ridden(sim.world)).toBeUndefined();
    const m = sim.world.mounts[0];
    expect(m.state).toBe('wait');
    expect(sim.world.hero.height).toBe(heroHeightFor('small'));
    expect(sim.world.hero.y + sim.world.hero.height).toBeLessThanOrEqual(m.y);
    expect(sim.world.hero.motion.vy).toBeLessThan(0);
  });

  it('logo depois de desmontar não monta de novo; passado o tempo, monta', () => {
    const sim = mountedSim(FIELD, tileObject('rapidash', 3, 5));
    press(sim, { ...NO_INPUT, down: true, jump: true });
    const m = sim.world.mounts[0];
    expect(m.graceSteps).toBe(stepsFor(MOUNTS.remountDelay));
    // Cai de volta durante a espera: atravessa a montaria e para no chão, sem montar.
    sim.until(NO_INPUT, (w) => w.hero.contacts.ground, stepsFor(2));
    expect(ridden(sim.world)).toBeUndefined();
    // Passada a espera, um pulo no lugar cai em cima dela e monta.
    sim.hold(NO_INPUT, stepsFor(MOUNTS.remountDelay));
    expect(sim.world.mounts[0].graceSteps).toBe(0);
    press(sim, JUMP);
    expect(sim.until(JUMP, (w) => ridden(w) !== undefined, stepsFor(2))).toBe(true);
  });
});
