import {
  CROPS,
  FILM_COUNT,
  POSTER_HEIGHT,
  POSTER_WIDTH,
  SHEETS,
  TOTAL_TAPES,
  type CropKey,
  type DecadeId,
  type FilmId,
} from './data';

export interface BoxDimensions {
  H: number;
  ws: number;
  d: number;
  gap: number;
}

export interface TapePose {
  o: number;
  x: number;
  y: number;
  z: number;
  rotY: number;
  rotX: number;
  rotZ: number;
  zIndex: number;
  spineShade: number;
  coverShade: number;
  transform: string;
}

export interface CropCssStyle {
  url: string;
  backgroundSize: string;
  backgroundPosition: string;
}

export interface PosterSvgImageGeometry {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function smoothstep(x: number): number {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Smooth step B(r) for horizontal tape spacing:
 * For |r| < 1: (r + sin(pi * r) / pi) / 2, otherwise sign(r) * 0.5.
 */
export function bumpStep(r: number): number {
  if (Math.abs(r) < 1) {
    return (r + Math.sin(Math.PI * r) / Math.PI) / 2;
  }
  return r > 0 ? 0.5 : -0.5;
}

export function computeBoxDimensions(H: number): BoxDimensions {
  return {
    H,
    ws: (H * 142) / 840,
    d: (H * 474) / 900,
    gap: H * 0.03,
  };
}

/**
 * Horizontal centre of a tape at relative index r:
 * F(r) = r * (ws + gap) + (d - ws + 1.6 * gap) * B(r)
 */
export function computeShelfX(r: number, dims: BoxDimensions): number {
  return r * (dims.ws + dims.gap) + (dims.d - dims.ws + 1.6 * dims.gap) * bumpStep(r);
}

/**
 * Wraps (v - s) modulo total (36) into the range (-total/2, +total/2] (-18 .. +18).
 */
export function wrapRelativeIndex(v: number, s: number, total: number = TOTAL_TAPES): number {
  const half = total / 2;
  let r = (((v - s) % total) + total) % total;
  if (r > half) {
    r -= total;
  }
  return r;
}

/**
 * Normalizes s and T by full virtual cycles (36 tapes = 3 loops of 12) when s drifts
 * beyond ±4 full film loops (±48), preserving both film index (mod 12) and virtual tape
 * identity (mod 36) with zero visual jump.
 */
export function normalizeScroll(
  s: number,
  T: number,
  filmCount: number = FILM_COUNT,
  totalTapes: number = TOTAL_TAPES
): { s: number; T: number } {
  const limit = filmCount * 4;
  if (Math.abs(s) <= limit) {
    return { s, T };
  }
  const shift = Math.trunc(s / totalTapes) * totalTapes;
  if (shift === 0) {
    return { s, T };
  }
  return {
    s: s - shift,
    T: T - shift,
  };
}

export function filmIndexFromScroll(s: number, filmCount: number = FILM_COUNT): number {
  return ((Math.round(s) % filmCount) + filmCount) % filmCount;
}

/**
 * Computes the new integer scroll target T to reach desiredFilmIndex via the shortest
 * path around the 12-film loop.
 */
export function shortestLoopTarget(
  currentTarget: number,
  desiredFilmIndex: number,
  filmCount: number = FILM_COUNT
): number {
  const base = Math.round(currentTarget);
  const currentIdx = ((base % filmCount) + filmCount) % filmCount;
  let delta = (((desiredFilmIndex - currentIdx) % filmCount) + filmCount) % filmCount;
  if (delta > filmCount / 2) {
    delta -= filmCount;
  }
  return base + delta;
}

export function decadeForYear(year: number): Exclude<DecadeId, 'all'> {
  const dec = Math.floor(year / 10) * 10;
  if (dec <= 1950) return '1950s';
  if (dec === 1960) return '1960s';
  if (dec === 1970) return '1970s';
  return '1980s';
}

export function computeTapePose(
  r: number,
  lift: number,
  tiltX: number,
  tiltY: number,
  dims: BoxDimensions
): TapePose {
  const absR = Math.abs(r);
  const o = smoothstep(Math.max(0, 1 - absR));
  const x = computeShelfX(r, dims);
  const y = -o * 0.025 * dims.H - lift * 0.045 * dims.H;
  const z = o * 0.2 * dims.H;
  const rotY = o === 0 ? 0 : -90 * o + tiltY * o;
  const rotX = o === 0 ? 0 : tiltX * o;
  const rotZ = o === 0 ? 0 : -4.5 * o;
  const zIndex = Math.round(100 - absR * 4);
  const spineShade = o * 0.55;
  const coverShade = (1 - o) * 0.5;
  const transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateZ(${rotZ.toFixed(3)}deg) rotateX(${rotX.toFixed(3)}deg) rotateY(${rotY.toFixed(3)}deg)`;

  return {
    o,
    x,
    y,
    z,
    rotY,
    rotX,
    rotZ,
    zIndex,
    spineShade,
    coverShade,
    transform,
  };
}

export function computeCropCss(cropKey: CropKey): CropCssStyle {
  const [sheetId, x, y, w, h] = CROPS[cropKey];
  const [url, W, H] = SHEETS[sheetId];
  const sizeX = (W / w) * 100;
  const sizeY = (H / h) * 100;
  const posX = (x / (W - w)) * 100;
  const posY = (y / (H - h)) * 100;

  return {
    url,
    backgroundSize: `${sizeX.toFixed(4)}% ${sizeY.toFixed(4)}%`,
    backgroundPosition: `${posX.toFixed(4)}% ${posY.toFixed(4)}%`,
  };
}

export function computePosterSvgImage(filmId: FilmId): PosterSvgImageGeometry {
  const [sheetId, x, y, w, h] = CROPS[`cover-${filmId}`];
  const [url, W, H] = SHEETS[sheetId];

  return {
    url,
    x: (-x * POSTER_WIDTH) / w,
    y: (-y * POSTER_HEIGHT) / h,
    width: (W * POSTER_WIDTH) / w,
    height: (H * POSTER_HEIGHT) / h,
  };
}

export function computeInkBlobRadius(
  elapsedMs: number,
  delayMs: number,
  durationMs: number = 1250,
  maxRadius: number = 720
): number {
  const p = clamp((elapsedMs - delayMs) / durationMs, 0, 1);
  const eased = 1 - Math.pow(1 - p, 3);
  return maxRadius * eased;
}

export function computePlayRingScale(T: number, s: number, isOpen: boolean): number {
  if (isOpen) return 0;
  return smoothstep(Math.max(0, 1 - Math.abs(T - s) * 3));
}
