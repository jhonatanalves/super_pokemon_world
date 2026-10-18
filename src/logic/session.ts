import { RULES, type RulesConfig } from '../config/rules';

/** O que passa de uma tentativa para a outra: vidas, moedas e se o checkpoint da fase foi tocado. */
export interface Session {
  readonly lives: number;
  readonly coins: number;
  readonly checkpoint: boolean;
}

export function newSession(r: RulesConfig = RULES): Session {
  return { lives: r.startLives, coins: 0, checkpoint: false };
}

/** Soma moedas. A cada `coinsPerLife` moedas ganha 1 vida e o contador volta a 0. */
export function addCoins(session: Session, amount: number, r: RulesConfig = RULES): Session {
  const total = session.coins + amount;
  const lives = Math.floor(total / r.coinsPerLife);
  return { ...session, lives: session.lives + lives, coins: total % r.coinsPerLife };
}

export function loseLife(session: Session): Session {
  return { ...session, lives: Math.max(session.lives - 1, 0) };
}

/** Sem vidas: depois da morte vem a tela de Game Over. */
export function isGameOver(session: Session): boolean {
  return session.lives <= 0;
}

export function reachCheckpoint(session: Session): Session {
  return session.checkpoint ? session : { ...session, checkpoint: true };
}
