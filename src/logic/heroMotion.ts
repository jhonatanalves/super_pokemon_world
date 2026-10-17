import { FIXED_DT, PHYSICS, type PhysicsConfig } from '../config/physics';
import { transition } from '../systems/StateMachine';
import { HERO_TRANSITIONS, type HeroState } from './heroStates';

/** Botões lidos no passo. `jump` e `run` são "segurado", não "apertado agora". */
export interface HeroInput {
  readonly left: boolean;
  readonly right: boolean;
  readonly down: boolean;
  readonly jump: boolean;
  readonly run: boolean;
}

/** Lados em que o cenário bloqueou o corpo no último passo da física. */
export interface HeroContacts {
  readonly ground: boolean;
  readonly ceiling: boolean;
  readonly wallLeft: boolean;
  readonly wallRight: boolean;
}

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
};

export const NO_CONTACTS: HeroContacts = {
  ground: false,
  ceiling: false,
  wallLeft: false,
  wallRight: false,
};

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

/** Leva `value` em direção a `target`, andando no máximo `delta`. */
function approach(value: number, target: number, delta: number): number {
  return value < target ? Math.min(value + delta, target) : Math.max(value - delta, target);
}

/**
 * Avança o herói um passo fixo. Recebe os contatos do passo anterior e devolve
 * a velocidade que o corpo deve usar no próximo.
 */
export function stepHero(
  prev: HeroMotion,
  input: HeroInput,
  contacts: HeroContacts,
  dt: number = FIXED_DT,
  p: PhysicsConfig = PHYSICS,
): HeroMotion {
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

  // Horizontal. No ar, aceleração e desaceleração valem uma fração das do chão.
  const control = ground ? 1 : p.airControl;
  if (crouching || dir === 0) {
    vx = approach(vx, 0, p.groundDecel * control * dt);
  } else if (reversing) {
    vx = approach(vx, 0, p.skidDecel * control * dt);
  } else {
    const max = !input.run ? p.walkSpeed : pFull ? p.pMeterSpeed : p.runSpeed;
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
    const atRunSpeed = input.run && Math.sign(vx) === dir && Math.abs(vx) >= p.runSpeed;
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
  else if (Math.abs(vx) > p.walkSpeed) desired = 'run';
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
