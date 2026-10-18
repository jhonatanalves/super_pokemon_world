import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { PHYSICS } from '../src/config/physics';
import { parseBlock, withBlocks } from '../src/logic/blocks';
import { NO_INPUT, stepsFor, type HeroInput } from '../src/logic/heroMotion';
import { tileAt } from '../src/logic/level';
import type { World } from '../src/logic/world';
import { asciiLevel, tileObject } from './helpers/asciiLevel';
import { makeWorld, WorldSim } from './helpers/world';

const T = GAME_CONFIG.tileSize;
const JUMP: HeroInput = { ...NO_INPUT, jump: true };
const RIGHT: HeroInput = { ...NO_INPUT, right: true };

// Chão em y = 112 (linha 7). Bloco na linha 3: o pulo do chão alcança a face de baixo dele.
const ROOM = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  'S...............',
  '################',
];

/** Pula do chão uma vez (aperta e segura até cair de novo no chão). */
function jumpOnce(sim: WorldSim): void {
  sim.step(NO_INPUT);
  sim.step(JUMP);
  sim.until(JUMP, (w) => w.hero.contacts.ground, stepsFor(2));
}

const blockAt = (w: World, col: number, row: number) =>
  w.blocks.find((b) => b.col === col && b.row === row)!;

describe('bloco ?', () => {
  it('a cabeçada solta 1 moeda e o bloco vira usado', () => {
    const sim = new WorldSim(makeWorld(ROOM, [tileObject('question-block', 0, 3)]));
    jumpOnce(sim);
    expect(blockAt(sim.world, 0, 3).kind).toBe('used');
    expect(sim.world.session.coins).toBe(1);
    expect(sim.eventsOf('coin-collected')).toEqual([
      { type: 'coin-collected', coins: 1, lives: sim.world.session.lives },
    ]);
    // Bater de novo no bloco usado não dá outra moeda.
    jumpOnce(sim);
    expect(sim.world.session.coins).toBe(1);
  });

  it('a moeda aparece saindo do bloco e some depois', () => {
    const sim = new WorldSim(makeWorld(ROOM, [tileObject('question-block', 0, 3)]));
    sim.step(NO_INPUT);
    expect(sim.until(JUMP, (w) => w.popups.length > 0, stepsFor(1))).toBe(true);
    expect(sim.world.popups[0]).toMatchObject({ x: 0, y: 3 * T });
    expect(sim.until(JUMP, (w) => w.popups.length === 0, stepsFor(1))).toBe(true);
  });
});

describe('tijolo', () => {
  it('com o herói pequeno só balança, sem quebrar nem soltar nada', () => {
    const sim = new WorldSim(makeWorld(ROOM, [tileObject('brick-block', 0, 3)]));
    sim.step(NO_INPUT);
    expect(sim.until(JUMP, (w) => blockAt(w, 0, 3).bumpSteps > 0, stepsFor(1))).toBe(true);
    expect(blockAt(sim.world, 0, 3).kind).toBe('brick');
    expect(sim.world.session.coins).toBe(0);
    expect(tileAt(sim.world.collision, 0, 3).kind).toBe('solid');
  });
});

describe('bloco invisível', () => {
  it('não bloqueia de lado nem de cima', () => {
    const sim = new WorldSim(makeWorld(ROOM, [tileObject('hidden-block', 3, 6)]));
    expect(sim.until(RIGHT, (w) => w.hero.x > 4 * T, stepsFor(3))).toBe(true);

    const fromAbove = new WorldSim(makeWorld(ROOM, [tileObject('hidden-block', 3, 3)]));
    fromAbove.placeHero(3 * T, 0);
    fromAbove.until(NO_INPUT, (w) => w.hero.contacts.ground, stepsFor(2));
    expect(fromAbove.world.hero.y + T).toBe(7 * T);
  });

  it('aparece com a cabeçada por baixo, solta a moeda e fica sólido', () => {
    const sim = new WorldSim(makeWorld(ROOM, [tileObject('hidden-block', 0, 3)]));
    expect(tileAt(sim.world.collision, 0, 3).kind).toBe('hidden');
    jumpOnce(sim);
    expect(blockAt(sim.world, 0, 3).kind).toBe('used');
    expect(sim.world.session.coins).toBe(1);
    expect(tileAt(sim.world.collision, 0, 3).kind).toBe('solid');
  });
});

describe('bloco nota', () => {
  it('quem pousa nele é jogado para cima com noteBounce', () => {
    const sim = new WorldSim(makeWorld(ROOM, [tileObject('note-block', 3, 6)]));
    sim.placeHero(3 * T, 2 * T);
    expect(sim.until(NO_INPUT, (w) => w.hero.motion.vy < 0, stepsFor(2))).toBe(true);
    expect(sim.world.hero.motion.vy).toBe(-PHYSICS.noteBounce);
    expect(sim.world.hero.motion.state).toBe('jump');
  });

  it('segurando o pulo, sobe mais alto que o pulo normal', () => {
    const sim = new WorldSim(makeWorld(ROOM, [tileObject('note-block', 3, 6)]));
    sim.placeHero(3 * T, 5 * T - 1);
    sim.until(JUMP, (w) => w.hero.motion.vy < 0, stepsFor(2));
    const start = sim.world.hero.y;
    let top = start;
    sim.until(
      JUMP,
      (w) => {
        top = Math.min(top, w.hero.y);
        return w.hero.motion.vy > 0;
      },
      stepsFor(2),
    );
    const normalJump = PHYSICS.jumpImpulse ** 2 / (2 * PHYSICS.gravityUp);
    expect(start - top).toBeGreaterThan(normalJump);
  });
});

describe('blocos no mapa', () => {
  const props = (o: Record<string, unknown>) => o;

  it('aceitam só retângulos de 1 tile alinhados à grade', () => {
    expect(() => parseBlock({ ...tileObject('brick-block', 1, 1), x: T + 4 }, T)).toThrow(
      /alinhado/,
    );
    expect(() => parseBlock(tileObject('brick-block', 1, 1, {}, 2), T)).toThrow(/1 tile/);
    expect(parseBlock(tileObject('coin', 1, 1), T)).toBeNull();
  });

  it('o bloco ? solta moeda por padrão e recusa conteúdo desconhecido', () => {
    expect(parseBlock(tileObject('question-block', 1, 1), T)?.content).toBe('coin');
    expect(() =>
      parseBlock(tileObject('question-block', 1, 1, props({ content: 'fruta' })), T),
    ).toThrow(/fruta/);
    expect(() =>
      parseBlock(tileObject('brick-block', 1, 1, props({ content: 'coin' })), T),
    ).toThrow(/conteúdo/);
  });

  it('um bloco não pode ficar sobre o terreno', () => {
    const level = asciiLevel(['S..', '###']);
    const block = parseBlock(tileObject('note-block', 1, 1), T)!;
    expect(() => withBlocks(level, [block])).toThrow(/sobre o terreno/);
  });
});
