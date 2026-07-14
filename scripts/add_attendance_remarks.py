from pathlib import Path

path = Path("src/app/App.tsx")
source = path.read_text(encoding="utf-8")

if "attendanceRemarksV1" in source:
    print("Attendance remarks are already installed.")
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str) -> None:
    global source
    if old not in source:
        raise RuntimeError(f"Could not find expected source for {label}.")
    source = source.replace(old, new, 1)


def replace_first(options: list[str], new: str, label: str) -> None:
    global source
    for old in options:
        if old in source:
            source = source.replace(old, new, 1)
            return
    raise RuntimeError(f"Could not find any expected source for {label}.")


replace_once(
    'type AttRecord = { date: string; clockIn: string | null; clockOut: string | null; type?: "present" | "late" | "wfh" | "absent"; };',
    'type AttRecord = { date: string; clockIn: string | null; clockOut: string | null; type?: "present" | "late" | "wfh" | "absent"; remarks?: string; }; // attendanceRemarksV1',
    "attendance record type",
)

replace_once(
    '''    clockOut: "18:00",
    type: "present" as "present"|"late"|"wfh"|"absent",
  });''',
    '''    clockOut: "18:00",
    type: "present" as "present"|"late"|"wfh"|"absent",
    remarks: "",
  });''',
    "attendance form state",
)

replace_once(
    '    const { date, clockIn, clockOut, type } = logForm;',
    '    const { date, clockIn, clockOut, type, remarks } = logForm;',
    "attendance save destructuring",
)

replace_once(
    '''      clockOut: type === "absent" ? null : coDate.toISOString(),
      type,
    });''',
    '''      clockOut: type === "absent" ? null : coDate.toISOString(),
      type,
      remarks: remarks.trim() || undefined,
    });''',
    "attendance saved record",
)

replace_first(
    [
        '''    return { date:d, status, holiday, clockIn: rec?.clockIn ? fmt12(new Date(rec.clockIn)) : "—", clockOut: rec?.clockOut ? fmt12(new Date(rec.clockOut)) : "—" };''',
        '''    return { date:d, status, clockIn: rec?.clockIn ? fmt12(new Date(rec.clockIn)) : "—", clockOut: rec?.clockOut ? fmt12(new Date(rec.clockOut)) : "—" };''',
    ],
    '''    return {
      date:d,
      status,
      holiday: holidays.find(item => item.date === iso) ?? null,
      clockIn: rec?.clockIn ? fmt12(new Date(rec.clockIn)) : "—",
      clockOut: rec?.clockOut ? fmt12(new Date(rec.clockOut)) : "—",
      remarks: rec?.remarks || "",
    };''',
    "attendance display records",
)

replace_once(
    '''              onClick={() => { setShowLogForm(v => !v); setLogError(""); }}''',
    '''              onClick={() => {
                if (!showLogForm) {
                  const previousDay = new Date(now);
                  previousDay.setDate(previousDay.getDate() - 1);
                  setLogForm({
                    date:localDateKey(previousDay),
                    clockIn:"09:00",
                    clockOut:"18:00",
                    type:"present",
                    remarks:"",
                  });
                }
                setShowLogForm(v => !v);
                setLogError("");
              }}''',
    "new attendance form button",
)

replace_once(
    '''                </>)}
              </div>

              {logError && (''',
    '''                </>)}
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold text-pink-400 uppercase tracking-widest">Remarks</label>
                  <span className="text-[9px] tabular-nums" style={{ color:"rgba(61,10,32,0.34)" }}>{logForm.remarks.length}/300</span>
                </div>
                <textarea
                  value={logForm.remarks}
                  maxLength={300}
                  rows={3}
                  onChange={event => setLogForm(previous => ({ ...previous, remarks:event.target.value }))}
                  placeholder="Add an optional note, reason, location, or other attendance detail…"
                  className={`${inputCls} resize-none leading-relaxed`}
                  style={glassInput}
                />
              </div>

              {logError && (''',
    "attendance remarks input",
)

replace_once(
    '''                      </div>
                    </div>
                    {/* Edit shortcut: click to pre-fill form */}''',
    '''                      </div>
                      {r.remarks && (
                        <p className="mt-1 text-[11px] leading-snug break-words" style={{ color:"rgba(61,10,32,0.56)" }}>
                          {r.remarks}
                        </p>
                      )}
                    </div>
                    {/* Edit shortcut: click to pre-fill form */}''',
    "attendance remarks list display",
)

replace_first(
    [
        '''                          type: ["future","holiday","nationalHoliday","companyHoliday"].includes(r.status) ? "present" : r.status as typeof logForm.type,
                        });''',
        '''                          type: r.status === "future" || r.status === "holiday" ? "present" : r.status as typeof logForm.type,
                        });''',
    ],
    '''                          type: ["future","holiday","nationalHoliday","companyHoliday"].includes(r.status) ? "present" : r.status as typeof logForm.type,
                          remarks: rec?.remarks || "",
                        });''',
    "attendance edit form",
)

replace_once(
    '''      let specialLabel = "";
      let remarks = record?.type === "wfh" ? "WFH" : record?.type === "late" ? "LATE" : "";
      let activityText = dayActivities;

      if (record?.type === "absent") {
        specialLabel = activityText ? `LEAVE OF ABSENCE (${activityText})` : "LEAVE OF ABSENCE";''',
    '''      let specialLabel = "";
      const enteredRemark = String(record?.remarks || "").trim();
      const typeRemark = record?.type === "wfh" ? "WFH" : record?.type === "late" ? "LATE" : "";
      let remarks = [typeRemark, enteredRemark].filter(Boolean).join(" - ");
      let activityText = dayActivities;

      if (record?.type === "absent") {
        const absenceDetail = enteredRemark || activityText;
        specialLabel = absenceDetail ? `LEAVE OF ABSENCE (${absenceDetail})` : "LEAVE OF ABSENCE";''',
    "monthly PDF remarks",
)

source = source.replace(
    'title={holiday ? `${m.label}: ${holiday.title}` : m.label}',
    'title={holiday ? `${m.label}: ${holiday.title}` : r.remarks ? `${m.label}: ${r.remarks}` : m.label}',
    1,
)

path.write_text(source, encoding="utf-8")
print("Added optional remarks to Attendance records and monthly PDF exports.")
