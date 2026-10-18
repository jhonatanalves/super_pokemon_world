import type { Level } from '../../logic/level';
import type { Box } from '../../logic/tileCollision';
import { transition, type TransitionTable } from '../../systems/StateMachine';

/**
 * Dados comuns a todo inimigo. Os inimigos não usam Phaser: cada um é um estado imutável e
 * funções que o avançam, como o herói (src/logic/heroBody.ts). Quem desenha é o WorldView.
 */
export interface EnemyBase extends Box {
  readonly id: number;
  /** Tipo do objeto no Tiled; chave em creatures.json (nome e cor). */
  readonly creature: string;
  /** Acorda quando chega perto da tela e não dorme mais; antes disso não anda nem colide. */
  readonly active: boolean;
  /** Passos desde a entrada no estado atual. */
  readonly stateSteps: number;
}

/** O que o inimigo vê do mundo a cada passo. */
export interface EnemyContext {
  /** Terreno com os blocos. */
  readonly level: Level;
  readonly hero: Box;
  readonly dt: number;
}

/**
 * Muda de estado se a tabela permitir (senão ignora), zerando o contador do estado.
 * Ficar no mesmo estado só conta mais um passo.
 */
export function enterState<
  S extends string,
  E extends { readonly state: S; readonly stateSteps: number },
>(enemy: E, table: TransitionTable<S>, to: S): E {
  const state = transition(table, enemy.state, to);
  return state === enemy.state ? enemy : { ...enemy, state, stateSteps: 0 };
}

/** Um passo a mais no estado atual. */
export function tick<E extends { readonly stateSteps: number }>(enemy: E): E {
  return { ...enemy, stateSteps: enemy.stateSteps + 1 };
}

export function centerX(box: Box): number {
  return box.x + box.width / 2;
}
