import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

interface DemoModeContextValue {
  isDemoMode: boolean;
  demoRunId: number;
  speedMultiplier: number;
  stopDemoMode: () => void;
}

const DemoModeContext = createContext<DemoModeContextValue>({
  isDemoMode: false,
  demoRunId: 0,
  speedMultiplier: 1,
  stopDemoMode: () => {},
});

const TOTAL_DEMO_DURATION_MS = 45000;
const PAUSE_DURATION_MS = 2000;
const LOAD_SLOW_MULTIPLIER = 1.5;

interface TimelineSegment {
  type: 'pause' | 'scroll';
  startMs: number;
  endMs: number;
  fromY: number;
  toY: number;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function getElementScrollTarget(
  el: HTMLElement,
  align: 'center' | 'top',
  maxScroll: number
): number {
  const rect = el.getBoundingClientRect();
  const absTop = rect.top + window.scrollY;
  const targetY =
    align === 'center'
      ? absTop + rect.height / 2 - window.innerHeight / 2
      : absTop - 84;
  return Math.max(0, Math.min(maxScroll, Math.round(targetY)));
}

function buildDemoTimeline(): TimelineSegment[] {
  const docHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight
  );
  const maxScroll = Math.max(0, docHeight - window.innerHeight);

  const stops: { y: number; pauseMs: number }[] = [{ y: 0, pauseMs: PAUSE_DURATION_MS }];

  const featuresEl = document.getElementById('features');
  if (featuresEl) {
    // Center if tall bento fits comfortably, otherwise frame from top of grid
    const fitsViewport = featuresEl.getBoundingClientRect().height <= window.innerHeight * 0.88;
    stops.push({
      y: getElementScrollTarget(featuresEl, fitsViewport ? 'center' : 'top', maxScroll),
      pauseMs: PAUSE_DURATION_MS,
    });
  }

  const allStepEls = Array.from(document.querySelectorAll<HTMLElement>('[data-tour-step]'));
  const visibleStepEls = allStepEls.filter((el) => el.getClientRects().length > 0);
  visibleStepEls.forEach((stepEl) => {
    stops.push({
      y: getElementScrollTarget(stepEl, 'center', maxScroll),
      pauseMs: PAUSE_DURATION_MS,
    });
  });

  const earlyAccessEl = document.getElementById('early-access');
  if (earlyAccessEl) {
    stops.push({
      y: getElementScrollTarget(earlyAccessEl, 'center', maxScroll),
      pauseMs: PAUSE_DURATION_MS,
    });
  }

  // Final smooth glide down to reveal footer if not already at bottom
  const lastStopY = stops[stops.length - 1]?.y ?? 0;
  if (maxScroll - lastStopY > 24) {
    stops.push({ y: maxScroll, pauseMs: 0 });
  }

  // Deduplicate/ensure monotonically non-decreasing targets while keeping required pauses
  const totalPauseMs = stops.reduce((sum, s) => sum + s.pauseMs, 0);
  const totalScrollBudgetMs = Math.max(8000, TOTAL_DEMO_DURATION_MS - totalPauseMs);

  let totalDistance = 0;
  for (let i = 1; i < stops.length; i++) {
    totalDistance += Math.abs(stops[i].y - stops[i - 1].y);
  }

  const segments: TimelineSegment[] = [];
  let cursorMs = 0;

  if (stops[0].pauseMs > 0) {
    segments.push({
      type: 'pause',
      startMs: cursorMs,
      endMs: cursorMs + stops[0].pauseMs,
      fromY: stops[0].y,
      toY: stops[0].y,
    });
    cursorMs += stops[0].pauseMs;
  }

  for (let i = 1; i < stops.length; i++) {
    const prevY = stops[i - 1].y;
    const nextY = stops[i].y;
    const dist = Math.abs(nextY - prevY);
    const segScrollMs =
      totalDistance > 0
        ? Math.max(dist > 0 ? 350 : 0, (dist / totalDistance) * totalScrollBudgetMs)
        : 0;

    if (segScrollMs > 0) {
      segments.push({
        type: 'scroll',
        startMs: cursorMs,
        endMs: cursorMs + segScrollMs,
        fromY: prevY,
        toY: nextY,
      });
      cursorMs += segScrollMs;
    }

    if (stops[i].pauseMs > 0) {
      segments.push({
        type: 'pause',
        startMs: cursorMs,
        endMs: cursorMs + stops[i].pauseMs,
        fromY: nextY,
        toY: nextY,
      });
      cursorMs += stops[i].pauseMs;
    }
  }

  return segments;
}

export const DemoModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoRunId, setDemoRunId] = useState(0);
  const rafRef = useRef<number | null>(null);

  const stopDemoMode = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsDemoMode(false);
  }, []);

  // Keyboard listener: D toggles Demo mode, Escape stops it
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape') {
        if (isDemoMode) {
          e.preventDefault();
          stopDemoMode();
        }
        return;
      }

      if (e.key.toLowerCase() === 'd' && !e.repeat) {
        if (isEditableElement(e.target)) return;
        e.preventDefault();
        setIsDemoMode((prev) => {
          const next = !prev;
          if (next) {
            setDemoRunId((id) => id + 1);
          }
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDemoMode, stopDemoMode]);

  // Toggle hidden-scrollbar CSS class & run smooth auto-scroll timeline
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (!isDemoMode) {
      root.classList.remove('blisp-demo-mode');
      body.classList.remove('blisp-demo-mode');
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    root.classList.add('blisp-demo-mode');
    body.classList.add('blisp-demo-mode');

    // Jump cleanly to top so hero entrance and full-page recording start together
    window.scrollTo({ top: 0, behavior: 'auto' });

    let cancelled = false;

    // Wait two animation frames after layout reset so bounding rects settle cleanly
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        if (cancelled) return;
        const segments = buildDemoTimeline();
        const totalDuration =
          segments.length > 0 ? segments[segments.length - 1].endMs : TOTAL_DEMO_DURATION_MS;

        const startedAt = performance.now();

        const tick = (now: number) => {
          if (cancelled) return;
          const elapsed = now - startedAt;

          if (elapsed >= totalDuration) {
            const finalY = segments.length > 0 ? segments[segments.length - 1].toY : 0;
            window.scrollTo(0, finalY);
            stopDemoMode();
            return;
          }

          const seg =
            segments.find((s) => elapsed >= s.startMs && elapsed < s.endMs) ??
            segments[segments.length - 1];

          if (seg) {
            if (seg.type === 'pause') {
              window.scrollTo(0, seg.toY);
            } else {
              const span = Math.max(1, seg.endMs - seg.startMs);
              const progress = Math.max(0, Math.min(1, (elapsed - seg.startMs) / span));
              const eased = easeInOutCubic(progress);
              const nextY = seg.fromY + (seg.toY - seg.fromY) * eased;
              window.scrollTo(0, nextY);
            }
          }

          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
      });
    });

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      root.classList.remove('blisp-demo-mode');
      body.classList.remove('blisp-demo-mode');
    };
  }, [isDemoMode, stopDemoMode]);

  const value = useMemo<DemoModeContextValue>(
    () => ({
      isDemoMode,
      demoRunId,
      speedMultiplier: isDemoMode ? LOAD_SLOW_MULTIPLIER : 1,
      stopDemoMode,
    }),
    [isDemoMode, demoRunId, stopDemoMode]
  );

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
};

export function useDemoMode(): DemoModeContextValue {
  return useContext(DemoModeContext);
}
