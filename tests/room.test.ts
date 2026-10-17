import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import testRoom from '../src/content/testRoom.json';
import { parseRoom, surfaceRow } from '../src/logic/room';

describe('parseRoom', () => {
  it('lê sólidos e o ponto de início', () => {
    const room = parseRoom(['#S.', '###']);
    expect(room.cols).toBe(3);
    expect(room.rows).toBe(2);
    expect(room.spawn).toEqual({ col: 1, row: 0 });
    expect(room.solid[0]).toEqual([true, false, false]);
  });

  it('recusa linhas de tamanhos diferentes, caracteres desconhecidos e início ausente ou repetido', () => {
    expect(() => parseRoom(['S..', '##'])).toThrow(/colunas/);
    expect(() => parseRoom(['S.x'])).toThrow(/desconhecido/);
    expect(() => parseRoom(['...'])).toThrow(/início/);
    expect(() => parseRoom(['S.S'])).toThrow(/início/);
  });

  it('surfaceRow encontra o primeiro sólido de cima para baixo', () => {
    const room = parseRoom(['S..', '..#', '###']);
    expect(surfaceRow(room, 0)).toBe(2);
    expect(surfaceRow(room, 2)).toBe(1);
    expect(() => surfaceRow(parseRoom(['S']), 0)).toThrow(/chão/);
  });
});

describe('sala de teste da F1', () => {
  const room = parseRoom(testRoom.rows);

  it('tem 3 telas de largura e 1 de altura', () => {
    expect(room.cols * GAME_CONFIG.tileSize).toBe(3 * GAME_CONFIG.width);
    expect(room.rows * GAME_CONFIG.tileSize).toBe(GAME_CONFIG.height);
  });

  it('o herói começa em pé sobre o chão', () => {
    expect(surfaceRow(room, room.spawn.col)).toBe(room.spawn.row + 1);
  });

  it('é plana com degraus de 1, 2, 3 e 4 tiles', () => {
    const floor = surfaceRow(room, room.spawn.col);
    const heights = new Set<number>();
    for (let col = 0; col < room.cols; col++) heights.add(floor - surfaceRow(room, col));
    for (const step of [1, 2, 3, 4]) expect(heights).toContain(step);
  });

  it('a régua fica sobre o chão, dentro da sala', () => {
    expect(testRoom.ruler.col).toBeGreaterThanOrEqual(0);
    expect(testRoom.ruler.col).toBeLessThan(room.cols);
    expect(surfaceRow(room, testRoom.ruler.col)).toBe(surfaceRow(room, room.spawn.col));
  });
});
