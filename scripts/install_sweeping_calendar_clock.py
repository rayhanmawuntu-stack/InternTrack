from pathlib import Path

path = Path('src/app/App.tsx')
text = path.read_text(encoding='utf-8')

if 'CalendarAnalogClock' in text:
    print('Sweeping Calendar analog clock is already installed.')
    raise SystemExit(0)

import_anchor = 'import ReportEntryForms from "./ReportEntryForms";\n'
if import_anchor not in text:
    raise RuntimeError('Could not locate the app component import anchor.')
text = text.replace(
    import_anchor,
    import_anchor + 'import CalendarAnalogClock from "./CalendarAnalogClock";\n',
    1,
)

calendar_start = text.find('function CalendarView(')
calendar_end = text.find('/* ─── Attendance View', calendar_start)
if calendar_start < 0 or calendar_end < 0:
    raise RuntimeError('Could not locate CalendarView.')
calendar = text[calendar_start:calendar_end]

old_numbers = '''              {[7,9,12,15,17,19].map(hour => {
                const [x, y] = pol(h2deg(hour), 148);
                return <text key={hour} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
                  fill="rgba(255,220,232,0.66)" fontSize={8.5} fontWeight={600}
                  style={{ fontFamily:"'DM Mono',monospace" }}>
                  {String(hour).padStart(2, "0")}
                </text>;
              })}'''
new_numbers = '''              {[7,9,12,15,17,19].map(hour => {
                const [x, y] = pol(h2deg(hour), 148);
                const displayHour = ((hour + 11) % 12) + 1;
                const suffix = hour < 12 ? "a" : "p";
                return <text key={hour} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
                  fill="rgba(255,220,232,0.66)" fontSize={7.8} fontWeight={700}
                  style={{ fontFamily:"'DM Mono',monospace" }}>
                  {displayHour}{suffix}
                </text>;
              })}'''
if old_numbers not in calendar:
    raise RuntimeError('Could not locate the Calendar ring hour labels.')
calendar = calendar.replace(old_numbers, new_numbers, 1)

center_start_marker = '              <circle cx={CX} cy={CY} r={65} fill="url(#calendarCenter)"'
center_start = calendar.find(center_start_marker)
center_end_marker = '              <text x={CX} y={CY + 91} textAnchor="middle" fill="rgba(249,168,212,0.70)" fontSize={18}>⌄</text>'
center_end = calendar.find(center_end_marker, center_start)
if center_start < 0 or center_end < 0:
    raise RuntimeError('Could not locate the existing Calendar center display.')
center_end += len(center_end_marker)

new_center = '''              <CalendarAnalogClock cx={CX} cy={CY} radius={63} />
              <text x={CX} y={CY + 88} textAnchor="middle" fill="rgba(255,220,232,0.72)" fontSize={8.2} fontWeight={700}
                style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", letterSpacing:"0.04em" }}>
                {monthLabel} {dateNumber} · {dayName.slice(0,3)}
              </text>'''
calendar = calendar[:center_start] + new_center + calendar[center_end:]

text = text[:calendar_start] + calendar + text[calendar_end:]
path.write_text(text, encoding='utf-8')
print('Installed correct 12-hour numerals and a continuously sweeping second hand.')
