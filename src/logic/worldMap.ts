import type { LevelExit } from './goal';
import type { Point } from './level';

/**
 * Mapa-múndi (F5b), sem Phaser: leitura e validação de src/content/worlds.json e a regra de
 * desbloqueio. Os nós são fases, castelos ou pontos sem fase; os caminhos ligam dois nós e
 * se abrem quando uma saída de fase os lista. Nomes de mundos e fases só existem no JSON.
 */

/**
 * `start`: ponto de partida, sem fase. `level` e `castle`: abrem uma fase (o castelo terá o
 * chefe, F5e). `soon`: mundo que ainda não existe (aparece no mapa, sem entrar).
 */
export const NODE_KINDS = ['start', 'level', 'castle', 'soon'] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export interface MapNode {
  readonly id: string;
  readonly world: number;
  readonly kind: NodeKind;
  readonly name: string;
  /** Posição na grade do mapa, em tiles. */
  readonly x: number;
  readonly y: number;
  /** Fase que o nó abre (chave em ASSETS.levels); null em `start` e `soon`. */
  readonly level: string | null;
  /** Caminhos que cada saída abre. */
  readonly exits: { readonly [E in LevelExit]: readonly string[] };
}

export interface MapPath {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  /** Cantos entre os dois nós, em tiles. Todo trecho é horizontal ou vertical. */
  readonly points: readonly Point[];
  /** Aberto desde o começo do jogo. */
  readonly open: boolean;
}

export interface WorldsData {
  /** Nome de cada mundo, pelo número. */
  readonly worlds: ReadonlyMap<number, string>;
  /** Nó em que o jogo novo começa. */
  readonly start: string;
  readonly nodes: ReadonlyMap<string, MapNode>;
  readonly paths: ReadonlyMap<string, MapPath>;
}

/** Direção em que um caminho sai de um nó. */
export type Direction = 'left' | 'right' | 'up' | 'down';

type Json = Record<string, unknown>;

function fail(message: string): never {
  throw new Error(`worlds.json inválido: ${message}`);
}

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function obj(value: unknown, what: string): Json {
  if (!isObject(value)) fail(`${what} não é um objeto`);
  return value;
}

function int(o: Json, key: string, what: string): number {
  const value = o[key];
  if (typeof value !== 'number' || !Number.isInteger(value)) fail(`${what}.${key} não é inteiro`);
  return value;
}

function text(o: Json, key: string, what: string): string {
  const value = o[key];
  if (typeof value !== 'string' || value === '') fail(`${what}.${key} não é um texto`);
  return value;
}

function ids(value: unknown, what: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    fail(`${what} não é uma lista de ids`);
  }
  return value as string[];
}

function parseNode(id: string, raw: unknown): MapNode {
  const what = `nó "${id}"`;
  const o = obj(raw, what);
  const kind = NODE_KINDS.find((k) => k === o.kind);
  if (!kind) fail(`${what}: "kind" precisa ser um de ${NODE_KINDS.join(', ')}`);
  const playable = kind === 'level' || kind === 'castle';
  const exits = o.exits === undefined ? {} : obj(o.exits, `${what}.exits`);
  const node: MapNode = {
    id,
    world: int(o, 'world', what),
    kind,
    name: text(o, 'name', what),
    x: int(o, 'x', what),
    y: int(o, 'y', what),
    level: playable ? text(o, 'level', what) : null,
    exits: {
      normal: ids(exits.normal, `${what}.exits.normal`),
      secret: ids(exits.secret, `${what}.exits.secret`),
    },
  };
  if (!playable && (node.exits.normal.length > 0 || node.exits.secret.length > 0)) {
    fail(`${what}: só fases e castelos têm saídas`);
  }
  if (playable && o.level === undefined) fail(`${what}: falta "level"`);
  return node;
}

function parsePath(id: string, raw: unknown): MapPath {
  const what = `caminho "${id}"`;
  const o = obj(raw, what);
  const points = o.points === undefined ? [] : o.points;
  if (!Array.isArray(points)) fail(`${what}.points não é uma lista`);
  return {
    id,
    from: text(o, 'from', what),
    to: text(o, 'to', what),
    points: points.map((p, i) => {
      const point = obj(p, `${what}.points[${i}]`);
      return { x: int(point, 'x', what), y: int(point, 'y', what) };
    }),
    open: o.open === true,
  };
}

/** Pontos do caminho, em tiles: do nó `from` ao nó `to`, passando pelos cantos. */
export function pathCorners(data: WorldsData, path: MapPath): Point[] {
  const from = data.nodes.get(path.from);
  const to = data.nodes.get(path.to);
  if (!from || !to) fail(`caminho "${path.id}" liga nós que não existem`);
  return [{ x: from.x, y: from.y }, ...path.points, { x: to.x, y: to.y }];
}

function directionOf(a: Point, b: Point): Direction {
  if (b.x !== a.x) return b.x > a.x ? 'right' : 'left';
  return b.y > a.y ? 'down' : 'up';
}

/** Direção em que o caminho sai do nó `nodeId` (uma das pontas dele). */
export function leavingDirection(data: WorldsData, path: MapPath, nodeId: string): Direction {
  const corners = pathCorners(data, path);
  if (path.from === nodeId) return directionOf(corners[0], corners[1]);
  const n = corners.length;
  return directionOf(corners[n - 1], corners[n - 2]);
}

/** Caminhos que tocam o nó. */
export function pathsAt(data: WorldsData, nodeId: string): MapPath[] {
  return [...data.paths.values()].filter((p) => p.from === nodeId || p.to === nodeId);
}

function validate(data: WorldsData, levelKeys: readonly string[]): void {
  if (!data.nodes.has(data.start)) fail(`o nó inicial "${data.start}" não existe`);
  for (const node of data.nodes.values()) {
    if (!data.worlds.has(node.world)) fail(`nó "${node.id}": mundo ${node.world} sem nome`);
    if (node.level !== null && !levelKeys.includes(node.level)) {
      fail(`nó "${node.id}": fase "${node.level}" não existe`);
    }
    for (const id of [...node.exits.normal, ...node.exits.secret]) {
      const path = data.paths.get(id);
      if (!path) fail(`nó "${node.id}": a saída abre o caminho "${id}", que não existe`);
      if (path.from !== node.id && path.to !== node.id) {
        fail(`nó "${node.id}": a saída abre o caminho "${id}", que não passa por ele`);
      }
    }
    // Nenhum nó órfão: todo nó está em algum caminho.
    const here = pathsAt(data, node.id);
    if (here.length === 0) fail(`o nó "${node.id}" não está em nenhum caminho`);
    // Cada direção leva a um caminho só, para o jogador escolher pelas setas.
    const dirs = here.map((p) => leavingDirection(data, p, node.id));
    if (new Set(dirs).size !== dirs.length)
      fail(`o nó "${node.id}" tem 2 caminhos na mesma direção`);
  }
  const opened = new Set(
    [...data.nodes.values()].flatMap((n) => [...n.exits.normal, ...n.exits.secret]),
  );
  for (const path of data.paths.values()) {
    if (path.from === path.to) fail(`caminho "${path.id}" liga um nó a ele mesmo`);
    const corners = pathCorners(data, path);
    for (let i = 1; i < corners.length; i++) {
      const [a, b] = [corners[i - 1], corners[i]];
      if ((a.x !== b.x) === (a.y !== b.y)) {
        fail(`caminho "${path.id}": cada trecho precisa ser horizontal ou vertical`);
      }
    }
    if (!path.open && !opened.has(path.id)) fail(`caminho "${path.id}" nunca se abre`);
  }
  // Todo nó é alcançável a partir do início, com todos os caminhos abertos.
  const reached = new Set([data.start]);
  const queue = [data.start];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    for (const p of pathsAt(data, id)) {
      const other = p.from === id ? p.to : p.from;
      if (!reached.has(other)) {
        reached.add(other);
        queue.push(other);
      }
    }
  }
  for (const id of data.nodes.keys()) {
    if (!reached.has(id)) fail(`o nó "${id}" não é alcançável a partir do início`);
  }
}

/** Lê e valida o worlds.json. `levelKeys`: as fases que existem (chaves de ASSETS.levels). */
export function parseWorlds(raw: unknown, levelKeys: readonly string[]): WorldsData {
  const json = obj(raw, 'worlds.json');
  const worlds = new Map<number, string>();
  for (const [key, name] of Object.entries(obj(json.worlds, 'worlds'))) {
    const n = Number(key);
    if (!Number.isInteger(n) || typeof name !== 'string' || name === '') {
      fail(`mundo "${key}" precisa de número e nome`);
    }
    worlds.set(n, name);
  }
  const nodes = new Map<string, MapNode>();
  for (const [id, raw] of Object.entries(obj(json.nodes, 'nodes'))) {
    nodes.set(id, parseNode(id, raw));
  }
  const paths = new Map<string, MapPath>();
  for (const [id, raw] of Object.entries(obj(json.paths, 'paths'))) {
    const path = parsePath(id, raw);
    if (!nodes.has(path.from) || !nodes.has(path.to)) {
      fail(`caminho "${id}" aponta para um nó que não existe`);
    }
    paths.set(id, path);
  }
  const data: WorldsData = { worlds, start: text(json, 'start', 'worlds.json'), nodes, paths };
  validate(data, levelKeys);
  return data;
}

/** Chave de uma saída vencida, como fica guardada no progresso: "nó:saída". */
export function exitKey(nodeId: string, exit: LevelExit): string {
  return `${nodeId}:${exit}`;
}

/**
 * A saída que vale: a fechadura numa fase sem saída secreta no mapa conta como a normal (as
 * fases de teste provisórias da F5b têm fechadura em todo nó).
 */
export function effectiveExit(node: MapNode, exit: LevelExit): LevelExit {
  return exit === 'secret' && node.exits.secret.length === 0 ? 'normal' : exit;
}

/** Caminhos abertos: os do começo mais os de cada saída vencida. */
export function openPaths(data: WorldsData, cleared: readonly string[]): Set<string> {
  const open = new Set([...data.paths.values()].filter((p) => p.open).map((p) => p.id));
  for (const node of data.nodes.values()) {
    for (const exit of ['normal', 'secret'] as const) {
      if (cleared.includes(exitKey(node.id, exit))) node.exits[exit].forEach((id) => open.add(id));
    }
  }
  return open;
}

/** A fase do nó já foi vencida por alguma saída. */
export function isCleared(cleared: readonly string[], nodeId: string): boolean {
  return cleared.includes(exitKey(nodeId, 'normal')) || cleared.includes(exitKey(nodeId, 'secret'));
}
