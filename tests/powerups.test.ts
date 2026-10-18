import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { PHYSICS } from '../src/config/physics';
import { POWERUPS } from '../src/config/powerups';
import { enemyHitbox } from '../src/entities/enemies/Enemy';
import { heroBox, resizeHero } from '../src/logic/heroBody';
import { NO_INPUT, stepsFor, type HeroInput } from '../src/logic/heroMotion';
import { tileAt } from '../src/logic/level';
import {
  blockRelease,
  collectPower,
  damagePower,
  FORM_TRANSITIONS,
  FORMS,
  hasStar,
  heroHeightFor,
  POWERS,
  START_POWER,
  tickPower,
  type Form,
  type Power,
  type PowerState,
} from '../src/logic/powerups';
import { overlaps } from '../src/logic/tileCollision';
import type { World } from '../src/logic/world';
import { canTransition } from '../src/systems/StateMachine';
import { tileObject } from './helpers/asciiLevel';
import { makeWorld, WorldSim } from './helpers/world';

const T = GAME_CONFIG.tileSize;
const BIG = GAME_CONFIG.bigHeroHeight;
const JUMP: HeroInput = { ...NO_INPUT, jump: true };
const RIGHT: HeroInput = { ...NO_INPUT, right: true };
const ATTACK: HeroInput = { ...NO_INPUT, run: true };

const state = (form: Form, starSteps = 0): PowerState => ({ form, starSteps });

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

/** Põe o herói numa forma, com a altura dela e os pés no mesmo lugar. */
function withForm(sim: WorldSim, form: Form, starSteps = 0): void {
  const w = sim.world;
  sim.world = {
    ...w,
    power: state(form, starSteps),
    hero: resizeHero(w.hero, heroHeightFor(form)),
  };
}

/** Pula do chão uma vez (aperta e segura até cair de novo no chão). */
function jumpOnce(sim: WorldSim): void {
  sim.step(NO_INPUT);
  sim.step(JUMP);
  sim.until(JUMP, (w) => w.hero.contacts.ground, stepsFor(2));
}

/** Aperta o botão de atacar uma vez (solta antes, para o aperto contar). */
function attack(sim: WorldSim): World {
  sim.step(NO_INPUT);
  return sim.step(ATTACK);
}

describe('transições de forma (PowerUpSystem)', () => {
  it('F4-A1: Pichu + Fruta Oran vira Pikachu grande', () => {
    expect(collectPower(START_POWER, 'grow').state.form).toBe('big');
  });

  it('F4-A2: Pikachu + Pedra do Trovão vira Raichu', () => {
    expect(collectPower(state('big'), 'electric').state.form).toBe('electric');
  });

  it('F4-A3: Raichu + dano volta para Pikachu grande, sem morrer', () => {
    expect(damagePower(state('electric'))).toEqual({ state: state('big'), died: false });
  });

  it('F4-A4: Pikachu grande + dano volta para Pichu', () => {
    expect(damagePower(state('big'))).toEqual({ state: state('small'), died: false });
  });

  it('F4-A5: Pichu + dano morre', () => {
    expect(damagePower(state('small')).died).toBe(true);
  });

  it('tabela completa: cada forma com cada item', () => {
    const expected: { readonly [F in Form]: { readonly [P in Power]: Form } } = {
      small: { grow: 'big', electric: 'electric', surf: 'surf', flying: 'flying', star: 'small' },
      big: { grow: 'big', electric: 'electric', surf: 'surf', flying: 'flying', star: 'big' },
      electric: {
        grow: 'electric',
        electric: 'electric',
        surf: 'surf',
        flying: 'flying',
        star: 'electric',
      },
      surf: { grow: 'surf', electric: 'electric', surf: 'surf', flying: 'flying', star: 'surf' },
      flying: {
        grow: 'flying',
        electric: 'electric',
        surf: 'surf',
        flying: 'flying',
        star: 'flying',
      },
    };
    for (const form of FORMS) {
      for (const power of POWERS) {
        const got = collectPower(state(form), power).state;
        expect(got.form, `${form} + ${power}`).toBe(expected[form][power]);
        expect(hasStar(got), `${form} + ${power}`).toBe(power === 'star');
      }
    }
  });

  it('tabela completa: dano em cada forma', () => {
    const expected: { readonly [F in Form]: Form | 'morre' } = {
      small: 'morre',
      big: 'small',
      electric: 'big',
      surf: 'big',
      flying: 'big',
    };
    for (const form of FORMS) {
      const hit = damagePower(state(form));
      expect(hit.died ? 'morre' : hit.state.form, form).toBe(expected[form]);
    }
  });

  it('item que não muda nada avisa que não mudou', () => {
    expect(collectPower(state('big'), 'grow').changed).toBe(false);
    expect(collectPower(state('electric'), 'electric').changed).toBe(false);
    expect(collectPower(state('big'), 'flying').changed).toBe(true);
  });

  it('a tabela de transições recusa pular etapas', () => {
    expect(canTransition(FORM_TRANSITIONS, 'electric', 'small')).toBe(false);
    expect(canTransition(FORM_TRANSITIONS, 'flying', 'small')).toBe(false);
    expect(canTransition(FORM_TRANSITIONS, 'small', 'big')).toBe(true);
  });

  it('F4-A6: a invencibilidade dura exatamente 10 s e depois volta à forma anterior', () => {
    let power = collectPower(state('big'), 'star').state;
    const total = stepsFor(POWERUPS.starTime);
    expect(total).toBe(stepsFor(10));
    for (let i = 0; i < total - 1; i++) {
      power = tickPower(power);
      expect(hasStar(power)).toBe(true);
    }
    power = tickPower(power);
    expect(power).toEqual(state('big'));
  });

  it('pegar outra invencibilidade recomeça a contagem', () => {
    const almostOver = state('small', 5);
    expect(collectPower(almostOver, 'star').state.starSteps).toBe(stepsFor(POWERUPS.starTime));
  });

  it('o herói pequeno tira o item de crescer de um bloco com item especial', () => {
    expect(blockRelease('small', 'electric')).toBe('grow');
    expect(blockRelease('small', 'flying')).toBe('grow');
    expect(blockRelease('small', 'star')).toBe('star');
    expect(blockRelease('big', 'electric')).toBe('electric');
  });

  it('o pequeno tem 16 px de altura; o grande e os especiais, 32', () => {
    expect(heroHeightFor('small')).toBe(16);
    for (const form of FORMS.filter((f) => f !== 'small')) expect(heroHeightFor(form)).toBe(BIG);
  });
});

describe('itens na fase', () => {
  it('pegar a Fruta Oran faz crescer para 32 px, com os pés no mesmo lugar', () => {
    const sim = new WorldSim(makeWorld(ROOM, [tileObject('oran-berry', 4, 6)]));
    expect(sim.world.hero.height).toBe(T);
    expect(sim.until(RIGHT, (w) => w.power.form === 'big', stepsFor(3))).toBe(true);
    expect(sim.world.powerItems).toHaveLength(0);
    expect(sim.world.hero.height).toBe(BIG);
    expect(sim.world.hero.y + sim.world.hero.height).toBe(7 * T);
  });

  it('o item sai do bloco ? subindo e o de crescer anda para longe do herói', () => {
    const sim = new WorldSim(
      makeWorld(ROOM, [tileObject('question-block', 2, 3, { content: 'oran-berry' })]),
    );
    sim.placeHero(2 * T, 6 * T);
    sim.step(NO_INPUT);
    expect(sim.until(JUMP, (w) => w.powerItems.length > 0, stepsFor(1))).toBe(true);
    const item = sim.world.powerItems[0];
    expect(item).toMatchObject({ power: 'grow', state: 'emerge' });
    expect(sim.until(NO_INPUT, (w) => w.powerItems[0]?.state === 'idle', stepsFor(1))).toBe(true);
    expect(sim.world.powerItems[0].y).toBe(2 * T);
    // Depois anda, cai do bloco e segue no chão.
    expect(
      sim.until(
        NO_INPUT,
        (w) => w.powerItems[0]?.ground === true && w.powerItems[0].y === 6 * T,
        stepsFor(4),
      ),
    ).toBe(true);
    expect(sim.world.powerItems[0].x).toBeGreaterThan(2 * T);
  });

  it('o pequeno tira Fruta Oran do bloco da Pedra do Trovão; o grande tira a pedra, que fica parada', () => {
    const block = tileObject('question-block', 2, 3, { content: 'thunder-stone' });
    const small = new WorldSim(makeWorld(ROOM, [block]));
    small.placeHero(2 * T, 6 * T);
    jumpOnce(small);
    expect(small.world.powerItems[0]?.power).toBe('grow');

    const big = new WorldSim(makeWorld(ROOM, [block]));
    big.placeHero(2 * T, 6 * T);
    withForm(big, 'big');
    jumpOnce(big);
    expect(big.world.powerItems[0]?.power).toBe('electric');
    big.hold(NO_INPUT, stepsFor(2));
    expect(big.world.powerItems[0]).toMatchObject({ x: 2 * T, y: 2 * T });
  });

  it('o Doce Raro anda quicando', () => {
    const sim = new WorldSim(makeWorld(ROOM, [tileObject('rare-candy', 10, 6)]));
    const ys = sim.hold(NO_INPUT, stepsFor(2)).map((w) => w.powerItems[0].y);
    expect(Math.min(...ys)).toBeLessThan(6 * T - T);
    expect(sim.world.powerItems[0].x).not.toBe(10 * T);
  });

  it('item posto no Tiled dorme até chegar perto da tela', () => {
    const lines = ['S' + '.'.repeat(63), '#'.repeat(64)];
    const sim = new WorldSim(makeWorld(lines, [tileObject('oran-berry', 50, 0)]), {
      left: 0,
      right: GAME_CONFIG.width,
    });
    sim.hold(NO_INPUT, 30);
    expect(sim.world.powerItems[0]).toMatchObject({ active: false, x: 50 * T });
  });

  it('cada tentativa começa com o herói pequeno', () => {
    expect(makeWorld(ROOM).power).toEqual(START_POWER);
    expect(makeWorld(ROOM).hero.height).toBe(T);
  });
});

describe('tijolo com o herói grande', () => {
  it('a cabeçada quebra o tijolo: ele some da colisão e solta os pedaços', () => {
    const sim = new WorldSim(makeWorld(ROOM, [tileObject('brick-block', 0, 3)]));
    withForm(sim, 'big');
    sim.step(NO_INPUT);
    expect(sim.until(JUMP, (w) => w.blocks.length === 0, stepsFor(1))).toBe(true);
    expect(tileAt(sim.world.collision, 0, 3).kind).toBe('empty');
    expect(sim.world.popups.some((p) => p.kind === 'debris')).toBe(true);
  });
});

describe('dano com power-up', () => {
  const lines = ['S...........', '############'];

  it('grande que encosta num inimigo encolhe, não morre e fica 1,5 s sem tomar dano', () => {
    const sim = new WorldSim(makeWorld(lines, [tileObject('rattata', 4, 0)]));
    withForm(sim, 'big');
    expect(sim.until(RIGHT, (w) => w.power.form === 'small', stepsFor(3))).toBe(true);
    expect(sim.world.hero.height).toBe(T);
    expect(sim.world.hero.y + T).toBe(T);
    expect(sim.eventsOf('player-damaged')).toHaveLength(1);
    // Encostado no inimigo durante a invencibilidade: nada acontece.
    sim.hold(RIGHT, stepsFor(PHYSICS.hurtInvincibilityTime) - 2);
    expect(sim.world.hero.motion.state).not.toBe('dead');
    expect(sim.eventsOf('player-damaged')).toHaveLength(1);
  });

  it('Raichu que toma dano na fase volta para Pikachu grande', () => {
    const sim = new WorldSim(makeWorld(lines, [tileObject('rattata', 4, 0)]));
    withForm(sim, 'electric');
    expect(sim.until(RIGHT, (w) => w.power.form !== 'electric', stepsFor(3))).toBe(true);
    expect(sim.world.power.form).toBe('big');
    expect(sim.world.hero.height).toBe(BIG);
  });
});

describe('invencível (F4-A7)', () => {
  const lines = ['S...........', '############'];

  it('inimigo morre ao contato e o herói não toma dano', () => {
    const sim = new WorldSim(makeWorld(lines, [tileObject('rattata', 4, 0)]));
    withForm(sim, 'small', stepsFor(POWERUPS.starTime));
    expect(sim.until(RIGHT, (w) => w.enemies[0]?.state === 'dead', stepsFor(3))).toBe(true);
    expect(sim.eventsOf('player-damaged')).toHaveLength(0);
    expect(sim.world.power.form).toBe('small');
    expect(sim.world.hero.motion.state).not.toBe('dead');
  });

  it('o Geodude é imune, mas também não machuca', () => {
    const sim = new WorldSim(makeWorld(lines, [tileObject('geodude', 4, 0)]));
    withForm(sim, 'small', stepsFor(POWERUPS.starTime));
    const touching = sim.hold(RIGHT, stepsFor(2)).filter((w) => {
      const box = enemyHitbox(w.enemies[0]);
      return box !== null && overlaps(heroBox(w.hero), box);
    });
    expect(touching.length).toBeGreaterThan(0);
    expect(sim.world.enemies).toHaveLength(1);
    expect(sim.world.hero.motion.state).not.toBe('dead');
  });
});

describe('faísca do Raichu', () => {
  const lines = ['................', '................', 'S...............', '################'];

  it('o aperto solta uma faísca; segurar o botão não solta outra', () => {
    const sim = new WorldSim(makeWorld(lines));
    withForm(sim, 'electric');
    attack(sim);
    expect(sim.world.sparks).toHaveLength(1);
    sim.hold(ATTACK, 10);
    expect(sim.world.sparks).toHaveLength(1);
    expect(sim.world.sparks[0].vx).toBe(POWERUPS.spark.speed);
  });

  it('no máximo 2 faíscas na tela', () => {
    const sim = new WorldSim(makeWorld(lines));
    withForm(sim, 'electric');
    for (let i = 0; i < 4; i++) attack(sim);
    expect(sim.world.sparks).toHaveLength(POWERUPS.spark.max);
  });

  it('quica no chão', () => {
    const sim = new WorldSim(makeWorld(lines));
    withForm(sim, 'electric');
    attack(sim);
    expect(sim.until(NO_INPUT, (w) => (w.sparks[0]?.vy ?? 0) < 0, stepsFor(1))).toBe(true);
    expect(sim.world.sparks[0].vy).toBe(-POWERUPS.spark.bounce);
  });

  it('some ao bater numa parede', () => {
    const walled = ['.......#', '.......#', 'S......#', '########'];
    const sim = new WorldSim(makeWorld(walled));
    withForm(sim, 'electric');
    attack(sim);
    expect(sim.until(NO_INPUT, (w) => w.sparks.length === 0, stepsFor(2))).toBe(true);
  });

  it('derrota o inimigo que toca e some; o Geodude é imune', () => {
    const sim = new WorldSim(makeWorld(lines, [tileObject('rattata', 10, 2)]));
    withForm(sim, 'electric');
    attack(sim);
    expect(sim.until(NO_INPUT, (w) => w.enemies[0]?.state === 'dead', stepsFor(2))).toBe(true);
    expect(sim.world.sparks).toHaveLength(0);

    const rock = new WorldSim(makeWorld(lines, [tileObject('geodude', 10, 1)]));
    withForm(rock, 'electric');
    attack(rock);
    expect(rock.until(NO_INPUT, (w) => w.sparks.length === 0, stepsFor(2))).toBe(true);
    expect(rock.world.enemies[0].state).toBe('wait');
  });

  it('só o Raichu solta faísca', () => {
    const sim = new WorldSim(makeWorld(lines));
    withForm(sim, 'big');
    attack(sim);
    expect(sim.world.sparks).toHaveLength(0);
  });
});

describe('Pikachu Voador', () => {
  const tall = [
    'S...............',
    ...Array<string>(20).fill('................'),
    '################',
  ];

  it('segurando o pulo na queda, plana: cai no máximo a glideFallSpeed', () => {
    const glide = new WorldSim(makeWorld(tall));
    withForm(glide, 'flying');
    const falling = glide.hold(JUMP, stepsFor(1)).map((w) => w.hero.motion.vy);
    expect(Math.max(...falling)).toBe(POWERUPS.glideFallSpeed);

    const plain = new WorldSim(makeWorld(tall));
    withForm(plain, 'flying');
    expect(Math.max(...plain.hold(NO_INPUT, stepsFor(1)).map((w) => w.hero.motion.vy))).toBe(
      PHYSICS.maxFallSpeed,
    );
  });

  it('outra forma, mesmo segurando o pulo, cai normalmente', () => {
    const sim = new WorldSim(makeWorld(tall));
    withForm(sim, 'big');
    expect(Math.max(...sim.hold(JUMP, stepsFor(1)).map((w) => w.hero.motion.vy))).toBe(
      PHYSICS.maxFallSpeed,
    );
  });

  const floor = ['................', '................', 'S...............', '################'];

  it('o giro no ar derrota o inimigo ao lado, dentro do alcance', () => {
    const sim = new WorldSim(makeWorld(floor, [tileObject('rattata', 6, 2)]));
    withForm(sim, 'flying');
    const enemy = sim.world.enemies[0];
    // No ar, ao lado do inimigo, sem encostar nele.
    sim.placeHero(enemy.x - T - POWERUPS.spin.reach / 2, enemy.y - BIG);
    expect(heroBox(sim.world.hero).x + T).toBeLessThan(enemy.x);
    attack(sim);
    expect(sim.world.spinSteps).toBeGreaterThan(0);
    expect(sim.world.enemies[0].state).toBe('dead');
    expect(sim.world.power.form).toBe('flying');
  });

  it('no chão não há giro', () => {
    const sim = new WorldSim(makeWorld(floor));
    withForm(sim, 'flying');
    sim.hold(NO_INPUT, 5);
    attack(sim);
    expect(sim.world.spinSteps).toBe(0);
  });
});
