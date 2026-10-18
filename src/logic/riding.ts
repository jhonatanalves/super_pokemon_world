import { MOUNTS, type MountsConfig } from '../config/mounts';
import type { PhysicsConfig } from '../config/physics';
import { POWERUPS, type PowerUpsConfig } from '../config/powerups';
import { canBeSwallowed, enemyHitbox, type Enemy } from '../entities/enemies/Enemy';
import {
  canRide,
  fleeMount,
  followRider,
  leaveMount,
  rideMount,
  riderMods,
  riderPhysics,
  tongueBox,
  type Mount,
} from '../entities/mounts/Mount';
import { createShot, type Shot } from './attacks';
import { heroBox, NO_MODS, resizeHero, type HeroBody, type HeroMods } from './heroBody';
import { bounceHero, canGroundJump, stepsFor, type HeroInput } from './heroMotion';
import type { Level } from './level';
import type { PowerState } from './powerups';
import { isStomp } from './stomp';
import { overlaps } from './tileCollision';
import { onWaterSurface } from './water';

/**
 * Montarias e habilidades que mudam o corpo do herói (F4c), sem Phaser: física do passo
 * (montaria, Surfista, planar do voador), montar, pulo extra, desmontar, engolir, cuspir e
 * a fuga da montaria com o dano.
 */

/** Montaria em uso, se houver. */
export function riddenMount(mounts: readonly Mount[]): Mount | null {
  return mounts.find((m) => m.state === 'ridden') ?? null;
}

/** Física, ajustes do corpo e botões que valem para o herói neste passo. */
export interface HeroSetup {
  readonly physics: PhysicsConfig;
  readonly mods: HeroMods;
  readonly input: HeroInput;
}

/**
 * Montado: velocidades e pulo da montaria, e o baixo não agacha (é para desmontar).
 * Surfista: nada mais rápido e anda sobre a água até `waterWalkTime`. Voador: plana
 * segurando o pulo na queda.
 */
export function heroSetup(
  hero: HeroBody,
  power: PowerState,
  mount: Mount | null,
  surfSteps: number,
  level: Level,
  input: HeroInput,
  p: PhysicsConfig,
  dt: number,
  c: PowerUpsConfig = POWERUPS,
): HeroSetup {
  if (mount) {
    const onWater = hero.contacts.ground && onWaterSurface(level, heroBox(hero));
    return {
      physics: riderPhysics(mount.kind, onWater, p),
      mods: riderMods(mount.kind),
      input: { ...input, down: false },
    };
  }
  if (power.form === 'surf') {
    const mods = {
      waterFloor: surfSteps < stepsFor(c.surf.waterWalkTime, dt),
      swimSpeed: c.surf.swimSpeed,
    };
    return { physics: p, mods, input };
  }
  const gliding = power.form === 'flying' && input.jump && hero.motion.vy > 0;
  return {
    physics: gliding ? { ...p, maxFallSpeed: c.glideFallSpeed } : p,
    mods: NO_MODS,
    input,
  };
}

/**
 * Passos seguidos do Surfista em pé sobre a água. Zera ao pisar em chão firme (ou em outra
 * forma); no ar ou nadando, fica como está.
 */
export function nextSurfSteps(
  prev: number,
  power: PowerState,
  hero: HeroBody,
  level: Level,
): number {
  if (power.form !== 'surf') return 0;
  if (!hero.contacts.ground) return prev;
  return onWaterSurface(level, heroBox(hero)) ? prev + 1 : 0;
}

/**
 * Herói caindo em cima de uma montaria livre (mesma regra do pisão): monta. A caixa passa
 * a ser a do herói montado, com a base na base da montaria.
 */
export function tryMount(
  hero: HeroBody,
  mounts: readonly Mount[],
  c: MountsConfig = MOUNTS,
): { hero: HeroBody; mounts: Mount[] } | null {
  const box = heroBox(hero);
  const i = mounts.findIndex(
    (m) => canRide(m) && overlaps(box, m) && isStomp(box, hero.motion.vy, m),
  );
  if (i < 0) return null;
  const m = mounts[i];
  const rider: HeroBody = {
    ...hero,
    x: m.x,
    y: m.y + m.height - c.riderHeight,
    height: c.riderHeight,
    motion: { ...hero.motion, vy: 0 },
  };
  const facing = hero.motion.facing;
  return {
    hero: rider,
    mounts: mounts.map((x, j) => (j === i ? followRider(rideMount(x), heroBox(rider), facing) : x)),
  };
}

export interface RiderStep {
  readonly hero: HeroBody;
  readonly mount: Mount;
  readonly airJumps: number;
  readonly enemies: readonly Enemy[];
  readonly shots: readonly Shot[];
  /** O herói desceu da montaria neste passo (baixo + pulo). */
  readonly dismounted: boolean;
}

/**
 * Um passo do herói montado, depois da física: desmontar (baixo + pulo), pulo extra no ar,
 * engolir com o botão de ataque (a aquática guarda o inimigo e o cospe no aperto seguinte;
 * a de terra o digere e ganha um pulo no ar) e a montaria seguindo o herói.
 */
export function stepRider(
  prev: HeroBody,
  hero: HeroBody,
  mount: Mount,
  input: HeroInput,
  attackPressed: boolean,
  airJumps: number,
  enemies: readonly Enemy[],
  shots: readonly Shot[],
  formHeight: number,
  p: PhysicsConfig,
  dt: number,
  c: MountsConfig = MOUNTS,
): RiderStep {
  const jumpPressed = input.jump && !prev.motion.jumpHeld;
  let jumps = hero.contacts.ground ? c.airJumps : airJumps;
  let m = mount;

  // Desmontar: o herói sai por cima, com um pulo, e a montaria fica onde está.
  if (jumpPressed && input.down) {
    const top = m.y - formHeight;
    const off: HeroBody = {
      ...hero,
      y: top,
      height: formHeight,
      motion: bounceHero(hero.motion, p.jumpImpulse, true),
      contacts: { ...hero.contacts, ground: false },
    };
    return { hero: off, mount: leaveMount(m, dt), airJumps: 0, enemies, shots, dismounted: true };
  }

  // Pulo extra no ar: só quando o pulo comum não vale mais, e fora d'água.
  let h = hero;
  const swimming = hero.motion.state === 'swim';
  if (jumpPressed && !swimming && !canGroundJump(prev.motion, prev.contacts, dt, p)) {
    if (jumps > 0 || m.bonusJumps > 0) {
      if (jumps > 0) jumps--;
      else m = { ...m, bonusJumps: m.bonusJumps - 1 };
      h = {
        ...h,
        motion: bounceHero(h.motion, c.airJumpImpulse, true),
        contacts: { ...h.contacts, ground: false },
      };
    }
  }

  // Engolir ou cuspir.
  let nextEnemies = enemies;
  let nextShots = shots;
  const facing = h.motion.facing;
  if (attackPressed) {
    if (m.kind === 'water' && m.stomach) {
      nextShots = [...shots, createShot(heroBox(h), facing)];
      m = { ...m, stomach: false };
    } else {
      const area = tongueBox(heroBox(h), facing);
      const prey = enemies.find((e) => {
        const box = enemyHitbox(e);
        return box !== null && canBeSwallowed(e) && overlaps(area, box);
      });
      if (prey) {
        nextEnemies = enemies.filter((e) => e.id !== prey.id);
        m =
          m.kind === 'water'
            ? { ...m, stomach: true }
            : { ...m, bonusJumps: Math.min(m.bonusJumps + 1, c.land.maxBonusJumps) };
      }
    }
  }

  return {
    hero: h,
    mount: followRider(m, heroBox(h), facing),
    airJumps: jumps,
    enemies: nextEnemies,
    shots: nextShots,
    dismounted: false,
  };
}

/**
 * Dano montado: o herói cai da montaria sem perder o power-up (volta à altura da forma, com
 * um pulinho) e a montaria foge para o lado em que olhava.
 */
export function throwRider(
  hero: HeroBody,
  mount: Mount,
  formHeight: number,
  bounce: number,
): { hero: HeroBody; mount: Mount } {
  const off = resizeHero(hero, formHeight);
  return {
    hero: {
      ...off,
      motion: bounceHero(off.motion, bounce, false),
      contacts: { ...off.contacts, ground: false },
    },
    mount: fleeMount(mount, mount.dir),
  };
}
