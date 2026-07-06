from pathlib import Path

path = Path('src/app/App.tsx')
text = path.read_text(encoding='utf-8')

if 'calendarResponsiveLayout' in text:
    print('Full-screen responsive Calendar optimization is already applied.')
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str):
    global text
    if old not in text:
        raise RuntimeError(f'Could not locate {label}.')
    text = text.replace(old, new, 1)

# Give Calendar the full available app viewport and remove the ordinary page header.
replace_once(
    '<main className="it-main flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-4 md:px-7 py-5 md:py-6 pb-28 md:pb-6">',
    '<main className={`it-main flex-1 min-w-0 overflow-y-auto overflow-x-hidden ${navTab === "calendar" ? "it-calendar-main p-0 pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0" : "px-4 md:px-7 py-5 md:py-6 pb-28 md:pb-6"}`}>',
    'main app container',
)
replace_once(
    '<div className="flex items-start justify-between mb-5 md:mb-6">',
    '<div className={`${navTab === "calendar" ? "hidden" : "flex"} items-start justify-between mb-5 md:mb-6`}>',
    'standard page header',
)

# Calendar-specific structural classes used by the responsive layout.
replacements = [
    ('<div className="it-calendar-stage max-w-4xl mx-auto space-y-4">', '<div className="it-calendar-stage w-full min-h-full">'),
    ('<section className="relative overflow-hidden rounded-[30px] sm:rounded-[38px] px-4 py-5 sm:px-8 sm:py-7"', '<section className="it-calendar-shell relative overflow-hidden min-h-[calc(100svh-4.75rem-env(safe-area-inset-bottom))] md:min-h-screen rounded-none md:rounded-[30px] px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-6 sm:px-6 md:px-8 md:py-6"'),
    ('<div className="relative z-10">', '<div className="it-calendar-layout relative z-10 min-h-full">'),
    ('<div className="flex items-center justify-between text-white mb-6">', '<div className="it-calendar-topbar flex items-center justify-between text-white mb-4 sm:mb-5">'),
    ('<div className="text-center px-2">', '<div className="it-calendar-hero text-center px-1 sm:px-2">'),
    ('<div className="grid grid-cols-2 gap-3 sm:gap-4 mt-6 max-w-lg mx-auto">', '<div className="it-calendar-day-controls grid grid-cols-2 gap-2.5 sm:gap-4 mt-4 sm:mt-5 max-w-lg mx-auto">'),
    ('<div className="text-center mt-10 mb-1">', '<div className="it-calendar-focus text-center mt-6 sm:mt-8 mb-0">'),
    ('<div className="relative mt-1">', '<div className="it-calendar-dial relative mt-0">'),
    ('<div className="grid grid-cols-3 gap-3 max-w-xl mx-auto -mt-4 sm:-mt-7">', '<div className="it-calendar-actions grid grid-cols-3 gap-2 sm:gap-3 max-w-xl mx-auto -mt-5 sm:-mt-8">'),
]
for old, new in replacements:
    replace_once(old, new, 'Calendar responsive structure')

# Forms and schedule become bottom sheets on iPhone and a side panel on laptops.
text = text.replace(
    '<section className="rounded-[26px] p-5 sm:p-6"',
    '<section className="it-calendar-sheet rounded-t-[28px] md:rounded-[26px] p-5 sm:p-6"',
    2,
)

# Add the dedicated laptop and iPhone sizing rules inside CalendarView.
calendar_start = text.find('function CalendarView(')
calendar_end = text.find('/* ─── Attendance View', calendar_start)
if calendar_start < 0 or calendar_end < 0:
    raise RuntimeError('Could not locate CalendarView after redesign.')

return_marker = '  return (\n    <div className="it-calendar-stage w-full min-h-full">'
style_block = r'''  return (
    <>
      <style>{`
        .it-calendar-main {
          overscroll-behavior: contain;
          scrollbar-width: thin;
        }
        .it-calendar-stage {
          --calendar-safe-bottom: calc(4.75rem + env(safe-area-inset-bottom));
          min-height: 100%;
        }
        .it-calendar-shell {
          isolation: isolate;
        }
        .it-calendar-dial svg {
          width: min(100%, 620px);
          max-height: min(55svh, 620px);
        }
        .it-calendar-sheet {
          animation: calendarSheetEnter 0.28s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes calendarSheetEnter {
          from { opacity:0; transform:translateY(18px) scale(0.985); }
          to { opacity:1; transform:translateY(0) scale(1); }
        }

        /* iPhone 17 Pro and similar modern phone viewports */
        @media (max-width: 430px) {
          .it-calendar-main {
            height: 100svh;
          }
          .it-calendar-shell {
            min-height: calc(100svh - var(--calendar-safe-bottom));
            padding-left: max(0.9rem, env(safe-area-inset-left));
            padding-right: max(0.9rem, env(safe-area-inset-right));
            padding-top: max(0.85rem, env(safe-area-inset-top));
            padding-bottom: 1rem;
          }
          .it-calendar-topbar {
            margin-bottom: 0.55rem;
          }
          .it-calendar-topbar > button {
            width: 2.35rem !important;
            height: 2.35rem !important;
          }
          .it-calendar-hero h2 {
            font-size: clamp(2.65rem, 13vw, 3.45rem) !important;
            line-height: 0.92 !important;
          }
          .it-calendar-hero > p {
            max-width: 20rem;
            margin-left: auto;
            margin-right: auto;
          }
          .it-calendar-hero input[type="date"] {
            height: 2.25rem;
            width: 9.3rem !important;
            padding-top: 0.35rem;
            padding-bottom: 0.35rem;
          }
          .it-calendar-day-controls button {
            min-height: 3.15rem;
            padding-top: 0.65rem !important;
            padding-bottom: 0.65rem !important;
            border-radius: 1.15rem !important;
          }
          .it-calendar-focus {
            margin-top: 1rem !important;
          }
          .it-calendar-focus p:nth-child(2) {
            font-size: 2.65rem !important;
          }
          .it-calendar-dial {
            margin-top: -0.45rem !important;
          }
          .it-calendar-dial svg {
            width: min(94vw, 390px);
            max-height: 40svh;
            overflow: visible;
          }
          .it-calendar-actions {
            position: relative;
            z-index: 2;
            margin-top: -2rem !important;
            padding: 0 0.25rem;
          }
          .it-calendar-actions > button > span {
            width: 2.65rem !important;
            height: 2.65rem !important;
          }
          .it-calendar-actions > button {
            gap: 0.35rem !important;
            font-size: 0.62rem !important;
          }
          .it-calendar-sheet {
            position: fixed;
            z-index: 80;
            left: max(0.5rem, env(safe-area-inset-left));
            right: max(0.5rem, env(safe-area-inset-right));
            bottom: calc(var(--calendar-safe-bottom) - 0.2rem);
            max-height: min(72svh, 680px);
            overflow-y: auto;
            overscroll-behavior: contain;
            box-shadow: 0 -20px 70px rgba(0,0,0,0.42) !important;
          }
        }

        /* Laptop workspace: use the full pane and separate content from the dial */
        @media (min-width: 768px) {
          .it-calendar-main {
            height: 100dvh;
            padding: 0.8rem !important;
          }
          .it-calendar-stage {
            display: grid;
            grid-template-columns: minmax(0,1fr);
            gap: 0.8rem;
          }
          .it-calendar-shell {
            min-height: calc(100dvh - 1.6rem) !important;
          }
          .it-calendar-layout {
            display: grid;
            grid-template-columns: minmax(280px,0.82fr) minmax(400px,1.18fr);
            grid-template-rows: auto auto auto minmax(0,1fr) auto;
            column-gap: clamp(1rem,3vw,3rem);
            align-items: center;
          }
          .it-calendar-topbar {
            grid-column: 1 / -1;
            grid-row: 1;
          }
          .it-calendar-hero {
            grid-column: 1;
            grid-row: 2;
            align-self: end;
          }
          .it-calendar-day-controls {
            grid-column: 1;
            grid-row: 3;
            width: 100%;
            max-width: none !important;
          }
          .it-calendar-focus {
            grid-column: 1;
            grid-row: 4;
            align-self: center;
            margin-top: 0 !important;
          }
          .it-calendar-dial {
            grid-column: 2;
            grid-row: 2 / 5;
            align-self: center;
            margin: 0 !important;
            min-width: 0;
          }
          .it-calendar-dial svg {
            width: min(100%, calc(100dvh - 10rem));
            max-width: 670px;
            max-height: calc(100dvh - 9.5rem);
          }
          .it-calendar-actions {
            grid-column: 2;
            grid-row: 5;
            width: min(100%, 560px);
            margin-top: -2rem !important;
          }
          .it-calendar-stage:has(.it-calendar-sheet) {
            grid-template-columns: minmax(0,1fr) minmax(310px,370px);
          }
          .it-calendar-stage:has(.it-calendar-sheet) .it-calendar-shell {
            min-width: 0;
          }
          .it-calendar-sheet {
            align-self: stretch;
            max-height: calc(100dvh - 1.6rem);
            overflow-y: auto;
            overscroll-behavior: contain;
          }
        }

        @media (min-width: 1440px) {
          .it-calendar-main {
            padding: 1rem !important;
          }
          .it-calendar-shell {
            min-height: calc(100dvh - 2rem) !important;
          }
          .it-calendar-layout {
            grid-template-columns: minmax(340px,0.78fr) minmax(520px,1.22fr);
            column-gap: clamp(2rem,4vw,5rem);
          }
          .it-calendar-hero h2 {
            font-size: clamp(4.5rem,6vw,6.5rem) !important;
          }
        }
      `}</style>
      <div className="it-calendar-stage w-full min-h-full">'''

calendar_segment = text[calendar_start:calendar_end]
if return_marker not in calendar_segment:
    raise RuntimeError('Could not find Calendar return root for CSS insertion.')
calendar_segment = calendar_segment.replace(return_marker, style_block, 1)

# Close the responsive fragment at the end of CalendarView.
close_marker = '    </div>\n  );\n}\n\n'
if close_marker not in calendar_segment:
    raise RuntimeError('Could not find CalendarView closing block.')
calendar_segment = calendar_segment.rsplit(close_marker, 1)[0] + '      </div>\n    </>\n  );\n}\n\n'

text = text[:calendar_start] + calendar_segment + text[calendar_end:]
path.write_text(text, encoding='utf-8')
print('Optimized Calendar as a full-screen laptop and iPhone 17 Pro workspace.')
