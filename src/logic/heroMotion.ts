import {
  FIXED_DT,
  PHYSICS,
  SLOPE_SPEED,
  type PhysicsConfig,
  type SlopeSpeedTable,
} from '../config/physics';
import { transition } from '../systems/StateMachine';
import { HERO_TRANSITIONS, type HeroState } from './heroStates';
import { approach } from './math';
import { NO_TILE_CONTACTS, type TileContacts } from './tileCollision';

/** Botões lidos no passo. Todos são "segurado", não "apertado agora". */
export interface HeroInput {
  readonly left: boolean;
  readonly right: boolean;
  readonly down: boolean;
  readonly jump: boolean;
  readonly run: boolean;
  /** Ativa o item da caixa de reserva (F4b). Não mexe no movimento. */
  readonly reserve: boolean;
}

/** Lados em que o cenário bloqueou o corpo no último passo da física, e a inclinação do piso. */
export type HeroContacts = TileContacts;

export interface HeroMotion {
  /** px/s; positivo para a direita. */
  readonly vx: number;
  /** px/s; positivo para baixo. */
  readonly vy: number;
  readonly facing: 1 | -1;
  readonly state: HeroState;
  /** Passos seguidos no ar desde o último contato com o chão. */
  readonly airSteps: number;
  /** Falso depois de pular: o coyote time só vale para quem saiu da borda sem pular. */
  readonly canCoyote: boolean;
  /** Passos desde que o pulo foi apertado sem ser usado; null se não há pulo pendente. */
  readonly bufferedJumpAge: number | null;
  /** Passos acumulados correndo na velocidade máxima. */
  readonly pMeter: number;
  /** Botão de pulo no passo anterior, para detectar o aperto. */
  readonly jumpHeld: boolean;
  /** O corte do pulo variável já foi aplicado neste pulo. */
  readonly jumpCut: boolean;
}

export const NO_INPUT: HeroInput = {
  left: false,
  right: false,
  down: false,
  jump: false,
  run: false,
  reserve: false,
};

export const NO_CONTACTS: HeroContacts = NO_TILE_CONTACTS;

/**
 * Estado inicial. `jumpHeld` começa verdadeiro para que a tecla que abriu a fase,
 * se ainda estiver pressionada, não vire um pulo.
 */
export function createHeroMotion(): HeroMotion {
  return {
    vx: 0,
    vy: 0,
    facing: 1,
    state: 'fall',
    airSteps: 0,
    canCoyote: false,
    bufferedJumpAge: null,
    pMeter: 0,
    jumpHeld: true,
    jumpCut: true,
  };
}

/** Converte uma duração em passos fixos inteiros, para janelas de tempo sem erro de arredondamento. */
export function stepsFor(seconds: number, dt: number = FIXED_DT): number {
  return Math.round(seconds / dt);
}

export function isPMeterFull(
  motion: HeroMotion,
  dt: number = FIXED_DT,
  p: PhysicsConfig = PHYSICS,
): boolean {
  return motion.pMeter >= stepsFor(p.pMeterChargeTime, dt);
}

/**
 * Multiplicador da velocidade máxima no piso com inclinação `grade` (ver TileContacts.groundSlope),
 * andando na direção `dir`. Usa a linha da tabela com a inclinação mais próxima.
 */
export function slopeSpeedFactor(
  grade: number,
  dir: number,
  table: SlopeSpeedTable = SLOPE_SPEED,
): number {
  if (grade === 0 || dir === 0 || table.length === 0) return 1;
  const steepness = Math.abs(grade);
  const row = table.reduce((best, r) =>
    Math.abs(r.grade - steepness) < Math.abs(best.grade - steepness) ? r : best,
  );
  return Math.sign(grade) === Math.sign(dir) ? row.uphill : row.downhill;
}

/**
 * Joga o herói para cima com `speed` (pisão, bloco nota). Com o botão de pulo segurado vale
 * como um pulo (gravidade menor e corte ao soltar); sem ele, o quique não é cortado.
 */
export function bounceHero(motion: HeroMotion, speed: number, jumpHeld: boolean): HeroMotion {
  return {
    ...motion,
    vy: -speed,
    state: transition(HERO_TRANSITIONS, motion.state, 'jump'),
    canCoyote: false,
    bufferedJumpAge: null,
    jumpCut: !jumpHeld,
  };
}

/** Água em volta do herói neste passo (F4c); null fora d'água. */
export interface SwimContext {
  /** Cabeça fora d'água: o pulo daqui sai da água com o impulso normal. */
  readonly surface: boolean;
  /** Multiplica a velocidade de nado (o Surfista nada mais rápido). */
  readonly speed: number;
}

/**
 * Nadando: afunda devagar até `swimMaxFall`; cada aperto do pulo é uma braçada para cima,
 * ou um pulo para fora na superfície. Sem P-meter, coyote nem buffer.
 */
function stepSwim(
  prev: HeroMotion,
  input: HeroInput,
  contacts: HeroContacts,
  swim: SwimContext,
  dt: number,
  p: PhysicsConfig,
): HeroMotion {
  let vx = prev.vx;
  let vy = prev.vy;
  if (contacts.ground && vy > 0) vy = 0;
  if (contacts.ceiling && vy < 0) vy = 0;
  if ((contacts.wallLeft && vx < 0) || (contacts.wallRight && vx > 0)) vx = 0;

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  vx =
    dir === 0
      ? approach(vx, 0, p.swimDecel * dt)
      : approach(vx, dir * p.swimSpeed * swim.speed, p.swimAccel * dt);
  const stroke = input.jump && !prev.jumpHeld;
  if (stroke) vy = -(swim.surface ? p.jumpImpulse : p.swimStroke);
  else vy = Math.min(vy + p.swimGravity * dt, p.swimMaxFall);

  // Agachado não entra direto na água: passa um passo parado.
  const desired: HeroState = prev.state === 'crouch' ? 'idle' : 'swim';
  return {
    vx,
    vy,
    facing: dir > 0 ? 1 : dir < 0 ? -1 : prev.facing,
    state: transition(HERO_TRANSITIONS, prev.state, desired),
    airSteps: 0,
    canCoyote: false,
    bufferedJumpAge: null,
    pMeter: 0,
    jumpHeld: input.jump,
    jumpCut: true,
  };
}

/**
 * O pulo comum ainda vale neste passo: no chão, ou logo depois de sair da borda (coyote).
 * Mesma regra de stepHero; a montaria usa para saber quando o pulo é o extra, no ar (F4c).
 */
export function canGroundJump(
  prev: HeroMotion,
  contacts: HeroContacts,
  dt: number = FIXED_DT,
  p: PhysicsConfig = PHYSICS,
): boolean {
  if (contacts.ground) return true;
  return prev.canCoyote && prev.airSteps + 1 <= stepsFor(p.coyoteTime, dt);
}

/** Mata o herói: ele para onde está e não aceita mais comandos. */
export function killHero(motion: HeroMotion): HeroMotion {
  return { ...motion, vx: 0, vy: 0, state: transition(HERO_TRANSITIONS, motion.state, 'dead') };
}

/**
 * Avança o herói um passo fixo. Recebe os contatos do passo anterior e devolve
 * a velocidade que o corpo deve usar no próximo. Na água (`swim`), nada (F4c).
 */
export function stepHero(
  prev: HeroMotion,
  input: HeroInput,
  contacts: HeroContacts,
  dt: number = FIXED_DT,
  p: PhysicsConfig = PHYSICS,
  slopes: SlopeSpeedTable = SLOPE_SPEED,
  swim: SwimContext | null = null,
): HeroMotion {
  if (prev.state === 'dead') return prev;
  if (swim) return stepSwim(prev, input, contacts, swim, dt, p);
  const ground = contacts.ground;
  let vx = prev.vx;
  let vy = prev.vy;

  // O cenário bloqueou o movimento no último passo.
  if (ground && vy > 0) vy = 0;
  if (contacts.ceiling && vy < 0) vy = 0;
  if ((contacts.wallLeft && vx < 0) || (contacts.wallRight && vx > 0)) vx = 0;

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const crouching = ground && input.down;
  const reversing = dir !== 0 && vx !== 0 && Math.sign(vx) !== dir;
  const speedBefore = Math.abs(vx);
  const pFull = isPMeterFull(prev, dt, p);
  // Na ladeira a velocidade máxima cai na subida e sobe na descida.
  const slope = ground ? slopeSpeedFactor(contacts.groundSlope, dir, slopes) : 1;

  // Horizontal. No ar, aceleração e desaceleração valem uma fração das do chão.
  const control = ground ? 1 : p.airControl;
  if (crouching || dir === 0) {
    vx = approach(vx, 0, p.groundDecel * control * dt);
  } else if (reversing) {
    vx = approach(vx, 0, p.skidDecel * control * dt);
  } else {
    const max = (!input.run ? p.walkSpeed : pFull ? p.pMeterSpeed : p.runSpeed) * slope;
    if (Math.abs(vx) <= max) {
      vx = approach(vx, dir * max, p.groundAccel * control * dt);
    } else if (ground) {
      vx = approach(vx, dir * max, p.groundDecel * dt);
    }
    // No ar, acima do máximo, o embalo é mantido.
  }

  // P-meter: enche correndo no chão na velocidade máxima, esvazia no chão, congela no ar.
  let pMeter = prev.pMeter;
  if (ground) {
    const atRunSpeed = input.run && Math.sign(vx) === dir && Math.abs(vx) >= p.runSpeed * slope;
    pMeter = atRunSpeed
      ? Math.min(pMeter + 1, stepsFor(p.pMeterChargeTime, dt))
      : Math.max(pMeter - 1, 0);
  }

  // Pulo: buffer (apertado antes de pousar) e coyote time (logo depois de sair da borda).
  const jumpPressed = input.jump && !prev.jumpHeld;
  let bufferedJumpAge = jumpPressed
    ? 0
    : prev.bufferedJumpAge === null
      ? null
      : prev.bufferedJumpAge + 1;
  if (bufferedJumpAge !== null && bufferedJumpAge > stepsFor(p.jumpBufferTime, dt)) {
    bufferedJumpAge = null;
  }

  const airSteps = ground ? 0 : prev.airSteps + 1;
  let canCoyote = ground || prev.canCoyote;
  const canJump = ground || (canCoyote && airSteps <= stepsFor(p.coyoteTime, dt));

  let jumpCut = prev.jumpCut;
  let jumped = false;
  if (bufferedJumpAge !== null && canJump) {
    vy = -(pFull ? p.pMeterJumpImpulse : p.jumpImpulse);
    bufferedJumpAge = null;
    canCoyote = false;
    jumpCut = false;
    jumped = true;
  } else {
    // Pulo variável: soltar o botão subindo corta a velocidade uma vez.
    if (vy < 0 && !input.jump && !jumpCut) {
      vy *= p.jumpCutFactor;
      jumpCut = true;
    }
    const gravity = vy < 0 && input.jump ? p.gravityUp : p.gravityDown;
    vy = Math.min(vy + gravity * dt, p.maxFallSpeed);
  }

  let desired: HeroState;
  if (jumped) desired = 'jump';
  else if (!ground) desired = vy < 0 ? 'jump' : 'fall';
  else if (crouching) desired = 'crouch';
  else if (reversing && vx !== 0 && (speedBefore >= p.skidMinSpeed || prev.state === 'skid'))
    desired = 'skid';
  else if (Math.abs(vx) > p.walkSpeed * slope) desired = 'run';
  else if (vx !== 0 || dir !== 0) desired = 'walk';
  else desired = 'idle';

  return {
    vx,
    vy,
    facing: dir > 0 ? 1 : dir < 0 ? -1 : prev.facing,
    state: transition(HERO_TRANSITIONS, prev.state, desired),
    airSteps,
    canCoyote,
    bufferedJumpAge,
    pMeter,
    jumpHeld: input.jump,
    jumpCut,
  };
}
