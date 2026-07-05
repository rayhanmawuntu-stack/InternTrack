import { useState } from "react";

export type ReportActivityEntry = {
  id: string;
  title: string;
  description: string;
  time: string;
  color: "green" | "blue" | "amber" | "violet";
};

export type ReportAttendanceRecord = {
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  type?: "present" | "late" | "wfh" | "absent";
};

type Props = {
  reportMonth: string;
  onAddActivity: (entry: ReportActivityEntry) => void;
  onSaveAttendance: (record: ReportAttendanceRecord) => void;
};

const COLORS = {
  green: "#22c55e",
  blue: "#3b82f6",
  amber: "#f59e0b",
  violet: "#8b5cf6",
} as const;

const inputClass = "w-full px-3.5 py-2.5 rounded-xl text-sm text-[#3d0a20] outline-none placeholder:text-pink-300/60";
const inputStyle = { background:"rgba(255,255,255,0.22)", border:"1px solid rgba(255,255,255,0.42)" };
const panelStyle = { background:"rgba(255,255,255,0.22)", border:"1px solid rgba(255,255,255,0.40)", boxShadow:"0 6px 40px rgba(180,30,80,0.10)" };

const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const id = () => Math.random().toString(36).slice(2, 9);

function toIso(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

export default function ReportEntryForms({ reportMonth, onAddActivity, onSaveAttendance }: Props) {
  const today = localDateKey(new Date());
  const defaultDate = reportMonth === today.slice(0, 7) ? today : `${reportMonth}-01`;
  const [active, setActive] = useState<"activity"|"attendance"|null>(null);
  const [message, setMessage] = useState("");
  const [activity, setActivity] = useState({ date:defaultDate, time:"17:00", title:"", description:"", color:"blue" as ReportActivityEntry["color"] });
  const [attendance, setAttendance] = useState({ date:defaultDate, type:"present" as NonNullable<ReportAttendanceRecord["type"]>, clockIn:"08:00", clockOut:"17:00" });

  function toggle(kind: "activity"|"attendance") {
    setMessage("");
    setActive(current => current === kind ? null : kind);
    if (kind === "activity") setActivity(current => ({ ...current, date:defaultDate }));
    else setAttendance(current => ({ ...current, date:defaultDate }));
  }

  function submitActivity(event: React.FormEvent) {
    event.preventDefault();
    if (!activity.date || !activity.time || !activity.title.trim()) {
      setMessage("Date, time, and activity title are required.");
      return;
    }
    if (activity.date > today) {
      setMessage("Activity date cannot be in the future.");
      return;
    }
    onAddActivity({ id:id(), title:activity.title.trim(), description:activity.description.trim(), time:toIso(activity.date, activity.time), color:activity.color });
    setActivity(current => ({ ...current, title:"", description:"" }));
    setMessage("Activity saved to Google Sheets.");
    setActive(null);
  }

  function submitAttendance(event: React.FormEvent) {
    event.preventDefault();
    if (!attendance.date) {
      setMessage("Attendance date is required.");
      return;
    }
    if (attendance.date > today) {
      setMessage("Attendance date cannot be in the future.");
      return;
    }
    const absent = attendance.type === "absent";
    if (!absent && (!attendance.clockIn || !attendance.clockOut)) {
      setMessage("Clock-in and clock-out are required.");
      return;
    }
    const clockIn = absent ? null : toIso(attendance.date, attendance.clockIn);
    const clockOut = absent ? null : toIso(attendance.date, attendance.clockOut);
    if (clockIn && clockOut && new Date(clockOut).getTime() <= new Date(clockIn).getTime()) {
      setMessage("Clock-out must be later than clock-in.");
      return;
    }
    onSaveAttendance({ date:attendance.date, clockIn, clockOut, type:attendance.type });
    setMessage("Past attendance saved to Google Sheets.");
    setActive(null);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onClick={() => toggle("activity")} className="px-4 py-3 rounded-2xl text-sm font-semibold transition-all" style={active === "activity" ? { background:"linear-gradient(135deg,#f472b6,#e11d48)", color:"white" } : { ...panelStyle, color:"#be185d" }}>+ Add Activity</button>
        <button onClick={() => toggle("attendance")} className="px-4 py-3 rounded-2xl text-sm font-semibold transition-all" style={active === "attendance" ? { background:"linear-gradient(135deg,#a78bfa,#7c3aed)", color:"white" } : { ...panelStyle, color:"#7c3aed" }}>Log Past Attendance</button>
      </div>

      {message && <div className="rounded-xl px-4 py-3 text-xs font-medium" style={{ background:message.includes("saved") ? "rgba(52,211,153,0.18)" : "rgba(251,113,133,0.18)", color:message.includes("saved") ? "#047857" : "#be123c", border:"1px solid rgba(255,255,255,0.35)" }}>{message}</div>}

      {active === "activity" && (
        <form onSubmit={submitActivity} className="rounded-2xl p-5 space-y-3" style={panelStyle}>
          <div><p className="font-bold text-sm text-[#3d0a20]">Add Activity</p><p className="text-[11px] text-[#3d0a20]/50">Choose the date so it appears on the correct monthly report row.</p></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="date" max={today} value={activity.date} onChange={event => setActivity(current => ({ ...current, date:event.target.value }))} className={inputClass} style={inputStyle} />
            <input type="time" value={activity.time} onChange={event => setActivity(current => ({ ...current, time:event.target.value }))} className={inputClass} style={inputStyle} />
          </div>
          <input value={activity.title} onChange={event => setActivity(current => ({ ...current, title:event.target.value }))} placeholder="Activity title" className={inputClass} style={inputStyle} />
          <textarea rows={3} value={activity.description} onChange={event => setActivity(current => ({ ...current, description:event.target.value }))} placeholder="Description (optional)" className={`${inputClass} resize-none`} style={inputStyle} />
          <div className="flex gap-2">{(Object.keys(COLORS) as ReportActivityEntry["color"][]).map(color => <button type="button" key={color} onClick={() => setActivity(current => ({ ...current, color }))} className="w-8 h-8 rounded-full" style={{ background:COLORS[color], outline:activity.color === color ? `3px solid ${COLORS[color]}` : "none", outlineOffset:2 }} />)}</div>
          <button type="submit" className="w-full py-3 rounded-xl text-sm font-bold text-white" style={{ background:"linear-gradient(135deg,#f472b6,#e11d48)" }}>Save Activity</button>
        </form>
      )}

      {active === "attendance" && (
        <form onSubmit={submitAttendance} className="rounded-2xl p-5 space-y-3" style={panelStyle}>
          <div><p className="font-bold text-sm text-[#3d0a20]">Log Past Attendance</p><p className="text-[11px] text-[#3d0a20]/50">An existing record on the same date will be replaced.</p></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="date" max={today} value={attendance.date} onChange={event => setAttendance(current => ({ ...current, date:event.target.value }))} className={inputClass} style={inputStyle} />
            <select value={attendance.type} onChange={event => setAttendance(current => ({ ...current, type:event.target.value as NonNullable<ReportAttendanceRecord["type"]> }))} className={inputClass} style={inputStyle}><option value="present">Present</option><option value="late">Late</option><option value="wfh">Work From Home</option><option value="absent">Leave / Absent</option></select>
          </div>
          {attendance.type !== "absent" && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><input type="time" value={attendance.clockIn} onChange={event => setAttendance(current => ({ ...current, clockIn:event.target.value }))} className={inputClass} style={inputStyle} /><input type="time" value={attendance.clockOut} onChange={event => setAttendance(current => ({ ...current, clockOut:event.target.value }))} className={inputClass} style={inputStyle} /></div>}
          <button type="submit" className="w-full py-3 rounded-xl text-sm font-bold text-white" style={{ background:"linear-gradient(135deg,#a78bfa,#7c3aed)" }}>Save Past Attendance</button>
        </form>
      )}
    </div>
  );
}
