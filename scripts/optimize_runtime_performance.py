from pathlib import Path

path = Path('src/app/App.tsx')
text = path.read_text(encoding='utf-8')

if 'runtimePerformanceLowSpecV3' in text:
    print('Low-spec runtime performance optimizations are already applied.')
    raise SystemExit(0)

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
elif 'runtimePerformanceSafeV2' in text:
    print('Minute clock optimization already exists; low-spec detector was not duplicated.')
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
print('Applied automatic low-spec runtime performance mode.')
