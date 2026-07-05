from pathlib import Path

path = Path('src/app/App.tsx')
text = path.read_text(encoding='utf-8')

if 'ReportEntryForms' in text and 'saveReportAttendance' in text:
    print('Report entry forms are already integrated.')
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str):
    global text
    if old not in text:
        raise RuntimeError(f'Missing source block: {label}')
    text = text.replace(old, new, 1)

replace_once(
    'import autoTable from "jspdf-autotable";\n',
    'import autoTable from "jspdf-autotable";\nimport ReportEntryForms from "./ReportEntryForms";\n',
    'form import',
)

replace_once(
    '''  function addActivity() {\n    if (!actInput.trim()) return;\n    setActivities(p => [...p, { id:uid(), title:actInput.trim(), description:actDesc.trim(), time:new Date().toISOString(), color:actColor }]);\n    setActInput(""); setActDesc(""); setShowActForm(false);\n  }''',
    '''  function addActivity() {\n    if (!actInput.trim()) return;\n    setActivities(p => [...p, { id:uid(), title:actInput.trim(), description:actDesc.trim(), time:new Date().toISOString(), color:actColor }]);\n    setActInput(""); setActDesc(""); setShowActForm(false);\n  }\n\n  function addReportActivity(entry: ActivityEntry) {\n    setActivities(previous => [...previous, entry].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()));\n  }\n\n  function saveReportAttendance(record: AttRecord) {\n    if (!user) return;\n    const next = [...LS.att(user.id).filter(item => item.date !== record.date), record]\n      .sort((a, b) => a.date.localeCompare(b.date));\n    LS.saveAtt(user.id, next);\n    setCloudRevision(value => value + 1);\n    if (record.date === localDateKey(new Date())) restoreClockState(user.id);\n    void STORE.syncNow().catch(error => console.error("Past attendance sync failed.", error));\n  }''',
    'save callbacks',
)

replace_once(
    '{navTab === "reports"    && <ReportsView user={user} activities={activities} attRecords={LS.att(user.id)} />}',
    '{navTab === "reports"    && <ReportsView user={user} activities={activities} attRecords={LS.att(user.id)} onAddActivity={addReportActivity} onSaveAttendance={saveReportAttendance} />}',
    'reports route',
)

replace_once(
    'function ReportsView({ user, activities, attRecords }: { user:User; activities:ActivityEntry[]; attRecords:AttRecord[] }) {',
    'function ReportsView({ user, activities, attRecords, onAddActivity, onSaveAttendance }: { user:User; activities:ActivityEntry[]; attRecords:AttRecord[]; onAddActivity:(entry:ActivityEntry)=>void; onSaveAttendance:(record:AttRecord)=>void }) {',
    'reports props',
)

replace_once(
    '''      {!hasData ? (\n        <GlassCard>''',
    '''      <ReportEntryForms reportMonth={reportMonth} onAddActivity={onAddActivity} onSaveAttendance={onSaveAttendance} />\n\n      {!hasData ? (\n        <GlassCard>''',
    'forms placement',
)

path.write_text(text, encoding='utf-8')
print('Integrated report entry forms into InternTrack.')
