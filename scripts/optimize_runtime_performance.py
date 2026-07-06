from pathlib import Path

path = Path('src/app/App.tsx')
text = path.read_text(encoding='utf-8')

if 'runtimePerformanceV1' in text:
    print('Runtime performance optimizations are already applied.')
    raise SystemExit(0)

# Add React's lazy-loading primitives.
text = text.replace(
    'import { useState, useEffect, useRef } from "react";',
    'import { useState, useEffect, useRef, lazy, Suspense } from "react";',
    1,
)

# Keep the initial bundle lean: reports charts and PDF code load only when used.
text = text.replace('import { jsPDF } from "jspdf";\n', '', 1)
text = text.replace('import autoTable from "jspdf-autotable";\n', '', 1)
text = text.replace('''import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
''', '', 1)

types_marker = '/* ─── Types ─────────────────────────────────────────────── */'
if types_marker not in text:
    raise RuntimeError('Could not locate the App type section.')
text = text.replace(
    types_marker,
    'const DailyHoursChart = lazy(() => import("./DailyHoursChart"));\n\n' + types_marker,
    1,
)

old_ticker = '''  // Clock ticker
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
      if (clockedIn && clockInTime) setElapsed(Date.now() - clockInTime.getTime());
    }, 1000);
    return () => clearInterval(t);
  }, [clockedIn, clockInTime]);
'''
new_ticker = '''  // runtimePerformanceV1: the visible dashboard only displays minute-level
  // values. Align updates to minute boundaries instead of rerendering the
  // entire application every second. The analog second hand animates itself.
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

      const delay = 60000 - (Date.now() % 60000) + 40;
      timer = window.setTimeout(updateClock, delay);
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
'''
if old_ticker not in text:
    raise RuntimeError('Could not locate the application clock ticker.')
text = text.replace(old_ticker, new_ticker, 1)

# Reduce background network and parsing work while preserving cross-device sync.
text = text.replace('const refreshTimer = window.setInterval(refreshCloud, 30000);',
                    'const refreshTimer = window.setInterval(refreshCloud, 60000);', 1)

# Load the relatively large PDF libraries on demand.
old_export = '  function exportMonthlyAttendancePdf() {'
new_export = '  async function exportMonthlyAttendancePdf() {'
if old_export not in text:
    raise RuntimeError('Could not locate the monthly PDF export function.')
text = text.replace(old_export, new_export, 1)

old_document = '    const document = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });'
new_document = '''    const [{ jsPDF }, autoTableModule] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const autoTable = autoTableModule.default;
    const document = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });'''
if old_document not in text:
    raise RuntimeError('Could not locate PDF document creation.')
text = text.replace(old_document, new_document, 1)
text = text.replace('(document as jsPDF & { lastAutoTable?: { finalY:number } })',
                    '(document as any)', 1)

# Defer Recharts until the Reports tab is actually opened.
chart_start = text.find('                <ResponsiveContainer width="100%" height={200}>')
chart_end_marker = '                </ResponsiveContainer>'
chart_end = text.find(chart_end_marker, chart_start)
if chart_start < 0 or chart_end < 0:
    raise RuntimeError('Could not locate the Reports daily-hours chart.')
chart_end += len(chart_end_marker)
chart_replacement = '''                <Suspense fallback={
                  <div className="h-[200px] rounded-xl flex items-center justify-center text-xs text-pink-300"
                    style={{ background:"rgba(255,255,255,0.05)" }}>
                    Loading chart…
                  </div>
                }>
                  <DailyHoursChart data={dailyData} />
                </Suspense>'''
text = text[:chart_start] + chart_replacement + text[chart_end:]

# Shorten the app-entry transition and remove the expensive full-screen blur.
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
text = text.replace('animation:"dashEnter 0.7s cubic-bezier(0.22,1,0.36,1) both"',
                    'animation:"dashEnter 0.28s cubic-bezier(0.22,1,0.36,1) both"', 1)

path.write_text(text, encoding='utf-8')
print('Applied minute-aligned rendering, lazy reports/PDF loading, and faster transitions.')
