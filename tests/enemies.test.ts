import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/config/enemies';
import { GAME_CONFIG } from '../src/config/game';
import { FIXED_DT } from '../src/config/physics';
import type { DropperEnemy } from '../src/entities/enemies/DropperEnemy';
import { enemyHitbox, hitByShell, stepEnemy, type Enemy } from '../src/entities/enemies/Enemy';
import type { EnemyContext } from '../src/entities/enemies/EnemyBase';
import type { FlyerEnemy } from '../src/entities/enemies/FlyerEnemy';
import type { PiperEnemy } from '../src/entities/enemies/PiperEnemy';
import {
  createShell,
  kickShell,
  SHELL_TRANSITIONS,
  stompShell,
  type ShellEnemy,
} from '../src/entities/enemies/ShellEnemy';
import { WALKER_TRANSITIONS, type WalkerEnemy } from '../src/entities/enemies/WalkerEnemy';
import { createEnemy } from '../src/entities/EntityFactory';
import { NO_INPUT, stepsFor, type HeroInput } from '../src/logic/heroMotion';
import type { Level } from '../src/logic/level';
import { newSession } from '../src/logic/session';
import { createWorld } from '../src/logic/world';
import { canTransition } from '../src/systems/StateMachine';
import { asciiLevel, tileObject } from './helpers/asciiLevel';
import { CREATURES, makeWorld, WorldSim } from './helpers/world';

const T = GAME_CONFIG.tileSize;
const RIGHT: HeroInput = { ...NO_INPUT, right: true };

const FLOOR = [
  '................',
  '................',
  '................',
  '................',
  '................',
  'S...............',
  '################',
];

/** Inimigo acordado andando sozinho, com o herói parado em `hero`. */
function run<E extends Enemy>(enemy: E, level: Level, steps: number, hero = { x: 0, y: 0 }): E[] {
  const ctx: EnemyContext = { level, hero: { ...hero, width: T, height: T }, dt: FIXED_DT };
  const history: E[] = [];
  let e: Enemy = { ...enemy, active: true };
  for (let i = 0; i < steps; i++) {
    e = stepEnemy(e, ctx);
    history.push(e as E);
  }
  return history;
}

function spawn<E extends Enemy>(type: string, col: number, row: number, cols = 1): E {
  const result = createEnemy(tileObject(type, col, row, {}, cols), 0, CREATURES);
  if (!result.ok) throw new Error(result.error);
  return result.enemy as E;
}

describe('fábrica de entidades (F3-A1)', () => {
  it('objeto "rattata" gera WalkerEnemy, com os pés no centro da base do objeto', () => {
    const result = createEnemy(tileObject('rattata', 3, 5), 7, CREATURES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.enemy.behavior).toBe('walker');
    expect(result.enemy).toMatchObject({ id: 7, creature: 'rattata', state: 'walk' });
    expect(result.enemy.x + result.enemy.width / 2).toBe(3.5 * T);
    expect(result.enemy.y + result.enemy.height).toBe(6 * T);
  });

  it('cada criatura do creatures.json gera a classe do seu comportamento', () => {
    for (const [type, creature] of CREATURES) {
      const result = createEnemy(tileObject(type, 3, 5), 0, CREATURES);
      expect(result.ok && result.enemy.behavior).toBe(creature.behavior);
    }
  });

  it('tipo desconhecido gera erro claro, sem exceção, e a fase segue sem ele', () => {
    const result = createEnemy(tileObject('missingno', 3, 5), 0, CREATURES);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/desconhecido "missingno".*creatures\.json/);

    const level = asciiLevel(
      ['S.......', '########'],
      [tileObject('missingno', 3, 0), tileObject('rattata', 5, 0)],
    );
    const built = createWorld(level, CREATURES, newSession());
    expect(built.errors).toHaveLength(1);
    expect(built.errors[0]).toMatch(/missingno/);
    expect(built.world.enemies.map((e) => e.creature)).toEqual(['rattata']);
  });
});

describe('máquinas de estado dos inimigos', () => {
  it('rejeitam transições inválidas', () => {
    expect(canTransition(WALKER_TRANSITIONS, 'squashed', 'walk')).toBe(false);
    expect(canTransition(SHELL_TRANSITIONS, 'shell', 'walk')).toBe(false);
    expect(canTransition(SHELL_TRANSITIONS, 'dead', 'slide')).toBe(false);
  });
});

describe('WalkerEnemy', () => {
  it('anda e vira ao bater na parede, sem ficar preso', () => {
    const level = asciiLevel(['S........', '........#', '#########']);
    const walker: WalkerEnemy = { ...spawn<WalkerEnemy>('rattata', 4, 1), dir: 1 };
    const history = run(walker, level, stepsFor(6));
    expect(history.some((e) => e.dir === -1)).toBe(true);
    const xs = history.map((e) => e.x);
    expect(Math.max(...xs)).toBeLessThanOrEqual(8 * T - walker.width);
    // Depois de virar, continua andando para a esquerda.
    expect(history.at(-1)!.x).toBeLessThan(Math.max(...xs));
  });

  it('cai da borda e some ao passar do fundo da fase', () => {
    const level = asciiLevel(['S.......', '####....']);
    const walker: WalkerEnemy = { ...spawn<WalkerEnemy>('rattata', 3, 0), dir: 1 };
    const history = run(walker, level, stepsFor(5));
    expect(history.at(-1)!.y).toBeGreaterThan(level.height);
  });

  it('dorme até chegar perto da tela e, acordado, continua existindo fora dela', () => {
    const lines = ['S' + '.'.repeat(63), '#'.repeat(64)];
    const world = makeWorld(lines, [tileObject('rattata', 40, 0)]);
    const far = new WorldSim(world, { left: 0, right: GAME_CONFIG.width });
    far.hold(NO_INPUT, 30);
    expect(far.world.enemies[0]).toMatchObject({ active: false, x: world.enemies[0].x });

    const near = new WorldSim(world, { left: 30 * T, right: 30 * T + GAME_CONFIG.width });
    near.hold(NO_INPUT, 2);
    expect(near.world.enemies[0].active).toBe(true);
    // A tela volta para o começo: o inimigo segue andando.
    const back = new WorldSim(near.world, { left: 0, right: GAME_CONFIG.width });
    const before = back.world.enemies[0].x;
    back.hold(NO_INPUT, 30);
    expect(back.world.enemies).toHaveLength(1);
    expect(back.world.enemies[0].x).not.toBe(before);
  });
});

describe('ShellEnemy e a concha (F3-A6)', () => {
  it('pisão fecha na concha; tocar na concha a chuta para longe do herói', () => {
    const shell = { ...createShell(0, 'shellder', { x: 5 * T, y: 6 * T }), active: true };
    const closed = stompShell(shell, 0);
    expect(closed.state).toBe('shell');
    const kicked = kickShell({ ...closed, graceSteps: 0 }, 0);
    expect(kicked.state).toBe('slide');
    expect(kicked.dir).toBe(1);
    expect(kickShell({ ...closed, graceSteps: 0 }, 10 * T).dir).toBe(-1);
    // Pisar na concha deslizando faz ela parar.
    expect(stompShell(kicked, 0).state).toBe('shell');
  });

  it('pisar no Shellder, chutar a concha e ela matar outro inimigo', () => {
    const lines = [
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      'S.......................',
      '########################',
    ];
    const sim = new WorldSim(
      makeWorld(lines, [tileObject('shellder', 4, 5), tileObject('rattata', 14, 5)]),
    );
    const shell = sim.world.enemies[0];
    sim.placeHero(shell.x, shell.y - 3 * T);

    const shellOf = () => sim.world.enemies.find((e) => e.id === 0) as ShellEnemy | undefined;
    const walkerOf = () => sim.world.enemies.find((e) => e.id === 1);
    expect(sim.until(NO_INPUT, () => shellOf()?.state === 'shell', stepsFor(2))).toBe(true);
    expect(sim.world.hero.motion.vy).toBeLessThan(0);

    // O herói cai de novo sobre a concha parada e a chuta para a direita.
    expect(sim.until(NO_INPUT, () => shellOf()?.state === 'slide', stepsFor(2))).toBe(true);
    expect(shellOf()?.dir).toBe(1);
    expect(sim.until(NO_INPUT, () => walkerOf()?.state === 'dead', stepsFor(3))).toBe(true);
    expect(sim.world.hero.motion.state).not.toBe('dead');
  });

  it('a concha chutada desliza, bate na parede e volta', () => {
    const level = asciiLevel(['S......#', '########']);
    const shell: ShellEnemy = {
      ...createShell(0, 'shellder', { x: 3 * T, y: T }),
      active: true,
      state: 'slide',
      dir: 1,
    };
    const history = run(shell, level, stepsFor(1));
    expect(history.some((e) => e.dir === -1)).toBe(true);
    expect(Math.max(...history.map((e) => e.x))).toBeLessThanOrEqual(7 * T - shell.width);
  });

  it('encostar de lado na concha deslizando machuca', () => {
    const lines = ['S...........', '############'];
    const sim = new WorldSim(makeWorld(lines, [tileObject('shellder', 9, 0)]));
    const shell = sim.world.enemies[0] as ShellEnemy;
    sim.world = {
      ...sim.world,
      enemies: [{ ...shell, active: true, state: 'slide', dir: -1, graceSteps: 0 }],
    };
    expect(sim.until(NO_INPUT, (w) => w.hero.motion.state === 'dead', stepsFor(3))).toBe(true);
  });
});

describe('FlyerEnemy', () => {
  it('voa em onda: sobe e desce em torno do ponto inicial, dentro do alcance', () => {
    const level = asciiLevel(['S.......', '........', '........', '########']);
    const flyer = spawn<FlyerEnemy>('zubat', 4, 1);
    const history = run(flyer, level, stepsFor(ENEMIES.flyer.period * 3));
    const ys = history.map((e) => e.y - flyer.homeY);
    const xs = history.map((e) => e.x - flyer.homeX);
    expect(Math.max(...ys)).toBeCloseTo(ENEMIES.flyer.amplitude, 0);
    expect(Math.min(...ys)).toBeCloseTo(-ENEMIES.flyer.amplitude, 0);
    expect(Math.max(...xs.map(Math.abs))).toBeLessThanOrEqual(ENEMIES.flyer.range);
    expect(new Set(history.map((e) => e.dir)).size).toBe(2);
  });
});

describe('PiperEnemy', () => {
  const level = asciiLevel(['S.......', '....##..', '....##..', '########']);
  // Boca do cano em y = 16, centro em x = 80.
  const piper = spawn<PiperEnemy>('bellsprout', 4, 0, 2);
  const farHero = { x: 0, y: 2 * T };

  it('sai e volta para o cano em ciclo', () => {
    const history = run(piper, level, stepsFor(10), farHero);
    const states = history.map((e) => e.state).filter((s, i, all) => s !== all[i - 1]);
    expect(states.slice(0, 5)).toEqual(['hidden', 'rising', 'out', 'sinking', 'hidden']);
    expect(Math.max(...history.map((e) => e.rise))).toBe(ENEMIES.piper.height);
    // Escondido não pode ser tocado; fora, a caixa fica acima da boca do cano.
    const out = history.find((e) => e.state === 'out')!;
    expect(enemyHitbox(out)).toEqual({
      x: out.x,
      y: T - out.height,
      width: out.width,
      height: out.height,
    });
    expect(enemyHitbox(history[0])).toBeNull();
  });

  it('não sai com o herói perto do cano', () => {
    const history = run(piper, level, stepsFor(5), { x: 72, y: 0 });
    expect(history.every((e) => e.state === 'hidden')).toBe(true);
  });
});

describe('DropperEnemy', () => {
  const lines = [
    '................',
    '................',
    '................',
    '................',
    '................',
    'S...............',
    '################',
  ];
  const dropper = spawn<DropperEnemy>('geodude', 8, 1);

  it('fica parado até o herói passar embaixo; cai, espera no chão e volta', () => {
    const level = asciiLevel(lines);
    expect(
      run(dropper, level, stepsFor(2), { x: 0, y: 5 * T }).every((e) => e.state === 'wait'),
    ).toBe(true);
    const history = run(dropper, level, stepsFor(8), { x: dropper.x, y: 5 * T });
    // Com o herói ainda embaixo, volta a cair depois de subir.
    const states = history.map((e) => e.state).filter((s, i, all) => s !== all[i - 1]);
    expect(states.slice(0, 5)).toEqual(['fall', 'land', 'rise', 'wait', 'fall']);
    const landed = history.find((e) => e.state === 'land')!;
    expect(landed.y + landed.height).toBe(6 * T);
    const back = history.find((e) => e.state === 'wait')!;
    expect(back.y).toBe(dropper.homeY);
  });

  it('não pode ser pisado: cair em cima dele machuca', () => {
    const sim = new WorldSim(makeWorld(lines, [tileObject('geodude', 8, 4)]));
    const e = sim.world.enemies[0];
    sim.placeHero(e.x + 4, e.y - 3 * T);
    expect(sim.until(NO_INPUT, (w) => w.hero.motion.state === 'dead', stepsFor(2))).toBe(true);
  });
});

describe('Bellsprout e Zubat na fase', () => {
  it('cair sobre o Bellsprout fora do cano machuca (não pode ser pisado)', () => {
    const lines = ['........', '........', '........', 'S...##..', '....##..', '########'];
    const sim = new WorldSim(makeWorld(lines, [tileObject('bellsprout', 4, 2, {}, 2)]));
    const piper = sim.world.enemies[0] as PiperEnemy;
    sim.world = {
      ...sim.world,
      enemies: [
        { ...piper, active: true, state: 'out', rise: piper.height, y: piper.baseY - piper.height },
      ],
    };
    sim.placeHero(piper.x, 0);
    expect(sim.until(NO_INPUT, (w) => w.hero.motion.state === 'dead', stepsFor(2))).toBe(true);
  });

  it('a concha mata o Bellsprout e o Zubat, mas não o Geodude', () => {
    expect(hitByShell(spawn('bellsprout', 4, 0, 2)).state).toBe('dead');
    expect(hitByShell(spawn('zubat', 4, 0)).state).toBe('dead');
    const dropper = spawn<DropperEnemy>('geodude', 4, 0);
    expect(hitByShell(dropper)).toBe(dropper);
  });

  it('pisar no Zubat o derrota', () => {
    const sim = new WorldSim(makeWorld(FLOOR, [tileObject('zubat', 8, 3)]));
    const e = sim.world.enemies[0];
    sim.placeHero(e.x, e.y - 3 * T);
    expect(sim.until(NO_INPUT, (w) => w.enemies[0]?.state === 'dead', stepsFor(2))).toBe(true);
    expect(sim.world.hero.motion.state).not.toBe('dead');
  });

  it('andando de encontro ao Zubat o herói toma dano', () => {
    const sim = new WorldSim(makeWorld(FLOOR, [tileObject('zubat', 6, 5)]));
    expect(sim.until(RIGHT, (w) => w.hero.motion.state === 'dead', stepsFor(5))).toBe(true);
  });
});
