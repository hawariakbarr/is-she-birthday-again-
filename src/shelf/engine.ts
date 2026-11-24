import {
  FILMS,
  FILM_COUNT,
  INITIAL_FILM_INDEX,
  INITIAL_SCROLL,
  INK_BLOBS,
  SHEETS,
  TOTAL_TAPES,
  type DecadeId,
} from './data';
import {
  computeBoxDimensions,
  computeInkBlobRadius,
  computePlayRingScale,
  computePosterSvgImage,
  computeTapePose,
  decadeForYear,
  filmIndexFromScroll,
  normalizeScroll,
  shortestLoopTarget,
  wrapRelativeIndex,
  type BoxDimensions,
} from './math';

export interface ShelfRefs {
  probe: HTMLElement;
  shelf: HTMLElement;
  stage: HTMLElement;
  tapes: HTMLElement[];
  spines: HTMLElement[];
  covers: HTMLElement[];
  playBtn: HTMLButtonElement;
  capTitleMask: HTMLElement;
  capSubMask: HTMLElement;
  capYearMask: HTMLElement;
  tabIndicator: HTMLElement;
  tabButtons: Map<DecadeId, HTMLButtonElement>;
  cursor: HTMLElement;
  detail: HTMLElement;
  detailLines: HTMLElement[];
  detailSub: HTMLElement;
  detailTitle: HTMLElement;
  detailMeta: HTMLElement;
  detailSyn: HTMLElement;
  detailWatch: HTMLButtonElement;
  posterImage: SVGImageElement;
  inkCircles: SVGCircleElement[];
}

export class ShelfEngine {
  private refs: ShelfRefs;
  private rafId: number | null = null;
  private lastTime = 0;

  // Motion & shelf state
  private s = INITIAL_SCROLL;
  private T = INITIAL_SCROLL;
  private hover = -1;
  private active = INITIAL_FILM_INDEX;
  private lifts: Float32Array = new Float32Array(TOTAL_TAPES);

  // Dimensions
  private W = window.innerWidth;
  private vh = window.innerHeight;
  private shelfCy = window.innerHeight / 2;
  private dims: BoxDimensions = computeBoxDimensions(400);

  // Pointer & cursor state
  private mx = -120;
  private my = -120;
  private cx = -120;
  private cy = -120;
  private hasPointer = false;
  private overBtn = false;
  private tiltX = 0;
  private tiltY = 0;
  private onCover = false;

  // Drag & wheel state
  private dragging = false;
  private dragMoved = false;
  private dragStartX = 0;
  private dragStartT = INITIAL_SCROLL;
  private suppressClickUntil = 0;
  private wheelSnapTimer: number | null = null;

  // Detail & ink state
  private isOpen = false;
  private isAnimatingDetail = false;
  private inkActive = false;
  private inkOpenTime = 0;
  private detailAnims: Animation[] = [];
  private watchQueued = false;

  // Reduced motion
  private reducedMotionQuery: MediaQueryList;
  private reducedMotion = false;

  // Cleanup registry
  private cleanups: Array<() => void> = [];

  constructor(refs: ShelfRefs) {
    this.refs = refs;
    this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.reducedMotionQuery.matches;
  }

  public start(): void {
    this.preloadSheets();
    this.measure(true);
    this.updateDecadeIndicator(true);
    this.bindEvents();
    this.renderFrame(0);
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.wheelSnapTimer !== null) {
      window.clearTimeout(this.wheelSnapTimer);
      this.wheelSnapTimer = null;
    }
    this.cancelDetailAnims();
    for (const fn of this.cleanups) {
      fn();
    }
    this.cleanups = [];
  }

  private preloadSheets(): void {
    for (const key of Object.keys(SHEETS) as Array<keyof typeof SHEETS>) {
      const img = new Image();
      img.decoding = 'async';
      img.src = SHEETS[key][0];
    }
  }

  private on<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    listener: (ev: WindowEventMap[K]) => void,
    options?: AddEventListenerOptions
  ): void;
  private on<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (ev: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions
  ): void;
  private on(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions
  ): void {
    target.addEventListener(type, listener, options);
    this.cleanups.push(() => target.removeEventListener(type, listener, options));
  }

  private bindEvents(): void {
    const onReducedChange = (e: MediaQueryListEvent) => {
      this.reducedMotion = e.matches;
    };
    this.reducedMotionQuery.addEventListener('change', onReducedChange);
    this.cleanups.push(() =>
      this.reducedMotionQuery.removeEventListener('change', onReducedChange)
    );

    this.on(window, 'resize', () => {
      this.measure(false);
      this.updateDecadeIndicator(true);
    });

    // Pointer tracking for cursor and cover tilt
    this.on(window, 'pointermove', (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      this.mx = e.clientX;
      this.my = e.clientY;
      if (!this.hasPointer) {
        this.cx = this.mx;
        this.cy = this.my;
        this.hasPointer = true;
      }
      const target = e.target as HTMLElement | null;
      this.overBtn = Boolean(target && target.closest('button, a'));
    });

    this.on(window, 'pointerleave', () => {
      this.hover = -1;
      this.overBtn = false;
    });

    // Hover tracking on each tape
    this.refs.tapes.forEach((tapeEl, v) => {
      this.on(tapeEl, 'pointerenter', (e: PointerEvent) => {
        if (e.pointerType === 'touch') return;
        this.hover = v;
      });
      this.on(tapeEl, 'pointerleave', () => {
        if (this.hover === v) {
          this.hover = -1;
        }
      });
      this.on(tapeEl, 'click', (e: MouseEvent) => {
        if (this.isOpen) return;
        if (performance.now() < this.suppressClickUntil) return;
        e.stopPropagation();
        const r = wrapRelativeIndex(v, this.s, TOTAL_TAPES);
        if (Math.abs(r) < 0.5) {
          this.openDetail();
        } else {
          this.T = Math.round(this.T + r);
        }
      });
    });

    // Fallback hit-test on shelf for clicking the active 3D cover (Chromium 3D hit-testing
    // can skip children of a rotateY(-90deg) parent when the parent plane is edge-on)
    const shelf = this.refs.shelf;
    this.on(shelf, 'click', (e: MouseEvent) => {
      if (this.isOpen) return;
      if (performance.now() < this.suppressClickUntil) return;
      if (Math.abs(this.T - this.s) >= 0.3) return;
      const coverEl = this.getActiveCoverElement();
      const rect = coverEl?.getBoundingClientRect();
      const inRect =
        rect &&
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      const inCoverZone =
        Math.abs(e.clientX - this.W / 2) <= 0.55 * this.dims.d &&
        Math.abs(e.clientY - this.shelfCy) <= 0.55 * this.dims.H;
      if (inRect || inCoverZone) {
        this.openDetail();
      }
    });

    // Drag scrubbing on the shelf
    let dragPointerId: number | null = null;

    this.on(shelf, 'pointerdown', (e: PointerEvent) => {
      if (this.isOpen) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      this.dragging = true;
      this.dragMoved = false;
      this.dragStartX = e.clientX;
      this.dragStartT = this.T;
      dragPointerId = e.pointerId;
    });

    this.on(window, 'pointermove', (e: PointerEvent) => {
      if (!this.dragging || e.pointerId !== dragPointerId) return;
      const dx = e.clientX - this.dragStartX;
      if (!this.dragMoved && Math.abs(dx) > 5) {
        this.dragMoved = true;
        try {
          shelf.setPointerCapture(e.pointerId);
        } catch {
          // Ignore if capture is unsupported
        }
      }
      if (this.dragMoved) {
        const pitch = this.dims.ws + this.dims.gap;
        this.T = this.dragStartT - dx / pitch;
      }
    });

    const endDrag = (e: PointerEvent) => {
      if (!this.dragging || e.pointerId !== dragPointerId) return;
      this.dragging = false;
      dragPointerId = null;
      if (this.dragMoved) {
        this.T = Math.round(this.T);
        this.suppressClickUntil = performance.now() + 80;
      }
      this.dragMoved = false;
      try {
        if (shelf.hasPointerCapture(e.pointerId)) {
          shelf.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
    };
    this.on(window, 'pointerup', endDrag);
    this.on(window, 'pointercancel', endDrag);

    // Wheel scrolling (both axes)
    this.on(
      window,
      'wheel',
      (e: WheelEvent) => {
        if (this.isOpen) return;
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (delta === 0) return;
        e.preventDefault();
        const pitch = this.dims.ws + this.dims.gap;
        this.T += (delta / pitch) * 0.5;
        if (this.wheelSnapTimer !== null) {
          window.clearTimeout(this.wheelSnapTimer);
        }
        this.wheelSnapTimer = window.setTimeout(() => {
          this.T = Math.round(this.T);
          this.wheelSnapTimer = null;
        }, 160);
      },
      { passive: false }
    );

    // Keyboard controls
    this.on(window, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this.isOpen) {
          e.preventDefault();
          this.closeDetail();
        }
        return;
      }
      if (this.isOpen) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.step(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.step(1);
      } else if (e.key === 'Enter' && document.activeElement === document.body) {
        e.preventDefault();
        this.openDetail();
      }
    });
  }

  public measure(isInitial: boolean): void {
    this.W = window.innerWidth;
    this.vh = window.innerHeight;
    const hPx = this.refs.probe.getBoundingClientRect().height || Math.min(this.vh * 0.46, this.W * 0.31);
    this.dims = computeBoxDimensions(hPx);

    this.refs.stage.style.setProperty('--ws', `${this.dims.ws.toFixed(2)}px`);
    this.refs.stage.style.setProperty('--d', `${this.dims.d.toFixed(2)}px`);

    const shelfRect = this.refs.shelf.getBoundingClientRect();
    this.shelfCy = shelfRect.top + shelfRect.height / 2;

    if (!isInitial) {
      this.positionPlayRing();
    }
  }

  public step(delta: number): void {
    if (this.isOpen) return;
    this.T = Math.round(this.T) + delta;
  }

  public jumpToFilmIndex(targetIndex: number): void {
    if (this.isOpen) {
      this.closeDetail();
    }
    this.T = shortestLoopTarget(this.T, targetIndex, FILM_COUNT);
  }

  public toggleWatchAction(): void {
    this.watchQueued = !this.watchQueued;
    const btn = this.refs.detailWatch;
    btn.classList.toggle('is-queued', this.watchQueued);
    btn.textContent = this.watchQueued
      ? '35MM ARCHIVE PRINT QUEUED / 上映予約済'
      : 'WATCH THE FILM / 映画を見る';
  }

  private getActiveCoverElement(): HTMLElement | null {
    let bestV = -1;
    let bestDist = Infinity;
    for (let v = 0; v < TOTAL_TAPES; v++) {
      const dist = Math.abs(wrapRelativeIndex(v, this.s, TOTAL_TAPES));
      if (dist < bestDist) {
        bestDist = dist;
        bestV = v;
      }
    }
    return bestV >= 0 ? this.refs.covers[bestV] : null;
  }

  public openDetail(): void {
    if (this.isOpen || this.isAnimatingDetail) return;

    this.T = Math.round(this.T);
    const filmIdx = filmIndexFromScroll(this.T, FILM_COUNT);
    if (filmIdx !== this.active) {
      this.setActive(filmIdx, 1);
    }
    const film = FILMS[this.active];

    // Fill detail content
    this.watchQueued = false;
    this.refs.detailWatch.classList.remove('is-queued');
    this.refs.detailWatch.textContent = 'WATCH THE FILM / 映画を見る';
    this.refs.detailSub.textContent = `${film.romaji} / ${film.kanji}`;
    this.refs.detailTitle.textContent = film.title;
    this.refs.detailMeta.textContent = `${film.year} / ${film.genre.toUpperCase()} / ${film.minutes} MIN`;
    this.refs.detailSyn.textContent = film.synopsis;

    // Position SVG poster image crop
    const posterGeom = computePosterSvgImage(film.id);
    this.refs.posterImage.setAttribute('href', posterGeom.url);
    this.refs.posterImage.setAttribute('x', posterGeom.x.toFixed(2));
    this.refs.posterImage.setAttribute('y', posterGeom.y.toFixed(2));
    this.refs.posterImage.setAttribute('width', posterGeom.width.toFixed(2));
    this.refs.posterImage.setAttribute('height', posterGeom.height.toFixed(2));

    // Reset all ink blob radii to 0
    for (const circle of this.refs.inkCircles) {
      circle.setAttribute('r', '0');
    }

    // Measure projected 3D rect of active cover face
    const coverEl = this.getActiveCoverElement();
    const rect = coverEl
      ? coverEl.getBoundingClientRect()
      : new DOMRect(
          this.W / 2 - this.dims.d / 2,
          this.shelfCy - this.dims.H / 2,
          this.dims.d,
          this.dims.H
        );

    const top = rect.top;
    const right = this.W - rect.right;
    const bottom = this.vh - rect.bottom;
    const left = rect.left;
    const ox = rect.left + rect.width / 2;
    const oy = rect.top + rect.height / 2;

    this.isOpen = true;
    this.isAnimatingDetail = true;
    this.overBtn = false;
    this.cancelDetailAnims();

    const detail = this.refs.detail;
    detail.scrollTop = 0;
    detail.style.transformOrigin = `${ox.toFixed(1)}px ${oy.toFixed(1)}px`;
    detail.style.visibility = 'visible';
    detail.setAttribute('aria-hidden', 'false');
    detail.dataset.open = 'true';

    const dur = this.reducedMotion ? 1 : 1050;
    const sheetAnim = detail.animate(
      [
        {
          clipPath: `inset(${top.toFixed(1)}px ${right.toFixed(1)}px ${bottom.toFixed(1)}px ${left.toFixed(1)}px round 3px)`,
          transform: 'rotate(-4.5deg)',
        },
        {
          clipPath: 'inset(0px 0px 0px 0px round 0px)',
          transform: 'rotate(0deg)',
        },
      ],
      {
        duration: dur,
        easing: 'cubic-bezier(0.76, 0, 0.18, 1)',
        fill: 'both',
      }
    );
    this.detailAnims.push(sheetAnim);

    sheetAnim.finished
      .then(() => {
        this.isAnimatingDetail = false;
      })
      .catch(() => {
        this.isAnimatingDetail = false;
      });

    // Masked text rise animations
    const lineDur = this.reducedMotion ? 1 : 900;
    this.refs.detailLines.forEach((el, index) => {
      const anim = el.animate(
        [{ transform: 'translateY(110%)' }, { transform: 'translateY(0%)' }],
        {
          duration: lineDur,
          delay: this.reducedMotion ? 0 : 620 + index * 75,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          fill: 'both',
        }
      );
      this.detailAnims.push(anim);
    });

    // Start ink reveal inside the single rAF loop
    const now = performance.now();
    this.inkOpenTime = this.reducedMotion ? now - 5000 : now;
    this.inkActive = true;
  }

  public closeDetail(): void {
    if (!this.isOpen) return;

    this.inkActive = false;
    this.isAnimatingDetail = true;
    this.overBtn = false;

    const coverEl = this.getActiveCoverElement();
    const rect = coverEl
      ? coverEl.getBoundingClientRect()
      : new DOMRect(
          this.W / 2 - this.dims.d / 2,
          this.shelfCy - this.dims.H / 2,
          this.dims.d,
          this.dims.H
        );

    const top = rect.top;
    const right = this.W - rect.right;
    const bottom = this.vh - rect.bottom;
    const left = rect.left;
    const ox = rect.left + rect.width / 2;
    const oy = rect.top + rect.height / 2;

    const detail = this.refs.detail;
    detail.style.transformOrigin = `${ox.toFixed(1)}px ${oy.toFixed(1)}px`;

    // Cancel existing sheet animation so close starts cleanly from full screen
    this.cancelDetailAnims();

    const closeDur = this.reducedMotion ? 1 : 850;
    const closeAnim = detail.animate(
      [
        {
          clipPath: 'inset(0px 0px 0px 0px round 0px)',
          transform: 'rotate(0deg)',
        },
        {
          clipPath: `inset(${top.toFixed(1)}px ${right.toFixed(1)}px ${bottom.toFixed(1)}px ${left.toFixed(1)}px round 3px)`,
          transform: 'rotate(-4.5deg)',
        },
      ],
      {
        duration: closeDur,
        easing: 'cubic-bezier(0.76, 0, 0.18, 1)',
        fill: 'both',
      }
    );
    this.detailAnims.push(closeAnim);

    closeAnim.finished
      .then(() => {
        detail.style.visibility = 'hidden';
        detail.setAttribute('aria-hidden', 'true');
        detail.dataset.open = 'false';
        detail.scrollTop = 0;
        this.cancelDetailAnims();
        this.isOpen = false;
        this.isAnimatingDetail = false;
      })
      .catch(() => {
        this.isAnimatingDetail = false;
      });
  }

  private cancelDetailAnims(): void {
    for (const anim of this.detailAnims) {
      try {
        anim.cancel();
      } catch {
        // Ignore
      }
    }
    this.detailAnims = [];
  }

  private setActive(filmIdx: number, dir: number): void {
    this.active = filmIdx;
    const film = FILMS[filmIdx];

    this.swapMaskText(this.refs.capTitleMask, film.title, dir);
    this.swapMaskText(this.refs.capSubMask, `${film.romaji} / ${film.kanji}`, dir);
    this.swapMaskText(this.refs.capYearMask, String(film.year), dir);
    this.updateDecadeIndicator(false);
  }

  private swapMaskText(maskEl: HTMLElement, text: string, dir: number): void {
    const travelDir = dir === 0 ? 1 : dir > 0 ? 1 : -1;

    if (this.reducedMotion) {
      const existing = maskEl.firstElementChild as HTMLElement | null;
      if (existing) {
        existing.textContent = text;
        while (maskEl.children.length > 1) {
          maskEl.lastElementChild?.remove();
        }
      } else {
        const span = document.createElement('span');
        span.textContent = text;
        maskEl.appendChild(span);
      }
      return;
    }

    const timing: KeyframeAnimationOptions = {
      duration: 650,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      fill: 'both',
    };

    const existingSpans = Array.from(maskEl.children) as HTMLElement[];
    for (const oldSpan of existingSpans) {
      if (oldSpan.dataset.leaving === '1') continue;
      oldSpan.dataset.leaving = '1';
      const computed = window.getComputedStyle(oldSpan).transform;
      const fromTransform = computed && computed !== 'none' ? computed : 'translateY(0%)';
      for (const a of oldSpan.getAnimations()) {
        a.cancel();
      }
      const outAnim = oldSpan.animate(
        [{ transform: fromTransform }, { transform: `translateY(${-travelDir * 105}%)` }],
        timing
      );
      outAnim.finished
        .then(() => {
          oldSpan.remove();
        })
        .catch(() => {
          oldSpan.remove();
        });
    }

    const nextSpan = document.createElement('span');
    nextSpan.textContent = text;
    maskEl.appendChild(nextSpan);
    nextSpan.animate(
      [{ transform: `translateY(${travelDir * 105}%)` }, { transform: 'translateY(0%)' }],
      timing
    );
  }

  private updateDecadeIndicator(instant: boolean): void {
    const film = FILMS[this.active];
    const activeDecade = decadeForYear(film.year);

    this.refs.tabButtons.forEach((btn, id) => {
      const isActive = id === activeDecade;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-current', isActive ? 'true' : 'false');
    });

    const targetBtn = this.refs.tabButtons.get(activeDecade);
    if (!targetBtn) return;

    const ind = this.refs.tabIndicator;
    if (instant || this.reducedMotion) {
      ind.classList.add('no-anim');
    }
    ind.style.width = `${targetBtn.offsetWidth}px`;
    ind.style.transform = `translateX(${targetBtn.offsetLeft}px)`;
    if (instant || this.reducedMotion) {
      void ind.offsetWidth;
      ind.classList.remove('no-anim');
    }
  }

  private positionPlayRing(): void {
    const playScale = computePlayRingScale(this.T, this.s, this.isOpen);
    const left = this.W / 2 - 0.5 * this.dims.d - 6;
    const top = this.shelfCy + 0.36 * this.dims.H;
    const btn = this.refs.playBtn;
    btn.style.left = `${left.toFixed(1)}px`;
    btn.style.top = `${top.toFixed(1)}px`;
    btn.style.transform = `scale(${playScale.toFixed(4)})`;
    btn.style.pointerEvents = playScale > 0.25 && !this.isOpen ? 'auto' : 'none';
  }

  private tick = (now: number): void => {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.renderFrame(dt, now);
    this.rafId = requestAnimationFrame(this.tick);
  };

  private renderFrame(dt: number, now: number = performance.now()): void {
    // 1. Scroll spring
    const diff = this.T - this.s;
    if (this.reducedMotion || Math.abs(diff) < 1e-4) {
      this.s = this.T;
    } else if (dt > 0) {
      const k = this.dragging ? 18 : 5.2;
      this.s += diff * (1 - Math.exp(-k * dt));
      if (Math.abs(this.T - this.s) < 1e-4) {
        this.s = this.T;
      }
    }

    // 2. Normalize scroll if beyond ±4 full loops
    const norm = normalizeScroll(this.s, this.T, FILM_COUNT, TOTAL_TAPES);
    this.s = norm.s;
    this.T = norm.T;

    // 3. Caption update when active film changes
    const currentFilmIdx = filmIndexFromScroll(this.s, FILM_COUNT);
    if (currentFilmIdx !== this.active) {
      const dir = this.T - this.s >= 0 ? 1 : -1;
      this.setActive(currentFilmIdx, dir);
    }

    // 4. Cursor & tilt towards pointer
    const settled = Math.abs(this.T - this.s) < 0.3;
    this.onCover =
      this.hasPointer &&
      !this.isOpen &&
      settled &&
      Math.abs(this.mx - this.W / 2) <= 0.55 * this.dims.d &&
      Math.abs(this.my - this.shelfCy) <= 0.55 * this.dims.H;

    const targetTiltY = this.hasPointer
      ? this.onCover
        ? ((this.mx - this.W / 2) / (0.55 * this.dims.d)) * 9
        : ((this.mx - this.W / 2) / Math.max(this.W, 1)) * 5
      : 0;
    const targetTiltX =
      this.hasPointer && this.onCover
        ? -((this.my - this.shelfCy) / (this.dims.H / 2)) * 6
        : 0;

    if (this.reducedMotion) {
      this.tiltX = 0;
      this.tiltY = 0;
    } else if (dt > 0) {
      const tiltAlpha = 1 - Math.exp(-7 * dt);
      this.tiltX += (targetTiltX - this.tiltX) * tiltAlpha;
      this.tiltY += (targetTiltY - this.tiltY) * tiltAlpha;
    }

    // 5. Position all 36 tapes
    const cullLimit = this.W / 2 + 1.5 * this.dims.d;
    const liftAlpha = this.reducedMotion ? 1 : dt > 0 ? 1 - Math.exp(-12 * dt) : 0;
    let hoveringSpine = false;

    for (let v = 0; v < TOTAL_TAPES; v++) {
      const r = wrapRelativeIndex(v, this.s, TOTAL_TAPES);
      const isHoveredSpine = !this.isOpen && this.hover === v && Math.abs(r) > 0.5;
      if (isHoveredSpine) {
        hoveringSpine = true;
      }
      const targetLift = isHoveredSpine ? 1 : 0;
      this.lifts[v] += (targetLift - this.lifts[v]) * liftAlpha;
      if (Math.abs(targetLift - this.lifts[v]) < 1e-4) {
        this.lifts[v] = targetLift;
      }

      const pose = computeTapePose(r, this.lifts[v], this.tiltX, this.tiltY, this.dims);
      const tapeEl = this.refs.tapes[v];

      if (Math.abs(pose.x) > cullLimit) {
        tapeEl.style.visibility = 'hidden';
        continue;
      }

      tapeEl.style.visibility = 'visible';
      tapeEl.style.transform = pose.transform;
      tapeEl.style.zIndex = String(pose.zIndex);
      tapeEl.dataset.active = Math.abs(r) < 0.5 ? 'true' : 'false';

      this.refs.spines[v].style.setProperty('--shade', pose.spineShade.toFixed(3));
      this.refs.covers[v].style.setProperty('--shade', pose.coverShade.toFixed(3));
      this.refs.covers[v].style.setProperty('--open', pose.o.toFixed(3));
    }

    // 6. Play ring
    this.positionPlayRing();

    // 7. Custom cursor smoothing & states
    if (this.hasPointer) {
      if (this.reducedMotion) {
        this.cx = this.mx;
        this.cy = this.my;
      } else if (dt > 0) {
        const curAlpha = 1 - Math.exp(-16 * dt);
        this.cx += (this.mx - this.cx) * curAlpha;
        this.cy += (this.my - this.cy) * curAlpha;
      }
      this.refs.cursor.style.transform = `translate3d(${this.cx.toFixed(2)}px, ${this.cy.toFixed(2)}px, 0)`;

      const isBtn = this.overBtn;
      const isOpenState = !this.isOpen && !isBtn && this.onCover;
      const isSpineState = !this.isOpen && !isBtn && !isOpenState && hoveringSpine;

      this.refs.cursor.classList.toggle('open', isOpenState);
      this.refs.cursor.classList.toggle('spine', isSpineState);
      this.refs.cursor.classList.toggle('btn', isBtn);
    }

    // 8. Ink blot reveal loop (runs for 2.4s after detail open)
    if (this.inkActive) {
      const sinceOpen = now - this.inkOpenTime;
      const inkElapsed = sinceOpen - 520;
      for (let i = 0; i < INK_BLOBS.length; i++) {
        const r = computeInkBlobRadius(inkElapsed, INK_BLOBS[i].delay, 1250, 720);
        this.refs.inkCircles[i].setAttribute('r', r.toFixed(1));
      }
      if (sinceOpen >= 2400) {
        this.inkActive = false;
      }
    }
  }
}
