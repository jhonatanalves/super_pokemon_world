/** Chaves e caminhos dos assets carregados pela BootScene (relativos a public/). */
export const ASSETS = {
  /**
   * Fase jogável: a fase de teste da F4, com power-ups, inimigos, blocos e checkpoint. As da
   * F2 (test.json) e da F3 (test-f3.json) continuam nos testes automáticos.
   */
  testLevel: { key: 'level-test-f4', url: 'assets/levels/test-f4.json' },
  testTiles: { key: 'tiles-test', url: 'assets/tiles/test-tiles.png' },
} as const;
