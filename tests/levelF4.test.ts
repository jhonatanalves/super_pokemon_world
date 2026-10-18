import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { RULES } from '../src/config/rules';
import { createHeroBody, stepHeroBody } from '../src/logic/heroBody';
import { NO_INPUT, stepsFor } from '../src/logic/heroMotion';
import { parseLevel } from '../src/logic/level';
import { heroHeightFor, POWERS } from '../src/logic/powerups';
import { newSession } from '../src/logic/session';
import { createWorld } from '../src/logic/world';
import { CONTENT } from './helpers/world';

const T = GAME_CONFIG.tileSize;
const MAP_PATH = new URL('../public/assets/levels/test-f4.json', import.meta.url);

const level = parseLevel(JSON.parse(readFileSync(MAP_PATH, 'utf-8')), T);
const built = createWorld(level, CONTENT, newSession());
const world = built.world;

describe('fase de teste da F4', () => {
  it('carrega sem erros, com 6 telas de largura e 1 de altura', () => {
    expect(built.errors).toEqual([]);
    expect(level.width).toBe(6 * GAME_CONFIG.width);
    expect(level.height).toBe(GAME_CONFIG.height);
  });

  it('tem todos os power-ups, em blocos ou no chão', () => {
    const inBlocks = world.blocks.flatMap((b) =>
      b.content && b.content !== 'coin' ? [b.content] : [],
    );
    const placed = world.powerItems.map((i) => i.power);
    expect(new Set([...inBlocks, ...placed])).toEqual(new Set(POWERS));
  });

  it('tem tijolos, inimigos (com um imune a ataques), 5 Moedas Pokébola e 1 checkpoint', () => {
    expect(world.blocks.filter((b) => b.kind === 'brick').length).toBeGreaterThan(2);
    const behaviors = new Set(world.enemies.map((e) => e.behavior));
    for (const b of ['walker', 'shell', 'flyer', 'dropper']) expect(behaviors).toContain(b);
    expect(world.pokeballsTotal).toBe(RULES.pokeballsPerLevel);
    expect(world.checkpoint).not.toBeNull();
  });

  it.each([
    ['pequeno', heroHeightFor('small')],
    ['grande', heroHeightFor('big')],
  ])('o terreno é atravessável do início ao fim pelo herói %s', (_, height) => {
    // Robô cego, como os da F2 e da F3, sem os inimigos.
    let body = createHeroBody(level.spawn, height);
    let jump = false;
    const end = level.width - GAME_CONFIG.heroWidth;
    for (let i = 0; i < stepsFor(60) && body.x < end; i++) {
      jump = body.contacts.ground ? !jump : true;
      body = stepHeroBody(body, { ...NO_INPUT, right: true, run: true, jump }, world.collision);
      expect(body.motion.state).not.toBe('dead');
    }
    expect(body.x).toBe(end);
  });
});
