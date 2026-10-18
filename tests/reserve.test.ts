import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { POWERUPS } from '../src/config/powerups';
import type { GameEvent } from '../src/logic/events';
import { resizeHero } from '../src/logic/heroBody';
import { NO_INPUT, stepsFor, type HeroInput } from '../src/logic/heroMotion';
import {
  applyHudEvent,
  EMPTY_HUD,
  HUD_EVENTS,
  hudFormText,
  hudPokeballText,
  hudText,
  type HudState,
} from '../src/logic/hud';
import {
  collectPower,
  heroHeightFor,
  useReserve,
  type Form,
  type PowerState,
  type Reserve,
} from '../src/logic/powerups';
import { newSession } from '../src/logic/session';
import { createWorld, levelStartedEvent, type View } from '../src/logic/world';
import { EventBus } from '../src/systems/EventBus';
import { asciiLevel, tileObject } from './helpers/asciiLevel';
import { CONTENT, makeWorld, WorldSim } from './helpers/world';

const T = GAME_CONFIG.tileSize;
const RIGHT: HeroInput = { ...NO_INPUT, right: true };
const RESERVE: HeroInput = { ...NO_INPUT, reserve: true };
const SCREEN: View = { left: 0, right: GAME_CONFIG.width };

const state = (form: Form, starSteps = 0): PowerState => ({ form, starSteps });
const LINES = ['S...............', '################'];

/** Fase com o herói numa forma e a reserva já com um item. */
function simWith(form: Form, reserve: Reserve, objects = [tileObject('oran-berry', 4, 0)]) {
  const world = makeWorld(LINES, objects, { ...newSession(), reserve });
  const sim = new WorldSim(
    { ...world, power: state(form), hero: resizeHero(world.hero, heroHeightFor(form)) },
    SCREEN,
  );
  return sim;
}

describe('caixa de reserva: regras', () => {
  it('F4-A8: item coletado com a forma já cheia vai para a reserva', () => {
    expect(collectPower(state('big'), 'grow')).toEqual({
      state: state('big'),
      reserve: 'grow',
      changed: false,
    });
    expect(collectPower(state('electric'), 'electric').reserve).toBe('electric');
    expect(collectPower(state('flying'), 'grow').reserve).toBe('grow');
  });

  it('F4-A8: ativar a reserva aplica o item e esvazia a caixa', () => {
    expect(useReserve(state('small'), 'grow')).toEqual({ state: state('big'), reserve: null });
    expect(useReserve(state('big'), 'flying')).toEqual({ state: state('flying'), reserve: null });
  });

  it('F4-A9: com a reserva cheia, o item novo é ignorado e não substitui o guardado', () => {
    expect(collectPower(state('big'), 'grow', 'flying').reserve).toBe('flying');
    expect(collectPower(state('electric'), 'electric', 'grow').reserve).toBe('grow');
  });

  it('trocar de especial guarda o antigo, se a reserva estiver vazia', () => {
    expect(collectPower(state('electric'), 'flying')).toMatchObject({
      state: state('flying'),
      reserve: 'electric',
    });
    expect(collectPower(state('electric'), 'flying', 'grow').reserve).toBe('grow');
    // Do grande ou do pequeno para um especial, nada vai para a reserva.
    expect(collectPower(state('big'), 'flying').reserve).toBeNull();
    expect(collectPower(state('small'), 'grow').reserve).toBeNull();
  });

  it('a invencibilidade nunca vai para a reserva', () => {
    expect(collectPower(state('big'), 'star').reserve).toBeNull();
    expect(collectPower(state('big'), 'star', 'grow').reserve).toBe('grow');
  });

  it('ativar um item que não muda nada deixa ele guardado', () => {
    expect(useReserve(state('big'), 'grow')).toEqual({ state: state('big'), reserve: 'grow' });
    expect(useReserve(state('surf'), 'surf')).toEqual({ state: state('surf'), reserve: 'surf' });
  });

  it('ativar outro especial guarda o atual na caixa', () => {
    expect(useReserve(state('electric'), 'flying')).toEqual({
      state: state('flying'),
      reserve: 'electric',
    });
  });

  it('ativar a reserva vazia não faz nada', () => {
    expect(useReserve(state('big'), null)).toEqual({ state: state('big'), reserve: null });
  });
});

describe('caixa de reserva na fase', () => {
  it('pegar a Fruta Oran já grande guarda ela e emite "reserve-changed"', () => {
    const sim = simWith('big', null);
    expect(sim.until(RIGHT, (w) => w.session.reserve !== null, stepsFor(3))).toBe(true);
    expect(sim.world.session.reserve).toBe('grow');
    expect(sim.world.power.form).toBe('big');
    expect(sim.eventsOf('reserve-changed')).toEqual([{ type: 'reserve-changed', reserve: 'grow' }]);
  });

  it('com a reserva cheia, o item pego some sem trocar o guardado', () => {
    const sim = simWith('big', 'flying');
    expect(sim.until(RIGHT, (w) => w.powerItems.length === 0, stepsFor(3))).toBe(true);
    expect(sim.world.session.reserve).toBe('flying');
    expect(sim.eventsOf('reserve-changed')).toHaveLength(0);
  });

  it('o botão da reserva aplica o item: o pequeno cresce e a caixa esvazia', () => {
    const sim = simWith('small', 'grow', []);
    sim.step(NO_INPUT);
    sim.step(RESERVE);
    expect(sim.world.power.form).toBe('big');
    expect(sim.world.hero.height).toBe(heroHeightFor('big'));
    expect(sim.world.session.reserve).toBeNull();
    expect(sim.eventsOf('power-changed')).toEqual([
      { type: 'power-changed', form: 'big', star: false },
    ]);
    expect(sim.eventsOf('reserve-changed')).toEqual([{ type: 'reserve-changed', reserve: null }]);
  });

  it('segurar o botão desde o começo da fase não usa a reserva', () => {
    const sim = simWith('small', 'grow', []);
    sim.hold(RESERVE, 10);
    expect(sim.world.power.form).toBe('small');
    expect(sim.world.session.reserve).toBe('grow');
  });

  it('o dano solta o item da reserva: ele cai do alto, no meio da tela, atravessando o cenário', () => {
    const sim = simWith('big', 'flying', [tileObject('rattata', 6, 0)]);
    expect(sim.until(RIGHT, (w) => w.power.form === 'small', stepsFor(3))).toBe(true);
    expect(sim.world.session.reserve).toBeNull();
    const dropped = sim.world.powerItems[0];
    expect(dropped).toMatchObject({ power: 'flying', state: 'drop', y: -POWERUPS.item.height });
    expect(dropped.x + dropped.width / 2).toBe(GAME_CONFIG.width / 2);
    // Sem pegar, ele passa pelo chão e some por baixo da fase.
    const floorY = T;
    sim.until(NO_INPUT, (w) => (w.powerItems[0]?.y ?? Infinity) > floorY, stepsFor(3));
    expect(sim.world.powerItems[0]?.y ?? Infinity).toBeGreaterThan(floorY);
    expect(sim.until(NO_INPUT, (w) => w.powerItems.length === 0, stepsFor(3))).toBe(true);
  });

  it('pegar o item que caiu da reserva aplica ele', () => {
    const sim = simWith('small', null, []);
    const center = GAME_CONFIG.width / 2;
    sim.world = {
      ...sim.world,
      powerItems: [
        {
          id: 9,
          power: 'grow',
          x: center - 8,
          y: -16,
          width: 16,
          height: 16,
          state: 'drop',
          stateSteps: 0,
          active: true,
          dir: 1,
          vy: POWERUPS.item.dropSpeed,
          ground: false,
          targetY: -16,
        },
      ],
    };
    sim.placeHero(center - 8, 0);
    expect(sim.until(NO_INPUT, (w) => w.power.form === 'big', stepsFor(2))).toBe(true);
  });

  it('a reserva passa de uma tentativa para a outra', () => {
    const level = asciiLevel(LINES);
    const retry = createWorld(level, CONTENT, { ...newSession(), reserve: 'electric' }).world;
    expect(levelStartedEvent(retry)).toMatchObject({ reserve: 'electric', form: 'small' });
  });

  it('o fim da invencibilidade emite "power-changed"', () => {
    const sim = simWith('big', null, []);
    sim.world = { ...sim.world, power: state('big', 2) };
    sim.hold(NO_INPUT, 3);
    expect(sim.eventsOf('power-changed')).toEqual([
      { type: 'power-changed', form: 'big', star: false },
    ]);
  });
});

describe('HUD da F4b', () => {
  it('mostra a forma e a reserva só pelos eventos', () => {
    const bus = new EventBus();
    let hud: HudState = EMPTY_HUD;
    for (const type of HUD_EVENTS) bus.on(type, (e) => (hud = applyHudEvent(hud, e)));

    const sim = simWith('big', null);
    bus.emit(levelStartedEvent(sim.world));
    expect(hud).toMatchObject({ form: 'big', reserve: null });
    sim.until(RIGHT, (w) => w.session.reserve !== null, stepsFor(3));
    sim.step(NO_INPUT);
    for (const event of sim.events) bus.emit(event);
    expect(hud.reserve).toBe('grow');

    const events: GameEvent[] = [{ type: 'power-changed', form: 'electric', star: true }];
    for (const event of events) bus.emit(event);
    expect(hud).toMatchObject({ form: 'electric', star: true });
  });

  it('o texto usa o nome da forma de creatures.json e marca a invencibilidade', () => {
    const hud: HudState = { ...EMPTY_HUD, form: 'big', star: true, lives: 4, coins: 7 };
    expect(hudFormText(hud, CONTENT.forms)).toBe(
      `${CONTENT.forms.big.name.toUpperCase()}  INVENCÍVEL`,
    );
    expect(hudFormText({ ...hud, star: false }, CONTENT.forms)).toBe(
      CONTENT.forms.big.name.toUpperCase(),
    );
    expect(hudText(hud)).toBe('VIDAS 4  MOEDAS 07');
    expect(hudPokeballText({ ...hud, pokeballs: 2, pokeballsTotal: 5 })).toBe('POKÉBOLAS 2/5');
  });
});
