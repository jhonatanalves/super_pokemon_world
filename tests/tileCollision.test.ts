import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { PHYSICS, SLOPE_SPEED } from '../src/config/physics';
import { shouldRestart } from '../src/logic/heroBody';
import { NO_INPUT, stepsFor, type HeroInput } from '../src/logic/heroMotion';
import { asciiLevel, LevelSim } from './helpers/asciiLevel';

const T = GAME_CONFIG.tileSize;
const RIGHT: HeroInput = { ...NO_INPUT, right: true };
const LEFT: HeroInput = { ...NO_INPUT, left: true };
const JUMP: HeroInput = { ...NO_INPUT, jump: true };
const EPS = 1e-6;
const MAX_STEPS = stepsFor(10);

const STEEP = SLOPE_SPEED.find((s) => s.grade === 1)!;
const GENTLE = SLOPE_SPEED.find((s) => s.grade === 0.5)!;

interface SlopeCase {
  name: string;
  map: string[];
  /** Altura do piso sob o centro do herói, calculada à mão a partir do mapa. */
  groundY: (x: number) => number;
  /** x do centro em que o herói já passou da ladeira. */
  endX: number;
  grade: number;
  factor: number;
}

// Pés no chão em y = 80 (linha 5) e no platô em y = 48 (linha 3).
const UPHILL: SlopeCase[] = [
  {
    name: '45°',
    map: [
      '..............',
      '..............',
      '..............',
      '....../#######',
      'S..../########',
      '##############',
    ],
    groundY: (x) => (x < 5 * T ? 80 : x < 7 * T ? 80 - (x - 5 * T) : 48),
    endX: 9 * T,
    grade: 1,
    factor: STEEP.uphill,
  },
  {
    name: '22,5°',
    map: [
      '..............',
      '..............',
      '..............',
      '........ab####',
      'S.....ab######',
      '##############',
    ],
    groundY: (x) => (x < 6 * T ? 80 : x < 10 * T ? 80 - (x - 6 * T) / 2 : 48),
    endX: 12 * T,
    grade: 0.5,
    factor: GENTLE.uphill,
  },
];

const DOWNHILL: SlopeCase[] = [
  {
    name: '45°',
    map: [
      '..............',
      '..............',
      '.S............',
      '#######\\......',
      '########\\.....',
      '##############',
    ],
    groundY: (x) => (x < 7 * T ? 48 : x < 9 * T ? 48 + (x - 7 * T) : 80),
    endX: 11 * T,
    grade: -1,
    factor: STEEP.downhill,
  },
  {
    name: '22,5°',
    map: [
      '..............',
      '..............',
      '.S............',
      '#######cd.....',
      '#########cd...',
      '##############',
    ],
    groundY: (x) => (x < 7 * T ? 48 : x < 11 * T ? 48 + (x - 7 * T) / 2 : 80),
    endX: 13 * T,
    grade: -0.5,
    factor: GENTLE.downhill,
  },
];

/** Anda para a direita até o centro passar de `endX`; devolve a velocidade em cada passo na ladeira. */
function walkAcross(c: SlopeCase): { sim: LevelSim; slopeVx: number[] } {
  const sim = new LevelSim(asciiLevel(c.map));
  sim.hold(NO_INPUT, 2);
  const slopeVx: number[] = [];
  for (let i = 0; i < MAX_STEPS && sim.centerX < c.endX; i++) {
    const body = sim.step(RIGHT);
    const ground = c.groundY(sim.centerX);
    // Nunca atravessa o piso; no chão, os pés ficam exatamente sobre ele (não voa).
    expect(sim.feet).toBeLessThanOrEqual(ground + EPS);
    expect(body.contacts.ground).toBe(true);
    expect(Math.abs(sim.feet - ground)).toBeLessThan(EPS);
    if (body.contacts.groundSlope === c.grade) slopeVx.push(body.motion.vx);
  }
  expect(sim.centerX).toBeGreaterThanOrEqual(c.endX);
  return { sim, slopeVx };
}

describe('ladeiras (F2-A2)', () => {
  for (const c of UPHILL) {
    it(`${c.name}: sobe sem atravessar, sem travar na emenda, e a velocidade cai de forma consistente`, () => {
      const { sim, slopeVx } = walkAcross(c);
      expect(sim.feet).toBe(48);
      expect(sim.body.motion.vx).toBeGreaterThan(0);

      const max = PHYSICS.walkSpeed * c.factor;
      expect(slopeVx.length).toBeGreaterThan(stepsFor(0.1));
      // Cai sempre, sem oscilar, até a velocidade máxima da subida, e fica nela.
      for (let i = 1; i < slopeVx.length; i++) {
        expect(slopeVx[i]).toBeLessThanOrEqual(slopeVx[i - 1] + EPS);
      }
      // O 1º passo na ladeira ainda usa a velocidade do plano: o contato vale a partir do seguinte.
      expect(slopeVx[0]).toBe(PHYSICS.walkSpeed);
      expect(slopeVx.at(-1)).toBeCloseTo(max, 6);
    });
  }

  for (const c of DOWNHILL) {
    it(`${c.name}: desce grudado no piso e mais rápido que no plano`, () => {
      const { sim, slopeVx } = walkAcross(c);
      expect(sim.feet).toBe(80);
      expect(Math.max(...slopeVx)).toBeGreaterThan(PHYSICS.walkSpeed);
      expect(Math.max(...slopeVx)).toBeLessThanOrEqual(PHYSICS.walkSpeed * c.factor + EPS);
    });
  }

  it('volta descendo a ladeira de 45° pelo outro lado (para a esquerda)', () => {
    const sim = new LevelSim(asciiLevel(UPHILL[0].map));
    sim.hold(RIGHT, stepsFor(3));
    expect(sim.feet).toBe(48);
    for (let i = 0; i < MAX_STEPS && sim.centerX > 3 * T; i++) {
      expect(sim.step(LEFT).contacts.ground).toBe(true);
      expect(Math.abs(sim.feet - UPHILL[0].groundY(sim.centerX))).toBeLessThan(EPS);
    }
    expect(sim.feet).toBe(80);
  });

  it('caindo e andando sobre a ladeira que sobe, pousa nela e não a atravessa', () => {
    const c = UPHILL[0];
    const map = [...c.map];
    map[0] = '....S.........';
    map[4] = '...../########';
    const sim = new LevelSim(asciiLevel(map));
    for (let i = 0; i < MAX_STEPS && !sim.body.contacts.ground; i++) {
      sim.step(RIGHT);
      expect(sim.feet).toBeLessThanOrEqual(c.groundY(sim.centerX) + EPS);
    }
    expect(sim.body.contacts.ground).toBe(true);
    expect(sim.body.contacts.groundSlope).toBe(1);
    expect(Math.abs(sim.feet - c.groundY(sim.centerX))).toBeLessThan(EPS);
  });
});

describe('plataforma de mão única (F2-A3)', () => {
  const MAP = [
    '......',
    '......',
    '......',
    '.====.', // topo em y = 48
    '......',
    '..S...', // pés em y = 96
    '######',
  ];
  const TOP = 3 * T;

  it('o pulo de baixo atravessa e o herói pousa em cima', () => {
    const sim = new LevelSim(asciiLevel(MAP));
    sim.hold(NO_INPUT, 2);
    let highest = sim.feet;
    for (let i = 0; i < MAX_STEPS; i++) {
      const body = sim.step(JUMP);
      expect(body.contacts.ceiling).toBe(false);
      highest = Math.min(highest, sim.feet);
      if (i > 0 && body.contacts.ground) break;
    }
    expect(highest).toBeLessThan(TOP);
    expect(sim.body.contacts.ground).toBe(true);
    expect(sim.feet).toBe(TOP);
  });

  it('quem cai de cima fica sobre ela', () => {
    const map = [...MAP];
    map[1] = '..S...';
    map[5] = '......';
    const sim = new LevelSim(asciiLevel(map));
    sim.hold(NO_INPUT, stepsFor(1));
    expect(sim.body.contacts.ground).toBe(true);
    expect(sim.feet).toBe(TOP);
  });

  it('um pulo curto que não passa do topo volta ao chão sem enganchar', () => {
    const sim = new LevelSim(asciiLevel(MAP));
    sim.hold(NO_INPUT, 2);
    sim.hold(JUMP, 3);
    sim.hold(NO_INPUT, stepsFor(1));
    expect(sim.body.contacts.ground).toBe(true);
    expect(sim.feet).toBe(6 * T);
  });
});

describe('paredes, teto e limites', () => {
  it('para encostado na parede', () => {
    const sim = new LevelSim(asciiLevel(['........', '.....#..', 'S....#..', '########']));
    const steps = sim.hold(RIGHT, stepsFor(2));
    expect(steps.some((b) => b.contacts.wallRight)).toBe(true);
    expect(sim.body.x + GAME_CONFIG.heroWidth).toBe(5 * T);
  });

  it('o teto corta o pulo e o herói volta ao chão', () => {
    const sim = new LevelSim(asciiLevel(['....', '####', '....', 'S...', '####']));
    sim.hold(NO_INPUT, 2);
    const steps = sim.hold(JUMP, stepsFor(1));
    expect(steps.some((b) => b.contacts.ceiling)).toBe(true);
    expect(Math.min(...steps.map((b) => b.y))).toBe(2 * T);
    expect(sim.feet).toBe(4 * T);
  });

  it('não sai pelas laterais da fase', () => {
    const sim = new LevelSim(asciiLevel(['S...', '####']));
    sim.hold(LEFT, stepsFor(1));
    expect(sim.body.x).toBe(0);
    expect(sim.body.contacts.wallLeft).toBe(true);
    sim.hold(RIGHT, stepsFor(2));
    expect(sim.body.x).toBe(4 * T - GAME_CONFIG.heroWidth);
  });
});

describe('buraco (F2-A4)', () => {
  const PIT = ['......', 'S.....', '##..##'];

  it('cair abaixo do limite da fase mata o herói, que reinicia depois do tempo de morte', () => {
    const level = asciiLevel(PIT);
    const sim = new LevelSim(level);
    let deadAt = -1;
    for (let i = 0; i < MAX_STEPS && deadAt < 0; i++) {
      const body = sim.step(RIGHT);
      if (body.motion.state === 'dead') deadAt = i;
      else expect(body.y).toBeLessThanOrEqual(level.height);
    }
    expect(deadAt).toBeGreaterThan(0);
    expect(sim.body.y).toBeGreaterThan(level.height);
    expect(sim.body.motion).toMatchObject({ vx: 0, vy: 0 });

    const delay = stepsFor(PHYSICS.deathRestartDelay);
    for (let i = 1; i < delay; i++) {
      sim.step(RIGHT);
      expect(shouldRestart(sim.body)).toBe(false);
    }
    sim.step(RIGHT);
    expect(shouldRestart(sim.body)).toBe(true);
    expect(sim.body.motion.state).toBe('dead');
  });

  it('parado na beira do buraco não morre', () => {
    const sim = new LevelSim(asciiLevel(['......', '.S....', '.#..##']));
    sim.hold(NO_INPUT, stepsFor(2));
    expect(sim.body.motion.state).not.toBe('dead');
    expect(sim.body.contacts.ground).toBe(true);
  });
});
