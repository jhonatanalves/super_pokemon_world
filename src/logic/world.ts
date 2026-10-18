import { ENEMIES } from '../config/enemies';
import { MOUNTS } from '../config/mounts';
import { EFFECTS } from '../config/placeholder';
import { FIXED_DT, PHYSICS, type PhysicsConfig } from '../config/physics';
import { POWERUPS } from '../config/powerups';
import { activateEnemy, isGone, stepEnemy } from '../entities/enemies/Enemy';
import {
  activateItem,
  createBlockItem,
  createDroppedItem,
  isItemGone,
  stepPowerItem,
} from '../entities/items/PowerItem';
import { isMountGone, stepMount } from '../entities/mounts/Mount';
import {
  canShoot,
  createSpark,
  spinBox,
  stepShot,
  stepSpark,
  type Shot,
  type Spark,
} from './attacks';
import { blockIndexAt, hitBlock, isOnNoteBlock, tickBlocks, withBlocks } from './blocks';
import { attackArea, heroContacts, projectileHits, shellHits } from './combat';
import { takeDamage, tickHurt } from './damage';
import type { GameEvent } from './events';
import { heroBox, heroCenter, resizeHero, stepHeroBody } from './heroBody';
import { bounceHero, killHero, stepsFor, type HeroInput } from './heroMotion';
import {
  blockRelease,
  collectPower,
  damagePower,
  hasStar,
  heroHeightFor,
  isBig,
  tickPower,
  useReserve,
} from './powerups';
import { heroSetup, nextSurfSteps, riddenMount, stepRider, throwRider, tryMount } from './riding';
import { addCoins, loseLife, reachCheckpoint } from './session';
import { stompBounceSpeed } from './stomp';
import { overlaps, type Box } from './tileCollision';
import type { View, World } from './worldState';

export { createWorld, levelStartedEvent, type Popup, type View, type World } from './worldState';
/** Meio da tela, de onde cai o item da reserva; sem tela finita (testes), o herói. */
function viewCenter(view: View, fallback: number): number {
  const center = (view.left + view.right) / 2;
  return Number.isFinite(center) ? center : fallback;
}

function inView(box: Box, view: View): boolean {
  const margin = ENEMIES.activationMargin;
  return box.x + box.width > view.left - margin && box.x < view.right + margin;
}

/**
 * Um passo fixo da fase: herói (a pé, nadando ou montado), cabeçadas nos blocos, bloco nota,
 * inimigos, itens de power-up, montarias, conchas, faíscas, cuspe e giro, contato herói ×
 * inimigo, itens, checkpoint. Devolve o mundo novo e os eventos do passo. Com o herói morto,
 * só ele anda (a contagem até reiniciar); o resto congela.
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
  let mount = riddenMount(world.mounts);
  const setup = heroSetup(world.hero, power, mount, world.surfSteps, world.collision, input, p, dt);
  let hero = stepHeroBody(world.hero, setup.input, world.collision, dt, setup.physics, setup.mods);
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

  // Inimigos, itens e montarias: os do Tiled acordam perto da tela; os acordados andam.
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
  let mounts = world.mounts
    .map((m) => stepMount(m, collision, dt))
    .filter((m) => m.y <= world.level.height)
    .filter((m) => !isMountGone(m, view.left, view.right, ENEMIES.activationMargin));

  // Montaria: montado, pulo extra, desmontar, engolir e cuspir; a pé, cair em cima monta.
  const attackPressed = input.run && !world.runHeld;
  const formHeight = heroHeightFor(power.form);
  let airJumps = world.airJumps;
  let shots = world.shots
    .map((sh) => stepShot(sh, collision, dt))
    .filter((sh): sh is Shot => sh !== null && inView(sh, view));
  mount = mounts.find((m) => m.state === 'ridden') ?? null;
  if (mount) {
    const ride = stepRider(
      world.hero,
      hero,
      mount,
      input,
      attackPressed,
      airJumps,
      enemies,
      shots,
      formHeight,
      p,
      dt,
    );
    hero = ride.hero;
    airJumps = ride.airJumps;
    enemies = [...ride.enemies];
    shots = [...ride.shots];
    const ridden = ride.mount;
    mounts = mounts.map((m) => (m.id === ridden.id ? ridden : m));
    if (ride.dismounted) mount = null;
  } else if (hero.motion.vy > 0) {
    const mounted = tryMount(hero, mounts);
    if (mounted) {
      hero = mounted.hero;
      mounts = mounted.mounts;
      mount = riddenMount(mounts);
      airJumps = MOUNTS.airJumps;
    }
  }

  // Concha deslizando, faíscas (elétrico), cuspe e giro (voador). Montado, sem habilidades.
  enemies = shellHits(enemies);
  let sparks = world.sparks
    .map((sp) => stepSpark(sp, collision, dt))
    .filter((sp): sp is Spark => sp !== null && inView(sp, view));
  if (!mount && attackPressed && power.form === 'electric' && canShoot(sparks)) {
    sparks.push(createSpark(heroBox(hero), hero.motion.facing));
  }
  const sparked = projectileHits(enemies, sparks);
  const spat = projectileHits(sparked.enemies, shots);
  enemies = spat.enemies;
  sparks = sparked.projectiles;
  shots = spat.projectiles;
  let spinSteps = power.form === 'flying' && !mount ? Math.max(world.spinSteps - 1, 0) : 0;
  const canSpin = !mount && power.form === 'flying' && !hero.contacts.ground;
  if (attackPressed && canSpin && spinSteps === 0) spinSteps = stepsFor(POWERUPS.spin.time, dt);
  if (spinSteps > 0) enemies = attackArea(enemies, spinBox(heroBox(hero)));

  // Herói × inimigos: invencível derrota no toque; senão pisão, chute da concha ou dano.
  const contact = heroContacts(enemies, heroBox(hero), hero.motion.vy, hasStar(power));
  enemies = contact.enemies;
  if (contact.stomped) bounce(stompBounceSpeed(input.jump, p));
  if (contact.hurt) {
    // Montado, o herói cai da montaria e não perde nada; a pé, grande ou especial perde um
    // nível (soltando o item da reserva) e o pequeno morre.
    const damage = takeDamage(hurt, mount !== null || isBig(power.form), dt, p);
    hurt = damage.state;
    if (damage.outcome !== 'ignored') events.push({ type: 'player-damaged' });
    if (damage.outcome === 'survived' && mount) {
      const thrown = throwRider(hero, mount, formHeight, p.stompBounce);
      hero = thrown.hero;
      const fled = thrown.mount;
      mounts = mounts.map((m) => (m.id === fled.id ? fled : m));
      mount = null;
    } else if (damage.outcome === 'survived') {
      power = damagePower(power).state;
      if (session.reserve) {
        powerItems.push(createDroppedItem(nextId++, session.reserve, viewCenter(view, heroX)));
        session = { ...session, reserve: null };
      }
    }
    if (damage.outcome === 'died') hero = { ...hero, motion: killHero(hero.motion), deadSteps: 0 };
  }

  // Itens de power-up pegos; o que não muda a forma vai para a reserva.
  powerItems = powerItems.filter((item) => {
    if (!overlaps(heroBox(hero), item)) return true;
    const got = collectPower(power, item.power, session.reserve, dt);
    power = got.state;
    session = { ...session, reserve: got.reserve };
    return false;
  });
  // Botão da reserva: aplica o item guardado.
  if (input.reserve && !world.reserveHeld && hero.motion.state !== 'dead') {
    const used = useReserve(power, session.reserve, dt);
    power = used.state;
    session = { ...session, reserve: used.reserve };
  }
  hero = resizeHero(hero, mount ? MOUNTS.riderHeight : heroHeightFor(power.form));
  if (power.form !== world.power.form || hasStar(power) !== hasStar(world.power)) {
    events.push({ type: 'power-changed', form: power.form, star: hasStar(power) });
  }
  if (session.reserve !== world.session.reserve) {
    events.push({ type: 'reserve-changed', reserve: session.reserve });
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
      power,
      enemies,
      blocks,
      items,
      powerItems,
      sparks,
      spinSteps,
      mounts,
      shots,
      airJumps,
      surfSteps: nextSurfSteps(world.surfSteps, power, hero, collision),
      runHeld: input.run,
      reserveHeld: input.reserve,
      nextId,
      session,
      pokeballs,
      popups,
    },
    events,
  };
}
