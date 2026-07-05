from pathlib import Path

path = Path('src/app/App.tsx')
text = path.read_text(encoding='utf-8')

if 'Calendar data refreshed from Google Sheets.' in text:
    print('Calendar tab fix already applied.')
    raise SystemExit(0)


def swap(old, new, label):
    global text
    if old not in text:
        raise RuntimeError('Missing calendar source: ' + label)
    text = text.replace(old, new, 1)

swap(
'''  const [selEv, setSelEv]       = useState<string|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ title:"", startTime:"09:00", endTime:"10:00", color:EV_COLORS[0] });''',
'''  const [selEv, setSelEv]       = useState<string|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [calendarError, setCalendarError] = useState("");
  const [calendarMessage, setCalendarMessage] = useState("");
  const [refreshingCalendar, setRefreshingCalendar] = useState(false);
  const [form, setForm]         = useState({ title:"", startTime:"09:00", endTime:"10:00", color:EV_COLORS[0] });''',
'calendar state')

swap(
'''  // 7-day strip centered on today
  const strip = Array.from({ length:7 }, (_,i) => {
    const d = new Date(now); d.setDate(now.getDate() - 3 + i); return d;
  });''',
'''  const monthLabel = viewMonth.toLocaleDateString("en-US", { month:"long", year:"numeric" });
  const monthDayCount = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const strip = Array.from({ length:monthDayCount }, (_,i) =>
    new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1, 12, 0, 0)
  );''',
'month date strip')

swap(
'''  function addEvent() {
    if (!form.title.trim()) return;
    const [sh,sm] = form.startTime.split(":").map(Number);
    const [eh,em] = form.endTime.split(":").map(Number);
    setEvents(p => [...p, { id:uid(), title:form.title.trim(), date:selDate, startHour:sh+sm/60, endHour:eh+em/60, color:form.color }]);
    setShowForm(false); setForm({ title:"", startTime:"09:00", endTime:"10:00", color:EV_COLORS[0] });
  }''',
'''  function changeCalendarMonth(offset:number) {
    const next = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + offset, 1);
    setViewMonth(next);
    setSelDate(localDateKey(next));
    setSelEv(null);
    setShowForm(false);
    setCalendarError("");
  }

  function returnCalendarToToday() {
    const current = new Date(now.getFullYear(), now.getMonth(), 1);
    setViewMonth(current);
    setSelDate(todayStr);
    setSelEv(null);
    setShowForm(false);
  }

  async function refreshCalendarData() {
    setRefreshingCalendar(true);
    setCalendarMessage("");
    try {
      await STORE.refresh();
      setEvents(CAL_LS(user.id));
      setHolidays(LS.holidays());
      setCalendarMessage("Calendar data refreshed from Google Sheets.");
    } catch (error) {
      setCalendarMessage(error instanceof Error ? error.message : "Could not refresh calendar data.");
    } finally {
      setRefreshingCalendar(false);
    }
  }

  function addEvent() {
    setCalendarError("");
    if (!form.title.trim()) { setCalendarError("Event title is required."); return; }
    const [sh,sm] = form.startTime.split(":").map(Number);
    const [eh,em] = form.endTime.split(":").map(Number);
    const startHour = sh + sm / 60;
    const endHour = eh + em / 60;
    if (endHour <= startHour) { setCalendarError("End time must be later than start time."); return; }
    if (startHour < CLK_S || endHour > CLK_E) { setCalendarError("Events must be between 7:00 AM and 7:00 PM."); return; }
    setEvents(p => [...p, { id:uid(), title:form.title.trim(), date:selDate, startHour, endHour, color:form.color }]);
    setShowForm(false);
    setCalendarMessage("Event saved to Google Sheets.");
    setForm({ title:"", startTime:"09:00", endTime:"10:00", color:EV_COLORS[0] });
  }''',
'calendar controls and event validation')

swap(
'''        <button onClick={() => { setShowForm(true); setSelEv(null); }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold text-white transition-all hover:scale-105"
          style={{ background:"linear-gradient(135deg,#f472b6,#e11d48)", boxShadow:"0 4px 14px rgba(225,29,72,0.3)" }}>
          <Plus size={14} /> New Event
        </button>''',
'''        <div className="flex items-center gap-2">
          <button onClick={refreshCalendarData} disabled={refreshingCalendar}
            className="px-3 py-2.5 rounded-full text-xs font-semibold transition-all disabled:opacity-50"
            style={{ background:"rgba(255,255,255,0.24)", border:"1px solid rgba(255,255,255,0.42)", color:"#7c3aed" }}>
            {refreshingCalendar ? "Refreshing…" : "Refresh"}
          </button>
          <button onClick={() => { setShowForm(true); setSelEv(null); setCalendarError(""); }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold text-white transition-all hover:scale-105"
            style={{ background:"linear-gradient(135deg,#f472b6,#e11d48)", boxShadow:"0 4px 14px rgba(225,29,72,0.3)" }}>
            <Plus size={14} /> New Event
          </button>
        </div>''',
'calendar header actions')

swap(
'''      {dayHoliday && (
        <div className="flex items-start gap-3 rounded-2xl px-4 py-3"''',
'''      {calendarMessage && (
        <div className="rounded-xl px-4 py-2.5 text-xs font-medium"
          style={{ background:"rgba(255,255,255,0.22)", border:"1px solid rgba(255,255,255,0.38)", color:"rgba(61,10,32,0.65)" }}>
          {calendarMessage}
        </div>
      )}

      {dayHoliday && (
        <div className="flex items-start gap-3 rounded-2xl px-4 py-3"''',
'calendar feedback')

swap(
'''              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-semibold text-pink-400 uppercase tracking-widest">Color</span>''',
'''              {calendarError && <p className="text-xs font-medium" style={{ color:"#be123c" }}>{calendarError}</p>}
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-semibold text-pink-400 uppercase tracking-widest">Color</span>''',
'calendar form error')

swap(
'''      {/* ── Date strip ── */}
      <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth:"none" }}>''',
'''      {/* ── Month navigation and date strip ── */}
      <div className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5"
        style={{ background:"rgba(255,255,255,0.20)", border:"1px solid rgba(255,255,255,0.38)" }}>
        <button onClick={() => changeCalendarMonth(-1)} className="w-10 h-10 rounded-xl text-xl font-bold" style={{ color:"#be185d", background:"rgba(255,255,255,0.22)" }}>‹</button>
        <div className="text-center">
          <p className="text-sm font-bold text-[#3d0a20]">{monthLabel}</p>
          <button onClick={returnCalendarToToday} className="text-[10px] font-semibold uppercase tracking-widest mt-0.5" style={{ color:"#be185d" }}>Go to today</button>
        </div>
        <button onClick={() => changeCalendarMonth(1)} className="w-10 h-10 rounded-xl text-xl font-bold" style={{ color:"#be185d", background:"rgba(255,255,255,0.22)" }}>›</button>
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-2 snap-x" style={{ scrollbarWidth:"none" }}>''',
'month navigation')

text = text.replace(
'className="flex flex-col items-center gap-1 px-5 py-3 rounded-2xl shrink-0 transition-all hover:scale-[1.03]"',
'className="flex flex-col items-center gap-1 px-4 py-3 rounded-2xl shrink-0 transition-all hover:scale-[1.03] snap-start"',
1)

swap(
'''      </div>
    </div>
  );
}

/* ─── Attendance View''',
'''      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-[10px] font-semibold" style={{ color:"rgba(61,10,32,0.5)" }}>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background:"#7c3aed" }} /> National holiday</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background:"#10b981" }} /> Company leave</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background:"#e11d48" }} /> Calendar event</span>
      </div>
    </div>
  );
}

/* ─── Attendance View''',
'calendar legend')

path.write_text(text, encoding='utf-8')
print('Fixed Calendar tab navigation, refresh, validation, and holiday display.')
