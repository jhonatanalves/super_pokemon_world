import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { NO_INPUT, stepsFor, type HeroInput } from '../src/logic/heroMotion';
import { parseLevel } from '../src/logic/level';
import { heroHeightFor } from '../src/logic/powerups';
import { newSession } from '../src/logic/session';
import { createWorld, type World } from '../src/logic/world';
import { resizeHero } from '../src/logic/heroBody';
import { CONTENT, WorldSim } from './helpers/world';

const T = GAME_CONFIG.tileSize;
const MAP_PATH = new URL('../public/assets/levels/test-f5.json', import.meta.url);

const level = parseLevel(JSON.parse(readFileSync(MAP_PATH, 'utf-8')), T);
const built = createWorld(level, CONTENT, newSession());
const world = built.world;

/** Fase sem inimigos, para os robôs só testarem o caminho. */
const empty = (w: World): World => ({ ...w, enemies: [] });

describe('fase de teste da F5a', () => {
  it('carrega sem erros, com 7 telas de largura e 1 de altura', () => {
    expect(built.errors).toEqual([]);
    expect(level.width).toBe(7 * GAME_CONFIG.width);
    expect(level.height).toBe(GAME_CONFIG.height);
  });

  it('tem a fita, a chave, a fechadura, duas conchas e um checkpoint', () => {
    expect(world.goal).not.toBeNull();
    expect(world.key).not.toBeNull();
    expect(world.keyhole).not.toBeNull();
    expect(world.enemies.filter((e) => e.behavior === 'shell')).toHaveLength(2);
    expect(world.checkpoint).not.toBeNull();
  });

  it.each([
    ['pequeno', 'small'],
    ['grande', 'big'],
  ] as const)('o herói %s chega à fita correndo e pulando', (_, form) => {
    // Sem a chave, a fechadura não acaba a fase no caminho.
    const start = { ...empty(world), key: null, power: { form, starSteps: 0 } };
    const sim = new WorldSim({ ...start, hero: resizeHero(start.hero, heroHeightFor(form)) });
    // Robô cego, como os das outras fases: corre e pula sem parar.
    let jump = false;
    for (let i = 0; i < stepsFor(40) && !sim.world.clear; i++) {
      jump = sim.world.hero.contacts.ground ? !jump : true;
      sim.step({ ...NO_INPUT, right: true, run: true, jump });
      expect(sim.world.hero.motion.state).not.toBe('dead');
    }
    expect(sim.eventsOf('level-complete')).toMatchObject([{ exit: 'normal' }]);
  });

  it('segurando X, o herói pega a chave no caminho e a leva até a fechadura', () => {
    const sim = new WorldSim(empty(world));
    let jump = false;
    for (let i = 0; i < stepsFor(20) && !sim.world.clear; i++) {
      // Pula só quando encosta numa parede, segurando o botão enquanto sobe.
      const h = sim.world.hero;
      jump = h.contacts.wallRight || (!h.contacts.ground && h.motion.vy < 0 && jump);
      const input: HeroInput = { ...NO_INPUT, right: true, run: true, jump };
      sim.step(input);
    }
    expect(sim.eventsOf('level-complete')).toEqual([
      { type: 'level-complete', exit: 'secret', stars: 0, totalStars: 0 },
    ]);
  });
});
