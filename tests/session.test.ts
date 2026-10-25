import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { PHYSICS } from '../src/config/physics';
import { RULES } from '../src/config/rules';
import { isInvincible, NOT_HURT, takeDamage, tickHurt } from '../src/logic/damage';
import type { GameEvent } from '../src/logic/events';
import { NO_INPUT, stepsFor, type HeroInput } from '../src/logic/heroMotion';
import { applyHudEvent, EMPTY_HUD, HUD_EVENTS, hudText, type HudState } from '../src/logic/hud';
import { heroHeightFor } from '../src/logic/powerups';
import { addCoins, isGameOver, loseLife, newSession } from '../src/logic/session';
import { createWorld, levelStartedEvent } from '../src/logic/world';
import { EventBus } from '../src/systems/EventBus';
import { asciiLevel, tileObject } from './helpers/asciiLevel';
import { CONTENT, makeWorld, WorldSim } from './helpers/world';

const T = GAME_CONFIG.tileSize;
const RIGHT: HeroInput = { ...NO_INPUT, right: true };

describe('vidas e Game Over', () => {
  it('o jogo começa com 5 vidas e nenhuma moeda', () => {
    expect(newSession()).toEqual({
      lives: 5,
      coins: 0,
      checkpoint: false,
      reserve: null,
      stars: 0,
      form: 'small',
    });
    expect(RULES.startLives).toBe(5);
  });

  it('perder a última vida é Game Over', () => {
    let session = newSession();
    for (let i = 1; i < RULES.startLives; i++) session = loseLife(session);
    expect(isGameOver(session)).toBe(false);
    session = loseLife(session);
    expect(session.lives).toBe(0);
    expect(isGameOver(session)).toBe(true);
  });
});

describe('dano e invencibilidade (F3-A8)', () => {
  it('na F3 o herói pequeno não aguenta o toque: morre', () => {
    expect(takeDamage(NOT_HURT, false).outcome).toBe('died');
  });

  it('depois de um dano que não mata, fica 1,5 s sem tomar dano novo', () => {
    const first = takeDamage(NOT_HURT, true);
    expect(first.outcome).toBe('survived');
    let state = first.state;
    const window = stepsFor(PHYSICS.hurtInvincibilityTime);
    expect(window).toBe(stepsFor(1.5));
    for (let i = 0; i < window - 1; i++) {
      state = tickHurt(state);
      expect(takeDamage(state, false).outcome).toBe('ignored');
    }
    state = tickHurt(state);
    expect(isInvincible(state)).toBe(false);
    expect(takeDamage(state, false).outcome).toBe('died');
  });
});

describe('moedas (F3-A9)', () => {
  it('100 moedas dão 1 vida e zeram o contador', () => {
    let session = newSession();
    for (let i = 0; i < 99; i++) session = addCoins(session, 1);
    expect(session).toMatchObject({ coins: 99, lives: RULES.startLives });
    session = addCoins(session, 1);
    expect(session).toMatchObject({ coins: 0, lives: RULES.startLives + 1 });
    expect(RULES.coinsPerLife).toBe(100);
  });

  it('coletar uma moeda da fase soma 1 e ela some', () => {
    const lines = ['S.......', '########'];
    const sim = new WorldSim(makeWorld(lines, [tileObject('coin', 4, 0)]));
    expect(sim.until(RIGHT, (w) => w.items.length === 0, stepsFor(3))).toBe(true);
    expect(sim.world.session.coins).toBe(1);
  });

  it('a 100ª moeda da fase dá a vida extra também no evento', () => {
    const lines = ['S.......', '########'];
    const world = makeWorld(lines, [tileObject('coin', 4, 0)], { ...newSession(), coins: 99 });
    const sim = new WorldSim(world);
    sim.until(RIGHT, (w) => w.items.length === 0, stepsFor(3));
    expect(sim.eventsOf('coin-collected')).toEqual([
      { type: 'coin-collected', coins: 0, lives: RULES.startLives + 1 },
    ]);
  });

  it('Moedas Pokébola contam à parte', () => {
    const lines = ['S.......', '########'];
    const sim = new WorldSim(makeWorld(lines, [tileObject('pokeball-coin', 4, 0)]));
    expect(sim.world.pokeballsTotal).toBe(1);
    sim.until(RIGHT, (w) => w.items.length === 0, stepsFor(3));
    expect(sim.world.pokeballs).toBe(1);
    expect(sim.world.session.coins).toBe(0);
    expect(sim.eventsOf('pokeball-collected')).toEqual([
      { type: 'pokeball-collected', pokeballs: 1 },
    ]);
  });
});

describe('EventBus e HUD (F3-A10)', () => {
  it('o barramento entrega só os eventos do tipo escutado, até cancelar', () => {
    const bus = new EventBus();
    const got: GameEvent[] = [];
    const off = bus.on('coin-collected', (e) => got.push(e));
    bus.emit({ type: 'coin-collected', coins: 3, lives: 5 });
    bus.emit({ type: 'player-damaged' });
    off();
    bus.emit({ type: 'coin-collected', coins: 4, lives: 5 });
    expect(got).toEqual([{ type: 'coin-collected', coins: 3, lives: 5 }]);
  });

  it('a fase emite "coin-collected" e o HUD atualiza só pelo evento', () => {
    const lines = ['S.......', '########'];
    const sim = new WorldSim(makeWorld(lines, [tileObject('coin', 4, 0)]));

    // HUD de teste: só escuta o barramento, como a HudScene.
    const bus = new EventBus();
    let hud: HudState = EMPTY_HUD;
    for (const type of HUD_EVENTS) bus.on(type, (e) => (hud = applyHudEvent(hud, e)));

    bus.emit(levelStartedEvent(sim.world));
    expect(hud).toEqual({
      lives: 5,
      coins: 0,
      pokeballs: 0,
      pokeballsTotal: 0,
      form: 'small',
      star: false,
      reserve: null,
      stars: 0,
      clear: null,
    });
    sim.until(RIGHT, (w) => w.items.length === 0, stepsFor(3));
    for (const event of sim.events) bus.emit(event);
    expect(hud.coins).toBe(1);
    expect(hudText(hud)).toContain('MOEDAS 01');
  });

  it('a morte chega ao HUD com as vidas já descontadas', () => {
    const hud = applyHudEvent({ ...EMPTY_HUD, lives: 5 }, { type: 'player-died', lives: 4 });
    expect(hud.lives).toBe(4);
  });
});

describe('forma do herói entre as fases (F5b)', () => {
  const lines = ['................', 'S...............', '################'];

  it('a fase começa na forma da sessão, com a altura dela', () => {
    const world = makeWorld(lines, [], { ...newSession(), form: 'surf' });
    expect(world.power.form).toBe('surf');
    expect(world.hero.height).toBe(heroHeightFor('surf'));
  });

  it('vencer a fase leva a forma atual para a sessão', () => {
    const goal = tileObject('goal', 8, 0, {}, 2, 2);
    const sim = new WorldSim(makeWorld(lines, [goal], { ...newSession(), form: 'big' }));
    sim.world = { ...sim.world, power: { form: 'flying', starSteps: 0 } };
    expect(sim.until(RIGHT, (w) => w.clear !== null, stepsFor(3))).toBe(true);
    expect(sim.world.session.form).toBe('flying');
  });

  it('morrer volta a forma da sessão para pequeno', () => {
    expect(loseLife({ ...newSession(), form: 'electric' }).form).toBe('small');
    const pit = ['S.......', '###.....'];
    const sim = new WorldSim(makeWorld(pit, [], { ...newSession(), form: 'big' }));
    expect(sim.until(RIGHT, (w) => w.hero.motion.state === 'dead', stepsFor(5))).toBe(true);
    expect(sim.world.session.form).toBe('small');
  });
});

describe('checkpoint (F3-A11)', () => {
  const lines = ['S...............', '################'];
  const objects = [tileObject('checkpoint', 8, 0)];

  it('tocar no checkpoint marca a sessão e emite o evento uma vez', () => {
    const sim = new WorldSim(makeWorld(lines, objects));
    expect(sim.until(RIGHT, (w) => w.session.checkpoint, stepsFor(3))).toBe(true);
    sim.hold(RIGHT, 10);
    expect(sim.eventsOf('checkpoint-reached')).toHaveLength(1);
  });

  it('a morte depois do checkpoint reinicia nele, não no início da fase', () => {
    const level = asciiLevel(lines, objects);
    const sim = new WorldSim(createWorld(level, CONTENT, newSession()).world);
    sim.until(RIGHT, (w) => w.session.checkpoint, stepsFor(3));

    // A LevelScene reinicia a fase com a sessão da tentativa anterior.
    const retry = createWorld(level, CONTENT, sim.world.session).world;
    expect(retry.hero.x + T / 2).toBe(8.5 * T);
    expect(retry.hero.y + T).toBe(T);

    const fresh = createWorld(level, CONTENT, newSession()).world;
    expect(fresh.hero.x + T / 2).toBe(level.spawn.x);
  });

  it('no máximo 1 checkpoint por fase', () => {
    const level = asciiLevel(lines, [...objects, tileObject('checkpoint', 12, 0)]);
    expect(() => createWorld(level, CONTENT, newSession())).toThrow(/checkpoint/);
  });
});
