import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { integerZoom } from '../src/logic/scale';

describe('config do jogo (F0-A4)', () => {
  it('usa 256 x 224 com pixelArt', () => {
    expect(GAME_CONFIG.width).toBe(256);
    expect(GAME_CONFIG.height).toBe(224);
    expect(GAME_CONFIG.pixelArt).toBe(true);
  });
});

describe('tsconfig (F0-A5)', () => {
  it('tem strict true', () => {
    const tsconfig = JSON.parse(readFileSync('tsconfig.json', 'utf-8'));
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });
});

describe('integerZoom', () => {
  it('escolhe o maior zoom inteiro que cabe', () => {
    const { width, height, minZoom } = GAME_CONFIG;
    expect(integerZoom(1920, 1080, width, height, minZoom)).toBe(4);
    expect(integerZoom(width * 3, height * 3, width, height, minZoom)).toBe(3);
  });

  it('nunca fica abaixo do zoom mínimo', () => {
    const { width, height, minZoom } = GAME_CONFIG;
    expect(integerZoom(100, 100, width, height, minZoom)).toBe(minZoom);
  });
});
