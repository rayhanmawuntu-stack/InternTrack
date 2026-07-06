from pathlib import Path

path = Path("src/app/App.tsx")
source = path.read_text(encoding="utf-8")

if "attendanceHolidayKindsV1" in source:
    print("Attendance holiday markers are already installed.")
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str) -> None:
    global source
    if old not in source:
        raise RuntimeError(f"Could not find expected source for {label}.")
    source = source.replace(old, new, 1)


replace_once(
    '''type AttStatus = "present"|"absent"|"late"|"wfh"|"holiday"|"future";
const STATUS_META: Record<AttStatus,{label:string;color:string;bg:string;dot:string}> = {
  present: { label:"Present", color:"#059669", bg:"rgba(52,211,153,0.18)",  dot:"#22c55e" },
  late:    { label:"Late",    color:"#b45309", bg:"rgba(251,191,36,0.22)",  dot:"#f59e0b" },
  absent:  { label:"Absent",  color:"#be123c", bg:"rgba(251,113,133,0.22)", dot:"#fb7185" },
  wfh:     { label:"WFH",     color:"#1d4ed8", bg:"rgba(96,165,250,0.22)",  dot:"#60a5fa" },
  holiday: { label:"Holiday", color:"#7c3aed", bg:"rgba(167,139,250,0.22)", dot:"#a78bfa" },
  future:  { label:"—",       color:"rgba(61,10,32,0.3)", bg:"rgba(255,255,255,0.1)", dot:"rgba(255,255,255,0.3)" },
};''',
    '''// attendanceHolidayKindsV1: distinguish weekends, national holidays, and KSB leave.
type AttStatus = "present"|"absent"|"late"|"wfh"|"holiday"|"nationalHoliday"|"companyHoliday"|"future";
const STATUS_META: Record<AttStatus,{label:string;color:string;bg:string;dot:string}> = {
  present:         { label:"Present",          color:"#059669", bg:"rgba(52,211,153,0.18)",  dot:"#22c55e" },
  late:            { label:"Late",             color:"#b45309", bg:"rgba(251,191,36,0.22)",  dot:"#f59e0b" },
  absent:          { label:"Absent",           color:"#be123c", bg:"rgba(251,113,133,0.22)", dot:"#fb7185" },
  wfh:             { label:"WFH",              color:"#1d4ed8", bg:"rgba(96,165,250,0.22)",  dot:"#60a5fa" },
  holiday:         { label:"Weekend",          color:"#64748b", bg:"rgba(148,163,184,0.18)", dot:"#94a3b8" },
  nationalHoliday: { label:"National Holiday", color:"#7c3aed", bg:"rgba(167,139,250,0.24)", dot:"#a78bfa" },
  companyHoliday:  { label:"Company Holiday",  color:"#047857", bg:"rgba(16,185,129,0.22)",  dot:"#10b981" },
  future:          { label:"—",                color:"rgba(61,10,32,0.3)", bg:"rgba(255,255,255,0.1)", dot:"rgba(255,255,255,0.3)" },
};''',
    "attendance status metadata",
)

replace_once(
    '''  function statusForDate(d: Date): AttStatus {
    if (d > now && d.toDateString() !== now.toDateString()) return "future";
    const iso = localDateKey(d);
    if (holidays.some(h => h.date === iso)) return "holiday";
    const dow = d.getDay();''',
    '''  function statusForDate(d: Date): AttStatus {
    if (d > now && d.toDateString() !== now.toDateString()) return "future";
    const iso = localDateKey(d);
    const holiday = holidays.find(item => item.date === iso);
    if (holiday?.type === "company") return "companyHoliday";
    if (holiday) return "nationalHoliday";
    const dow = d.getDay();''',
    "attendance holiday status resolution",
)

replace_once(
    '''    const rec = attRecords.find(r => r.date === iso);
    return { date:d, status, clockIn: rec?.clockIn ? fmt12(new Date(rec.clockIn)) : "—", clockOut: rec?.clockOut ? fmt12(new Date(rec.clockOut)) : "—" };
  });

  const counts = records.reduce((a,r) => { if (r.status !== "future") a[r.status]=(a[r.status]||0)+1; return a; }, {} as Record<string,number>);
  const workdays = records.filter(r=>r.status!=="holiday"&&r.status!=="future").length;
  const present  = (counts["present"]||0)+(counts["wfh"]||0);
  const rate     = workdays > 0 ? Math.round((present/workdays)*100) : 0;
  const pastRecords = records.filter(r=>r.status!=="future"&&r.status!=="holiday").slice().reverse();''',
    '''    const rec = attRecords.find(r => r.date === iso);
    const holiday = holidays.find(item => item.date === iso) ?? null;
    return { date:d, status, holiday, clockIn: rec?.clockIn ? fmt12(new Date(rec.clockIn)) : "—", clockOut: rec?.clockOut ? fmt12(new Date(rec.clockOut)) : "—" };
  });

  const counts = records.reduce((a,r) => { if (r.status !== "future") a[r.status]=(a[r.status]||0)+1; return a; }, {} as Record<string,number>);
  const nonWorkingStatuses: AttStatus[] = ["holiday","nationalHoliday","companyHoliday","future"];
  const workdays = records.filter(r => !nonWorkingStatuses.includes(r.status)).length;
  const present  = (counts["present"]||0)+(counts["wfh"]||0);
  const rate     = workdays > 0 ? Math.round((present/workdays)*100) : 0;
  const pastRecords = records.filter(r => !nonWorkingStatuses.includes(r.status)).slice().reverse();''',
    "attendance records and calculations",
)

replace_once(
    '''            {records.map((r,i) => {
              const isToday = r.date.toDateString() === now.toDateString();
              const m = STATUS_META[r.status];
              const holiday = holidays.find(h => h.date === localDateKey(r.date));
              return (
                <div key={i} title={holiday ? holiday.title : undefined} className="aspect-square flex flex-col items-center justify-center rounded-xl transition-all"
                  style={r.status==="future" ? { background:"rgba(255,255,255,0.08)" } : isToday ? { background:"linear-gradient(135deg,#f472b6,#e11d48)", boxShadow:"0 2px 10px rgba(225,29,72,0.35)" } : { background:m.bg }}>
                  <span className="text-xs font-semibold leading-none" style={{ color: isToday?"#fff":r.status==="future"?"rgba(61,10,32,0.25)":m.color }}>{r.date.getDate()}</span>
                  {r.status !== "future" && !isToday && <span className="w-1 h-1 rounded-full mt-0.5" style={{ background:m.dot }} />}
                </div>
              );
            })}''',
    '''            {records.map((r,i) => {
              const isToday = r.date.toDateString() === now.toDateString();
              const m = STATUS_META[r.status];
              const holiday = r.holiday;
              const isCompanyHoliday = r.status === "companyHoliday";
              const isNationalHoliday = r.status === "nationalHoliday";
              const holidayBadge = isCompanyHoliday ? "KSB" : isNationalHoliday ? "LIBUR" : null;
              const cellStyle: React.CSSProperties = r.status === "future"
                ? { background:"rgba(255,255,255,0.08)" }
                : isCompanyHoliday
                  ? { background:"linear-gradient(135deg,rgba(52,211,153,0.30),rgba(16,185,129,0.18))", border:"1px solid rgba(16,185,129,0.36)", boxShadow:isToday?"0 0 0 2px rgba(255,255,255,0.72), 0 3px 14px rgba(16,185,129,0.30)":"0 2px 10px rgba(16,185,129,0.16)" }
                  : isNationalHoliday
                    ? { background:"linear-gradient(135deg,rgba(196,181,253,0.34),rgba(139,92,246,0.18))", border:"1px solid rgba(139,92,246,0.34)", boxShadow:isToday?"0 0 0 2px rgba(255,255,255,0.72), 0 3px 14px rgba(124,58,237,0.28)":"0 2px 10px rgba(124,58,237,0.14)" }
                    : isToday
                      ? { background:"linear-gradient(135deg,#f472b6,#e11d48)", boxShadow:"0 2px 10px rgba(225,29,72,0.35)" }
                      : { background:m.bg };
              return (
                <div key={i} title={holiday ? `${m.label}: ${holiday.title}` : m.label} className="aspect-square min-h-10 flex flex-col items-center justify-center rounded-xl transition-all"
                  style={cellStyle}>
                  <span className="text-xs font-semibold leading-none" style={{ color:isToday&&!holidayBadge?"#fff":r.status==="future"?"rgba(61,10,32,0.25)":m.color }}>{r.date.getDate()}</span>
                  {holidayBadge
                    ? <span className="mt-1 rounded-full px-1 py-0.5 text-[7px] font-black leading-none" style={{ background:isCompanyHoliday?"rgba(4,120,87,0.14)":"rgba(124,58,237,0.14)", color:m.color }}>{holidayBadge}</span>
                    : r.status !== "future" && !isToday
                      ? <span className="w-1 h-1 rounded-full mt-0.5" style={{ background:m.dot }} />
                      : null
                  }
                </div>
              );
            })}''',
    "attendance calendar cells",
)

replace_once(
    '''            {(["present","wfh","late","absent","holiday"] as AttStatus[]).map(s => (''',
    '''            {(["present","wfh","late","absent","holiday","nationalHoliday","companyHoliday"] as AttStatus[]).map(s => (''',
    "attendance legend",
)

replace_once(
    '''                          type: r.status === "future" || r.status === "holiday" ? "present" : r.status as typeof logForm.type,''',
    '''                          type: ["future","holiday","nationalHoliday","companyHoliday"].includes(r.status) ? "present" : r.status as typeof logForm.type,''',
    "attendance edit fallback",
)

path.write_text(source, encoding="utf-8")
print("Reflected national and company holidays in the Attendance calendar.")
