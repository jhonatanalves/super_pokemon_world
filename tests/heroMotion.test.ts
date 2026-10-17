import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/game';
import { FIXED_DT, PHYSICS } from '../src/config/physics';
import {
  createHeroMotion,
  isPMeterFull,
  NO_INPUT,
  stepHero,
  stepsFor,
  type HeroInput,
  type HeroMotion,
} from '../src/logic/heroMotion';
import { AIR, FlatFloor, GROUND, standing } from './helpers/flatFloor';

const TILE = GAME_CONFIG.tileSize;
const RIGHT: HeroInput = { ...NO_INPUT, right: true };
const LEFT: HeroInput = { ...NO_INPUT, left: true };
const RUN_RIGHT: HeroInput = { ...RIGHT, run: true };
const RUN_LEFT: HeroInput = { ...LEFT, run: true };
const JUMP: HeroInput = { ...NO_INPUT, jump: true };
const DOWN: HeroInput = { ...NO_INPUT, down: true };

/** Limite de passos das simulações, para um teste com bug não rodar para sempre. */
const MAX_STEPS = stepsFor(10);

/** Pula do chão e devolve a altura máxima dos pés, em px. */
function jumpHeight(floor: FlatFloor, input: (motion: HeroMotion) => HeroInput): number {
  let top = 0;
  for (let i = 0; i < MAX_STEPS; i++) {
    floor.step(input(floor.motion));
    top = Math.min(top, floor.y);
    if (top < 0 && floor.y === 0) return -top;
  }
  throw new Error('O herói não voltou ao chão');
}

/** Corre para a direita até o P-meter encher. */
function withFullPMeter(): FlatFloor {
  const floor = standing();
  for (let i = 0; i < MAX_STEPS && !isPMeterFull(floor.motion); i++) floor.step(RUN_RIGHT);
  expect(isPMeterFull(floor.motion)).toBe(true);
  return floor;
}

describe('pulo', () => {
  it('F1-A1: segurando o botão, sobe entre 3,5 e 4 tiles, perto de impulso² / (2 × gravidade)', () => {
    const height = jumpHeight(standing(), () => JUMP);
    expect(height).toBeGreaterThanOrEqual(3.5 * TILE);
    expect(height).toBeLessThanOrEqual(4 * TILE);
    const reference = PHYSICS.jumpImpulse ** 2 / (2 * PHYSICS.gravityUp);
    // A integração em passos fixos erra no máximo um passo de deslocamento.
    expect(Math.abs(height - reference)).toBeLessThanOrEqual(PHYSICS.jumpImpulse * FIXED_DT);
  });

  it('F1-A2: soltar no meio da subida corta a velocidade para 45%', () => {
    const floor = standing();
    floor.step(JUMP);
    while (floor.motion.vy < -PHYSICS.jumpImpulse / 2) floor.step(JUMP);
    const before = floor.motion.vy;
    const after = floor.step(NO_INPUT).vy;
    expect(after).toBeCloseTo(before * PHYSICS.jumpCutFactor + PHYSICS.gravityDown * FIXED_DT);
  });

  it('F1-A2: o pulo curto é mais baixo que o longo', () => {
    const long = jumpHeight(standing(), () => JUMP);
    let released = false;
    const short = jumpHeight(standing(), (m) => {
      if (m.state === 'jump' && m.vy >= -PHYSICS.jumpImpulse / 2) released = true;
      return released ? NO_INPUT : JUMP;
    });
    expect(short).toBeLessThan(long);
  });

  it('um toque gera exatamente um pulo, mesmo segurando o botão depois de pousar', () => {
    const history = standing().hold(JUMP, stepsFor(3));
    const jumps = history.filter((m, i) => m.state === 'jump' && history[i - 1]?.state !== 'jump');
    expect(jumps).toHaveLength(1);
  });

  it('com o P-meter cheio, o pulo usa o impulso maior e passa de 4 tiles', () => {
    const floor = withFullPMeter();
    expect(floor.step({ ...RUN_RIGHT, jump: true }).vy).toBe(-PHYSICS.pMeterJumpImpulse);
    const height = jumpHeight(withFullPMeter(), () => ({ ...RUN_RIGHT, jump: true }));
    expect(height).toBeGreaterThan(4 * TILE);
  });

  it('bater no teto zera a subida e começa a queda', () => {
    const floor = standing();
    const rising = floor.step(JUMP);
    const after = stepHero(rising, JUMP, { ...AIR, ceiling: true });
    expect(after.vy).toBeGreaterThanOrEqual(0);
    expect(after.state).toBe('fall');
  });
});

describe('movimento horizontal', () => {
  it('F1-A3: após 0,5 s segurando direita, a velocidade fica entre andar e correr', () => {
    const vx = standing().hold(RIGHT, stepsFor(0.5)).at(-1)?.vx;
    expect(vx).toBeGreaterThanOrEqual(PHYSICS.walkSpeed);
    expect(vx).toBeLessThanOrEqual(PHYSICS.runSpeed);
  });

  it('F1-A4: andando, nunca passa da velocidade de andar', () => {
    const speeds = standing()
      .hold(RIGHT, stepsFor(3))
      .map((m) => m.vx);
    expect(Math.max(...speeds)).toBe(PHYSICS.walkSpeed);
  });

  it('F1-A5: correndo sem P-meter não passa de 150; com P-meter chega a 180 e não passa', () => {
    const history = standing().hold(RUN_RIGHT, stepsFor(3));
    const firstFull = history.findIndex((m) => isPMeterFull(m));
    expect(firstFull).toBeGreaterThan(0);

    const beforeP = history.slice(0, firstFull + 1).map((m) => m.vx);
    expect(Math.max(...beforeP)).toBe(PHYSICS.runSpeed);

    const afterP = history.slice(firstFull + 1).map((m) => m.vx);
    expect(Math.max(...afterP)).toBe(PHYSICS.pMeterSpeed);
  });

  it('o P-meter enche depois de pMeterChargeTime correndo na velocidade máxima', () => {
    const history = standing().hold(RUN_RIGHT, stepsFor(3));
    const firstAtRunSpeed = history.findIndex((m) => m.vx >= PHYSICS.runSpeed);
    const firstFull = history.findIndex((m) => isPMeterFull(m));
    expect((firstFull - firstAtRunSpeed + 1) * FIXED_DT).toBeCloseTo(PHYSICS.pMeterChargeTime);
  });

  it('o P-meter esvazia no chão ao parar de correr', () => {
    const floor = withFullPMeter();
    const full = floor.motion.pMeter;
    expect(floor.step(RIGHT).pMeter).toBeLessThan(full);
  });

  it('soltar a direção desacelera até parar', () => {
    const floor = standing();
    floor.hold(RIGHT, stepsFor(1));
    const next = floor.step(NO_INPUT);
    expect(next.vx).toBeCloseTo(PHYSICS.walkSpeed - PHYSICS.groundDecel * FIXED_DT);
    expect(floor.hold(NO_INPUT, stepsFor(1)).at(-1)?.state).toBe('idle');
  });

  it('no ar, a aceleração é 70% da do chão', () => {
    const inAir = stepHero(createHeroMotion(), RIGHT, AIR);
    expect(inAir.vx).toBeCloseTo(PHYSICS.groundAccel * PHYSICS.airControl * FIXED_DT);
  });

  it('encostar na parede zera a velocidade na direção dela', () => {
    const floor = standing();
    const running = floor.hold(RUN_RIGHT, stepsFor(1)).at(-1);
    if (!running) throw new Error('sem histórico');
    const blocked = stepHero(running, RUN_RIGHT, { ...GROUND, wallRight: true });
    expect(blocked.vx).toBeLessThanOrEqual(PHYSICS.groundAccel * FIXED_DT);
  });
});

describe('derrapagem', () => {
  it('F1-A8: virar correndo gera o estado "derrapando"', () => {
    const floor = standing();
    floor.hold(RUN_RIGHT, stepsFor(1));
    expect(floor.step(RUN_LEFT).state).toBe('skid');
  });

  it('a derrapagem freia com skidDecel e acaba quando a velocidade zera', () => {
    const floor = standing();
    const before = floor.hold(RUN_RIGHT, stepsFor(1)).at(-1)?.vx ?? 0;
    const skids = floor.hold(LEFT, stepsFor(1));
    expect(skids[0].vx).toBeCloseTo(before - PHYSICS.skidDecel * FIXED_DT);
    const stopped = skids.findIndex((m) => m.vx <= 0);
    expect(skids.slice(0, stopped).every((m) => m.state === 'skid')).toBe(true);
    expect(skids[stopped].state).not.toBe('skid');
  });

  it('virar abaixo da velocidade mínima não derrapa', () => {
    const floor = standing();
    floor.step(RIGHT);
    expect(floor.motion.vx).toBeLessThan(PHYSICS.skidMinSpeed);
    expect(floor.step(LEFT).state).toBe('walk');
  });

  it('não derrapa no ar', () => {
    const floor = standing();
    floor.hold(RUN_RIGHT, stepsFor(1));
    floor.step({ ...RUN_RIGHT, jump: true });
    expect(floor.step({ ...RUN_LEFT, jump: true }).state).toBe('jump');
  });
});

describe('agachar', () => {
  it('agachado desliza até parar e não acelera', () => {
    const floor = standing();
    floor.hold(RIGHT, stepsFor(1));
    const crouched = floor.step({ ...DOWN, right: true });
    expect(crouched.state).toBe('crouch');
    expect(crouched.vx).toBeCloseTo(PHYSICS.walkSpeed - PHYSICS.groundDecel * FIXED_DT);
    expect(floor.hold({ ...DOWN, right: true }, stepsFor(1)).at(-1)?.vx).toBe(0);
  });

  it('dá para pular agachado', () => {
    const floor = standing();
    floor.step(DOWN);
    expect(floor.step({ ...DOWN, jump: true }).state).toBe('jump');
  });
});

describe('janelas de tempo', () => {
  /** Anda para a direita, sai da borda e aperta pulo no passo `airStep` no ar (1 = primeiro). */
  function jumpsAfterLeavingEdge(airStep: number): boolean {
    let m = standing().hold(RIGHT, stepsFor(1)).at(-1) ?? createHeroMotion();
    for (let i = 1; i < airStep; i++) m = stepHero(m, RIGHT, AIR);
    m = stepHero(m, { ...RIGHT, jump: true }, AIR);
    return m.vy === -PHYSICS.jumpImpulse;
  }

  it('F1-A6: pulo é aceito até 100 ms depois de sair da borda; depois não', () => {
    const coyote = stepsFor(PHYSICS.coyoteTime);
    expect(coyote * FIXED_DT).toBeCloseTo(PHYSICS.coyoteTime);
    expect(jumpsAfterLeavingEdge(1)).toBe(true);
    expect(jumpsAfterLeavingEdge(coyote)).toBe(true);
    expect(jumpsAfterLeavingEdge(coyote + 1)).toBe(false);
  });

  it('coyote time não vale depois de um pulo (sem pulo duplo)', () => {
    const floor = standing();
    const jumped = floor.step(JUMP);
    const released = stepHero(jumped, NO_INPUT, AIR);
    const again = stepHero(released, JUMP, AIR);
    expect(again.vy).toBeGreaterThan(released.vy);
  });

  /** Aperta pulo no ar e pousa `lead` passos depois. */
  function landAfterPressing(lead: number): HeroMotion {
    let m = stepHero(createHeroMotion(), NO_INPUT, AIR);
    m = stepHero(m, JUMP, AIR);
    for (let i = 1; i < lead; i++) m = stepHero(m, JUMP, AIR);
    return stepHero(m, JUMP, GROUND);
  }

  it('F1-A7: pulo apertado 100 ms antes de tocar o chão é executado ao pousar', () => {
    const landed = landAfterPressing(stepsFor(0.1));
    expect(landed.state).toBe('jump');
    expect(landed.vy).toBe(-PHYSICS.jumpImpulse);
  });

  it('F1-A7: o buffer vale até jumpBufferTime e expira depois', () => {
    const buffer = stepsFor(PHYSICS.jumpBufferTime);
    expect(landAfterPressing(buffer).state).toBe('jump');
    expect(landAfterPressing(buffer + 1).state).not.toBe('jump');
  });
});

describe('queda', () => {
  it('F1-A9: a velocidade de queda nunca passa de 300 px/s', () => {
    let m = createHeroMotion();
    const speeds: number[] = [];
    for (let i = 0; i < stepsFor(3); i++) {
      m = stepHero(m, NO_INPUT, AIR);
      speeds.push(m.vy);
    }
    expect(Math.max(...speeds)).toBe(PHYSICS.maxFallSpeed);
  });

  it('cai com gravityDown e fica no estado "caindo"', () => {
    const m = stepHero(createHeroMotion(), NO_INPUT, AIR);
    expect(m.vy).toBeCloseTo(PHYSICS.gravityDown * FIXED_DT);
    expect(m.state).toBe('fall');
  });
});
