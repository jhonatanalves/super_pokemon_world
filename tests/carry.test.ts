import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/config/enemies';
import { GAME_CONFIG } from '../src/config/game';
import { CARRY } from '../src/config/goal';
import type { Enemy } from '../src/entities/enemies/Enemy';
import { resizeHero } from '../src/logic/heroBody';
import { NO_INPUT, stepsFor, type HeroInput } from '../src/logic/heroMotion';
import { heroHeightFor } from '../src/logic/powerups';
import type { World } from '../src/logic/world';
import { tileObject } from './helpers/asciiLevel';
import { makeWorld, WorldSim } from './helpers/world';

const T = GAME_CONFIG.tileSize;
const RIGHT: HeroInput = { ...NO_INPUT, right: true };
const LEFT: HeroInput = { ...NO_INPUT, left: true };
const HOLD: HeroInput = { ...NO_INPUT, run: true };
const HOLD_RIGHT: HeroInput = { ...RIGHT, run: true };
const HOLD_LEFT: HeroInput = { ...LEFT, run: true };

const FIELD = [
  '................................',
  '................................',
  '................................',
  'S...............................',
  '################################',
];

const shellOf = (w: World): Extract<Enemy, { behavior: 'shell' }> | undefined =>
  w.enemies.find((e): e is Extract<Enemy, { behavior: 'shell' }> => e.behavior === 'shell');

/** Herói ao lado de uma concha parada (o Shellder já pisado), virado para ela. */
function besideShell(others = [tileObject('rattata', 20, 3)]): WorldSim {
  const sim = new WorldSim(makeWorld(FIELD, [tileObject('shellder', 6, 3), ...others]));
  sim.step(NO_INPUT);
  const shell = shellOf(sim.world)!;
  sim.world = {
    ...sim.world,
    enemies: sim.world.enemies.map((e) =>
      e.id === shell.id && e.behavior === 'shell' ? { ...e, state: 'shell', x: 6 * T } : e,
    ),
  };
  sim.placeHero(4 * T, 3 * T);
  sim.until(NO_INPUT, (w) => w.hero.contacts.ground, stepsFor(1));
  return sim;
}

describe('carregar a chave', () => {
  const objects = [tileObject('key', 6, 1), tileObject('keyhole', 30, 3)];

  it('solta, a chave cai até o chão e fica parada', () => {
    const sim = new WorldSim(makeWorld(FIELD, objects));
    sim.hold(NO_INPUT, stepsFor(1));
    expect(sim.world.key).toMatchObject({ y: 3 * T, ground: true, x: 6 * T });
  });

  it('encostar segurando X pega a chave; sem X, não', () => {
    const sim = new WorldSim(makeWorld(FIELD, objects));
    expect(sim.until(RIGHT, (w) => w.hero.x + T >= 6 * T + 4, stepsFor(2))).toBe(true);
    sim.hold(RIGHT, 5);
    expect(sim.world.carry).toBeNull();
    expect(sim.world.key).not.toBeNull();
    sim.step(HOLD_RIGHT);
    expect(sim.world.carry?.kind).toBe('key');
    expect(sim.world.key).toBeNull();
  });

  it('a chave fica na frente do herói e troca de lado quando ele vira', () => {
    const sim = new WorldSim(makeWorld(FIELD, objects));
    sim.until(HOLD_RIGHT, (w) => w.carry !== null, stepsFor(2));
    const box = (w: World) => (w.carry?.kind === 'key' ? w.carry.key : null);
    let hero = sim.world.hero;
    expect(box(sim.world)!.x).toBe(hero.x + T - CARRY.overlap);
    sim.hold(HOLD_LEFT, 2);
    hero = sim.world.hero;
    expect(box(sim.world)!.x).toBe(hero.x - CARRY.key.width + CARRY.overlap);
    expect(box(sim.world)!.y + CARRY.key.height).toBe(hero.y + hero.height);
  });

  it('soltar X larga a chave na frente, e ela cai', () => {
    const sim = new WorldSim(makeWorld(FIELD, objects));
    sim.until(HOLD_RIGHT, (w) => w.carry !== null, stepsFor(2));
    sim.placeHero(sim.world.hero.x, 0);
    sim.step(HOLD);
    sim.step(NO_INPUT);
    expect(sim.world.carry).toBeNull();
    expect(sim.world.key!.x).toBe(sim.world.hero.x + T - CARRY.overlap);
    sim.hold(NO_INPUT, stepsFor(1));
    expect(sim.world.key).toMatchObject({ y: 3 * T, ground: true });
  });

  it('o dano que não mata faz largar a chave', () => {
    const sim = new WorldSim(makeWorld(FIELD, [...objects, tileObject('rattata', 12, 3)]));
    sim.world = {
      ...sim.world,
      power: { form: 'big', starSteps: 0 },
      hero: resizeHero(sim.world.hero, heroHeightFor('big')),
    };
    expect(sim.until(HOLD_RIGHT, (w) => w.carry !== null, stepsFor(2))).toBe(true);
    expect(sim.until(HOLD_RIGHT, (w) => w.power.form === 'small', stepsFor(3))).toBe(true);
    expect(sim.world.carry).toBeNull();
    expect(sim.world.key).not.toBeNull();
  });

  it('carregando algo, cair na montaria não monta', () => {
    const sim = new WorldSim(makeWorld(FIELD, [...objects, tileObject('rapidash', 12, 3)]));
    sim.until(HOLD_RIGHT, (w) => w.carry !== null, stepsFor(2));
    const mount = sim.world.mounts[0];
    sim.placeHero(mount.x, mount.y - 2 * T);
    sim.hold(HOLD, stepsFor(1));
    expect(sim.world.mounts[0].state).not.toBe('ridden');
    expect(sim.world.carry?.kind).toBe('key');
  });
});

describe('carregar e arremessar a concha', () => {
  it('encostar na concha parada segurando X pega em vez de chutar', () => {
    const sim = besideShell();
    expect(sim.until(HOLD_RIGHT, (w) => w.carry !== null, stepsFor(1))).toBe(true);
    expect(sim.world.carry?.kind).toBe('shell');
    expect(shellOf(sim.world)).toBeUndefined();
    expect(sim.eventsOf('player-damaged')).toEqual([]);
  });

  it('sem X, encostar continua chutando a concha', () => {
    const sim = besideShell();
    sim.until(RIGHT, (w) => shellOf(w)?.state === 'slide', stepsFor(1));
    expect(sim.world.carry).toBeNull();
    expect(shellOf(sim.world)?.state).toBe('slide');
  });

  it('soltar X arremessa a concha para onde o herói olha, sem machucá-lo', () => {
    const sim = besideShell([]);
    sim.until(HOLD_RIGHT, (w) => w.carry !== null, stepsFor(1));
    sim.hold(HOLD_LEFT, 3);
    sim.step(LEFT);
    const shell = shellOf(sim.world)!;
    expect(shell.state).toBe('slide');
    expect(shell.dir).toBe(-1);
    expect(shell.x).toBeLessThan(sim.world.hero.x);
    sim.hold(NO_INPUT, 10);
    expect(sim.eventsOf('player-damaged')).toEqual([]);
  });

  it('a concha arremessada derrota o inimigo no caminho', () => {
    const sim = besideShell([tileObject('rattata', 20, 3)]);
    sim.until(HOLD_RIGHT, (w) => w.carry !== null, stepsFor(1));
    sim.step(RIGHT);
    expect(shellOf(sim.world)?.state).toBe('slide');
    const rattataDead = (w: World) =>
      w.enemies.every((e) => e.behavior !== 'walker' || e.state === 'dead');
    expect(sim.until(NO_INPUT, rattataDead, stepsFor(2))).toBe(true);
  });

  it('com baixo, soltar X só larga a concha, parada, e ela não é chutada na hora', () => {
    const sim = besideShell([]);
    sim.until(HOLD_RIGHT, (w) => w.carry !== null, stepsFor(1));
    sim.step({ ...NO_INPUT, down: true });
    expect(shellOf(sim.world)?.state).toBe('shell');
    sim.hold(NO_INPUT, stepsFor(ENEMIES.shell.kickGrace) - 1);
    expect(shellOf(sim.world)?.state).toBe('shell');
  });

  it('a concha carregada que encosta num inimigo derrota os dois', () => {
    const sim = besideShell([tileObject('rattata', 12, 3)]);
    sim.until(HOLD_RIGHT, (w) => w.carry !== null, stepsFor(1));
    expect(sim.until(HOLD_RIGHT, (w) => w.carry === null, stepsFor(3))).toBe(true);
    const walker = sim.world.enemies.find((e) => e.behavior === 'walker');
    expect(walker?.state).toBe('dead');
    expect(shellOf(sim.world)?.state).toBe('dead');
    expect(sim.eventsOf('player-damaged')).toEqual([]);
  });

  it('o pisão na concha parada continua chutando, mesmo segurando X', () => {
    const sim = besideShell([]);
    const shell = shellOf(sim.world)!;
    sim.placeHero(shell.x, shell.y - 2 * T);
    sim.until(HOLD, (w) => shellOf(w)?.state === 'slide', stepsFor(1));
    expect(sim.world.carry).toBeNull();
    expect(shellOf(sim.world)?.state).toBe('slide');
  });
});
