import { describe, expect, it } from 'vitest';
import worldsJson from '../src/content/worlds.json';
import { ASSETS } from '../src/config/assets';
import { FIXED_DT } from '../src/config/physics';
import { RULES } from '../src/config/rules';
import { WORLD_MAP } from '../src/config/worldMap';
import { enterLevel, newGame, returnFromLevel, type GameState } from '../src/logic/game';
import { stepsFor } from '../src/logic/heroMotion';
import {
  cellCenter,
  choosePath,
  pathDots,
  pathPixels,
  polylineLength,
  revealedDots,
  stepWalker,
  walkerPosition,
  type Walker,
} from '../src/logic/mapWalk';
import { newSession } from '../src/logic/session';
import {
  effectiveExit,
  exitKey,
  isCleared,
  openPaths,
  parseWorlds,
  pathsAt,
  type WorldsData,
} from '../src/logic/worldMap';

const LEVELS = Object.keys(ASSETS.levels);
const WORLDS = parseWorlds(worldsJson, LEVELS);

/** Mapa mínimo válido: início → A → B, com A abrindo o caminho para B. */
function mini(): Record<string, unknown> {
  return {
    worlds: { '1': 'Teste' },
    start: 's',
    nodes: {
      s: { world: 1, kind: 'start', name: 'S', x: 0, y: 0 },
      a: {
        world: 1,
        kind: 'level',
        name: 'A',
        x: 3,
        y: 0,
        level: LEVELS[0],
        exits: { normal: ['a>b'] },
      },
      b: { world: 1, kind: 'level', name: 'B', x: 3, y: 4, level: LEVELS[0] },
    },
    paths: {
      's>a': { from: 's', to: 'a', open: true },
      'a>b': { from: 'a', to: 'b' },
    },
  };
}

type Raw = ReturnType<typeof mini> & {
  nodes: Record<string, Record<string, unknown>>;
  paths: Record<string, Record<string, unknown>>;
};
const parseMini = (change: (raw: Raw) => void): WorldsData => {
  const raw = mini() as Raw;
  change(raw);
  return parseWorlds(raw, LEVELS);
};

describe('worlds.json válido (F5-A1)', () => {
  it('o worlds.json do jogo é lido sem erros', () => {
    expect(WORLDS.nodes.has(WORLDS.start)).toBe(true);
    expect(() => parseMini(() => undefined)).not.toThrow();
  });

  it('todo caminho aponta para nós existentes e nenhum nó é órfão', () => {
    for (const path of WORLDS.paths.values()) {
      expect(WORLDS.nodes.has(path.from)).toBe(true);
      expect(WORLDS.nodes.has(path.to)).toBe(true);
    }
    for (const id of WORLDS.nodes.keys()) expect(pathsAt(WORLDS, id).length).toBeGreaterThan(0);
  });

  it('caminho para um nó que não existe é erro', () => {
    expect(() => parseMini((r) => (r.paths['a>b'].to = 'x'))).toThrow(/não existe/);
  });

  it('nó órfão (sem caminho) é erro', () => {
    expect(() =>
      parseMini((r) => (r.nodes.c = { world: 1, kind: 'start', name: 'C', x: 9, y: 9 })),
    ).toThrow(/não está em nenhum caminho/);
  });

  it('nó que não se alcança a partir do início é erro', () => {
    expect(() =>
      parseMini((r) => {
        r.nodes.c = { world: 1, kind: 'start', name: 'C', x: 9, y: 9 };
        r.nodes.d = { world: 1, kind: 'start', name: 'D', x: 9, y: 12 };
        r.paths['c>d'] = { from: 'c', to: 'd', open: true };
      }),
    ).toThrow(/alcançável/);
  });

  it('saída que abre caminho inexistente, ou que não passa pelo nó, é erro', () => {
    expect(() => parseMini((r) => (r.nodes.a.exits = { normal: ['zz'] }))).toThrow(/não existe/);
    expect(() =>
      parseMini((r) => {
        r.nodes.b.exits = { normal: ['s>a'] };
      }),
    ).toThrow(/não passa por ele/);
  });

  it('caminho que nunca se abre, trecho diagonal e 2 caminhos na mesma direção são erros', () => {
    expect(() => parseMini((r) => (r.nodes.a.exits = {}))).toThrow(/nunca se abre/);
    expect(() => parseMini((r) => (r.nodes.b.x = 5))).toThrow(/horizontal ou vertical/);
    expect(() =>
      parseMini((r) => {
        r.nodes.c = { world: 1, kind: 'start', name: 'C', x: 3, y: 8 };
        r.paths['a>c'] = { from: 'a', to: 'c', open: true };
      }),
    ).toThrow(/mesma direção/);
  });

  it('fase que não existe, ou nó sem fase com saídas, é erro', () => {
    expect(() => parseMini((r) => (r.nodes.a.level = 'fase-x'))).toThrow(/não existe/);
    expect(() => parseMini((r) => (r.nodes.s.exits = { normal: ['s>a'] }))).toThrow(/só fases/);
  });
});

describe('Mundo 1 no worlds.json (F5-A7)', () => {
  const world1 = [...WORLDS.nodes.values()].filter((n) => n.world === 1);

  it('tem 5 fases e 1 castelo, cada um com a sua fase', () => {
    expect(world1.filter((n) => n.kind === 'level')).toHaveLength(5);
    expect(world1.filter((n) => n.kind === 'castle')).toHaveLength(1);
    for (const n of world1) if (n.kind !== 'start') expect(LEVELS).toContain(n.level);
  });

  it('vencer as 5 fases pela saída normal leva ao castelo, e o castelo abre o Mundo 2', () => {
    let state = newGame(WORLDS);
    for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5', 'w1-castle']) {
      state = returnFromLevel(WORLDS, { ...state, node: id }, clear('normal')).state;
    }
    const open = openPaths(WORLDS, state.cleared);
    const reached = [...WORLDS.paths.values()].filter((p) => open.has(p.id)).map((p) => p.to);
    expect(reached).toEqual(expect.arrayContaining(['1-2', '1-3', '1-4', '1-5', 'w1-castle']));
    expect(reached).toContain('w2-start');
    expect(WORLDS.nodes.get('w2-start')?.kind).toBe('soon');
  });

  it('só a 1-3 tem saída secreta, e ela abre o atalho para o castelo', () => {
    const secret = world1.filter((n) => n.exits.secret.length > 0).map((n) => n.id);
    expect(secret).toEqual(['1-3']);
    const shortcut = WORLDS.paths.get(WORLDS.nodes.get('1-3')!.exits.secret[0])!;
    expect([shortcut.from, shortcut.to].sort()).toEqual(['1-3', 'w1-castle']);
  });
});

const clear = (exit: 'normal' | 'secret') =>
  ({ kind: 'clear', exit, session: newSession() }) as const;

describe('desbloqueio (F5-A2)', () => {
  it('no começo, só o caminho do início até a 1-1 está aberto', () => {
    expect([...openPaths(WORLDS, [])]).toEqual(['start>1-1']);
  });

  it('vencer a 1-1 abre o caminho para a 1-2 e não abre a 1-3', () => {
    const back = returnFromLevel(WORLDS, { ...newGame(WORLDS), node: '1-1' }, clear('normal'));
    expect(back.opened).toEqual(['1-1>1-2']);
    const open = openPaths(WORLDS, back.state.cleared);
    expect(open.has('1-1>1-2')).toBe(true);
    expect(open.has('1-2>1-3')).toBe(false);
    expect(choosePath(WORLDS, open, '1-2', 'up')).toBeNull();
  });

  it('a saída secreta da 1-3 abre o atalho para o castelo, e não o caminho normal', () => {
    const back = returnFromLevel(WORLDS, { ...newGame(WORLDS), node: '1-3' }, clear('secret'));
    expect(back.opened).toEqual(['1-3>castle']);
    expect(back.state.cleared).toEqual([exitKey('1-3', 'secret')]);
    expect(isCleared(back.state.cleared, '1-3')).toBe(true);
  });

  it('a fechadura de uma fase sem saída secreta no mapa conta como a saída normal', () => {
    expect(effectiveExit(WORLDS.nodes.get('1-1')!, 'secret')).toBe('normal');
    const back = returnFromLevel(WORLDS, { ...newGame(WORLDS), node: '1-1' }, clear('secret'));
    expect(back.opened).toEqual(['1-1>1-2']);
  });

  it('vencer de novo uma fase já vencida não abre nada', () => {
    const first = returnFromLevel(WORLDS, { ...newGame(WORLDS), node: '1-1' }, clear('normal'));
    const again = returnFromLevel(WORLDS, first.state, clear('normal'));
    expect(again.opened).toEqual([]);
    expect(again.state.cleared).toEqual(first.state.cleared);
  });
});

describe('volta das fases para o mapa (F5b)', () => {
  const at1: GameState = { ...newGame(WORLDS), node: '1-1' };

  it('a fase começa com a sessão do jogo, e o checkpoint só vale na mesma fase', () => {
    const touched = {
      ...at1,
      session: { ...at1.session, checkpoint: true },
      checkpointNode: '1-1',
    };
    expect(enterLevel(touched, '1-1').checkpoint).toBe(true);
    expect(enterLevel(touched, '1-2').checkpoint).toBe(false);
  });

  it('morrer volta ao mesmo nó, com a sessão da fase e o checkpoint guardado', () => {
    const session = { ...newSession(), lives: 4, checkpoint: true };
    const back = returnFromLevel(WORLDS, at1, { kind: 'death', session });
    expect(back.gameOver).toBe(false);
    expect(back.state).toMatchObject({ node: '1-1', checkpointNode: '1-1', session });
    expect(back.opened).toEqual([]);
  });

  it('sem vidas, é Game Over: o jogo continua no mapa com as vidas iniciais e o progresso', () => {
    const cleared = [exitKey('1-1', 'normal')];
    const session = { ...newSession(), lives: 0, coins: 42, stars: 7, checkpoint: true };
    const back = returnFromLevel(WORLDS, { ...at1, cleared }, { kind: 'death', session });
    expect(back.gameOver).toBe(true);
    expect(back.state.session).toMatchObject({ lives: RULES.startLives, coins: 42, stars: 7 });
    expect(back.state.session.checkpoint).toBe(false);
    expect(back.state.cleared).toEqual(cleared);
  });

  it('vencer guarda a sessão da fase (forma, estrelas) e zera o checkpoint', () => {
    const session = { ...newSession(), form: 'electric', stars: 30 } as const;
    const state = { ...at1, checkpointNode: '1-1' };
    const back = returnFromLevel(WORLDS, state, { kind: 'clear', exit: 'normal', session });
    expect(back.state.session).toEqual(session);
    expect(back.state.checkpointNode).toBeNull();
  });
});

describe('andar no mapa', () => {
  const open = openPaths(WORLDS, [exitKey('1-1', 'normal')]);

  it('a seta escolhe o caminho aberto que sai do nó naquela direção', () => {
    expect(choosePath(WORLDS, open, '1-1', 'right')).toEqual({
      path: '1-1>1-2',
      forward: true,
      distance: 0,
    });
    expect(choosePath(WORLDS, open, '1-1', 'left')).toMatchObject({
      path: 'start>1-1',
      forward: false,
    });
    expect(choosePath(WORLDS, open, '1-1', 'up')).toBeNull();
  });

  it('anda pelo caminho e para no outro nó no tempo certo', () => {
    let walker: Walker = { node: '1-1', walk: choosePath(WORLDS, open, '1-1', 'right') };
    const length = polylineLength(pathPixels(WORLDS, '1-1>1-2'));
    const steps = Math.ceil(length / (WORLD_MAP.walkSpeed * FIXED_DT));
    for (let i = 0; i < steps - 1; i++) walker = stepWalker(walker, WORLDS);
    expect(walker.walk).not.toBeNull();
    const middle = walkerPosition(walker, WORLDS);
    expect(middle.x).toBeGreaterThan(cellCenter(WORLDS.nodes.get('1-1')!).x);
    walker = stepWalker(walker, WORLDS);
    expect(walker).toEqual({ node: '1-2', walk: null });
    expect(walkerPosition(walker, WORLDS)).toEqual(cellCenter(WORLDS.nodes.get('1-2')!));
  });

  it('volta pelo mesmo caminho no sentido contrário', () => {
    let walker: Walker = { node: '1-2', walk: choosePath(WORLDS, open, '1-2', 'left') };
    expect(walker.walk?.forward).toBe(false);
    for (let i = 0; i < stepsFor(5) && walker.walk; i++) walker = stepWalker(walker, WORLDS);
    expect(walker.node).toBe('1-1');
  });

  it('o caminho novo aparece aos poucos, a partir do nó vencido, depois da pausa', () => {
    const full = pathDots(pathPixels(WORLDS, '1-1>1-2'), WORLD_MAP.dotSpacing);
    expect(revealedDots(WORLDS, '1-1>1-2', '1-1', 0).dots).toHaveLength(1);
    const pause = stepsFor(WORLD_MAP.revealDelay);
    expect(revealedDots(WORLDS, '1-1>1-2', '1-1', pause).dots).toHaveLength(1);
    const half = revealedDots(WORLDS, '1-1>1-2', '1-1', pause + stepsFor(0.5));
    expect(half.done).toBe(false);
    expect(half.dots.length).toBeGreaterThan(1);
    expect(half.dots.length).toBeLessThan(full.length);
    expect(half.dots[0]).toEqual(cellCenter(WORLDS.nodes.get('1-1')!));
    const done = revealedDots(WORLDS, '1-1>1-2', '1-1', pause + stepsFor(10));
    expect(done.done).toBe(true);
    expect(done.dots).toHaveLength(full.length);
  });
});
