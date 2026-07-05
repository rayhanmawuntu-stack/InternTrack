from pathlib import Path

file = Path("src/app/App.tsx")
source = file.read_text()

marker = "  const allUsers = LS.users();"
insert = "  const todayActivities = activities.filter(item => localDateKey(new Date(item.time)) === localDateKey(now));\n"
if insert not in source:
    source = source.replace(marker, insert + marker, 1)

source = source.replace('{activities.length} {activities.length === 1 ? "entry" : "entries"}', '{todayActivities.length} {todayActivities.length === 1 ? "entry" : "entries"}', 1)
source = source.replace('{activities.length === 0\n                  ? <div className="h-full flex items-center justify-center">', '{todayActivities.length === 0\n                  ? <div className="h-full flex items-center justify-center">', 1)
source = source.replace(': activities.map(a => (', ': todayActivities.map(a => (', 1)
source = source.replace('{activities.length} {activities.length === 1 ? "activity" : "activities"} logged today', '{todayActivities.length} {todayActivities.length === 1 ? "activity" : "activities"} logged today', 1)

file.write_text(source)
print("Today activity filter applied")
