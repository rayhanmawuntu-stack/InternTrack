from pathlib import Path

path = Path('src/app/App.tsx')
text = path.read_text(encoding='utf-8')

if 'calendarPersistentNavigation' in text:
    print('Persistent-navigation Calendar layout is already applied.')
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str):
    global text
    if old not in text:
        raise RuntimeError(f'Could not locate {label}.')
    text = text.replace(old, new, 1)


# Calendar keeps its own back control while the app navigation remains visible.
replace_once(
    '{navTab === "calendar"   && <CalendarView user={user} now={now} cloudRevision={cloudRevision} />}',
    '{navTab === "calendar"   && <CalendarView user={user} now={now} cloudRevision={cloudRevision} onClose={() => setNavTab("dashboard")} />}',
    'Calendar route',
)
replace_once(
    'function CalendarView({ user, now, cloudRevision }: { user:User; now:Date; cloudRevision:number }) {',
    'function CalendarView({ user, now, cloudRevision, onClose }: { user:User; now:Date; cloudRevision:number; onClose:()=>void }) {',
    'CalendarView signature',
)

old_left = '''            <button onClick={() => changeDay(-1)} aria-label="Previous day"
              className="w-10 h-10 rounded-full flex items-center justify-center text-2xl transition-all hover:scale-105"
              style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.14)" }}>
              ‹
            </button>'''
new_left = '''            <button onClick={onClose} aria-label="Back to dashboard"
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all hover:scale-105"
              style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.14)" }}>
              ←
            </button>'''
replace_once(old_left, new_left, 'Calendar back button')

old_right = '''            <button onClick={returnToToday} aria-label="Return to today"
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all hover:scale-105"
              style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.14)" }}>
              ×
            </button>'''
new_right = '''            <button onClick={returnToToday} aria-label="Return to today"
              className="h-10 px-3 rounded-full flex items-center justify-center text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105"
              style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.14)", color:"#f9a8d4" }}>
              Today
            </button>'''
replace_once(old_right, new_right, 'Calendar Today button')

calendar_start = text.find('function CalendarView(')
calendar_end = text.find('/* ─── Attendance View', calendar_start)
if calendar_start < 0 or calendar_end < 0:
    raise RuntimeError('Could not locate CalendarView for responsive CSS.')
calendar = text[calendar_start:calendar_end]

style_close = '      `}</style>'
if style_close not in calendar:
    raise RuntimeError('Could not locate responsive Calendar style block.')

mobile_overrides = r'''
        /* calendarPersistentNavigation */
        @media (max-width: 767px) {
          .it-calendar-main {
            position:relative;
            z-index:auto;
            width:100%;
            height:100%;
            min-height:0;
            padding:0 0 calc(5.25rem + env(safe-area-inset-bottom)) !important;
            overflow:hidden;
            background:#0c0c0e;
            box-sizing:border-box;
          }
          .it-calendar-stage,
          .it-calendar-shell,
          .it-calendar-layout {
            width:100%;
            height:100%;
            min-height:0 !important;
          }
          .it-calendar-stage {
            --calendar-safe-bottom: calc(5.25rem + env(safe-area-inset-bottom));
            display:block !important;
          }
          .it-calendar-shell {
            border:0 !important;
            border-radius:0 !important;
            padding-top:max(0.7rem,env(safe-area-inset-top)) !important;
            padding-right:max(0.85rem,env(safe-area-inset-right)) !important;
            padding-bottom:0.45rem !important;
            padding-left:max(0.85rem,env(safe-area-inset-left)) !important;
            box-shadow:none !important;
          }
          .it-calendar-layout {
            display:flex !important;
            flex-direction:column;
            overflow:hidden;
          }
          .it-calendar-topbar {
            flex:0 0 auto;
            margin-bottom:0.4rem !important;
          }
          .it-calendar-topbar > button:first-child {
            width:2.4rem !important;
            height:2.4rem !important;
          }
          .it-calendar-topbar > button:last-child {
            height:2.4rem !important;
          }
          .it-calendar-hero { flex:0 0 auto; }
          .it-calendar-hero h2 {
            font-size:clamp(2.5rem,12.5vw,3.35rem) !important;
            line-height:0.9 !important;
          }
          .it-calendar-hero button p {
            margin-top:0.45rem !important;
            font-size:0.9rem !important;
          }
          .it-calendar-hero > p {
            margin-top:0.4rem !important;
            font-size:0.68rem !important;
            line-height:1rem;
          }
          .it-calendar-hero > p:nth-of-type(2) { display:none; }
          .it-calendar-hero > div { margin-top:0.55rem !important; }
          .it-calendar-hero input[type="date"] {
            width:8.7rem !important;
            height:2rem !important;
            font-size:0.68rem !important;
            padding:0.2rem 0.65rem !important;
          }
          .it-calendar-day-controls {
            flex:0 0 auto;
            margin-top:0.55rem !important;
            gap:0.55rem !important;
          }
          .it-calendar-day-controls button {
            min-height:2.65rem !important;
            padding:0.45rem 0.65rem !important;
            border-radius:1rem !important;
            font-size:0.72rem !important;
          }
          .it-calendar-focus {
            flex:0 0 auto;
            margin-top:0.55rem !important;
          }
          .it-calendar-focus p:first-child,
          .it-calendar-focus p:last-of-type { font-size:0.64rem !important; }
          .it-calendar-focus p:nth-child(2) {
            font-size:2.25rem !important;
            margin-top:0.2rem !important;
          }
          .it-calendar-focus div { margin-top:0.15rem !important; }
          .it-calendar-dial {
            flex:1 1 auto;
            min-height:0;
            display:flex;
            align-items:center;
            justify-content:center;
            margin-top:-0.5rem !important;
            overflow:visible;
          }
          .it-calendar-dial svg {
            display:block;
            width:auto !important;
            height:100% !important;
            max-width:96vw !important;
            max-height:100% !important;
            overflow:visible;
          }
          .it-calendar-actions {
            flex:0 0 auto;
            width:100%;
            margin-top:-0.85rem !important;
            padding:0 0.2rem 0.1rem;
            position:relative;
            z-index:2;
          }
          .it-calendar-actions > button {
            gap:0.3rem !important;
            font-size:0.6rem !important;
          }
          .it-calendar-actions > button > span {
            width:2.5rem !important;
            height:2.5rem !important;
          }
          .it-calendar-sheet {
            position:fixed;
            z-index:90;
            left:max(0.45rem,env(safe-area-inset-left));
            right:max(0.45rem,env(safe-area-inset-right));
            bottom:calc(5.4rem + env(safe-area-inset-bottom));
            max-height:min(66svh,620px);
            overflow-y:auto;
            overscroll-behavior:contain;
            border-radius:1.5rem !important;
            box-shadow:0 -24px 80px rgba(0,0,0,0.55) !important;
          }
          .it-mobile-nav {
            display:block;
          }
        }

        @media (max-width: 430px) and (max-height: 820px) {
          .it-calendar-hero > p,
          .it-calendar-hero > div { display:none; }
          .it-calendar-focus p:first-child,
          .it-calendar-focus p:last-of-type,
          .it-calendar-focus div { display:none; }
          .it-calendar-focus p:nth-child(2) { font-size:1.9rem !important; }
          .it-calendar-day-controls { margin-top:0.4rem !important; }
          .it-calendar-dial { margin-top:-0.8rem !important; }
        }
'''
calendar = calendar.replace(style_close, mobile_overrides + style_close, 1)
text = text[:calendar_start] + calendar + text[calendar_end:]

path.write_text(text, encoding='utf-8')
print('Kept navigation persistent while preserving the full-screen Calendar layout.')
