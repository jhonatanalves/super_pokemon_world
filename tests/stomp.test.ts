import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { PHYSICS } from '../src/config/physics';
import { RULES } from '../src/config/rules';
import { NO_INPUT, stepsFor, type HeroInput } from '../src/logic/heroMotion';
import { isStomp } from '../src/logic/stomp';
import type { Box } from '../src/logic/tileCollision';
import { tileObject } from './helpers/asciiLevel';
import { makeWorld, WorldSim } from './helpers/world';

const T = GAME_CONFIG.tileSize;
const RIGHT: HeroInput = { ...NO_INPUT, right: true };
const JUMP: HeroInput = { ...NO_INPUT, jump: true };

// Chão em y = 96 (linha 6).
const FLOOR = [
  '................',
  '................',
  '................',
  '................',
  '................',
  'S...............',
  '################',
];

/** Herói caindo de 3 tiles de altura bem em cima do inimigo andando. */
function heroAboveWalker(): WorldSim {
  const sim = new WorldSim(makeWorld(FLOOR, [tileObject('rattata', 8, 5)]));
  const walker = sim.world.enemies[0];
  sim.placeHero(walker.x, walker.y - 3 * T);
  return sim;
}

describe('regra do pisão (função pura)', () => {
  const enemy: Box = { x: 0, y: 80, width: 16, height: 16 };
  const heroWithFeetAt = (feet: number): Box => ({ x: 0, y: feet - 16, width: 16, height: 16 });

  it('vale caindo com o pé acima do centro do inimigo', () => {
    expect(isStomp(heroWithFeetAt(84), 100, enemy)).toBe(true);
  });

  it('não vale com o pé abaixo do centro', () => {
    expect(isStomp(heroWithFeetAt(90), 100, enemy)).toBe(false);
  });

  it('não vale subindo nem parado, mesmo com o pé acima do centro (F3-A5)', () => {
    expect(isStomp(heroWithFeetAt(84), -100, enemy)).toBe(false);
    expect(isStomp(heroWithFeetAt(84), 0, enemy)).toBe(false);
  });
});

describe('pisão na fase', () => {
  it('F3-A2: pisão válido mata o inimigo e o herói quica a 250 px/s', () => {
    const sim = heroAboveWalker();
    expect(sim.until(NO_INPUT, (w) => w.enemies[0]?.state === 'squashed', stepsFor(2))).toBe(true);
    expect(sim.world.hero.motion.vy).toBe(-PHYSICS.stompBounce);
    expect(sim.world.hero.motion.vy).toBe(-250);
    expect(sim.world.hero.motion.state).toBe('jump');
    expect(sim.world.session.lives).toBe(RULES.startLives);
    expect(sim.eventsOf('player-damaged')).toHaveLength(0);
  });

  it('F3-A3: segurando o pulo, o quique é de 380 px/s', () => {
    const sim = heroAboveWalker();
    expect(sim.until(JUMP, (w) => w.enemies[0]?.state === 'squashed', stepsFor(2))).toBe(true);
    expect(sim.world.hero.motion.vy).toBe(-PHYSICS.stompBounceHeld);
    expect(sim.world.hero.motion.vy).toBe(-380);
  });

  it('o corpo pisado some depois de um tempo', () => {
    const sim = heroAboveWalker();
    sim.until(NO_INPUT, (w) => w.enemies[0]?.state === 'squashed', stepsFor(2));
    expect(sim.until(NO_INPUT, (w) => w.enemies.length === 0, stepsFor(2))).toBe(true);
  });
});

describe('dano por contato', () => {
  it('F3-A4 e F3-A7: encostar de lado mata o herói pequeno e tira 1 vida', () => {
    const sim = new WorldSim(makeWorld(FLOOR, [tileObject('rattata', 8, 5)]));
    expect(sim.until(RIGHT, (w) => w.hero.motion.state === 'dead', stepsFor(5))).toBe(true);
    expect(sim.world.enemies[0].state).toBe('walk');
    expect(sim.world.session.lives).toBe(RULES.startLives - 1);
    expect(sim.eventsOf('player-damaged')).toHaveLength(1);
    expect(sim.eventsOf('player-died')).toEqual([
      { type: 'player-died', lives: RULES.startLives - 1 },
    ]);
  });

  it('F3-A5: subindo e tocando o inimigo por baixo, o herói toma dano', () => {
    // Inimigo numa plataforma de mão única; o herói pula por baixo dela.
    const lines = [
      '................',
      '................',
      '................',
      '.....======.....',
      '................',
      'S...............',
      '################',
    ];
    const sim = new WorldSim(makeWorld(lines, [tileObject('rattata', 7, 2)]));
    const walker = sim.world.enemies[0];
    sim.placeHero(walker.x, 5 * T);
    sim.step(NO_INPUT);
    let vyAtHit = 0;
    const died = sim.until(
      JUMP,
      (w) => {
        if (w.hero.motion.state !== 'dead') vyAtHit = w.hero.motion.vy;
        return w.hero.motion.state === 'dead';
      },
      stepsFor(2),
    );
    expect(died).toBe(true);
    expect(vyAtHit).toBeLessThan(0);
    expect(sim.world.enemies[0].state).toBe('walk');
  });

  it('cair num buraco também tira 1 vida', () => {
    const lines = ['S.......', '##....##'];
    const sim = new WorldSim(makeWorld(lines));
    expect(sim.until(RIGHT, (w) => w.hero.motion.state === 'dead', stepsFor(5))).toBe(true);
    expect(sim.world.session.lives).toBe(RULES.startLives - 1);
    expect(sim.eventsOf('player-died')).toHaveLength(1);
  });

  it('com o herói morto o resto da fase congela', () => {
    const sim = new WorldSim(makeWorld(FLOOR, [tileObject('rattata', 8, 5)]));
    sim.until(RIGHT, (w) => w.hero.motion.state === 'dead', stepsFor(5));
    const frozen = sim.world.enemies;
    sim.hold(NO_INPUT, 10);
    expect(sim.world.enemies).toBe(frozen);
    expect(sim.eventsOf('player-died')).toHaveLength(1);
  });
});
