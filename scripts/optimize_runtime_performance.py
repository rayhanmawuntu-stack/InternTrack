from pathlib import Path

path = Path('src/app/App.tsx')
text = path.read_text(encoding='utf-8')

if 'runtimePerformanceLowSpecV3' not in text:
    # Keep this transform conservative: no import rewrites or risky bundle splitting.
    old_ticker = '''  // Clock ticker
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
      if (clockedIn && clockInTime) setElapsed(Date.now() - clockInTime.getTime());
    }, 1000);
    return () => clearInterval(t);
  }, [clockedIn, clockInTime]);
'''
    new_ticker = '''  // runtimePerformanceLowSpecV3: update minute-level UI once per minute.
  // The Calendar second hand animates independently in CalendarAnalogClock.
  useEffect(() => {
    let timer = 0;

    const updateClock = () => {
      const nextNow = new Date();
      setNow(previous => {
        const sameMinute = previous.getFullYear() === nextNow.getFullYear()
          && previous.getMonth() === nextNow.getMonth()
          && previous.getDate() === nextNow.getDate()
          && previous.getHours() === nextNow.getHours()
          && previous.getMinutes() === nextNow.getMinutes();
        return sameMinute ? previous : nextNow;
      });

      if (clockedIn && clockInTime) {
        setElapsed(Math.max(0, Date.now() - clockInTime.getTime()));
      }

      timer = window.setTimeout(updateClock, 60000 - (Date.now() % 60000) + 40);
    };

    const resumeClock = () => {
      window.clearTimeout(timer);
      if (document.visibilityState === "visible") updateClock();
    };

    updateClock();
    document.addEventListener("visibilitychange", resumeClock);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", resumeClock);
    };
  }, [clockedIn, clockInTime]);

  useEffect(() => {
    type PerformanceNavigator = Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean; effectiveType?: string };
    };

    const nav = navigator as PerformanceNavigator;
    const memory = nav.deviceMemory ?? 8;
    const cores = nav.hardwareConcurrency || 8;
    const connection = nav.connection;
    const effectiveType = connection?.effectiveType || "";
    const forcedMode = window.localStorage.getItem("it_performance_mode");
    const detectedLowSpec = memory <= 4
      || cores <= 4
      || Boolean(connection?.saveData)
      || effectiveType === "slow-2g"
      || effectiveType === "2g";
    const lowSpec = forcedMode === "low"
      || (forcedMode !== "standard" && detectedLowSpec);

    document.documentElement.classList.toggle("it-low-spec", lowSpec);
    document.documentElement.dataset.performanceMode = lowSpec ? "low-spec" : "standard";

    return () => {
      document.documentElement.classList.remove("it-low-spec");
      delete document.documentElement.dataset.performanceMode;
    };
  }, []);
'''

    if old_ticker in text:
        text = text.replace(old_ticker, new_ticker, 1)
    else:
        print('Clock ticker already changed; leaving it unchanged.')

    old_refresh = 'const refreshTimer = window.setInterval(refreshCloud, 30000);'
    new_refresh = '''const refreshDelay = document.documentElement.classList.contains("it-low-spec") ? 120000 : 60000;
    const refreshTimer = window.setInterval(refreshCloud, refreshDelay);'''
    if old_refresh in text:
        text = text.replace(old_refresh, new_refresh, 1)
    else:
        text = text.replace(
            'const refreshTimer = window.setInterval(refreshCloud, 60000);',
            new_refresh,
            1,
        )

    old_animation = '''        @keyframes dashEnter {
          from { opacity: 0; transform: scale(0.96); filter: blur(10px); }
          to   { opacity: 1; transform: scale(1);    filter: blur(0);    }
        }'''
    new_animation = '''        @keyframes dashEnter {
          from { opacity:0; transform:translateY(6px); }
          to   { opacity:1; transform:translateY(0); }
        }'''
    if old_animation in text:
        text = text.replace(old_animation, new_animation, 1)

    text = text.replace(
        'animation:"dashEnter 0.7s cubic-bezier(0.22,1,0.36,1) both"',
        'animation:"dashEnter 0.28s cubic-bezier(0.22,1,0.36,1) both"',
        1,
    )

    path.write_text(text, encoding='utf-8')
else:
    print('Low-spec runtime detector is already applied.')

styles_path = Path('src/styles/performance.css')
styles = styles_path.read_text(encoding='utf-8')
low_spec_css = r'''

/* lowSpecPerformanceV3: automatically enabled on limited CPU/RAM or Data Saver. */
html.it-low-spec .it-app-shell > .fixed.rounded-full {
  display: none !important;
}

html.it-low-spec .it-app-shell aside,
html.it-low-spec .it-mobile-nav,
html.it-low-spec .it-clock-card,
html.it-low-spec .it-calendar-shell,
html.it-low-spec .it-month-calendar-card,
html.it-low-spec .it-main [style*="backdrop-filter"] {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

html.it-low-spec .it-calendar-section,
html.it-low-spec .it-clock-grid,
html.it-low-spec .it-dashboard-lower,
html.it-low-spec .it-main > .space-y-5 {
  content-visibility: auto;
  contain-intrinsic-size: 520px;
  contain: layout paint style;
}

html.it-low-spec .it-clock-card::after,
html.it-low-spec .it-stat-grid > *::after,
html.it-low-spec .it-dashboard-lower > *::after,
html.it-low-spec .it-month-calendar-card::after {
  display: none !important;
}

html.it-low-spec .it-main *,
html.it-low-spec .it-mobile-nav *,
html.it-low-spec .it-app-shell aside * {
  animation-duration: 0.001ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 80ms !important;
}

html.it-low-spec .it-calendar-shell svg [style*="filter"],
html.it-low-spec .it-calendar-shell svg line,
html.it-low-spec .it-calendar-shell svg circle {
  filter: none !important;
}

html.it-low-spec .it-shift-progress-sweep {
  display: none !important;
}

html.it-low-spec .it-shift-progress-glow.is-active {
  animation: none !important;
  opacity: 0.62 !important;
  transform: translate3d(0,-50%,0) !important;
  box-shadow: 0 0 8px rgba(249,168,212,0.72), 0 0 16px rgba(225,29,72,0.38) !important;
}

html.it-low-spec .it-shift-progress-fill,
html.it-low-spec .it-shift-progress-beacon {
  animation: none !important;
}

html.it-low-spec .it-shift-progress-fill {
  box-shadow: 0 0 7px rgba(249,168,212,0.65) !important;
}

html.it-low-spec .it-shift-progress-beacon {
  opacity: 0.92 !important;
  transform: translate3d(-50%,-50%,0) !important;
  box-shadow: 0 0 9px rgba(249,168,212,0.72) !important;
}

html.it-low-spec .it-stat-grid > *,
html.it-low-spec .it-clock-card,
html.it-low-spec .it-dashboard-lower > *,
html.it-low-spec .it-month-calendar-card,
html.it-low-spec .it-attendance-day {
  box-shadow: 0 3px 12px rgba(96,18,54,0.08) !important;
}
'''

if 'lowSpecPerformanceV3' not in styles:
    styles_path.write_text(styles.rstrip() + low_spec_css + '\n', encoding='utf-8')
else:
    print('Low-spec CSS overrides are already applied.')

print('Applied automatic low-spec runtime performance mode.')
