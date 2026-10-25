/** Chaves e caminhos dos assets carregados pela BootScene (relativos a public/). */
export const ASSETS = {
  /**
   * Fases jogáveis, pela chave do cache do Phaser; os nós do worlds.json apontam para elas.
   * Até as fases do Mundo 1 (F5d), o mapa usa as fases de teste da F5a e da F4. As da F2
   * (test.json) e da F3 (test-f3.json) continuam só nos testes automáticos.
   */
  levels: {
    'level-test-f5': 'assets/levels/test-f5.json',
    'level-test-f4': 'assets/levels/test-f4.json',
  },
  testTiles: { key: 'tiles-test', url: 'assets/tiles/test-tiles.png' },
} as const;
