import { describe, expect, it } from 'vitest';
import { CAMERA } from '../src/config/camera';
import { GAME_CONFIG } from '../src/config/game';
import { FIXED_DT, PHYSICS } from '../src/config/physics';
import { createCamera, stepCamera, type CameraState } from '../src/logic/camera';
import { stepsFor } from '../src/logic/heroMotion';

const VIEW = { width: GAME_CONFIG.width, height: GAME_CONFIG.height };
/** Fase de 3 telas de largura e 1 de altura, como a de teste. */
const WORLD = { width: 3 * GAME_CONFIG.width, height: GAME_CONFIG.height };
const MAX_X = WORLD.width - VIEW.width;
const Y = WORLD.height / 2;
const HALF_HERO = GAME_CONFIG.heroWidth / 2;

/** Leva o herói de `from` até `to` a `speed` px/s, um passo fixo por vez. */
function run(
  start: CameraState,
  from: number,
  to: number,
  speed: number,
): { cam: CameraState; history: CameraState[] } {
  let cam = start;
  const history: CameraState[] = [];
  const dir = Math.sign(to - from);
  for (let x = from; dir > 0 ? x < to : x > to;) {
    x = dir > 0 ? Math.min(x + speed * FIXED_DT, to) : Math.max(x - speed * FIXED_DT, to);
    cam = stepCamera(cam, { x, y: Y }, VIEW, WORLD);
    history.push(cam);
  }
  return { cam, history };
}

describe('câmera', () => {
  it('F2-A5: nunca mostra fora da fase (x entre 0 e 512 para largura 768)', () => {
    expect(MAX_X).toBe(512);
    expect(createCamera({ x: 0, y: Y }, VIEW, WORLD).scrollX).toBe(0);
    expect(createCamera({ x: WORLD.width, y: Y }, VIEW, WORLD).scrollX).toBe(MAX_X);

    const there = run(
      createCamera({ x: 0, y: Y }, VIEW, WORLD),
      0,
      WORLD.width,
      PHYSICS.pMeterSpeed,
    );
    const back = run(there.cam, WORLD.width, 0, PHYSICS.pMeterSpeed);
    for (const cam of [...there.history, ...back.history]) {
      expect(cam.scrollX).toBeGreaterThanOrEqual(0);
      expect(cam.scrollX).toBeLessThanOrEqual(MAX_X);
      expect(cam.scrollY).toBe(0);
      expect(Number.isInteger(cam.scrollX)).toBe(true);
    }
    expect(there.cam.scrollX).toBe(MAX_X);
    expect(back.cam.scrollX).toBe(0);
  });

  it('não treme encostada nas bordas da fase (x = 0 e x = máximo)', () => {
    for (const x of [0, WORLD.width]) {
      let cam = createCamera({ x, y: Y }, VIEW, WORLD);
      const first = cam.scrollX;
      for (let i = 0; i < stepsFor(1); i++) {
        // Herói parado, mas com pequenas variações, como ao encostar na borda.
        cam = stepCamera(cam, { x: x + (i % 2 ? 0.5 : -0.5), y: Y }, VIEW, WORLD);
        expect(cam.scrollX).toBe(first);
      }
    }
  });

  it('F2-A6: movimento pequeno dentro da zona morta não move a câmera', () => {
    const start = createCamera({ x: WORLD.width / 2, y: Y }, VIEW, WORLD);
    const half = CAMERA.deadZoneWidth / 2;
    let cam = start;
    for (const dx of [1, half - 1, half, 0, -half + 1, -half, -2, 0]) {
      cam = stepCamera(cam, { x: WORLD.width / 2 + dx, y: Y }, VIEW, WORLD);
      expect(cam.scrollX).toBe(start.scrollX);
      expect(cam.offset).toBe(0);
    }
  });

  it('F2-A7: correndo para a direita, a câmera fica adiantada à direita do herói', () => {
    const start = createCamera({ x: 300, y: Y }, VIEW, WORLD);
    const { cam } = run(start, 300, 500, PHYSICS.runSpeed);
    const cameraCenter = cam.scrollX + VIEW.width / 2;
    expect(cam.offset).toBe(CAMERA.lookahead);
    expect(cameraCenter).toBeGreaterThan(500);
    expect(cameraCenter - 500).toBe(CAMERA.lookahead - CAMERA.deadZoneWidth / 2);

    // E para a esquerda, à esquerda.
    const left = run(cam, 500, 300, PHYSICS.runSpeed).cam;
    expect(left.offset).toBe(-CAMERA.lookahead);
    expect(left.scrollX + VIEW.width / 2).toBeLessThan(300);
  });

  it('não oscila ao parar: depois de parar, a câmera fica imóvel', () => {
    const { cam } = run(createCamera({ x: 300, y: Y }, VIEW, WORLD), 300, 420, PHYSICS.walkSpeed);
    let after = cam;
    for (let i = 0; i < stepsFor(2); i++) {
      after = stepCamera(after, { x: 420, y: Y }, VIEW, WORLD);
      expect(after.scrollX).toBe(cam.scrollX);
    }
  });

  it('com a antecipação completa, o herói fica no mesmo pixel da tela (sem tremor de 1 px)', () => {
    const { history } = run(
      createCamera({ x: 200, y: Y }, VIEW, WORLD),
      200,
      500,
      PHYSICS.runSpeed,
    );
    const screenX = new Set<number>();
    let x = 200;
    for (const cam of history) {
      x = Math.min(x + PHYSICS.runSpeed * FIXED_DT, 500);
      // O herói é desenhado no canto arredondado, como em Player.render.
      if (cam.offset === CAMERA.lookahead) screenX.add(Math.round(x - HALF_HERO) - cam.scrollX);
    }
    expect(screenX.size).toBe(1);
  });
});
