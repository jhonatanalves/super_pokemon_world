import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { RULES } from '../src/config/rules';
import { BEHAVIORS } from '../src/logic/creatures';
import { stepHeroBody, createHeroBody } from '../src/logic/heroBody';
import { NO_INPUT, stepsFor } from '../src/logic/heroMotion';
import { parseLevel, tileAt } from '../src/logic/level';
import { newSession } from '../src/logic/session';
import { createWorld } from '../src/logic/world';
import { CONTENT, CREATURES } from './helpers/world';

const T = GAME_CONFIG.tileSize;
const MAP_PATH = new URL('../public/assets/levels/test-f3.json', import.meta.url);

const level = parseLevel(JSON.parse(readFileSync(MAP_PATH, 'utf-8')), T);
const built = createWorld(level, CONTENT, newSession());
const world = built.world;

describe('fase de teste da F3', () => {
  it('carrega sem erros, com mais de 3 telas e as camadas da F2', () => {
    expect(built.errors).toEqual([]);
    expect(level.width % GAME_CONFIG.width).toBe(0);
    expect(level.width / GAME_CONFIG.width).toBeGreaterThan(3);
    expect(level.height).toBe(GAME_CONFIG.height);
  });

  it('tem todos os inimigos da F3', () => {
    const behaviors = new Set(world.enemies.map((e) => e.behavior));
    expect([...behaviors].sort()).toEqual([...BEHAVIORS].sort());
  });

  it('tem os blocos ?, tijolo, nota e invisível', () => {
    const kinds = new Set(world.blocks.map((b) => b.kind));
    for (const kind of ['question', 'brick', 'note', 'hidden']) expect(kinds).toContain(kind);
  });

  it('tem moedas, exatamente 5 Moedas Pokébola e 1 checkpoint sobre o chão', () => {
    expect(world.items.some((i) => i.kind === 'coin')).toBe(true);
    expect(world.pokeballsTotal).toBe(RULES.pokeballsPerLevel);
    expect(world.pokeballsTotal).toBe(5);
    const respawn = world.checkpoint!.respawn;
    expect(tileAt(level, Math.floor(respawn.x / T), respawn.y / T).kind).toBe('solid');
    expect(respawn.x).toBeGreaterThan(level.width / 4);
    expect(respawn.x).toBeLessThan((level.width * 3) / 4);
  });

  it('o terreno com os blocos é atravessável do início ao fim correndo e pulando', () => {
    // Robô cego, como o da F2, sem os inimigos: só confere que o mapa não tem trechos impossíveis.
    let body = createHeroBody(level.spawn);
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

describe('creatures.json e a regra dos nomes', () => {
  it('cada criatura tem nome, comportamento conhecido e cor', () => {
    expect(CREATURES.size).toBeGreaterThanOrEqual(BEHAVIORS.length);
    for (const creature of CREATURES.values()) {
      expect(creature.name).not.toBe('');
      expect(BEHAVIORS).toContain(creature.behavior);
    }
  });

  it('nenhum nome de criatura, forma do herói ou item aparece no código (só em src/content/)', () => {
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (path.endsWith('.ts')) files.push(path);
      }
    };
    walk('src');
    // Nomes de Pokémon: em qualquer lugar do texto (também dentro de identificadores).
    const pokemon = [
      ...[...CREATURES.values()].map((c) => c.name),
      ...Object.values(CONTENT.forms).map((f) => f.name),
      ...[...CONTENT.mounts.values()].map((m) => m.name),
    ].map((n) => n.toLowerCase());
    // Itens: como palavra inteira, porque "Pena" está dentro de "apenas".
    const items = [...CONTENT.items.values()].map(
      (i) => new RegExp(`(?<!\\p{L})${i.name.toLowerCase()}(?!\\p{L})`, 'u'),
    );
    for (const file of files) {
      const text = readFileSync(file, 'utf-8').toLowerCase();
      for (const name of pokemon) expect(text.includes(name), `${name} em ${file}`).toBe(false);
      for (const name of items) expect(name.test(text), `${name.source} em ${file}`).toBe(false);
    }
  });
});
