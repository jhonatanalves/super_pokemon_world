import { RULES, type RulesConfig } from '../config/rules';
import type { Form, Reserve } from './powerups';

/**
 * O que passa de uma tentativa para a outra: vidas, moedas, se o checkpoint da fase foi
 * tocado, o item da caixa de reserva (F4b; como no SMW, a reserva não se perde ao morrer),
 * as estrelas das fitas de fim de fase (F5a) e a forma do herói (F5b: passa de uma fase
 * vencida para a próxima; a morte a volta para pequeno).
 */
export interface Session {
  readonly lives: number;
  readonly coins: number;
  readonly checkpoint: boolean;
  readonly reserve: Reserve;
  readonly stars: number;
  readonly form: Form;
}

export function newSession(r: RulesConfig = RULES): Session {
  return {
    lives: r.startLives,
    coins: 0,
    checkpoint: false,
    reserve: null,
    stars: 0,
    form: 'small',
  };
}

/** Soma as estrelas da fita (F5a). O que elas dão é da F5c (a roleta aos 100). */
export function addStars(session: Session, stars: number): Session {
  return { ...session, stars: session.stars + stars };
}

/** Soma moedas. A cada `coinsPerLife` moedas ganha 1 vida e o contador volta a 0. */
export function addCoins(session: Session, amount: number, r: RulesConfig = RULES): Session {
  const total = session.coins + amount;
  const lives = Math.floor(total / r.coinsPerLife);
  return { ...session, lives: session.lives + lives, coins: total % r.coinsPerLife };
}

/** Morte: perde uma vida, e a próxima tentativa começa pequena (F5b). */
export function loseLife(session: Session): Session {
  return { ...session, lives: Math.max(session.lives - 1, 0), form: 'small' };
}

/**
 * Depois do Game Over (F5b): o jogo continua no mapa com as vidas iniciais, como no SMW. O
 * progresso no mapa, as moedas, as estrelas e a reserva ficam.
 */
export function continueAfterGameOver(session: Session, r: RulesConfig = RULES): Session {
  return { ...session, lives: r.startLives, checkpoint: false, form: 'small' };
}

/** Sem vidas: depois da morte vem a tela de Game Over. */
export function isGameOver(session: Session): boolean {
  return session.lives <= 0;
}

export function reachCheckpoint(session: Session): Session {
  return session.checkpoint ? session : { ...session, checkpoint: true };
}
