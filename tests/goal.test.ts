import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { GOAL } from '../src/config/goal';
import { FIXED_DT } from '../src/config/physics';
import { heroBox } from '../src/logic/heroBody';
import { NO_INPUT, stepsFor, type HeroInput } from '../src/logic/heroMotion';
import {
  goalReached,
  isClearDone,
  parseExits,
  tapeBox,
  tapeStars,
  tapeY,
  type LevelClear,
} from '../src/logic/goal';
import { applyHudEvent, EMPTY_HUD, hudClearText, hudStarText } from '../src/logic/hud';
import { newSession } from '../src/logic/session';
import { levelStartedEvent } from '../src/logic/world';
import { tileObject } from './helpers/asciiLevel';
import { makeWorld, WorldSim } from './helpers/world';

const T = GAME_CONFIG.tileSize;
const RIGHT: HeroInput = { ...NO_INPUT, right: true };

/** Fita de 2 tiles de largura e 8 de altura, com a base no chão. */
const GOAL_BOX = { x: 0, y: 0, width: 2 * T, height: 8 * T };
const RANGE = GOAL_BOX.height - GOAL.tapeHeight;
const BOTTOM = GOAL_BOX.y + RANGE;
/** Passos até a fita ir da base ao topo. */
const RISE_STEPS = RANGE / (GOAL.tapeSpeed * FIXED_DT);

describe('bônus de estrelas da fita (F5-A6)', () => {
  it('aumenta com a altura: 0 na base e o máximo no topo', () => {
    const stars = Array.from({ length: RANGE + 1 }, (_, h) => tapeStars(GOAL_BOX, BOTTOM - h));
    expect(stars[0]).toBe(0);
    expect(stars[RANGE]).toBe(GOAL.maxStars);
    for (let h = 1; h <= RANGE; h++) expect(stars[h]).toBeGreaterThanOrEqual(stars[h - 1]);
    expect(stars[RANGE / 2]).toBe(GOAL.maxStars / 2);
    expect(new Set(stars).size).toBe(GOAL.maxStars + 1);
  });

  it('fora da área, fica entre 0 e o máximo', () => {
    expect(tapeStars(GOAL_BOX, BOTTOM + 50)).toBe(0);
    expect(tapeStars(GOAL_BOX, GOAL_BOX.y - 50)).toBe(GOAL.maxStars);
  });

  it('a fita sai da base, sobe até o topo, volta e nunca sai da área', () => {
    expect(tapeY(GOAL_BOX, 0)).toBe(BOTTOM);
    expect(tapeY(GOAL_BOX, RISE_STEPS)).toBeCloseTo(GOAL_BOX.y);
    expect(tapeY(GOAL_BOX, 2 * RISE_STEPS)).toBeCloseTo(BOTTOM);
    for (let s = 0; s < 4 * RISE_STEPS; s++) {
      const y = tapeY(GOAL_BOX, s);
      expect(y).toBeGreaterThanOrEqual(GOAL_BOX.y);
      expect(y).toBeLessThanOrEqual(BOTTOM);
    }
  });

  it('tocar a fita dá as estrelas da altura dela; cruzar a linha sem tocar dá 0', () => {
    const steps = Math.round(RISE_STEPS / 2);
    const tape = tapeBox(GOAL_BOX, steps);
    const touching = { x: tape.x, y: tape.y - 8, width: 16, height: 16 };
    expect(goalReached(GOAL_BOX, steps, touching)).toBe(tapeStars(GOAL_BOX, tape.y));
    expect(goalReached(GOAL_BOX, steps, touching)).toBeGreaterThan(0);

    const onFloor = { x: GOAL_BOX.width / 2 - 8, y: BOTTOM - 16, width: 16, height: 16 };
    expect(goalReached(GOAL_BOX, steps, onFloor)).toBe(0);
    const before = { ...onFloor, x: GOAL_BOX.x - 16 };
    expect(goalReached(GOAL_BOX, steps, before)).toBeNull();
  });

  it('o fim dura clearTime pela fita e secretClearTime pela fechadura', () => {
    const normal: LevelClear = { exit: 'normal', stars: 0, steps: 0 };
    expect(isClearDone({ ...normal, steps: stepsFor(GOAL.clearTime) - 1 })).toBe(false);
    expect(isClearDone({ ...normal, steps: stepsFor(GOAL.clearTime) })).toBe(true);
    const secret: LevelClear = { exit: 'secret', stars: 0, steps: stepsFor(GOAL.secretClearTime) };
    expect(isClearDone(secret)).toBe(true);
  });
});

describe('objetos de saída no Tiled', () => {
  it('lê a fita, a chave e a fechadura', () => {
    const exits = parseExits([
      tileObject('goal', 10, 2, {}, 2, 8),
      tileObject('key', 3, 9),
      tileObject('keyhole', 6, 8, {}, 1, 2),
    ]);
    expect(exits.goal).toEqual({ x: 10 * T, y: 2 * T, width: 2 * T, height: 8 * T });
    expect(exits.key).toEqual({ x: 3.5 * T, y: 10 * T });
    expect(exits.keyhole).toEqual({ x: 6 * T, y: 8 * T, width: T, height: 2 * T });
  });

  it('no máximo uma fita, uma chave e uma fechadura por fase', () => {
    const goal = tileObject('goal', 10, 2, {}, 2, 8);
    expect(() => parseExits([goal, goal])).toThrow(/goal/);
  });

  it('a chave e a fechadura vêm juntas (no máximo 1 saída secreta)', () => {
    expect(() => parseExits([tileObject('key', 3, 9)])).toThrow(/juntas/);
    expect(() => parseExits([tileObject('keyhole', 3, 9)])).toThrow(/juntas/);
  });

  it('a fita precisa ser um retângulo', () => {
    const point = { ...tileObject('goal', 10, 2), width: 0, height: 0 };
    expect(() => parseExits([point])).toThrow(/retângulo/);
  });
});

// Fita no fim de um corredor: 2 tiles de largura e 8 de altura, com a base no chão.
const FIELD = [
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  'S.......................',
  '########################',
];
const goalAt = (col: number) => tileObject('goal', col, 1, {}, 2, 8);

describe('fim de fase pela fita', () => {
  it('cruzar a linha emite "level-complete" uma vez e soma as estrelas na sessão', () => {
    const world = makeWorld(FIELD, [goalAt(8)], { ...newSession(), stars: 7, checkpoint: true });
    // Fita no topo, longe do herói no chão: cruza a linha sem tocar.
    const sim = new WorldSim({ ...world, steps: Math.floor(RISE_STEPS) });
    expect(sim.until(RIGHT, (w) => w.clear !== null, stepsFor(3))).toBe(true);
    sim.hold(RIGHT, 30);
    expect(sim.eventsOf('level-complete')).toEqual([
      { type: 'level-complete', exit: 'normal', stars: 0, totalStars: 7 },
    ]);
    // A próxima fase começa do início.
    expect(sim.world.session.checkpoint).toBe(false);
  });

  it('pular na fita dá as estrelas da altura dela', () => {
    const sim = new WorldSim(makeWorld(FIELD, [goalAt(8)]));
    const steps = Math.round(RISE_STEPS / 2);
    const goal = sim.world.goal!;
    const tape = tapeBox(goal, steps);
    sim.world = { ...sim.world, steps };
    sim.placeHero(goal.x, tape.y - 8);
    sim.step(NO_INPUT);
    const [event] = sim.eventsOf('level-complete');
    expect(event.exit).toBe('normal');
    expect(event.stars).toBeGreaterThan(0);
    expect(event.stars).toBe(sim.world.session.stars);
    expect(event.totalStars).toBe(sim.world.session.stars);
  });

  it('depois do fim, o herói anda sozinho para a direita e os inimigos param', () => {
    const rattata = tileObject('rattata', 20, 8);
    const sim = new WorldSim(makeWorld(FIELD, [goalAt(8), rattata]));
    sim.until(RIGHT, (w) => w.clear !== null, stepsFor(3));
    const enemy = sim.world.enemies[0];
    const x = sim.world.hero.x;
    sim.hold(NO_INPUT, stepsFor(1));
    expect(sim.world.hero.x).toBeGreaterThan(x);
    expect(sim.world.enemies[0]).toEqual(enemy);
    expect(sim.world.clear!.steps).toBe(stepsFor(1));
  });
});

describe('HUD no fim da fase', () => {
  it('mostra as estrelas somadas e a mensagem, que some quando a fase recomeça', () => {
    const sim = new WorldSim(makeWorld(FIELD, [goalAt(8)], { ...newSession(), stars: 12 }));
    let hud = applyHudEvent(EMPTY_HUD, levelStartedEvent(sim.world));
    expect(hudStarText(hud)).toBe('ESTRELAS 12');
    expect(hudClearText(hud)).toBeNull();

    hud = applyHudEvent(hud, {
      type: 'level-complete',
      exit: 'normal',
      stars: 30,
      totalStars: 42,
    });
    expect(hudStarText(hud)).toBe('ESTRELAS 42');
    expect(hudClearText(hud)).toBe('FASE CONCLUÍDA!\n+30 ESTRELAS');
    const secret = { type: 'level-complete', exit: 'secret', stars: 0, totalStars: 42 } as const;
    expect(hudClearText(applyHudEvent(hud, secret))).toBe('SAÍDA SECRETA!');

    hud = applyHudEvent(
      hud,
      levelStartedEvent({ ...sim.world, session: { ...newSession(), stars: 42 } }),
    );
    expect(hudClearText(hud)).toBeNull();
    expect(hud.stars).toBe(42);
  });
});

describe('fim de fase pela fechadura (saída secreta)', () => {
  const lines = ['S...............', '################'];

  it('levar a chave até a fechadura acaba a fase pela saída secreta, sem estrelas', () => {
    const objects = [tileObject('key', 3, 0), tileObject('keyhole', 10, 0)];
    const sim = new WorldSim(makeWorld(lines, objects));
    const carryRight: HeroInput = { ...RIGHT, run: true };
    expect(sim.until(carryRight, (w) => w.carry?.kind === 'key', stepsFor(2))).toBe(true);
    expect(sim.until(carryRight, (w) => w.clear !== null, stepsFor(3))).toBe(true);
    expect(sim.eventsOf('level-complete')).toEqual([
      { type: 'level-complete', exit: 'secret', stars: 0, totalStars: 0 },
    ]);
    // Na secreta, o herói fica parado até a fase acabar.
    const x = sim.world.hero.x;
    sim.hold(RIGHT, 30);
    expect(sim.world.hero.x).toBe(x);
  });

  it('sem a chave, a fechadura não faz nada', () => {
    const objects = [tileObject('key', 14, 0), tileObject('keyhole', 6, 0)];
    const sim = new WorldSim(makeWorld(lines, objects));
    sim.until(RIGHT, (w) => heroBox(w.hero).x > 8 * T, stepsFor(3));
    expect(sim.world.clear).toBeNull();
    expect(sim.eventsOf('level-complete')).toEqual([]);
  });
});
