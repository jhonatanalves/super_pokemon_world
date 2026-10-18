import { describe, expect, it } from 'vitest';
import { FIXED_DT, PHYSICS } from '../src/config/physics';
import { advanceClock } from '../src/logic/fixedStep';

/** Roda `frames` quadros de `delta` segundos e devolve os passos de cada um. */
function frames(delta: number, count: number): number[] {
  let pending = 0;
  return Array.from({ length: count }, () => {
    const clock = advanceClock(pending, delta);
    pending = clock.pending;
    return clock.steps;
  });
}

describe('relógio de passo fixo', () => {
  it('a 60 Hz roda exatamente 1 passo por quadro', () => {
    expect(frames(FIXED_DT, 600).every((s) => s === 1)).toBe(true);
  });

  it('a 120 Hz alterna 0 e 1 passo; a 30 Hz roda 2', () => {
    expect(frames(FIXED_DT / 2, 8)).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
    expect(frames(FIXED_DT * 2, 4)).toEqual([2, 2, 2, 2]);
  });

  it('com quadros irregulares, o total de passos acompanha o tempo', () => {
    const deltas = [0.015, 0.018, 0.016, 0.02, 0.013, 0.017];
    let pending = 0;
    let steps = 0;
    let time = 0;
    for (let i = 0; i < 100; i++) {
      const d = deltas[i % deltas.length];
      const clock = advanceClock(pending, d);
      pending = clock.pending;
      steps += clock.steps;
      time += d;
    }
    expect(Math.abs(steps - time / FIXED_DT)).toBeLessThan(1);
  });

  it('um quadro muito longo roda no máximo maxStepsPerFrame e descarta o resto', () => {
    expect(advanceClock(0, 5)).toEqual({ steps: PHYSICS.maxStepsPerFrame, pending: 0 });
  });
});
