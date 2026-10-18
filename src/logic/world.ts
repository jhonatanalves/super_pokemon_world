import { ENEMIES } from '../config/enemies';
import { EFFECTS } from '../config/placeholder';
import { FIXED_DT, PHYSICS, type PhysicsConfig } from '../config/physics';
import { POWERUPS } from '../config/powerups';
import {
  activateEnemy,
  canBeStomped,
  enemyHitbox,
  hitByAttack,
  isAttackable,
  isGone,
  isSlidingShell,
  stepEnemy,
  stompEnemy,
  touchEnemy,
  type Enemy,
} from '../entities/enemies/Enemy';
import { createEnemy } from '../entities/EntityFactory';
import {
  activateItem,
  createBlockItem,
  createPlacedItem,
  isItemGone,
  stepPowerItem,
  type PowerItem,
} from '../entities/items/PowerItem';
import { canShoot, createSpark, spinBox, stepSpark, type Spark } from './attacks';
import {
  blockIndexAt,
  hitBlock,
  isOnNoteBlock,
  parseBlock,
  tickBlocks,
  withBlocks,
  type Block,
} from './blocks';
import type { GameContent } from './creatures';
import { NOT_HURT, takeDamage, tickHurt, type HurtState } from './damage';
import type { GameEvent } from './events';
import {
  createHeroBody,
  heroBox,
  heroCenter,
  resizeHero,
  stepHeroBody,
  type HeroBody,
} from './heroBody';
import { bounceHero, killHero, stepsFor, type HeroInput } from './heroMotion';
import { parseCheckpoint, parseItem, type Checkpoint, type Item } from './items';
import { objectFoot, type Level, type Point } from './level';
import {
  blockRelease,
  collectPower,
  damagePower,
  hasStar,
  heroHeightFor,
  isBig,
  START_POWER,
  tickPower,
  type PowerState,
} from './powerups';
import { addCoins, loseLife, reachCheckpoint, type Session } from './session';
import { isStomp, stompBounceSpeed } from './stomp';
import { overlaps, type Box } from './tileCollision';

/** Efeito só visual: moeda saindo de um bloco ou pedaços de um tijolo quebrado. */
export interface Popup {
  readonly kind: 'coin' | 'debris';
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
  /** Forma do herói e invencibilidade (F4). Toda tentativa começa pequena. */
  readonly power: PowerState;
  readonly enemies: readonly Enemy[];
  readonly blocks: readonly Block[];
  readonly items: readonly Item[];
  /** Itens de power-up soltos (F4). */
  readonly powerItems: readonly PowerItem[];
  /** Faíscas do estado elétrico na tela (F4). */
  readonly sparks: readonly Spark[];
  /** Passos que faltam do giro do estado voador; 0 = sem giro (F4). */
  readonly spinSteps: number;
  /** Botão de correr/atacar no passo anterior, para detectar o aperto (F4). */
  readonly runHeld: boolean;
  /** Próximo id livre para um item de power-up. */
  readonly nextId: number;
  readonly checkpoint: Checkpoint | null;
  readonly session: Session;
  /** Moedas Pokébola coletadas nesta tentativa. */
  readonly pokeballs: number;
  readonly pokeballsTotal: number;
  readonly popups: readonly Popup[];
}

/** Faixa horizontal da tela, para acordar os inimigos. */
export interface View {
  readonly left: number;
  readonly right: number;
}

/** Monta a fase a partir dos objetos do Tiled. Objetos com erro ficam de fora e vão em `errors`. */
export function createWorld(
  level: Level,
  content: GameContent,
  session: Session,
): { world: World; errors: string[] } {
  const blocks: Block[] = [];
  const items: Item[] = [];
  const checkpoints: Checkpoint[] = [];
  const powerItems: PowerItem[] = [];
  const enemies: Enemy[] = [];
  const errors: string[] = [];
  for (const o of level.objects) {
    const block = parseBlock(o, level.tileSize, content.items);
    const item = block ? null : parseItem(o);
    const checkpoint = block || item ? null : parseCheckpoint(o);
    const powerItem = content.items.get(o.type);
    if (block) blocks.push(block);
    else if (item) items.push(item);
    else if (checkpoint) checkpoints.push(checkpoint);
    else if (powerItem) {
      powerItems.push(createPlacedItem(powerItems.length, powerItem.power, objectFoot(o)));
    } else {
      const spawned = createEnemy(o, enemies.length, content.creatures);
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
    hero: createHeroBody(start, heroHeightFor(START_POWER.form)),
    hurt: NOT_HURT,
    power: START_POWER,
    enemies,
    blocks,
    items,
    powerItems,
    sparks: [],
    spinSteps: 0,
    // Como o pulo: o botão que abriu a fase, se ainda estiver pressionado, não vira ataque.
    runHeld: true,
    nextId: powerItems.length,
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

/** Derrota quem encosta em `area` e pode ser atacado. */
function attackArea(enemies: readonly Enemy[], area: Box): Enemy[] {
  return enemies.map((e) => {
    const box = enemyHitbox(e);
    return box && isAttackable(e) && overlaps(area, box) ? hitByAttack(e) : e;
  });
}

/**
 * Um passo fixo da fase: herói, cabeçadas nos blocos, bloco nota, inimigos, itens de power-up,
 * conchas, faíscas e giro, contato herói × inimigo, itens, checkpoint. Devolve o mundo novo e
 * os eventos do passo. Com o herói morto, só ele anda (a contagem até reiniciar); o resto congela.
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
  const s = world.level.tileSize;
  let session = world.session;
  let power = tickPower(world.power);
  // Voador: segurando o pulo na queda, plana (cai devagar).
  const gliding = power.form === 'flying' && input.jump && world.hero.motion.vy > 0;
  const heroPhysics = gliding ? { ...p, maxFallSpeed: POWERUPS.glideFallSpeed } : p;
  let hero = stepHeroBody(world.hero, input, world.collision, dt, heroPhysics);
  let hurt = tickHurt(world.hurt);
  let blocks = tickBlocks(world.blocks);
  let collision = world.collision;
  let nextId = world.nextId;
  let powerItems = [...world.powerItems];
  const popups = world.popups.map((c) => ({ ...c, steps: c.steps - 1 })).filter((c) => c.steps > 0);
  const heroX = heroCenter(hero).x;

  const gainCoins = (amount: number): void => {
    session = addCoins(session, amount);
    events.push({ type: 'coin-collected', coins: session.coins, lives: session.lives });
  };

  // Cabeçada num bloco: moeda, item de power-up ou tijolo quebrado.
  const index = hero.bumped ? blockIndexAt(blocks, hero.bumped) : -1;
  if (index >= 0) {
    const before = blocks[index];
    const hit = hitBlock(before, isBig(power.form));
    const after = hit.block;
    blocks = after
      ? blocks.map((b, i) => (i === index ? after : b))
      : blocks.filter((_, i) => i !== index);
    if (after?.kind !== before.kind) collision = withBlocks(world.level, blocks);
    const at = { x: before.col * s, y: before.row * s };
    if (!after) popups.push({ kind: 'debris', ...at, steps: stepsFor(EFFECTS.debrisTime, dt) });
    if (hit.released === 'coin') {
      gainCoins(1);
      popups.push({ kind: 'coin', ...at, steps: stepsFor(EFFECTS.coinPopTime, dt) });
    } else if (hit.released) {
      const released = blockRelease(power.form, hit.released);
      powerItems.push(createBlockItem(nextId++, released, before, s, heroX));
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
  if (hero.contacts.ground && isOnNoteBlock(blocks, heroBox(hero), s)) bounce(p.noteBounce);

  // Inimigos e itens postos no Tiled: acordam perto da tela; os acordados andam.
  const ctx = { level: collision, hero: heroBox(hero), dt };
  let enemies = world.enemies
    .map((e) => {
      if (e.active) return stepEnemy(e, ctx);
      return inView(e, view) ? activateEnemy(e, heroX) : e;
    })
    .filter((e) => !isGone(e, world.level.height, dt));
  powerItems = powerItems
    .map((item) => {
      if (item.active) return stepPowerItem(item, { level: collision, heroX, dt });
      return inView(item, view) ? activateItem(item, heroX) : item;
    })
    .filter((item) => !isItemGone(item, world.level.height));

  // Concha deslizando mata quem encostar nela (e outra concha deslizando também morre).
  const shells = enemies.filter(isSlidingShell);
  enemies = enemies.map((e) => {
    const box = enemyHitbox(e);
    if (!box) return e;
    const hit = shells.some((sh) => {
      const shellBox = sh.id !== e.id ? enemyHitbox(sh) : null;
      return shellBox !== null && overlaps(box, shellBox);
    });
    return hit ? hitByAttack(e) : e;
  });

  // Ataques: X solta faísca (elétrico) ou gira no ar (voador).
  const attackPressed = input.run && !world.runHeld;
  let sparks = world.sparks
    .map((sp) => stepSpark(sp, collision, dt))
    .filter((sp): sp is Spark => sp !== null && inView(sp, view));
  if (attackPressed && power.form === 'electric' && canShoot(sparks)) {
    sparks.push(createSpark(heroBox(hero), hero.motion.facing));
  }
  // A faísca some no primeiro inimigo que tocar; o imune não morre.
  enemies = enemies.map((e) => {
    const box = enemyHitbox(e);
    const i = box ? sparks.findIndex((sp) => overlaps(sp, box)) : -1;
    if (i < 0) return e;
    sparks = sparks.filter((_, j) => j !== i);
    return hitByAttack(e);
  });
  let spinSteps = power.form === 'flying' ? Math.max(world.spinSteps - 1, 0) : 0;
  if (attackPressed && power.form === 'flying' && !hero.contacts.ground && spinSteps === 0) {
    spinSteps = stepsFor(POWERUPS.spin.time, dt);
  }
  if (spinSteps > 0) enemies = attackArea(enemies, spinBox(heroBox(hero)));

  // Herói × inimigos: invencível derrota no toque; senão pisão, chute da concha ou dano.
  const box = heroBox(hero);
  const star = hasStar(power);
  let stomped = false;
  let hurtByEnemy = false;
  enemies = enemies.map((e) => {
    const enemyBox = enemyHitbox(e);
    if (!enemyBox || !overlaps(box, enemyBox)) return e;
    if (star) return hitByAttack(e);
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
    // Grande ou especial aguenta o toque e perde um nível; o pequeno morre.
    const damage = takeDamage(hurt, isBig(power.form), dt, p);
    hurt = damage.state;
    if (damage.outcome !== 'ignored') events.push({ type: 'player-damaged' });
    if (damage.outcome === 'survived') power = damagePower(power).state;
    if (damage.outcome === 'died') hero = { ...hero, motion: killHero(hero.motion), deadSteps: 0 };
  }

  // Itens de power-up pegos.
  powerItems = powerItems.filter((item) => {
    if (!overlaps(heroBox(hero), item)) return true;
    power = collectPower(power, item.power, dt).state;
    return false;
  });
  hero = resizeHero(hero, heroHeightFor(power.form));

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
      power,
      enemies,
      blocks,
      items,
      powerItems,
      sparks,
      spinSteps,
      runHeld: input.run,
      nextId,
      session,
      pokeballs,
      popups,
    },
    events,
  };
}
