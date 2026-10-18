import { FIXED_DT, PHYSICS } from '../config/physics';

/** Tolerância de ponto flutuante, em frações de passo. Não é ajuste de jogo. */
const EPSILON = 1e-6;

/**
 * Relógio de passo fixo: soma o tempo do quadro ao que sobrou e diz quantos passos rodar.
 * Acima de `maxSteps` (aba em segundo plano, travada), roda o máximo e descarta o resto.
 */
export function advanceClock(
  pending: number,
  delta: number,
  dt: number = FIXED_DT,
  maxSteps: number = PHYSICS.maxStepsPerFrame,
): { steps: number; pending: number } {
  const total = pending + Math.max(delta, 0);
  const steps = Math.floor(total / dt + EPSILON);
  if (steps > maxSteps) return { steps: maxSteps, pending: 0 };
  return { steps, pending: Math.max(total - steps * dt, 0) };
}
