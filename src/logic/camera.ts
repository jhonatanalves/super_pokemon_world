import { CAMERA, type CameraConfig } from '../config/camera';
import { FIXED_DT } from '../config/physics';
import type { Point } from './level';
import { approach, clamp } from './math';

export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * Câmera da fase. Na horizontal: o herói anda livre dentro de uma zona morta; quando
 * empurra a borda dela, a zona vai junto e a câmera se adianta na direção do movimento.
 */
export interface CameraState {
  /** Centro da zona morta (x do herói, em px, quando ele está no meio dela). */
  readonly anchor: number;
  /** Antecipação atual: deslocamento do centro da câmera em relação à zona morta. */
  readonly offset: number;
  /** Canto superior esquerdo da área visível, em px inteiros e dentro da fase. */
  readonly scrollX: number;
  readonly scrollY: number;
}

function place(
  anchor: number,
  offset: number,
  target: Point,
  view: Size,
  world: Size,
): CameraState {
  // Arredondar aqui (e não no desenho) faz câmera e herói andarem juntos, sem tremor de 1 px.
  const maxX = Math.max(world.width - view.width, 0);
  const maxY = Math.max(world.height - view.height, 0);
  return {
    anchor,
    offset,
    scrollX: clamp(Math.round(anchor + offset - view.width / 2), 0, maxX),
    // Na vertical só centraliza e respeita os limites; a fase de teste tem 1 tela de altura.
    scrollY: clamp(Math.round(target.y - view.height / 2), 0, maxY),
  };
}

/** Câmera centrada em `target` (o centro do herói), sem antecipação. */
export function createCamera(target: Point, view: Size, world: Size): CameraState {
  return place(target.x, 0, target, view, world);
}

/** Um passo fixo da câmera seguindo `target`. */
export function stepCamera(
  prev: CameraState,
  target: Point,
  view: Size,
  world: Size,
  dt: number = FIXED_DT,
  cfg: CameraConfig = CAMERA,
): CameraState {
  const half = cfg.deadZoneWidth / 2;
  const step = cfg.lookaheadSpeed * dt;
  let { anchor, offset } = prev;
  if (target.x > anchor + half) {
    anchor = target.x - half;
    offset = approach(offset, cfg.lookahead, step);
  } else if (target.x < anchor - half) {
    anchor = target.x + half;
    offset = approach(offset, -cfg.lookahead, step);
  }
  return place(anchor, offset, target, view, world);
}
