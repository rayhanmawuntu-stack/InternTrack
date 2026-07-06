import { useEffect, useMemo, useRef } from "react";
import { CalendarDays, ClipboardList, Plus, RefreshCw } from "lucide-react";

export type MonthCalendarEvent = {
  id: string;
  title: string;
  date: string;
  startHour: number;
  endHour: number;
  color: string;
};

export type MonthCalendarHoliday = {
  date: string;
  title: string;
  type: "national" | "company" | "collective";
  source?: string;
};

type Props = {
  selectedDate: string;
  todayDate: string;
  events: MonthCalendarEvent[];
  holidays: MonthCalendarHoliday[];
  refreshing: boolean;
  listOpen: boolean;
  onSelectDate: (date: string) => void;
  onSelectEvent: (id: string, date: string) => void;
  onAddEvent: () => void;
  onRefresh: () => void;
  onToggleList: () => void;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const parseDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

const formatTime = (hourValue: number) => {
  const hours = Math.floor(hourValue);
  const minutes = Math.round((hourValue - hours) * 60);
  const value = new Date(2000, 0, 1, hours, minutes);
  return value.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

export default function ScrollableMonthCalendar({
  selectedDate,
  todayDate,
  events,
  holidays,
  refreshing,
  listOpen,
  onSelectDate,
  onSelectEvent,
  onAddEvent,
  onRefresh,
  onToggleList,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const monthRefs = useRef<Record<string, HTMLElement | null>>({});
  const selected = parseDate(selectedDate);
  const selectedMonth = monthKey(selected);

  const months = useMemo(() => {
    const anchor = new Date(selected.getFullYear(), selected.getMonth() - 2, 1, 12, 0, 0);
    return Array.from({ length: 15 }, (_, index) =>
      new Date(anchor.getFullYear(), anchor.getMonth() + index, 1, 12, 0, 0)
    );
  }, [selected.getFullYear(), selected.getMonth()]);

  const eventsByDate = useMemo(() => {
    const result = new Map<string, MonthCalendarEvent[]>();
    events.forEach(event => {
      const current = result.get(event.date) ?? [];
      current.push(event);
      result.set(event.date, current.sort((a, b) => a.startHour - b.startHour));
    });
    return result;
  }, [events]);

  const holidayByDate = useMemo(() => {
    const result = new Map<string, MonthCalendarHoliday>();
    holidays.forEach(holiday => result.set(holiday.date, holiday));
    return result;
  }, [holidays]);

  const selectedEvents = eventsByDate.get(selectedDate) ?? [];
  const selectedHoliday = holidayByDate.get(selectedDate);

  useEffect(() => {
    const container = scrollRef.current;
    const monthElement = monthRefs.current[selectedMonth];
    if (!container || !monthElement) return;

    const nextTop = monthElement.offsetTop - container.offsetTop - 8;
    container.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
  }, [selectedMonth]);

  const jumpMonth = (offset: number) => {
    const target = new Date(selected.getFullYear(), selected.getMonth() + offset, 1, 12, 0, 0);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(selected.getDate(), lastDay));
    onSelectDate(dateKey(target));
  };

  return (
    <div className="it-month-calendar-view">
      <style>{`
        .it-month-calendar-view {
          min-height: 0;
          flex: 1 1 auto;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-top: 0.8rem;
        }
        .it-month-calendar-toolbar,
        .it-month-calendar-summary,
        .it-month-calendar-card {
          background: rgba(255,255,255,0.055);
          border: 1px solid rgba(255,255,255,0.11);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.055);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }
        .it-month-calendar-scroll {
          min-height: 0;
          flex: 1 1 auto;
          overflow-y: auto;
          overscroll-behavior: contain;
          scroll-snap-type: y proximity;
          scroll-padding-top: 0.5rem;
          padding: 0.1rem 0.15rem 1rem;
        }
        .it-month-calendar-card {
          scroll-snap-align: start;
          border-radius: 1.45rem;
          padding: 1rem;
          margin-bottom: 0.8rem;
        }
        .it-month-calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 0.42rem;
        }
        .it-month-calendar-day {
          min-width: 0;
          min-height: 5rem;
          border-radius: 1rem;
          padding: 0.55rem;
          text-align: left;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.06);
          transition: transform 150ms ease, background 150ms ease, border-color 150ms ease;
        }
        .it-month-calendar-day:hover {
          transform: translateY(-1px);
          background: rgba(255,255,255,0.075);
          border-color: rgba(249,168,212,0.25);
        }
        .it-month-calendar-day[data-selected="true"] {
          background: linear-gradient(145deg, rgba(244,114,182,0.30), rgba(225,29,72,0.16));
          border-color: rgba(249,168,212,0.55);
          box-shadow: 0 8px 24px rgba(225,29,72,0.15), inset 0 1px 0 rgba(255,255,255,0.18);
        }
        .it-month-calendar-day[data-today="true"] .it-month-calendar-number {
          color: #2b091b;
          background: #f9a8d4;
          box-shadow: 0 0 15px rgba(249,168,212,0.44);
        }
        .it-month-calendar-number {
          width: 1.65rem;
          height: 1.65rem;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.88);
          font-size: 0.72rem;
          font-weight: 700;
        }
        .it-month-calendar-event {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          min-width: 0;
          margin-top: 0.28rem;
          padding: 0.22rem 0.35rem;
          border-radius: 0.55rem;
          background: rgba(255,255,255,0.055);
          color: rgba(255,255,255,0.72);
          font-size: 0.57rem;
          line-height: 1;
        }
        .it-month-calendar-event-dot {
          width: 0.38rem;
          height: 0.38rem;
          flex: 0 0 auto;
          border-radius: 999px;
        }
        .it-month-calendar-holiday {
          margin-top: 0.28rem;
          color: #f9a8d4;
          font-size: 0.52rem;
          line-height: 1.1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (min-width: 768px) {
          .it-month-calendar-view {
            grid-column: 1 / -1;
            grid-row: 2 / 6;
            align-self: stretch;
            margin-top: 0;
          }
          .it-month-calendar-card {
            padding: 1.15rem;
          }
          .it-month-calendar-day {
            min-height: clamp(5.5rem, 10vh, 7.5rem);
          }
        }
        @media (max-width: 767px) {
          .it-month-calendar-view {
            margin-top: 0.45rem;
            gap: 0.55rem;
          }
          .it-month-calendar-toolbar,
          .it-month-calendar-summary {
            border-radius: 1.1rem !important;
          }
          .it-month-calendar-card {
            border-radius: 1.1rem;
            padding: 0.65rem;
            margin-bottom: 0.6rem;
          }
          .it-month-calendar-grid {
            gap: 0.24rem;
          }
          .it-month-calendar-day {
            min-height: 3.8rem;
            border-radius: 0.75rem;
            padding: 0.35rem;
          }
          .it-month-calendar-number {
            width: 1.35rem;
            height: 1.35rem;
            font-size: 0.64rem;
          }
          .it-month-calendar-event {
            padding: 0.18rem 0.22rem;
          }
          .it-month-calendar-event-label,
          .it-month-calendar-event-time {
            display: none;
          }
          .it-month-calendar-event {
            display: inline-flex;
            margin-right: 0.15rem;
            width: auto;
            background: transparent;
            padding: 0;
          }
          .it-month-calendar-holiday {
            font-size: 0.46rem;
          }
        }
      `}</style>

      <div className="it-month-calendar-toolbar rounded-[1.35rem] px-3 py-2.5 flex items-center justify-between gap-3">
        <button onClick={() => jumpMonth(-1)} aria-label="Previous month"
          className="w-9 h-9 rounded-full text-lg text-white transition-transform hover:scale-105"
          style={{ background: "rgba(255,255,255,0.07)" }}>‹</button>
        <div className="text-center min-w-0">
          <p className="text-sm sm:text-base font-bold text-white truncate">
            {selected.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
          <p className="text-[9px] uppercase tracking-[0.2em] mt-0.5" style={{ color: "rgba(249,168,212,0.64)" }}>
            Scroll through full months
          </p>
        </div>
        <button onClick={() => jumpMonth(1)} aria-label="Next month"
          className="w-9 h-9 rounded-full text-lg text-white transition-transform hover:scale-105"
          style={{ background: "rgba(255,255,255,0.07)" }}>›</button>
      </div>

      <div className="it-month-calendar-summary rounded-[1.35rem] px-3.5 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays size={15} color="#f9a8d4" />
            <p className="text-sm font-semibold text-white truncate">
              {selected.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </p>
          </div>
          <p className="text-[10px] mt-1 truncate" style={{ color: "rgba(255,255,255,0.48)" }}>
            {selectedHoliday ? selectedHoliday.title : `${selectedEvents.length} ${selectedEvents.length === 1 ? "event" : "events"}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onAddEvent} className="w-9 h-9 rounded-full flex items-center justify-center text-white"
            style={{ background: "linear-gradient(135deg,#f472b6,#e11d48)" }} aria-label="Add event"><Plus size={15} /></button>
          <button onClick={onRefresh} disabled={refreshing} className="w-9 h-9 rounded-full flex items-center justify-center text-white disabled:opacity-50"
            style={{ background: "rgba(255,255,255,0.08)" }} aria-label="Refresh calendar"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /></button>
          <button onClick={onToggleList} className="w-9 h-9 rounded-full flex items-center justify-center text-white"
            style={{ background: listOpen ? "rgba(244,114,182,0.30)" : "rgba(255,255,255,0.08)" }} aria-label="Toggle list view"><ClipboardList size={14} /></button>
        </div>
      </div>

      <div ref={scrollRef} className="it-month-calendar-scroll" data-smooth-scroll="true">
        {months.map(month => {
          const key = monthKey(month);
          const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
          const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
          const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

          return (
            <section key={key} ref={element => { monthRefs.current[key] = element; }} className="it-month-calendar-card">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </h3>
                <span className="text-[9px] uppercase tracking-[0.16em]" style={{ color: "rgba(249,168,212,0.58)" }}>
                  {events.filter(event => event.date.startsWith(key)).length} events
                </span>
              </div>

              <div className="it-month-calendar-grid mb-1.5">
                {WEEKDAYS.map(day => (
                  <div key={day} className="text-center text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider py-1"
                    style={{ color: "rgba(255,255,255,0.38)" }}>{day}</div>
                ))}
              </div>

              <div className="it-month-calendar-grid">
                {Array.from({ length: cellCount }, (_, index) => {
                  const dayNumber = index - firstWeekday + 1;
                  if (dayNumber < 1 || dayNumber > daysInMonth) {
                    return <div key={`blank-${index}`} aria-hidden="true" />;
                  }

                  const dayDate = new Date(month.getFullYear(), month.getMonth(), dayNumber, 12, 0, 0);
                  const dayKey = dateKey(dayDate);
                  const dayEvents = eventsByDate.get(dayKey) ?? [];
                  const holiday = holidayByDate.get(dayKey);
                  const isSelected = dayKey === selectedDate;
                  const isToday = dayKey === todayDate;

                  return (
                    <button key={dayKey} onClick={() => onSelectDate(dayKey)}
                      className="it-month-calendar-day"
                      data-selected={isSelected}
                      data-today={isToday}
                      aria-pressed={isSelected}
                      title={holiday?.title ?? dayEvents.map(event => event.title).join(", ")}>
                      <div className="flex items-start justify-between gap-1">
                        <span className="it-month-calendar-number">{dayNumber}</span>
                        {dayEvents.length > 2 && (
                          <span className="text-[8px] font-semibold" style={{ color: "rgba(249,168,212,0.72)" }}>+{dayEvents.length - 2}</span>
                        )}
                      </div>

                      {dayEvents.slice(0, 2).map(event => (
                        <span key={event.id} className="it-month-calendar-event"
                          onClick={click => { click.stopPropagation(); onSelectEvent(event.id, dayKey); }}>
                          <span className="it-month-calendar-event-dot" style={{ background: event.color }} />
                          <span className="it-month-calendar-event-label truncate">{event.title}</span>
                          <span className="it-month-calendar-event-time ml-auto shrink-0">{formatTime(event.startHour)}</span>
                        </span>
                      ))}

                      {holiday && (
                        <div className="it-month-calendar-holiday">
                          {holiday.type === "company" ? "KSB · " : "Holiday · "}{holiday.title}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
