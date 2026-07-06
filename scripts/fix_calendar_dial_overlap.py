from pathlib import Path

path = Path('src/app/App.tsx')
text = path.read_text(encoding='utf-8')

if 'calendarDialFitFix' in text:
    print('Calendar dial fit fix is already applied.')
    raise SystemExit(0)

calendar_start = text.find('function CalendarView(')
calendar_end = text.find('/* ─── Attendance View', calendar_start)
if calendar_start < 0 or calendar_end < 0:
    raise RuntimeError('Could not locate CalendarView.')

calendar = text[calendar_start:calendar_end]
style_close = '      `}</style>'
if style_close not in calendar:
    raise RuntimeError('Could not locate Calendar responsive style block.')

fit_css = r'''
        /* calendarDialFitFix */
        .it-calendar-layout {
          min-height:0;
        }
        .it-calendar-dial {
          min-width:0;
          min-height:0;
          display:flex;
          align-items:center;
          justify-content:center;
          overflow:visible;
          padding:0.3rem 0;
        }
        .it-calendar-dial svg {
          display:block;
          flex:0 0 auto;
          aspect-ratio:1 / 1;
          object-fit:contain;
          overflow:visible;
        }
        .it-calendar-actions {
          margin-top:0 !important;
          padding-top:0.35rem;
          flex-shrink:0;
        }

        @media (max-width: 767px) {
          .it-calendar-layout {
            gap:0;
          }
          .it-calendar-dial {
            flex:1 1 auto;
            width:100%;
            padding:0.1rem 0 0.25rem;
            margin:0 !important;
          }
          .it-calendar-dial svg {
            width:min(92vw,38svh,390px) !important;
            height:min(92vw,38svh,390px) !important;
            max-width:100% !important;
            max-height:100% !important;
          }
          .it-calendar-actions {
            margin-top:0 !important;
            padding-top:0.25rem !important;
            padding-bottom:0.15rem !important;
          }
        }

        @media (max-width: 430px) and (max-height: 820px) {
          .it-calendar-dial svg {
            width:min(90vw,34svh,340px) !important;
            height:min(90vw,34svh,340px) !important;
          }
          .it-calendar-actions {
            padding-top:0.1rem !important;
          }
        }

        @media (min-width: 768px) {
          .it-calendar-layout {
            grid-template-rows:auto auto auto minmax(0,1fr) auto;
          }
          .it-calendar-dial {
            margin:0 !important;
            padding:0.5rem 0;
          }
          .it-calendar-dial svg {
            width:min(44vw,calc(100dvh - 13rem),620px) !important;
            height:min(44vw,calc(100dvh - 13rem),620px) !important;
            max-width:100% !important;
            max-height:100% !important;
          }
          .it-calendar-actions {
            margin-top:0 !important;
            padding-top:0.5rem !important;
          }
        }

        @media (min-width: 1440px) {
          .it-calendar-dial svg {
            width:min(42vw,calc(100dvh - 13.5rem),660px) !important;
            height:min(42vw,calc(100dvh - 13.5rem),660px) !important;
          }
        }
'''

calendar = calendar.replace(style_close, fit_css + style_close, 1)
text = text[:calendar_start] + calendar + text[calendar_end:]
path.write_text(text, encoding='utf-8')
print('Fixed Calendar dial clipping and action-row overlap on phone and laptop.')
