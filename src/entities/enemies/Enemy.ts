import { ENEMIES } from '../../config/enemies';
import { stepsFor } from '../../logic/heroMotion';
import type { Box } from '../../logic/tileCollision';
import { centerX, type EnemyContext } from './EnemyBase';
import { stepDropper, type DropperEnemy } from './DropperEnemy';
import { killFlyer, stepFlyer, type FlyerEnemy } from './FlyerEnemy';
import { killPiper, piperVisibleBox, stepPiper, type PiperEnemy } from './PiperEnemy';
import { kickShell, killShell, stepShell, stompShell, type ShellEnemy } from './ShellEnemy';
import { killWalker, stepWalker, stompWalker, type WalkerEnemy } from './WalkerEnemy';

/** Todo inimigo da fase; `behavior` diz qual classe (vem de creatures.json). */
export type Enemy = WalkerEnemy | ShellEnemy | FlyerEnemy | PiperEnemy | DropperEnemy;

/** O que acontece quando o herói encosta num inimigo sem pisar nele. */
export type TouchEffect = 'hurt' | 'kick' | 'none';

export function stepEnemy(e: Enemy, ctx: EnemyContext): Enemy {
  switch (e.behavior) {
    case 'walker':
      return stepWalker(e, ctx);
    case 'shell':
      return stepShell(e, ctx);
    case 'flyer':
      return stepFlyer(e, ctx);
    case 'piper':
      return stepPiper(e, ctx);
    case 'dropper':
      return stepDropper(e, ctx);
  }
}

/** Morto (pisado ou pela concha): só o corpo fica na tela por um tempo. */
export function isDefeated(e: Enemy): boolean {
  return e.state === 'dead' || e.state === 'squashed';
}

/** Área que encosta no herói e nos outros inimigos; null se não colide agora. */
export function enemyHitbox(e: Enemy): Box | null {
  if (!e.active || isDefeated(e)) return null;
  if (e.behavior === 'piper') return piperVisibleBox(e);
  return { x: e.x, y: e.y, width: e.width, height: e.height };
}

/** Já pode sair da lista: o corpo sumiu ou caiu num buraco. */
export function isGone(e: Enemy, levelHeight: number, dt: number): boolean {
  if (e.y > levelHeight) return true;
  return isDefeated(e) && e.stateSteps >= stepsFor(ENEMIES.corpseTime, dt);
}

/** Acorda o inimigo; os que andam começam virados para o herói. */
export function activateEnemy(e: Enemy, heroX: number): Enemy {
  if (e.behavior === 'walker' || e.behavior === 'shell') {
    return { ...e, active: true, dir: heroX < centerX(e) ? -1 : 1 };
  }
  return { ...e, active: true };
}

export function canBeStomped(e: Enemy): boolean {
  return e.behavior === 'walker' || e.behavior === 'shell' || e.behavior === 'flyer';
}

/** Pisão válido (a regra está em src/logic/stomp.ts). Quem não pode ser pisado não muda. */
export function stompEnemy(e: Enemy, heroX: number): Enemy {
  switch (e.behavior) {
    case 'walker':
      return stompWalker(e);
    case 'shell':
      return stompShell(e, heroX);
    case 'flyer':
      return killFlyer(e);
    default:
      return e;
  }
}

/**
 * Toque sem pisão: a concha parada é chutada, e o resto machuca. Logo depois de um pisão ou
 * chute a concha não reage (o herói ainda está encostado nela).
 */
export function touchEnemy(e: Enemy, heroX: number): { enemy: Enemy; effect: TouchEffect } {
  if (e.behavior === 'shell' && e.state !== 'walk') {
    if (e.graceSteps > 0) return { enemy: e, effect: 'none' };
    if (e.state === 'shell') return { enemy: kickShell(e, heroX), effect: 'kick' };
  }
  return { enemy: e, effect: 'hurt' };
}

export function isSlidingShell(e: Enemy): boolean {
  return e.behavior === 'shell' && e.state === 'slide';
}

/** Atingido por uma concha deslizando. O que cai do teto (dropper) é imune. */
export function hitByShell(e: Enemy): Enemy {
  switch (e.behavior) {
    case 'walker':
      return killWalker(e);
    case 'shell':
      return killShell(e);
    case 'flyer':
      return killFlyer(e);
    case 'piper':
      return killPiper(e);
    case 'dropper':
      return e;
  }
}
