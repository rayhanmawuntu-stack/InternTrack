from pathlib import Path

file = Path("src/app/App.tsx")
source = file.read_text(encoding="utf-8")

if "ScrollableMonthCalendar" in source:
    print("Month calendar already installed")
    raise SystemExit(0)

source = source.replace(
    'import ReportEntryForms from "./ReportEntryForms";\n',
    'import ReportEntryForms from "./ReportEntryForms";\nimport ScrollableMonthCalendar from "./ScrollableMonthCalendar";\n',
    1,
)

calendar_start = source.find("function CalendarView(")
calendar_end = source.find("/* ─── Attendance View", calendar_start)
calendar = source[calendar_start:calendar_end]

actions = calendar.find('          <div className="it-calendar-actions')
marker = '          </div>\n        </div>\n      </section>'
insert_at = calendar.find(marker, actions)
if actions < 0 or insert_at < 0:
    raise RuntimeError("Calendar action area not found")
insert_at += len('          </div>\n')

component = '''
          <ScrollableMonthCalendar
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

calendar = calendar[:insert_at] + component + calendar[insert_at:]
source = source[:calendar_start] + calendar + source[calendar_end:]
file.write_text(source, encoding="utf-8")
print("Month calendar added below radial dial")
