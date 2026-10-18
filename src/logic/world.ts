import { ENEMIES } from '../config/enemies';
import { EFFECTS } from '../config/placeholder';
import { FIXED_DT, PHYSICS, type PhysicsConfig } from '../config/physics';
import {
  activateEnemy,
  canBeStomped,
  enemyHitbox,
  hitByShell,
  isGone,
  isSlidingShell,
  stepEnemy,
  stompEnemy,
  touchEnemy,
  type Enemy,
} from '../entities/enemies/Enemy';
import { createEnemy } from '../entities/EntityFactory';
import {
  blockIndexAt,
  hitBlock,
  isOnNoteBlock,
  parseBlock,
  tickBlocks,
  withBlocks,
  type Block,
} from './blocks';
import type { Creatures } from './creatures';
import { NOT_HURT, takeDamage, tickHurt, type HurtState } from './damage';
import type { GameEvent } from './events';
import { createHeroBody, heroBox, heroCenter, stepHeroBody, type HeroBody } from './heroBody';
import { bounceHero, killHero, stepsFor, type HeroInput } from './heroMotion';
import { parseCheckpoint, parseItem, type Checkpoint, type Item } from './items';
import type { Level, Point } from './level';
import { addCoins, loseLife, reachCheckpoint, type Session } from './session';
import { isStomp, stompBounceSpeed } from './stomp';
import { overlaps, type Box } from './tileCollision';

/** Moeda saindo de um bloco (só visual). */
export interface CoinPopup {
  /** Canto superior esquerdo do bloco que a soltou. */
  readonly x: number;
  readonly y: number;
  readonly steps: number;
}

/**
 * Tudo o que muda numa tentativa da fase. Sem Phaser: a LevelScene só chama stepWorld no
 * passo fixo, emite os eventos e desenha.
 */
export interface World {
  /** Fase como veio do Tiled. */
  readonly level: Level;
  /** Terreno com os blocos por cima; é nele que tudo colide. */
  readonly collision: Level;
  readonly hero: HeroBody;
  readonly hurt: HurtState;
  readonly enemies: readonly Enemy[];
  readonly blocks: readonly Block[];
  readonly items: readonly Item[];
  readonly checkpoint: Checkpoint | null;
  readonly session: Session;
  /** Moedas Pokébola coletadas nesta tentativa. */
  readonly pokeballs: number;
  readonly pokeballsTotal: number;
  readonly popups: readonly CoinPopup[];
}

/** Faixa horizontal da tela, para acordar os inimigos. */
export interface View {
  readonly left: number;
  readonly right: number;
}

/**
 * Na F3 o herói é sempre pequeno: qualquer dano mata. A partir da F4, quem diz se ele
 * aguenta o toque é o power-up atual.
 */
const HERO_SURVIVES_HIT = false;

/** Monta a fase a partir dos objetos do Tiled. Objetos com erro ficam de fora e vão em `errors`. */
export function createWorld(
  level: Level,
  creatures: Creatures,
  session: Session,
): { world: World; errors: string[] } {
  const blocks: Block[] = [];
  const items: Item[] = [];
  const checkpoints: Checkpoint[] = [];
  const enemies: Enemy[] = [];
  const errors: string[] = [];
  for (const o of level.objects) {
    const block = parseBlock(o, level.tileSize);
    const item = block ? null : parseItem(o);
    const checkpoint = block || item ? null : parseCheckpoint(o);
    if (block) blocks.push(block);
    else if (item) items.push(item);
    else if (checkpoint) checkpoints.push(checkpoint);
    else {
      const spawned = createEnemy(o, enemies.length, creatures);
      if (spawned.ok) enemies.push(spawned.enemy);
      else errors.push(spawned.error);
    }
  }
  if (checkpoints.length > 1) {
    throw new Error(`Mapa inválido: no máximo 1 checkpoint; tem ${checkpoints.length}`);
  }
  const checkpoint = checkpoints[0] ?? null;
  const start: Point = session.checkpoint && checkpoint ? checkpoint.respawn : level.spawn;
  const world: World = {
    level,
    collision: withBlocks(level, blocks),
    hero: createHeroBody(start),
    hurt: NOT_HURT,
    enemies,
    blocks,
    items,
    checkpoint,
    session,
    pokeballs: 0,
    pokeballsTotal: items.filter((i) => i.kind === 'pokeball').length,
    popups: [],
  };
  return { world, errors };
}

/** Evento inicial do HUD. */
export function levelStartedEvent(world: World): GameEvent {
  return {
    type: 'level-started',
    lives: world.session.lives,
    coins: world.session.coins,
    pokeballs: world.pokeballs,
    pokeballsTotal: world.pokeballsTotal,
  };
}

function inView(box: Box, view: View): boolean {
  const margin = ENEMIES.activationMargin;
  return box.x + box.width > view.left - margin && box.x < view.right + margin;
}

/**
 * Um passo fixo da fase: herói, cabeçadas nos blocos, bloco nota, inimigos, conchas, contato
 * herói × inimigo, itens e checkpoint. Devolve o mundo novo e os eventos do passo.
 * Com o herói morto, só ele anda (a contagem até reiniciar); o resto congela.
 */
export function stepWorld(
  world: World,
  input: HeroInput,
  view: View,
  dt: number = FIXED_DT,
  p: PhysicsConfig = PHYSICS,
): { world: World; events: GameEvent[] } {
  if (world.hero.motion.state === 'dead') {
    const hero = stepHeroBody(world.hero, input, world.collision, dt, p);
    return { world: { ...world, hero }, events: [] };
  }
  const events: GameEvent[] = [];
  let session = world.session;
  let hero = stepHeroBody(world.hero, input, world.collision, dt, p);
  let hurt = tickHurt(world.hurt);
  let blocks = tickBlocks(world.blocks);
  let collision = world.collision;
  const popups = world.popups.map((c) => ({ ...c, steps: c.steps - 1 })).filter((c) => c.steps > 0);

  const gainCoins = (amount: number): void => {
    session = addCoins(session, amount);
    events.push({ type: 'coin-collected', coins: session.coins, lives: session.lives });
  };

  // Cabeçada num bloco.
  const index = hero.bumped ? blockIndexAt(blocks, hero.bumped) : -1;
  if (index >= 0) {
    const before = blocks[index];
    const hit = hitBlock(before);
    blocks = blocks.map((b, i) => (i === index ? hit.block : b));
    if (hit.block.kind !== before.kind) collision = withBlocks(world.level, blocks);
    if (hit.released === 'coin') {
      gainCoins(1);
      const s = world.level.tileSize;
      popups.push({
        x: before.col * s,
        y: before.row * s,
        steps: stepsFor(EFFECTS.coinPopTime, dt),
      });
    }
  }

  // Bloco nota: quem pousa nele é jogado para cima.
  const bounce = (speed: number): void => {
    hero = {
      ...hero,
      motion: bounceHero(hero.motion, speed, input.jump),
      contacts: { ...hero.contacts, ground: false },
    };
  };
  if (hero.contacts.ground && isOnNoteBlock(blocks, heroBox(hero), world.level.tileSize)) {
    bounce(p.noteBounce);
  }

  // Inimigos: acordam perto da tela; os acordados andam.
  const heroX = heroCenter(hero).x;
  const ctx = { level: collision, hero: heroBox(hero), dt };
  let enemies = world.enemies
    .map((e) => {
      if (e.active) return stepEnemy(e, ctx);
      return inView(e, view) ? activateEnemy(e, heroX) : e;
    })
    .filter((e) => !isGone(e, world.level.height, dt));

  // Concha deslizando mata quem encostar nela (e outra concha deslizando também morre).
  const shells = enemies.filter(isSlidingShell);
  enemies = enemies.map((e) => {
    const box = enemyHitbox(e);
    if (!box) return e;
    const hit = shells.some((s) => {
      const shellBox = s.id !== e.id ? enemyHitbox(s) : null;
      return shellBox !== null && overlaps(box, shellBox);
    });
    return hit ? hitByShell(e) : e;
  });

  // Herói × inimigos: pisão, chute da concha ou dano.
  const box = heroBox(hero);
  let stomped = false;
  let hurtByEnemy = false;
  enemies = enemies.map((e) => {
    const enemyBox = enemyHitbox(e);
    if (!enemyBox || !overlaps(box, enemyBox)) return e;
    if (canBeStomped(e) && isStomp(box, hero.motion.vy, enemyBox)) {
      stomped = true;
      return stompEnemy(e, heroX);
    }
    const touch = touchEnemy(e, heroX);
    if (touch.effect === 'hurt') hurtByEnemy = true;
    return touch.enemy;
  });
  if (stomped) bounce(stompBounceSpeed(input.jump, p));
  if (hurtByEnemy) {
    const damage = takeDamage(hurt, HERO_SURVIVES_HIT, dt, p);
    hurt = damage.state;
    if (damage.outcome !== 'ignored') events.push({ type: 'player-damaged' });
    if (damage.outcome === 'died') hero = { ...hero, motion: killHero(hero.motion), deadSteps: 0 };
  }

  // Moedas, Moedas Pokébola e checkpoint.
  let pokeballs = world.pokeballs;
  const items = world.items.filter((item) => {
    if (!overlaps(heroBox(hero), item.box)) return true;
    if (item.kind === 'coin') gainCoins(1);
    else {
      pokeballs++;
      events.push({ type: 'pokeball-collected', pokeballs });
    }
    return false;
  });
  if (world.checkpoint && !session.checkpoint && overlaps(heroBox(hero), world.checkpoint.box)) {
    session = reachCheckpoint(session);
    events.push({ type: 'checkpoint-reached' });
  }

  // Morte neste passo (buraco ou dano): perde uma vida.
  if (hero.motion.state === 'dead') {
    session = loseLife(session);
    events.push({ type: 'player-died', lives: session.lives });
  }

  return {
    world: {
      ...world,
      collision,
      hero,
      hurt,
      enemies,
      blocks,
      items,
      session,
      pokeballs,
      popups,
    },
    events,
  };
}
