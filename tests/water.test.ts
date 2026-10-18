import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { PHYSICS } from '../src/config/physics';
import { POWERUPS } from '../src/config/powerups';
import { heroBox, resizeHero } from '../src/logic/heroBody';
import { NO_INPUT, stepsFor, type HeroInput } from '../src/logic/heroMotion';
import { heroHeightFor, type Form } from '../src/logic/powerups';
import { atSurface, inWater, onWaterSurface, withWaterFloor } from '../src/logic/water';
import { asciiLevel } from './helpers/asciiLevel';
import { makeWorld, WorldSim } from './helpers/world';

const T = GAME_CONFIG.tileSize;
const RIGHT: HeroInput = { ...NO_INPUT, right: true };
const JUMP: HeroInput = { ...NO_INPUT, jump: true };

// Piscina de 4 tiles de fundo: superfície em y = 32 (linha 2), fundo em y = 96.
const POOL = [
  'S...........',
  '............',
  '~~~~~~~~~~~~',
  '~~~~~~~~~~~~',
  '~~~~~~~~~~~~',
  '~~~~~~~~~~~~',
  '############',
];

function inForm(sim: WorldSim, form: Form): void {
  const w = sim.world;
  sim.world = {
    ...w,
    power: { form, starSteps: 0 },
    hero: resizeHero(w.hero, heroHeightFor(form)),
  };
}

/** Aperta o pulo uma vez (solta antes, para o aperto contar). */
function press(sim: WorldSim, input: HeroInput = JUMP): void {
  sim.step(NO_INPUT);
  sim.step(input);
}

describe('tile de água', () => {
  it('não bloqueia nada; o corpo com o centro nela está nadando', () => {
    const level = asciiLevel(POOL);
    const box = { x: 0, y: 3 * T, width: T, height: T };
    expect(inWater(level, box)).toBe(true);
    expect(inWater(level, { ...box, y: 0 })).toBe(false);
    // Cabeça acima da superfície, centro dentro: na superfície.
    expect(atSurface(level, { ...box, y: 2 * T - 4 })).toBe(true);
    expect(atSurface(level, box)).toBe(false);
  });

  it('com a superfície como chão, só a linha de cima da água vira plataforma', () => {
    const floor = withWaterFloor(asciiLevel(POOL));
    expect(floor.terrain[2][0].kind).toBe('oneWay');
    expect(floor.terrain[3][0].kind).toBe('water');
    expect(onWaterSurface(floor, { x: 0, y: T, width: T, height: T })).toBe(false);
    expect(onWaterSurface(asciiLevel(POOL), { x: 0, y: T, width: T, height: T })).toBe(true);
  });
});

describe('natação básica', () => {
  it('quem cai na água nada: afunda devagar, no máximo swimMaxFall, e chega ao fundo vivo', () => {
    const sim = new WorldSim(makeWorld(POOL));
    expect(sim.until(NO_INPUT, (w) => w.hero.motion.state === 'swim', stepsFor(2))).toBe(true);
    const speeds = sim.hold(NO_INPUT, stepsFor(1)).map((w) => w.hero.motion.vy);
    expect(Math.max(...speeds)).toBe(PHYSICS.swimMaxFall);
    expect(sim.until(NO_INPUT, (w) => w.hero.contacts.ground, stepsFor(4))).toBe(true);
    expect(sim.world.hero.y + T).toBe(6 * T);
    expect(sim.world.hero.motion.state).toBe('swim');
  });

  it('cada aperto do pulo é uma braçada para cima', () => {
    const sim = new WorldSim(makeWorld(POOL));
    sim.placeHero(0, 4 * T);
    sim.hold(NO_INPUT, 3);
    press(sim);
    expect(sim.world.hero.motion.vy).toBe(-PHYSICS.swimStroke);
    // Segurar não dá outra braçada: afunda de novo.
    sim.hold(JUMP, stepsFor(1));
    expect(sim.world.hero.motion.vy).toBeGreaterThan(0);
  });

  it('na superfície, o pulo sai da água com o impulso normal', () => {
    const sim = new WorldSim(makeWorld(POOL));
    sim.placeHero(0, 2 * T - 4);
    sim.step(NO_INPUT);
    expect(atSurface(sim.world.collision, heroBox(sim.world.hero))).toBe(true);
    sim.step(JUMP);
    expect(sim.world.hero.motion.vy).toBe(-PHYSICS.jumpImpulse);
    expect(sim.until(JUMP, (w) => w.hero.y + T < 2 * T - T, stepsFor(1))).toBe(true);
  });

  it('nada no máximo a swimSpeed na horizontal', () => {
    const sim = new WorldSim(makeWorld(POOL));
    sim.placeHero(0, 4 * T);
    const vx = sim.hold(RIGHT, stepsFor(1)).map((w) => w.hero.motion.vx);
    expect(Math.max(...vx)).toBe(PHYSICS.swimSpeed);
  });
});

describe('Pikachu Surfista', () => {
  const LAKE = [
    'S' + '.'.repeat(39),
    '#'.repeat(3) + '~'.repeat(37),
    '#'.repeat(3) + '~'.repeat(37),
    '#'.repeat(40),
  ];

  it('anda sobre a água por 2 s e depois afunda', () => {
    const sim = new WorldSim(makeWorld(LAKE));
    inForm(sim, 'surf');
    sim.until(NO_INPUT, (w) => w.hero.contacts.ground, stepsFor(1));
    expect(sim.until(RIGHT, (w) => onWaterSurface(w.collision, heroBox(w.hero)), stepsFor(2))).toBe(
      true,
    );
    // Em pé sobre a água quase até o fim do tempo.
    const limit = stepsFor(POWERUPS.surf.waterWalkTime);
    const onTop = sim.hold(RIGHT, limit - 2);
    expect(onTop.every((w) => w.hero.contacts.ground && w.hero.motion.state !== 'swim')).toBe(true);
    expect(sim.until(RIGHT, (w) => w.hero.motion.state === 'swim', stepsFor(1))).toBe(true);
  });

  it('nada mais rápido que as outras formas', () => {
    const sim = new WorldSim(makeWorld(POOL));
    inForm(sim, 'surf');
    sim.placeHero(0, 3 * T);
    const vx = sim.hold(RIGHT, stepsFor(1)).map((w) => w.hero.motion.vx);
    expect(Math.max(...vx)).toBe(PHYSICS.swimSpeed * POWERUPS.surf.swimSpeed);
  });

  it('a contagem zera ao pisar em chão firme', () => {
    const sim = new WorldSim(makeWorld(LAKE));
    inForm(sim, 'surf');
    sim.world = { ...sim.world, surfSteps: 50 };
    sim.until(NO_INPUT, (w) => w.hero.contacts.ground, stepsFor(1));
    sim.step(NO_INPUT);
    expect(sim.world.surfSteps).toBe(0);
  });

  it('outra forma não anda sobre a água', () => {
    const sim = new WorldSim(makeWorld(LAKE));
    inForm(sim, 'big');
    expect(sim.until(RIGHT, (w) => w.hero.motion.state === 'swim', stepsFor(2))).toBe(true);
  });
});
