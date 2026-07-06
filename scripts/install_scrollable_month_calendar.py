from pathlib import Path

path = Path('src/app/App.tsx')
text = path.read_text(encoding='utf-8')

if 'ScrollableMonthCalendar' in text:
    print('Scrollable full-month Calendar is already installed.')
    raise SystemExit(0)

import_anchor = 'import ReportEntryForms from "./ReportEntryForms";\n'
if import_anchor not in text:
    raise RuntimeError('Could not locate ReportEntryForms import.')
text = text.replace(
    import_anchor,
    import_anchor + 'import ScrollableMonthCalendar from "./ScrollableMonthCalendar";\n',
    1,
)

calendar_start = text.find('function CalendarView(')
calendar_end = text.find('/* ─── Attendance View', calendar_start)
if calendar_start < 0 or calendar_end < 0:
    raise RuntimeError('Could not locate CalendarView.')
calendar = text[calendar_start:calendar_end]

start_marker = '          <div className="it-calendar-hero'
start = calendar.find(start_marker)
if start < 0:
    raise RuntimeError('Could not locate Calendar hero block.')

actions_marker = '          <div className="it-calendar-actions'
actions = calendar.find(actions_marker, start)
if actions < 0:
    raise RuntimeError('Could not locate Calendar actions block.')

end_marker = '          </div>\n        </div>\n      </section>'
end = calendar.find(end_marker, actions)
if end < 0:
    raise RuntimeError('Could not locate the end of the Calendar actions block.')
end += len('          </div>\n')

replacement = '''          <ScrollableMonthCalendar
            selectedDate={selDate}
            todayDate={todayStr}
            events={events}
            holidays={holidays}
            refreshing={refreshingCalendar}
            listOpen={showList}
            onSelectDate={(date) => {
              setSelDate(date);
              setSelEv(null);
              setShowForm(false);
              setCalendarError("");
              setCalendarMessage("");
            }}
            onSelectEvent={(id, date) => {
              setSelDate(date);
              setSelEv(id);
              setShowList(true);
            }}
            onAddEvent={() => {
              setShowForm(true);
              setShowList(false);
              setCalendarError("");
            }}
            onRefresh={refreshCalendarData}
            onToggleList={() => setShowList(value => !value)}
          />
'''

calendar = calendar[:start] + replacement + calendar[end:]
text = text[:calendar_start] + calendar + text[calendar_end:]
path.write_text(text, encoding='utf-8')
print('Replaced the radial Calendar interface with a scrollable full-month view.')
