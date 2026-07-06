from pathlib import Path

app_path = Path("src/app/App.tsx")
source = app_path.read_text(encoding="utf-8")

if "mergeCalendarHolidays" in source:
    print("Holiday merge helper already enabled.")
    raise SystemExit(0)

store_import = 'import { STORE } from "../lib/cloudStore";\n'
if store_import not in source:
    raise RuntimeError("cloudStore import was not found")
source = source.replace(
    store_import,
    store_import + 'import { mergeCalendarHolidays } from "../lib/holidayCatalog";\n',
    1,
)

current_reader = '  holidays:   (): CalendarHoliday[] => { try { return JSON.parse(STORE.getItem("it_holidays_id") || "[]"); } catch { return []; } },'
replacement_reader = '''  holidays:   (): CalendarHoliday[] => {
    try {
      return mergeCalendarHolidays(JSON.parse(STORE.getItem("it_holidays_id") || "[]"));
    } catch {
      return mergeCalendarHolidays([]);
    }
  },'''
if current_reader not in source:
    raise RuntimeError("holiday reader was not found")
source = source.replace(current_reader, replacement_reader, 1)

app_path.write_text(source, encoding="utf-8")
print("Holiday dates are normalized before Calendar matching.")
