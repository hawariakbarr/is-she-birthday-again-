/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef } from 'react';
import {
  DECADES,
  FILMS,
  FILM_COUNT,
  INITIAL_FILM_INDEX,
  INK_BLOBS,
  TOTAL_TAPES,
  type DecadeId,
} from './shelf/data';
import { ShelfEngine } from './shelf/engine';
import { computeCropCss, computePosterSvgImage } from './shelf/math';

export default function App() {
  const probeRef = useRef<HTMLDivElement>(null);
  const shelfRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tapeRefs = useRef<Array<HTMLDivElement | null>>([]);
  const spineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const coverRefs = useRef<Array<HTMLDivElement | null>>([]);
  const playBtnRef = useRef<HTMLButtonElement>(null);
  const capTitleMaskRef = useRef<HTMLDivElement>(null);
  const capSubMaskRef = useRef<HTMLDivElement>(null);
  const capYearMaskRef = useRef<HTMLDivElement>(null);
  const tabIndRef = useRef<HTMLDivElement>(null);
  const tabBtnRefs = useRef<Map<DecadeId, HTMLButtonElement>>(new Map());
  const cursorRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const detailLineRefs = useRef<Array<HTMLElement | null>>([]);
  const detailSubRef = useRef<HTMLSpanElement>(null);
  const detailTitleRef = useRef<HTMLHeadingElement>(null);
  const detailMetaRef = useRef<HTMLSpanElement>(null);
  const detailSynRef = useRef<HTMLParagraphElement>(null);
  const detailWatchRef = useRef<HTMLButtonElement>(null);
  const posterImageRef = useRef<SVGImageElement>(null);
  const inkCircleRefs = useRef<Array<SVGCircleElement | null>>([]);
  const engineRef = useRef<ShelfEngine | null>(null);

  const initialFilm = FILMS[INITIAL_FILM_INDEX];
  const initialPoster = useMemo(() => computePosterSvgImage(initialFilm.id), [initialFilm.id]);

  // Precompute all 36 virtual tape crop styles once
  const virtualTapes = useMemo(() => {
    return Array.from({ length: TOTAL_TAPES }, (_, v) => {
      const filmIndex = v % FILM_COUNT;
      const film = FILMS[filmIndex];
      const spineCss = computeCropCss(`spine-${film.id}`);
      const coverCss = computeCropCss(`cover-${film.id}`);
      return {
        v,
        film,
        spineStyle: {
          backgroundImage: `url("${spineCss.url}")`,
          backgroundSize: spineCss.backgroundSize,
          backgroundPosition: spineCss.backgroundPosition,
        },
        coverStyle: {
          backgroundImage: `url("${coverCss.url}")`,
          backgroundSize: coverCss.backgroundSize,
          backgroundPosition: coverCss.backgroundPosition,
        },
      };
    });
  }, []);

  useEffect(() => {
    if (
      !probeRef.current ||
      !shelfRef.current ||
      !stageRef.current ||
      !playBtnRef.current ||
      !capTitleMaskRef.current ||
      !capSubMaskRef.current ||
      !capYearMaskRef.current ||
      !tabIndRef.current ||
      !cursorRef.current ||
      !detailRef.current ||
      !detailSubRef.current ||
      !detailTitleRef.current ||
      !detailMetaRef.current ||
      !detailSynRef.current ||
      !detailWatchRef.current ||
      !posterImageRef.current
    ) {
      return;
    }

    const tapes = tapeRefs.current.filter((el): el is HTMLDivElement => el !== null);
    const spines = spineRefs.current.filter((el): el is HTMLDivElement => el !== null);
    const covers = coverRefs.current.filter((el): el is HTMLDivElement => el !== null);
    const detailLines = detailLineRefs.current.filter((el): el is HTMLElement => el !== null);
    const inkCircles = inkCircleRefs.current.filter((el): el is SVGCircleElement => el !== null);

    const engine = new ShelfEngine({
      probe: probeRef.current,
      shelf: shelfRef.current,
      stage: stageRef.current,
      tapes,
      spines,
      covers,
      playBtn: playBtnRef.current,
      capTitleMask: capTitleMaskRef.current,
      capSubMask: capSubMaskRef.current,
      capYearMask: capYearMaskRef.current,
      tabIndicator: tabIndRef.current,
      tabButtons: tabBtnRefs.current,
      cursor: cursorRef.current,
      detail: detailRef.current,
      detailLines,
      detailSub: detailSubRef.current,
      detailTitle: detailTitleRef.current,
      detailMeta: detailMetaRef.current,
      detailSyn: detailSynRef.current,
      detailWatch: detailWatchRef.current,
      posterImage: posterImageRef.current,
      inkCircles,
    });

    engineRef.current = engine;
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  return (
    <>
      <div className="h-probe" ref={probeRef} aria-hidden="true" />

      {/* 1. Top bar */}
      <header className="topbar">
        <a
          href="#filmography"
          className="lbl box back-link"
          onClick={(e) => {
            e.preventDefault();
            engineRef.current?.jumpToFilmIndex(INITIAL_FILM_INDEX);
          }}
        >
          BACK / 戻る
        </a>

        <a
          href="#top"
          className="logo"
          aria-label="Leon Vasari"
          onClick={(e) => {
            e.preventDefault();
            engineRef.current?.jumpToFilmIndex(INITIAL_FILM_INDEX);
          }}
        >
          <span className="logo-zh">莱昂·瓦萨里</span>
          <span className="logo-en">LEON VASARI</span>
        </a>

        <span className="lbl career">CAREER 1958年〜1989年</span>
      </header>

      {/* 2. Decade tabs */}
      <nav className="tabs-nav" aria-label="Decades">
        <div className="tabs">
          <div className="tab-ind no-anim" ref={tabIndRef} aria-hidden="true" />
          {DECADES.map((dec) => (
            <button
              key={dec.id}
              type="button"
              className="lbl tab"
              data-decade={dec.id}
              ref={(el) => {
                if (el) {
                  tabBtnRefs.current.set(dec.id, el);
                } else {
                  tabBtnRefs.current.delete(dec.id);
                }
              }}
              onClick={() => engineRef.current?.jumpToFilmIndex(dec.targetIndex)}
            >
              {dec.label}
            </button>
          ))}
        </div>
      </nav>

      {/* 3. Endless 3D VHS shelf */}
      <main>
        <section
          className="shelf"
          ref={shelfRef}
          aria-label="Filmography shelf"
          data-testid="shelf"
        >
          <div className="stage" ref={stageRef}>
            {virtualTapes.map(({ v, film, spineStyle, coverStyle }) => (
              <div
                key={v}
                className="tape"
                data-v={v}
                data-film={film.id}
                ref={(el) => {
                  tapeRefs.current[v] = el;
                }}
              >
                <div
                  className="face sp"
                  style={spineStyle}
                  ref={(el) => {
                    spineRefs.current[v] = el;
                  }}
                />
                <div
                  className="face cv"
                  style={coverStyle}
                  ref={(el) => {
                    coverRefs.current[v] = el;
                  }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* 4. Play ring */}
        <button
          type="button"
          className="play-ring"
          ref={playBtnRef}
          aria-label="Open film"
          onClick={() => engineRef.current?.openDetail()}
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <polygon points="2,1 11,6 2,11" fill="currentColor" />
          </svg>
        </button>

        {/* 5. Masked caption */}
        <div className="caption" aria-live="polite" data-testid="caption">
          <div className="cap-mask cap-title" ref={capTitleMaskRef}>
            <span>{initialFilm.title}</span>
          </div>
          <div className="cap-mask lbl cap-sub" ref={capSubMaskRef}>
            <span>
              {initialFilm.romaji} / {initialFilm.kanji}
            </span>
          </div>
          <div className="cap-mask cap-year" ref={capYearMaskRef}>
            <span>{initialFilm.year}</span>
          </div>
        </div>

        {/* 6. Arrows */}
        <button
          type="button"
          className="arrow arrow-prev"
          aria-label="Previous film"
          onClick={() => engineRef.current?.step(-1)}
        >
          <svg width="18" height="10" viewBox="0 0 18 10" fill="none" aria-hidden="true">
            <path
              d="M5 1L1 5L5 9M1 5H17"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="square"
            />
          </svg>
        </button>

        <button
          type="button"
          className="arrow arrow-next"
          aria-label="Next film"
          onClick={() => engineRef.current?.step(1)}
        >
          <svg width="18" height="10" viewBox="0 0 18 10" fill="none" aria-hidden="true">
            <path
              d="M13 1L17 5L13 9M17 5H1"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="square"
            />
          </svg>
        </button>
      </main>

      {/* 7. Footer */}
      <footer className="footer">
        <span className="lbl footer-copy">© LEON VASARI. ALL RIGHTS RESERVED.</span>
        <div className="lbl footer-links">
          <a
            href="#fb"
            onClick={(e) => {
              e.preventDefault();
            }}
          >
            FB
          </a>
          <span aria-hidden="true">/</span>
          <a
            href="#tw"
            onClick={(e) => {
              e.preventDefault();
            }}
          >
            TW
          </a>
        </div>
      </footer>

      {/* Paper grain overlay */}
      <div className="grain" aria-hidden="true" />

      {/* Detail sheet dialog */}
      <div
        className="detail"
        ref={detailRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        aria-hidden="true"
        data-open="false"
        data-testid="detail-dialog"
      >
        <button
          type="button"
          className="lbl box detail-close"
          onClick={() => engineRef.current?.closeDetail()}
        >
          CLOSE / 閉じる
        </button>

        <div className="detail-top" aria-hidden="true">
          <div className="logo">
            <span className="logo-zh">莱昂·瓦萨里</span>
            <span className="logo-en">LEON VASARI</span>
          </div>
        </div>

        <div className="detail-grid">
          <div className="detail-left">
            <div className="d-line">
              <span
                className="lbl d-sub"
                ref={(el) => {
                  detailSubRef.current = el;
                  detailLineRefs.current[0] = el;
                }}
              >
                {initialFilm.romaji} / {initialFilm.kanji}
              </span>
            </div>

            <div className="d-line">
              <h1
                id="detail-title"
                className="d-title"
                ref={(el) => {
                  detailTitleRef.current = el;
                  detailLineRefs.current[1] = el;
                }}
              >
                {initialFilm.title}
              </h1>
            </div>

            <div className="d-line">
              <span
                className="lbl d-meta"
                ref={(el) => {
                  detailMetaRef.current = el;
                  detailLineRefs.current[2] = el;
                }}
              >
                {initialFilm.year} / {initialFilm.genre.toUpperCase()} / {initialFilm.minutes} MIN
              </span>
            </div>

            <div className="d-line">
              <p
                className="d-syn"
                ref={(el) => {
                  detailSynRef.current = el;
                  detailLineRefs.current[3] = el;
                }}
              >
                {initialFilm.synopsis}
              </p>
            </div>

            <div className="d-line">
              <p
                className="d-credit"
                ref={(el) => {
                  detailLineRefs.current[4] = el;
                }}
              >
                Written and directed by Leon Vasari. 監督作品
              </p>
            </div>

            <div className="d-line d-watch-wrap">
              <button
                type="button"
                className="lbl d-watch"
                ref={(el) => {
                  detailWatchRef.current = el;
                  detailLineRefs.current[5] = el;
                }}
                onClick={() => engineRef.current?.toggleWatchAction()}
              >
                WATCH THE FILM / 映画を見る
              </button>
            </div>
          </div>

          <div className="detail-right">
            <svg
              className="poster-svg"
              viewBox="0 0 474 900"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <clipPath id="poster-clip">
                  <rect x="0" y="0" width="474" height="900" rx="2" />
                </clipPath>
                <filter
                  id="ink-filter"
                  x="-200"
                  y="-200"
                  width="874"
                  height="1300"
                  filterUnits="userSpaceOnUse"
                >
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.011"
                    numOctaves="3"
                    seed="7"
                    result="noise"
                  />
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="noise"
                    scale="120"
                    xChannelSelector="R"
                    yChannelSelector="G"
                  />
                </filter>
                <mask
                  id="ink-mask"
                  maskUnits="userSpaceOnUse"
                  x="-200"
                  y="-200"
                  width="874"
                  height="1300"
                >
                  <rect x="-200" y="-200" width="874" height="1300" fill="black" />
                  <g filter="url(#ink-filter)">
                    {INK_BLOBS.map((blob, i) => (
                      <circle
                        key={i}
                        cx={blob.cx}
                        cy={blob.cy}
                        r="0"
                        fill="white"
                        ref={(el) => {
                          inkCircleRefs.current[i] = el;
                        }}
                      />
                    ))}
                  </g>
                </mask>
              </defs>
              <g mask="url(#ink-mask)">
                <g clipPath="url(#poster-clip)">
                  <image
                    ref={posterImageRef}
                    href={initialPoster.url}
                    x={initialPoster.x}
                    y={initialPoster.y}
                    width={initialPoster.width}
                    height={initialPoster.height}
                    preserveAspectRatio="none"
                  />
                </g>
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* 8. Custom cursor */}
      <div className="cursor" ref={cursorRef} aria-hidden="true">
        <div className="cur-ring" />
        <div className="cur-dot" />
        <div className="cur-lbl">
          <span>OPEN</span>
          <span>開く</span>
        </div>
      </div>
    </>
  );
}
