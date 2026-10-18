/** Chaves e caminhos dos assets carregados pela BootScene (relativos a public/). */
export const ASSETS = {
  /**
   * Fase jogável: a fase de teste da F3, com inimigos, blocos e checkpoint. A da F2
   * (assets/levels/test.json) continua nos testes automáticos.
   */
  testLevel: { key: 'level-test-f3', url: 'assets/levels/test-f3.json' },
  testTiles: { key: 'tiles-test', url: 'assets/tiles/test-tiles.png' },
} as const;
