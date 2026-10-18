import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { createHeroBody, stepHeroBody } from '../src/logic/heroBody';
import { NO_INPUT, stepsFor } from '../src/logic/heroMotion';
import { LEVEL_LAYERS, parseLevel, tileAt, type Level } from '../src/logic/level';

const T = GAME_CONFIG.tileSize;
const TEST_MAP_PATH = new URL('../public/assets/levels/test.json', import.meta.url);

function readTestMap(): unknown {
  return JSON.parse(readFileSync(TEST_MAP_PATH, 'utf-8'));
}

/** Mapa mínimo válido no formato do Tiled: 2 x 2, chão na linha de baixo. */
function miniMap(): Record<string, unknown> {
  return {
    orientation: 'orthogonal',
    infinite: false,
    width: 2,
    height: 2,
    tilewidth: T,
    tileheight: T,
    layers: [
      { name: LEVEL_LAYERS.background, type: 'tilelayer', data: [0, 0, 0, 0] },
      { name: LEVEL_LAYERS.terrain, type: 'tilelayer', data: [0, 0, 1, 1] },
      {
        name: LEVEL_LAYERS.objects,
        type: 'objectgroup',
        objects: [{ type: 'spawn', x: 8, y: 16 }],
      },
    ],
    tilesets: [
      {
        firstgid: 1,
        name: 'mini',
        tiles: [
          { id: 0, properties: [{ name: 'shape', type: 'string', value: 'solid' }] },
          {
            id: 1,
            properties: [
              { name: 'shape', type: 'string', value: 'slope' },
              { name: 'left', type: 'int', value: 0 },
              { name: 'right', type: 'int', value: T },
            ],
          },
          { id: 2 },
        ],
      },
    ],
  };
}

type Layer = { name: string; data?: number[]; objects?: unknown[] };

function withLayer(map: Record<string, unknown>, name: string, change: (layer: Layer) => void) {
  const layers = map.layers as Layer[];
  change(layers.find((l) => l.name === name)!);
  return map;
}

describe('leitura do mapa do Tiled', () => {
  it('lê terreno, ladeira, início e tileset', () => {
    const map = miniMap();
    withLayer(map, LEVEL_LAYERS.terrain, (l) => (l.data = [0, 0, 1, 2]));
    const level = parseLevel(map, T);
    expect(level).toMatchObject({
      cols: 2,
      rows: 2,
      width: 2 * T,
      height: 2 * T,
      tilesetName: 'mini',
    });
    expect(level.spawn).toEqual({ x: 8, y: 16 });
    expect(tileAt(level, 0, 1)).toEqual({ kind: 'solid' });
    expect(tileAt(level, 1, 1)).toEqual({ kind: 'slope', left: 0, right: T });
    expect(tileAt(level, 0, 0)).toEqual({ kind: 'empty' });
    // Fora do mapa é vazio.
    expect(tileAt(level, -1, 0).kind).toBe('empty');
    expect(tileAt(level, 0, 5).kind).toBe('empty');
  });

  it('aceita o campo "class" do Tiled 1.9 no lugar de "type"', () => {
    const map = withLayer(miniMap(), LEVEL_LAYERS.objects, (l) => {
      l.objects = [{ type: '', class: 'spawn', x: 8, y: 16 }];
    });
    expect(parseLevel(map, T).spawn).toEqual({ x: 8, y: 16 });
  });

  it('recusa mapas inválidos com mensagem clara', () => {
    const cases: [string, (m: Record<string, unknown>) => void, RegExp][] = [
      [
        'sem camada de terreno',
        (m) => (m.layers = (m.layers as Layer[]).filter((l) => l.name !== LEVEL_LAYERS.terrain)),
        /terreno/,
      ],
      [
        'sem camada de fundo',
        (m) => (m.layers = (m.layers as Layer[]).filter((l) => l.name !== LEVEL_LAYERS.background)),
        /fundo/,
      ],
      ['tile de tamanho errado', (m) => (m.tilewidth = 8), /16 x 16/],
      [
        'dados com tamanho errado',
        (m) => withLayer(m, LEVEL_LAYERS.terrain, (l) => (l.data = [0, 1])),
        /esperado 4/,
      ],
      [
        'tile sem "shape" no terreno',
        (m) => withLayer(m, LEVEL_LAYERS.terrain, (l) => (l.data = [0, 0, 3, 1])),
        /shape/,
      ],
      [
        'tile espelhado',
        (m) => withLayer(m, LEVEL_LAYERS.terrain, (l) => (l.data = [0, 0, 0x80000001, 1])),
        /espelhados/,
      ],
      ['sem início', (m) => withLayer(m, LEVEL_LAYERS.objects, (l) => (l.objects = [])), /spawn/],
      [
        'início fora do mapa',
        (m) =>
          withLayer(m, LEVEL_LAYERS.objects, (l) => (l.objects = [{ type: 'spawn', x: 99, y: 8 }])),
        /fora/,
      ],
    ];
    for (const [, change, message] of cases) {
      const map = miniMap();
      change(map);
      expect(() => parseLevel(map, T)).toThrow(message);
    }
    expect(() => parseLevel('não é mapa', T)).toThrow(/Mapa inválido/);
  });
});

describe('mapa de teste da F2 (F2-A1)', () => {
  const level: Level = parseLevel(readTestMap(), T);

  it('tem as camadas esperadas e 3 telas de comprimento (768 px)', () => {
    const raw = readTestMap() as { layers: { name: string }[] };
    expect(raw.layers.map((l) => l.name).sort()).toEqual(Object.values(LEVEL_LAYERS).sort());
    expect(level.width).toBe(3 * GAME_CONFIG.width);
    expect(level.width).toBe(768);
    expect(level.height).toBe(GAME_CONFIG.height);
  });

  it('o herói começa em pé sobre o chão', () => {
    const col = Math.floor(level.spawn.x / T);
    const row = level.spawn.y / T;
    expect(Number.isInteger(row)).toBe(true);
    expect(tileAt(level, col, row).kind).toBe('solid');
    expect(tileAt(level, col, row - 1).kind).toBe('empty');
  });

  it('tem ladeiras de 45° e 22,5° nos dois sentidos, plataforma de mão única e buraco', () => {
    const slopes = new Set<string>();
    let oneWay = 0;
    for (const row of level.terrain) {
      for (const tile of row) {
        if (tile.kind === 'slope') slopes.add(`${tile.left}-${tile.right}`);
        if (tile.kind === 'oneWay') oneWay++;
      }
    }
    // 45°: 0→16 e 16→0. 22,5°: 0→8→16 e 16→8→0.
    for (const s of ['0-16', '16-0', '0-8', '8-16', '16-8', '8-0']) expect(slopes).toContain(s);
    expect(oneWay).toBeGreaterThan(0);

    const pits = Array.from({ length: level.cols }, (_, col) => col).filter((col) =>
      level.terrain.every((row) => row[col].kind === 'empty'),
    );
    expect(pits.length).toBeGreaterThan(0);
  });

  it('é atravessável do início ao fim correndo e pulando, sem morrer', () => {
    // Robô cego: segura direita e correr, e pula de novo a cada vez que pousa. Se uma mudança
    // no mapa ou na física fizer este teste falhar, confira se a fase continua possível jogando.
    let body = createHeroBody(level.spawn);
    let jump = false;
    const end = level.width - GAME_CONFIG.heroWidth;
    for (let i = 0; i < stepsFor(60) && body.x < end; i++) {
      jump = body.contacts.ground ? !jump : true;
      body = stepHeroBody(body, { ...NO_INPUT, right: true, run: true, jump }, level);
      expect(body.motion.state).not.toBe('dead');
    }
    expect(body.x).toBe(end);
  });

  it('mantém a régua da F1 e degraus de 1 a 4 tiles', () => {
    expect(level.ruler?.tiles).toBeGreaterThanOrEqual(4);
    const floorRow = level.spawn.y / T;
    const heights = new Set<number>();
    for (let col = 0; col < level.cols; col++) {
      const top = level.terrain.findIndex((row) => row[col].kind === 'solid');
      if (top >= 0) heights.add(floorRow - top);
    }
    for (const h of [1, 2, 3, 4]) expect(heights).toContain(h);
  });
});
