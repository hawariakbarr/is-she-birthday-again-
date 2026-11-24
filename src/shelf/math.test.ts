import test from 'node:test';
import assert from 'node:assert/strict';
import { CROPS, FILMS, FILM_COUNT, INITIAL_SCROLL, SHEETS, TOTAL_TAPES } from './data';
import {
  bumpStep,
  computeBoxDimensions,
  computeCropCss,
  computeInkBlobRadius,
  computePlayRingScale,
  computePosterSvgImage,
  computeShelfX,
  computeTapePose,
  decadeForYear,
  filmIndexFromScroll,
  normalizeScroll,
  shortestLoopTarget,
  smoothstep,
  wrapRelativeIndex,
} from './math';

test('dataset contains 12 films and all 24 spine/cover crops map to valid sheets', () => {
  assert.equal(FILMS.length, 12);
  assert.equal(FILMS[5].id, 'noon');
  assert.equal(FILMS[5].title, 'Noon in Ashes');
  assert.equal(INITIAL_SCROLL, 17);

  for (const film of FILMS) {
    const spineCrop = CROPS[`spine-${film.id}`];
    const coverCrop = CROPS[`cover-${film.id}`];
    assert.ok(spineCrop, `missing spine crop for ${film.id}`);
    assert.ok(coverCrop, `missing cover crop for ${film.id}`);
    assert.ok(SHEETS[spineCrop[0]], `invalid sheet for spine-${film.id}`);
    assert.ok(SHEETS[coverCrop[0]], `invalid sheet for cover-${film.id}`);
  }
});

test('smoothstep and bumpStep satisfy boundary and continuity invariants', () => {
  assert.equal(smoothstep(-1), 0);
  assert.equal(smoothstep(0), 0);
  assert.equal(smoothstep(0.5), 0.5);
  assert.equal(smoothstep(1), 1);
  assert.equal(smoothstep(2), 1);

  assert.equal(bumpStep(0), 0);
  assert.ok(Math.abs(bumpStep(1) - 0.5) < 1e-12);
  assert.ok(Math.abs(bumpStep(-1) + 0.5) < 1e-12);
  assert.equal(bumpStep(2), 0.5);
  assert.equal(bumpStep(-2), -0.5);
  // Smooth continuity near r = 1
  assert.ok(Math.abs(bumpStep(0.999) - 0.5) < 1e-4);
});

test('box dimensions and horizontal placement F(r) push neighbours apart by half extra width', () => {
  const dims = computeBoxDimensions(414);
  assert.ok(Math.abs(dims.ws - (414 * 142) / 840) < 1e-9);
  assert.ok(Math.abs(dims.d - (414 * 474) / 900) < 1e-9);
  assert.ok(Math.abs(dims.gap - 414 * 0.03) < 1e-9);

  assert.equal(computeShelfX(0, dims), 0);
  const x1 = computeShelfX(1, dims);
  const x2 = computeShelfX(2, dims);
  const stepOutside = x2 - x1;
  assert.ok(Math.abs(stepOutside - (dims.ws + dims.gap)) < 1e-9);
  assert.ok(Math.abs(x1 + computeShelfX(-1, dims)) < 1e-9);
});

test('relative index wrapping and scroll normalization preserve loop invariants', () => {
  assert.equal(wrapRelativeIndex(17, 17, TOTAL_TAPES), 0);
  assert.equal(wrapRelativeIndex(19, 17, TOTAL_TAPES), 2);
  assert.equal(wrapRelativeIndex(0, 35, TOTAL_TAPES), 1);
  assert.equal(wrapRelativeIndex(35, 0, TOTAL_TAPES), -1);

  // Normalization beyond ±4 loops preserves film index AND virtual relative index
  const sBefore = 65.4;
  const TBefore = 67;
  const norm = normalizeScroll(sBefore, TBefore, FILM_COUNT, TOTAL_TAPES);
  assert.ok(Math.abs(norm.s) <= 48);
  assert.equal(filmIndexFromScroll(norm.s), filmIndexFromScroll(sBefore));
  assert.ok(Math.abs((norm.T - norm.s) - (TBefore - sBefore)) < 1e-9);
  for (let v = 0; v < TOTAL_TAPES; v++) {
    assert.ok(
      Math.abs(wrapRelativeIndex(v, norm.s) - wrapRelativeIndex(v, sBefore)) < 1e-9
    );
  }
});

test('shortestLoopTarget picks the shortest direction around the 12-film loop', () => {
  // From Noon in Ashes (index 5, T = 17)
  assert.equal(shortestLoopTarget(17, 1), 13); // 1960s -> 4 left
  assert.equal(shortestLoopTarget(17, 9), 21); // 1980s -> 4 right
  assert.equal(shortestLoopTarget(17, 0), 12); // 1950s/ALL -> 5 left
  // From Red Door (index 11, T = 23) to The Silent Valley (index 0) -> 1 right
  assert.equal(shortestLoopTarget(23, 0), 24);
  // From The Silent Valley (index 0, T = 12) to Red Door (index 11) -> 1 left
  assert.equal(shortestLoopTarget(12, 11), 11);
});

test('decadeForYear maps all 12 films to expected decade tabs', () => {
  assert.equal(decadeForYear(1958), '1950s');
  assert.equal(decadeForYear(1962), '1960s');
  assert.equal(decadeForYear(1969), '1960s');
  assert.equal(decadeForYear(1971), '1970s');
  assert.equal(decadeForYear(1978), '1970s');
  assert.equal(decadeForYear(1981), '1980s');
  assert.equal(decadeForYear(1989), '1980s');
});

test('tape pose matches active open cover and closed spine specifications', () => {
  const dims = computeBoxDimensions(400);
  const openPose = computeTapePose(0, 0, 2, -3, dims);
  assert.equal(openPose.o, 1);
  assert.equal(openPose.rotZ, -4.5);
  assert.equal(openPose.rotY, -93);
  assert.equal(openPose.rotX, 2);
  assert.equal(openPose.z, 80);
  assert.equal(openPose.y, -10);
  assert.equal(openPose.spineShade, 0.55);
  assert.equal(openPose.coverShade, 0);
  assert.equal(openPose.zIndex, 100);

  const spinePose = computeTapePose(2, 1, 5, 5, dims);
  assert.equal(spinePose.o, 0);
  assert.equal(spinePose.rotY, 0);
  assert.equal(spinePose.rotX, 0);
  assert.equal(spinePose.rotZ, 0);
  assert.equal(spinePose.y, -0.045 * 400);
  assert.equal(spinePose.spineShade, 0);
  assert.equal(spinePose.coverShade, 0.5);
  assert.equal(spinePose.zIndex, 92);
});

test('crop CSS percentages and SVG poster image geometry align exactly to crop boxes', () => {
  const css = computeCropCss('cover-noon');
  assert.equal(css.url, SHEETS.covers[0]);
  // covers sheet is 1744 x 2336, cover-noon is 74, 72, 347, 659
  const [sizeX, sizeY] = css.backgroundSize.split(' ').map((v) => parseFloat(v));
  const [posX, posY] = css.backgroundPosition.split(' ').map((v) => parseFloat(v));
  assert.ok(Math.abs(sizeX - (1744 / 347) * 100) < 1e-3);
  assert.ok(Math.abs(sizeY - (2336 / 659) * 100) < 1e-3);
  assert.ok(Math.abs(posX - (74 / (1744 - 347)) * 100) < 1e-3);
  assert.ok(Math.abs(posY - (72 / (2336 - 659)) * 100) < 1e-3);

  const svg = computePosterSvgImage('noon');
  assert.equal(svg.url, SHEETS.covers[0]);
  // Verify pixel x=74 maps to SVG x=0 and pixel x=74+347 maps to SVG x=474
  const scaleX = svg.width / 1744;
  assert.ok(Math.abs(svg.x + 74 * scaleX) < 1e-9);
  assert.ok(Math.abs(svg.x + (74 + 347) * scaleX - 474) < 1e-9);
  const scaleY = svg.height / 2336;
  assert.ok(Math.abs(svg.y + 72 * scaleY) < 1e-9);
  assert.ok(Math.abs(svg.y + (72 + 659) * scaleY - 900) < 1e-9);
});

test('ink blob radius and play ring scale follow cubic ease-out and smoothstep settle', () => {
  assert.equal(computeInkBlobRadius(0, 120), 0);
  assert.equal(computeInkBlobRadius(120, 120), 0);
  assert.equal(computeInkBlobRadius(120 + 1250, 120), 720);
  const mid = computeInkBlobRadius(120 + 625, 120);
  assert.ok(Math.abs(mid - 720 * (1 - 0.125)) < 1e-9);

  assert.equal(computePlayRingScale(17, 17, false), 1);
  assert.equal(computePlayRingScale(17, 17, true), 0);
  assert.equal(computePlayRingScale(17, 16, false), 0);
});
