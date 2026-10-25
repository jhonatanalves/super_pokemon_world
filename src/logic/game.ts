import type { LevelExit } from './goal';
import { continueAfterGameOver, isGameOver, newSession, type Session } from './session';
import { effectiveExit, exitKey, openPaths, type WorldsData } from './worldMap';

/**
 * O jogo entre o mapa e as fases (F5b), sem Phaser. É o que o save da F5c vai guardar:
 * sessão (vidas, moedas, estrelas, forma, reserva), saídas vencidas e onde o herói está no
 * mapa.
 */
export interface GameState {
  readonly session: Session;
  /** Saídas vencidas, como "nó:saída" (ver exitKey). */
  readonly cleared: readonly string[];
  /** Nó em que o herói está no mapa. */
  readonly node: string;
  /** Nó da fase em que o checkpoint foi tocado; entrar em outra fase o perde. */
  readonly checkpointNode: string | null;
}

export function newGame(data: WorldsData): GameState {
  return { session: newSession(), cleared: [], node: data.start, checkpointNode: null };
}

/** Sessão com que a fase do nó começa: o checkpoint só vale se foi tocado nesta mesma fase. */
export function enterLevel(state: GameState, nodeId: string): Session {
  const checkpoint = state.session.checkpoint && state.checkpointNode === nodeId;
  return { ...state.session, checkpoint };
}

/** Como a fase terminou: vencida por uma saída, ou com a morte do herói. */
export type LevelOutcome =
  | { readonly kind: 'clear'; readonly exit: LevelExit; readonly session: Session }
  | { readonly kind: 'death'; readonly session: Session };

export interface MapReturn {
  readonly state: GameState;
  /** Caminhos que esta vitória abriu, na ordem, para a animação do mapa. */
  readonly opened: readonly string[];
  /** Acabaram as vidas: a tela de Game Over vem antes do mapa (as vidas já voltaram). */
  readonly gameOver: boolean;
}

/**
 * Volta da fase para o mapa, no mesmo nó. Vencer marca a saída e abre os caminhos dela.
 * Morrer guarda o checkpoint da fase; sem vidas, o jogo continua com as vidas iniciais.
 */
export function returnFromLevel(
  data: WorldsData,
  state: GameState,
  outcome: LevelOutcome,
): MapReturn {
  if (outcome.kind === 'death') {
    const gameOver = isGameOver(outcome.session);
    const session = gameOver ? continueAfterGameOver(outcome.session) : outcome.session;
    const checkpointNode = session.checkpoint ? state.node : null;
    return { state: { ...state, session, checkpointNode }, opened: [], gameOver };
  }
  const node = data.nodes.get(state.node);
  if (!node) throw new Error(`nó "${state.node}" não existe no mapa`);
  const key = exitKey(node.id, effectiveExit(node, outcome.exit));
  const cleared = state.cleared.includes(key) ? state.cleared : [...state.cleared, key];
  const before = openPaths(data, state.cleared);
  const opened = [...openPaths(data, cleared)].filter((id) => !before.has(id));
  return {
    state: { ...state, session: outcome.session, cleared, checkpointNode: null },
    opened,
    gameOver: false,
  };
}
