type ScrollState = {
  current: number;
  target: number;
  frame: number;
};

type PerformanceNavigator = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
};

const SCROLLABLE_SELECTOR = [
  ".it-main",
  ".it-app-shell aside",
  ".it-calendar-sheet",
  '[data-smooth-scroll="true"]',
].join(",");

function shouldUseNativeScrolling(): boolean {
  const nav = navigator as PerformanceNavigator;
  const memory = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency || 8;
  const connection = nav.connection;
  const effectiveType = connection?.effectiveType || "";
  const forcedMode = window.localStorage.getItem("it_performance_mode");

  if (forcedMode === "standard") return false;
  if (forcedMode === "low") return true;

  return document.documentElement.classList.contains("it-low-spec")
    || memory <= 4
    || cores <= 4
    || Boolean(connection?.saveData)
    || effectiveType === "slow-2g"
    || effectiveType === "2g";
}

export function installDesktopScrollSmoothing(): () => void {
  const desktop = window.matchMedia("(min-width: 768px) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Native scrolling avoids a continuous requestAnimationFrame loop and is
  // substantially cheaper on limited CPUs and integrated graphics.
  if (!desktop.matches || reducedMotion.matches || shouldUseNativeScrolling()) {
    return () => undefined;
  }

  const states = new WeakMap<HTMLElement, ScrollState>();

  const getState = (element: HTMLElement): ScrollState => {
    const existing = states.get(element);
    if (existing) return existing;

    const created: ScrollState = {
      current: element.scrollTop,
      target: element.scrollTop,
      frame: 0,
    };
    states.set(element, created);
    return created;
  };

  const animate = (element: HTMLElement, state: ScrollState) => {
    state.current += (state.target - state.current) * 0.2;
    element.scrollTop = state.current;

    if (Math.abs(state.target - state.current) > 0.45) {
      state.frame = requestAnimationFrame(() => animate(element, state));
      return;
    }

    element.scrollTop = state.target;
    state.current = state.target;
    state.frame = 0;
  };

  const onWheel = (event: WheelEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

    const origin = event.target as HTMLElement | null;
    if (!origin) return;
    if (origin.closest('textarea, select, input[type="number"], [data-native-scroll="true"]')) return;

    const container = origin.closest(SCROLLABLE_SELECTOR) as HTMLElement | null;
    if (!container || container.scrollHeight <= container.clientHeight + 1) return;

    // Small pixel deltas generally come from precision trackpads. Their native
    // momentum is already smooth, so only interpolate stepped wheel input.
    if (event.deltaMode === 0 && Math.abs(event.deltaY) < 28) return;

    const multiplier = event.deltaMode === 1
      ? 30
      : event.deltaMode === 2
        ? container.clientHeight
        : 1;
    const delta = event.deltaY * multiplier;
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);

    if ((container.scrollTop <= 0.5 && delta < 0) ||
        (container.scrollTop >= maxScroll - 0.5 && delta > 0)) return;

    event.preventDefault();
    const state = getState(container);
    if (!state.frame) state.current = container.scrollTop;
    state.target = Math.max(0, Math.min(maxScroll, state.target + delta * 0.82));
    if (!state.frame) state.frame = requestAnimationFrame(() => animate(container, state));
  };

  window.addEventListener("wheel", onWheel, { passive: false });

  return () => {
    window.removeEventListener("wheel", onWheel);
    document.querySelectorAll<HTMLElement>(SCROLLABLE_SELECTOR).forEach(element => {
      const state = states.get(element);
      if (state?.frame) cancelAnimationFrame(state.frame);
    });
  };
}
