/** Maior zoom inteiro que cabe na janela, nunca menor que minZoom. */
export function integerZoom(
  windowWidth: number,
  windowHeight: number,
  baseWidth: number,
  baseHeight: number,
  minZoom: number,
): number {
  const fit = Math.floor(Math.min(windowWidth / baseWidth, windowHeight / baseHeight));
  return Math.max(minZoom, fit);
}
