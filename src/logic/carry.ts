import { CARRY, type CarryConfig } from '../config/goal';
import { enemyHitbox, hitByAttack, isAttackable, type Enemy } from '../entities/enemies/Enemy';
import { dropShell, killShell, throwShell, type ShellEnemy } from '../entities/enemies/ShellEnemy';
import type { Key } from '../entities/items/Key';
import type { HeroInput } from './heroMotion';
import type { Level } from './level';
import { isStomp } from './stomp';
import { insideTerrain, overlaps, type Box } from './tileCollision';

/**
 * Carregar a chave e as conchas (F5a), como no SMW, sem Phaser: encostar segurando o botão de
 * correr pega; soltar o botão larga. A concha é arremessada para a frente (com baixo, só
 * largada) e a chave cai na frente do herói.
 */
export type Carried =
  | { readonly kind: 'shell'; readonly shell: ShellEnemy }
  | { readonly kind: 'key'; readonly key: Key };

export function carriedBox(carry: Carried): Box {
  return carry.kind === 'shell' ? carry.shell : carry.key;
}

/** O objeto fica na frente do herói, com a base na base dele. */
function holdAt<B extends Box>(body: B, hero: Box, facing: 1 | -1, c: CarryConfig): B {
  const x = facing > 0 ? hero.x + hero.width - c.overlap : hero.x - body.width + c.overlap;
  return { ...body, x, y: hero.y + hero.height - body.height };
}

/** Só a concha parada pode ser pega, e não logo depois do pisão (ela ainda está saindo). */
function isGrabbable(e: Enemy): e is ShellEnemy {
  return e.behavior === 'shell' && e.active && e.state === 'shell' && e.graceSteps === 0;
}

/** O que muda com o passo: o objeto carregado, os inimigos (a concha sai e volta) e a chave solta. */
export interface CarryStep {
  readonly carry: Carried | null;
  readonly enemies: readonly Enemy[];
  readonly key: Key | null;
}

/** Quem carrega: o herói neste passo, depois da física. */
export interface Holder {
  readonly box: Box;
  readonly vy: number;
  readonly facing: 1 | -1;
  readonly input: HeroInput;
  /** Pode continuar carregando: a pé (montado, larga). */
  readonly canHold: boolean;
  /** Pode pegar algo agora: não enquanto pisca depois do dano, que acabou de fazê-lo largar. */
  readonly canGrab: boolean;
}

/**
 * Larga o objeto na frente do herói; se ali for parede, ele sai do meio do herói. A concha
 * desliza para onde o herói olha, ou fica parada com `down`; a chave cai.
 */
export function releaseCarried(
  carry: Carried,
  holder: Pick<Holder, 'box' | 'facing'>,
  down: boolean,
  level: Level,
  enemies: readonly Enemy[],
  key: Key | null,
  c: CarryConfig = CARRY,
): CarryStep {
  const { box: hero, facing } = holder;
  const front = holdAt(carriedBox(carry), hero, facing, c);
  const x = insideTerrain(level, front) ? hero.x + (hero.width - front.width) / 2 : front.x;
  const y = front.y;
  if (carry.kind === 'key') {
    return { carry: null, enemies, key: { ...carry.key, x, y, vy: 0, ground: false } };
  }
  const shell: ShellEnemy = { ...carry.shell, x, y, vy: 0, ground: false };
  return {
    carry: null,
    enemies: [...enemies, down ? dropShell(shell) : throwShell(shell, facing)],
    key,
  };
}

/**
 * Um passo de quem carrega, depois da física do herói: larga ao soltar o botão (ou quando
 * não pode mais carregar, como ao montar), pega a chave ou uma concha parada que esteja
 * encostando (o pisão continua chutando), e leva o objeto junto. A concha carregada derrota
 * o primeiro inimigo que tocar e se quebra junto, como no SMW.
 */
export function stepCarry(
  carry: Carried | null,
  enemies: readonly Enemy[],
  key: Key | null,
  holder: Holder,
  level: Level,
  c: CarryConfig = CARRY,
): CarryStep {
  const { box: hero, facing, input } = holder;
  if (carry && !(input.run && holder.canHold)) {
    return releaseCarried(carry, holder, input.down, level, enemies, key, c);
  }
  let held = carry;
  let list = enemies;
  let free = key;
  if (!held && input.run && holder.canHold && holder.canGrab) {
    if (free && overlaps(hero, free)) {
      held = { kind: 'key', key: free };
      free = null;
    } else {
      const shell = list.find(
        (e): e is ShellEnemy => isGrabbable(e) && overlaps(hero, e) && !isStomp(hero, holder.vy, e),
      );
      if (shell) {
        held = { kind: 'shell', shell };
        list = list.filter((e) => e.id !== shell.id);
      }
    }
  }
  if (!held) return { carry: null, enemies: list, key: free };
  if (held.kind === 'key') {
    return {
      carry: { kind: 'key', key: holdAt(held.key, hero, facing, c) },
      enemies: list,
      key: free,
    };
  }

  const shell = holdAt(held.shell, hero, facing, c);
  const victim = list.find((e) => {
    const box = enemyHitbox(e);
    return box !== null && overlaps(box, shell);
  });
  if (!victim) return { carry: { kind: 'shell', shell }, enemies: list, key: free };
  const hit = list.map((e) => (e.id === victim.id && isAttackable(e) ? hitByAttack(e) : e));
  return { carry: null, enemies: [...hit, killShell(shell)], key: free };
}
