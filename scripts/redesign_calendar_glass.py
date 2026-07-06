from pathlib import Path

path = Path('src/app/App.tsx')
text = path.read_text(encoding='utf-8')

if 'it-calendar-stage' in text:
    print('Glassy pink Calendar redesign is already applied.')
    raise SystemExit(0)

start = text.find('function CalendarView(')
end = text.find('/* ─── Attendance View', start)
if start < 0 or end < 0:
    raise RuntimeError('Could not locate the CalendarView function boundaries.')

new_function = r'''function CalendarView({ user, now, cloudRevision }: { user:User; now:Date; cloudRevision:number }) {
  const todayStr = localDateKey(now);
  const [selDate, setSelDate] = useState(todayStr);
  const [events, setEvents] = useState<CalEvent[]>(() => CAL_LS(user.id));
  const [holidays, setHolidays] = useState<CalendarHoliday[]>(() => LS.holidays());
  const [selEv, setSelEv] = useState<string|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showList, setShowList] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [calendarMessage, setCalendarMessage] = useState("");
  const [refreshingCalendar, setRefreshingCalendar] = useState(false);
  const PINK_EVENT_COLORS = ["#f9a8d4", "#f472b6", "#fb7185", "#e11d48"];
  const [form, setForm] = useState({ title:"", startTime:"09:00", endTime:"10:00", color:PINK_EVENT_COLORS[1] });

  useEffect(() => {
    CAL_SAVE(user.id, events);
    void STORE.syncNow().catch(error => console.error("Calendar sync failed.", error));
  }, [events, user.id]);

  useEffect(() => {
    setEvents(CAL_LS(user.id));
    setHolidays(LS.holidays());
  }, [user.id, cloudRevision]);

  const selDateObj = new Date(selDate + "T12:00:00");
  const dayEvents = assignTracks(events.filter(event => event.date === selDate));
  const sortedDayEvents = [...dayEvents].sort((a, b) => a.startHour - b.startHour);
  const dayHoliday = holidays.find(holiday => holiday.date === selDate) ?? null;
  const isCompanyHoliday = dayHoliday?.type === "company";
  const selEvObj = selEv ? events.find(event => event.id === selEv) ?? null : null;
  const isToday = selDate === todayStr;
  const curH = now.getHours() + now.getMinutes() / 60;
  const nextEvent = sortedDayEvents.find(event => !isToday || event.endHour > curH) ?? sortedDayEvents[0] ?? null;
  const dayName = selDateObj.toLocaleDateString("en-US", { weekday:"long" });
  const monthLabel = selDateObj.toLocaleDateString("en-US", { month:"short" });
  const dateNumber = String(selDateObj.getDate()).padStart(2, "0");
  const summaryText = nextEvent
    ? `Next up: ${nextEvent.title} at ${fmtH(nextEvent.startHour)}`
    : dayHoliday
      ? dayHoliday.title
      : "No events scheduled yet.";
  const trackColors = ["#f9a8d4", "#f472b6", "#e11d48"];
  const glassInputSt: React.CSSProperties = {
    background:"rgba(255,255,255,0.10)",
    border:"1px solid rgba(255,255,255,0.20)",
    color:"white",
    colorScheme:"dark",
  };

  function changeDay(offset:number) {
    const next = new Date(selDateObj);
    next.setDate(next.getDate() + offset);
    setSelDate(localDateKey(next));
    setSelEv(null);
    setShowForm(false);
    setCalendarError("");
    setCalendarMessage("");
  }

  function returnToToday() {
    setSelDate(todayStr);
    setSelEv(null);
    setShowForm(false);
    setCalendarError("");
  }

  async function refreshCalendarData() {
    setRefreshingCalendar(true);
    setCalendarMessage("");
    try {
      await STORE.refresh();
      setEvents(CAL_LS(user.id));
      setHolidays(LS.holidays());
      setCalendarMessage("Calendar refreshed from Google Sheets.");
    } catch (error) {
      setCalendarMessage(error instanceof Error ? error.message : "Could not refresh calendar data.");
    } finally {
      setRefreshingCalendar(false);
    }
  }

  function addEvent() {
    setCalendarError("");
    if (!form.title.trim()) {
      setCalendarError("Event title is required.");
      return;
    }
    const [startHour, startMinute] = form.startTime.split(":").map(Number);
    const [endHour, endMinute] = form.endTime.split(":").map(Number);
    const startValue = startHour + startMinute / 60;
    const endValue = endHour + endMinute / 60;
    if (endValue <= startValue) {
      setCalendarError("End time must be later than start time.");
      return;
    }
    if (startValue < CLK_S || endValue > CLK_E) {
      setCalendarError("Events must be between 7:00 AM and 7:00 PM.");
      return;
    }
    setEvents(previous => [...previous, {
      id:uid(),
      title:form.title.trim(),
      date:selDate,
      startHour:startValue,
      endHour:endValue,
      color:form.color,
    }]);
    setShowForm(false);
    setShowList(true);
    setCalendarMessage("Event saved to Google Sheets.");
    setForm({ title:"", startTime:"09:00", endTime:"10:00", color:PINK_EVENT_COLORS[1] });
  }

  function deleteEvent(id:string) {
    setEvents(previous => previous.filter(event => event.id !== id));
    setSelEv(null);
    setCalendarMessage("Event removed.");
  }

  return (
    <div className="it-calendar-stage max-w-4xl mx-auto space-y-4">
      <section className="relative overflow-hidden rounded-[30px] sm:rounded-[38px] px-4 py-5 sm:px-8 sm:py-7"
        style={{
          background:"linear-gradient(155deg,rgba(96,19,58,0.90) 0%,rgba(53,10,38,0.91) 45%,rgba(22,7,20,0.95) 100%)",
          border:"1px solid rgba(255,180,210,0.34)",
          boxShadow:"0 22px 70px rgba(154,18,76,0.32), inset 0 1px 0 rgba(255,255,255,0.22)",
          backdropFilter:"blur(28px)",
          WebkitBackdropFilter:"blur(28px)",
        }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background:"radial-gradient(circle at 82% 14%,rgba(244,114,182,0.26),transparent 30%), radial-gradient(circle at 12% 66%,rgba(225,29,72,0.18),transparent 34%)",
          }} />
        <div className="absolute -right-20 top-20 w-52 h-52 rounded-full pointer-events-none"
          style={{ background:"rgba(244,114,182,0.18)", filter:"blur(62px)" }} />

        <div className="relative z-10">
          <div className="flex items-center justify-between text-white mb-6">
            <button onClick={() => changeDay(-1)} aria-label="Previous day"
              className="w-10 h-10 rounded-full flex items-center justify-center text-2xl transition-all hover:scale-105"
              style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.14)" }}>
              ‹
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold tracking-wide">Calendar</p>
              <p className="text-[9px] uppercase tracking-[0.28em] mt-1" style={{ color:"rgba(255,205,224,0.56)" }}>InternTrack</p>
            </div>
            <button onClick={returnToToday} aria-label="Return to today"
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all hover:scale-105"
              style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.14)" }}>
              ×
            </button>
          </div>

          <div className="text-center px-2">
            <button onClick={returnToToday} className="transition-transform hover:scale-[1.01]">
              <h2 className="text-5xl sm:text-7xl font-light text-white leading-none tracking-[-0.05em]">
                {monthLabel} {dateNumber}
              </h2>
              <p className="text-base sm:text-lg mt-3 font-medium" style={{ color:"#f9a8d4" }}>{dayName}</p>
            </button>
            <p className="text-xs sm:text-sm mt-4" style={{ color:"rgba(255,255,255,0.70)" }}>
              You have {dayEvents.length} {dayEvents.length === 1 ? "event" : "events"} on this day.
            </p>
            <p className="text-xs sm:text-sm mt-1 truncate max-w-md mx-auto" style={{ color:"rgba(255,205,224,0.60)" }}>{summaryText}</p>

            <div className="mt-5 flex justify-center">
              <input type="date" value={selDate} onChange={event => {
                  setSelDate(event.target.value);
                  setSelEv(null);
                  setShowForm(false);
                }}
                className="rounded-full px-4 py-2 text-xs outline-none text-center"
                style={{ ...glassInputSt, width:164 }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-6 max-w-lg mx-auto">
            <button onClick={() => changeDay(-1)}
              className="py-5 rounded-[26px] text-sm font-semibold transition-all hover:scale-[1.01]"
              style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,180,210,0.18)", color:"#f9a8d4", boxShadow:"inset 0 1px 0 rgba(255,255,255,0.08)" }}>
              −1 day
            </button>
            <button onClick={() => changeDay(1)}
              className="py-5 rounded-[26px] text-sm font-semibold transition-all hover:scale-[1.01]"
              style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,180,210,0.18)", color:"#f9a8d4", boxShadow:"inset 0 1px 0 rgba(255,255,255,0.08)" }}>
              +1 day
            </button>
          </div>

          {dayHoliday && (
            <div className="max-w-lg mx-auto mt-4 rounded-2xl px-4 py-3 flex items-center gap-3"
              style={{
                background:isCompanyHoliday ? "rgba(16,185,129,0.14)" : "rgba(167,139,250,0.14)",
                border:isCompanyHoliday ? "1px solid rgba(52,211,153,0.25)" : "1px solid rgba(196,181,253,0.24)",
              }}>
              <Calendar size={16} color={isCompanyHoliday ? "#6ee7b7" : "#ddd6fe"} />
              <div className="min-w-0 text-left">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color:isCompanyHoliday ? "#6ee7b7" : "#ddd6fe" }}>
                  {isCompanyHoliday ? "Company Mass Leave" : "National Holiday"}
                </p>
                <p className="text-xs font-semibold text-white truncate mt-0.5">{dayHoliday.title}</p>
              </div>
            </div>
          )}

          {calendarMessage && (
            <div className="max-w-lg mx-auto mt-4 text-center text-[11px] rounded-full px-4 py-2"
              style={{ background:"rgba(255,255,255,0.08)", color:"rgba(255,220,232,0.72)", border:"1px solid rgba(255,255,255,0.10)" }}>
              {calendarMessage}
            </div>
          )}

          <div className="text-center mt-10 mb-1">
            <p className="text-xs font-medium" style={{ color:"#f9a8d4" }}>Today's Focus</p>
            <p className="text-5xl font-light text-white leading-none mt-2">{dayEvents.length}</p>
            <p className="text-xs mt-1" style={{ color:"rgba(255,255,255,0.55)" }}>{dayEvents.length === 1 ? "event" : "events"}</p>
            <div className="mt-2 text-pink-300 text-xs">♥</div>
          </div>

          <div className="relative mt-1">
            <svg viewBox="0 0 370 370" className="w-full max-w-[600px] mx-auto block"
              onClick={event => {
                if ((event.target as SVGElement).tagName === "svg") setSelEv(null);
              }}>
              <defs>
                <linearGradient id="calendarRing" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="rgba(249,168,212,0.36)" />
                  <stop offset="100%" stopColor="rgba(225,29,72,0.16)" />
                </linearGradient>
                <radialGradient id="calendarCenter" cx="50%" cy="40%" r="70%">
                  <stop offset="0%" stopColor="rgba(255,205,224,0.34)" />
                  <stop offset="100%" stopColor="rgba(104,19,59,0.52)" />
                </radialGradient>
              </defs>

              <circle cx={CX} cy={CY} r={174} fill="rgba(255,255,255,0.025)" stroke="rgba(255,190,214,0.12)" strokeWidth={1} />
              <circle cx={CX} cy={CY} r={158} fill="none" stroke="url(#calendarRing)" strokeWidth={22} />
              <circle cx={CX} cy={CY} r={132} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
              <circle cx={CX} cy={CY} r={103} fill="none" stroke="rgba(249,168,212,0.30)" strokeWidth={1} strokeDasharray="2 5" />

              {Array.from({ length:49 }, (_, index) => {
                const hour = CLK_S + index * 0.25;
                const angle = h2deg(hour);
                const major = index % 4 === 0;
                const [x1, y1] = pol(angle, major ? 164 : 168);
                const [x2, y2] = pol(angle, 175);
                return <line key={`tick-${index}`} x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={major ? "rgba(255,220,232,0.76)" : "rgba(255,220,232,0.30)"}
                  strokeWidth={major ? 1.6 : 0.8} strokeLinecap="round" />;
              })}

              {[7,9,12,15,17,19].map(hour => {
                const [x, y] = pol(h2deg(hour), 148);
                return <text key={hour} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
                  fill="rgba(255,220,232,0.66)" fontSize={8.5} fontWeight={600}
                  style={{ fontFamily:"'DM Mono',monospace" }}>
                  {String(hour).padStart(2, "0")}
                </text>;
              })}

              {dayEvents.map(event => {
                const track = TRACKS[Math.min(event.track, TRACKS.length - 1)];
                const path = arcPath(event.startHour, event.endHour, track.or, track.ir);
                if (!path) return null;
                const startAngle = h2deg(Math.max(event.startHour, CLK_S));
                const endAngle = h2deg(Math.min(event.endHour, CLK_E));
                const midAngle = (startAngle + endAngle) / 2;
                const [labelX, labelY] = pol(midAngle, (track.or + track.ir) / 2);
                const selected = selEv === event.id;
                const arcColor = trackColors[Math.min(event.track, trackColors.length - 1)];
                return (
                  <g key={event.id} style={{ cursor:"pointer" }} onClick={click => {
                      click.stopPropagation();
                      setSelEv(selected ? null : event.id);
                      setShowList(true);
                    }}>
                    <path d={path} fill={arcColor} fillOpacity={selected ? 1 : 0.82}
                      stroke="rgba(255,255,255,0.52)" strokeWidth={selected ? 1.8 : 0.8}
                      style={{ filter:selected ? `drop-shadow(0 0 10px ${arcColor})` : `drop-shadow(0 3px 5px ${arcColor}44)`, transition:"all 0.15s ease" }} />
                    <rect x={labelX - 18} y={labelY - 9} width={36} height={18} rx={9}
                      fill="rgba(255,173,203,0.94)" stroke="rgba(255,255,255,0.55)" strokeWidth={0.7} />
                    <text x={labelX} y={labelY + 0.5} textAnchor="middle" dominantBaseline="middle"
                      fill="#4b102e" fontSize={7.1} fontWeight={800}
                      style={{ pointerEvents:"none", fontFamily:"'DM Mono',monospace" }}>
                      {fmtH(event.startHour).replace(" AM", "").replace(" PM", "")}
                    </text>
                  </g>
                );
              })}

              {isToday && curH >= CLK_S && curH <= CLK_E && (() => {
                const angle = h2deg(curH);
                const [x1, y1] = pol(angle, 145);
                const [x2, y2] = pol(angle, 176);
                return <g>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f9a8d4" strokeWidth={3} strokeLinecap="round" />
                  <circle cx={x1} cy={y1} r={3.5} fill="#f9a8d4" stroke="white" strokeWidth={1} />
                </g>;
              })()}

              <circle cx={CX} cy={CY} r={65} fill="url(#calendarCenter)" stroke="rgba(255,190,214,0.55)" strokeWidth={1.5}
                style={{ filter:"drop-shadow(0 0 14px rgba(244,114,182,0.28))" }} />
              <g stroke="white" strokeWidth={2} fill="none" strokeLinecap="round">
                <rect x={CX - 13} y={CY - 17} width={26} height={23} rx={3} />
                <line x1={CX - 13} y1={CY - 9} x2={CX + 13} y2={CY - 9} />
                <line x1={CX - 7} y1={CY - 20} x2={CX - 7} y2={CY - 14} />
                <line x1={CX + 7} y1={CY - 20} x2={CX + 7} y2={CY - 14} />
              </g>
              <text x={CX} y={CY + 24} textAnchor="middle" fill="white" fontSize={8.5} fontWeight={600}
                style={{ fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                {monthLabel} {dateNumber}, {dayName.slice(0,3)}
              </text>
              <text x={CX} y={CY + 91} textAnchor="middle" fill="rgba(249,168,212,0.70)" fontSize={18}>⌄</text>
            </svg>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-xl mx-auto -mt-4 sm:-mt-7">
            <button onClick={() => { setShowForm(true); setShowList(false); setCalendarError(""); }}
              className="flex flex-col items-center gap-2 text-[10px] sm:text-xs text-white transition-all hover:scale-105">
              <span className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,190,214,0.20)" }}><Plus size={17} /></span>
              Add Event
            </button>
            <button onClick={refreshCalendarData} disabled={refreshingCalendar}
              className="flex flex-col items-center gap-2 text-[10px] sm:text-xs text-white transition-all hover:scale-105 disabled:opacity-50">
              <span className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,190,214,0.20)" }}>{refreshingCalendar ? "…" : "↻"}</span>
              Refresh
            </button>
            <button onClick={() => setShowList(value => !value)}
              className="flex flex-col items-center gap-2 text-[10px] sm:text-xs text-white transition-all hover:scale-105">
              <span className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background:showList ? "rgba(244,114,182,0.30)" : "rgba(255,255,255,0.08)", border:"1px solid rgba(255,190,214,0.20)" }}><ClipboardList size={17} /></span>
              List View
            </button>
          </div>
        </div>
      </section>

      {showForm && (
        <section className="rounded-[26px] p-5 sm:p-6"
          style={{ background:"rgba(255,255,255,0.22)", border:"1px solid rgba(255,255,255,0.42)", backdropFilter:"blur(22px)", WebkitBackdropFilter:"blur(22px)", boxShadow:"0 10px 34px rgba(180,30,80,0.12)" }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-[#3d0a20]">Add Event</p>
              <p className="text-[11px] mt-1" style={{ color:"rgba(61,10,32,0.48)" }}>{monthLabel} {dateNumber} · {dayName}</p>
            </div>
            <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full text-sm" style={{ background:"rgba(255,255,255,0.25)", color:"rgba(61,10,32,0.55)" }}>×</button>
          </div>
          <div className="space-y-3">
            <input value={form.title} onChange={event => setForm(previous => ({ ...previous, title:event.target.value }))}
              onKeyDown={event => event.key === "Enter" && addEvent()}
              placeholder="Event title" autoFocus
              className="w-full px-4 py-3 rounded-2xl text-sm text-[#3d0a20] outline-none placeholder:text-pink-300/60"
              style={{ background:"rgba(255,255,255,0.26)", border:"1px solid rgba(255,255,255,0.48)" }} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-pink-500 mb-1">Start</label>
                <input type="time" value={form.startTime} onChange={event => setForm(previous => ({ ...previous, startTime:event.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-[#3d0a20] outline-none"
                  style={{ background:"rgba(255,255,255,0.26)", border:"1px solid rgba(255,255,255,0.48)", fontFamily:"'DM Mono',monospace" }} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-pink-500 mb-1">End</label>
                <input type="time" value={form.endTime} onChange={event => setForm(previous => ({ ...previous, endTime:event.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-[#3d0a20] outline-none"
                  style={{ background:"rgba(255,255,255,0.26)", border:"1px solid rgba(255,255,255,0.48)", fontFamily:"'DM Mono',monospace" }} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-pink-500">Color</span>
              {PINK_EVENT_COLORS.map(color => (
                <button key={color} onClick={() => setForm(previous => ({ ...previous, color }))}
                  className="w-7 h-7 rounded-full transition-all hover:scale-110"
                  style={{ background:color, outline:form.color === color ? "3px solid white" : "none", outlineOffset:2, boxShadow:form.color === color ? `0 0 0 1px ${color}` : "none" }} />
              ))}
            </div>
            {calendarError && <p className="text-xs font-medium" style={{ color:"#be123c" }}>{calendarError}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background:"rgba(255,255,255,0.26)", color:"rgba(61,10,32,0.60)" }}>Cancel</button>
              <button onClick={addEvent} className="flex-[2] py-3 rounded-xl text-sm font-semibold text-white"
                style={{ background:"linear-gradient(135deg,#f472b6,#e11d48)", boxShadow:"0 5px 18px rgba(225,29,72,0.28)" }}>Save Event</button>
            </div>
          </div>
        </section>
      )}

      {(showList || selEvObj) && (
        <section className="rounded-[26px] p-5 sm:p-6"
          style={{ background:"rgba(255,255,255,0.22)", border:"1px solid rgba(255,255,255,0.42)", backdropFilter:"blur(22px)", WebkitBackdropFilter:"blur(22px)", boxShadow:"0 10px 34px rgba(180,30,80,0.12)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-[#3d0a20]">Day Schedule</p>
              <p className="text-[11px] mt-1" style={{ color:"rgba(61,10,32,0.48)" }}>{dayEvents.length} {dayEvents.length === 1 ? "event" : "events"}</p>
            </div>
            <button onClick={() => { setShowList(false); setSelEv(null); }} className="w-8 h-8 rounded-full text-sm"
              style={{ background:"rgba(255,255,255,0.25)", color:"rgba(61,10,32,0.55)" }}>×</button>
          </div>

          {sortedDayEvents.length === 0 ? (
            <EmptyState icon={<Calendar size={20} className="text-pink-300" />} text="No events for this date." sub="Use Add Event to create one." />
          ) : (
            <div className="space-y-2.5">
              {sortedDayEvents.map(event => (
                <button key={event.id} onClick={() => setSelEv(event.id)}
                  className="w-full rounded-2xl px-4 py-3 flex items-center gap-3 text-left transition-all hover:scale-[1.005]"
                  style={{ background:selEv === event.id ? "rgba(244,114,182,0.22)" : "rgba(255,255,255,0.20)", border:selEv === event.id ? "1px solid rgba(244,114,182,0.42)" : "1px solid rgba(255,255,255,0.34)" }}>
                  <span className="w-2.5 h-10 rounded-full shrink-0" style={{ background:event.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#3d0a20] truncate">{event.title}</p>
                    <p className="text-[11px] mt-1" style={{ color:"rgba(61,10,32,0.50)", fontFamily:"'DM Mono',monospace" }}>{fmtH(event.startHour)} – {fmtH(event.endHour)}</p>
                  </div>
                  <span className="text-[10px] font-semibold rounded-full px-2 py-1" style={{ background:"rgba(244,114,182,0.18)", color:"#be185d" }}>{Math.round((event.endHour - event.startHour) * 60)}m</span>
                </button>
              ))}
            </div>
          )}

          {selEvObj && (
            <div className="mt-4 rounded-2xl p-4 flex items-center justify-between gap-3"
              style={{ background:`${selEvObj.color}18`, border:`1px solid ${selEvObj.color}38` }}>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#3d0a20] truncate">{selEvObj.title}</p>
                <p className="text-xs mt-1" style={{ color:"rgba(61,10,32,0.50)" }}>{fmtH(selEvObj.startHour)} → {fmtH(selEvObj.endHour)}</p>
              </div>
              <button onClick={() => deleteEvent(selEvObj.id)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl shrink-0"
                style={{ background:"rgba(251,113,133,0.18)", color:"#be123c" }}>
                <Trash2 size={12} /> Remove
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
'''

text = text[:start] + new_function + '\n\n' + text[end:]
path.write_text(text, encoding='utf-8')
print('Applied the approved glassy pink Calendar interface redesign.')
