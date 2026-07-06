export type CalendarHolidayRecord = {
  date: string;
  title: string;
  type: "national" | "company" | "collective";
  source?: string;
};

const OFFICIAL_SOURCE = "SKB 3 Menteri — Libur Nasional 2026";
const COMPANY_SOURCE = "PT KSB Indonesia & PT KSB Sales Indonesia — Company Calendar 2026";

const BUNDLED_HOLIDAYS_2026: CalendarHolidayRecord[] = [
  { date:"2026-01-01", title:"Tahun Baru Masehi", type:"national", source:OFFICIAL_SOURCE },
  { date:"2026-01-16", title:"Isra Mikraj Nabi Muhammad SAW", type:"national", source:OFFICIAL_SOURCE },
  { date:"2026-02-17", title:"Tahun Baru Imlek 2577 Kongzili", type:"national", source:OFFICIAL_SOURCE },
  { date:"2026-03-19", title:"Hari Suci Nyepi — Tahun Baru Saka 1948", type:"national", source:OFFICIAL_SOURCE },
  { date:"2026-03-20", title:"Idul Fitri 1447 H Leave", type:"company", source:COMPANY_SOURCE },
  { date:"2026-03-21", title:"Idulfitri 1447 Hijriah", type:"national", source:OFFICIAL_SOURCE },
  { date:"2026-03-22", title:"Idulfitri 1447 Hijriah", type:"national", source:OFFICIAL_SOURCE },
  { date:"2026-03-23", title:"Idul Fitri 1447 H Leave", type:"company", source:COMPANY_SOURCE },
  { date:"2026-03-24", title:"Idul Fitri 1447 H Leave", type:"company", source:COMPANY_SOURCE },
  { date:"2026-03-25", title:"Idul Fitri 1447 H Leave", type:"company", source:COMPANY_SOURCE },
  { date:"2026-03-26", title:"Idul Fitri 1447 H Leave", type:"company", source:COMPANY_SOURCE },
  { date:"2026-03-27", title:"Idul Fitri 1447 H Leave", type:"company", source:COMPANY_SOURCE },
  { date:"2026-04-03", title:"Wafat Yesus Kristus", type:"national", source:OFFICIAL_SOURCE },
  { date:"2026-04-05", title:"Kebangkitan Yesus Kristus — Paskah", type:"national", source:OFFICIAL_SOURCE },
  { date:"2026-05-01", title:"Hari Buruh Internasional", type:"national", source:OFFICIAL_SOURCE },
  { date:"2026-05-14", title:"Kenaikan Yesus Kristus", type:"national", source:OFFICIAL_SOURCE },
  { date:"2026-05-26", title:"Idul Adha 1447 H Leave", type:"company", source:COMPANY_SOURCE },
  { date:"2026-05-27", title:"Iduladha 1447 Hijriah", type:"national", source:OFFICIAL_SOURCE },
  { date:"2026-05-31", title:"Hari Raya Waisak 2570 BE", type:"national", source:OFFICIAL_SOURCE },
  { date:"2026-06-01", title:"Hari Lahir Pancasila", type:"national", source:OFFICIAL_SOURCE },
  { date:"2026-06-16", title:"Tahun Baru Islam 1448 Hijriah", type:"national", source:OFFICIAL_SOURCE },
  { date:"2026-08-17", title:"Hari Kemerdekaan Republik Indonesia", type:"national", source:OFFICIAL_SOURCE },
  { date:"2026-08-25", title:"Maulid Nabi Muhammad SAW", type:"national", source:OFFICIAL_SOURCE },
  { date:"2026-12-24", title:"Christmas Leave", type:"company", source:COMPANY_SOURCE },
  { date:"2026-12-25", title:"Hari Raya Natal", type:"national", source:OFFICIAL_SOURCE },
];

function jakartaDateKey(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Google Sheets can expose a date as its serial number when the column is
    // formatted inconsistently. Serial 1 is 1899-12-31, with the 1900 leap-year
    // compatibility offset used by Sheets/Excel.
    const utc = Date.UTC(1899, 11, 30) + Math.round(value) * 86400000;
    value = new Date(utc);
  }

  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const parsed = value instanceof Date ? value : new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone:"Asia/Jakarta",
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
  }).formatToParts(parsed);
  const read = (type: "year" | "month" | "day") => parts.find(part => part.type === type)?.value ?? "";
  const year = read("year");
  const month = read("month");
  const day = read("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function inferHolidayType(entry: Record<string, unknown>): CalendarHolidayRecord["type"] {
  const raw = String(entry.type ?? entry.kind ?? entry.category ?? entry.holidayType ?? "").trim().toLowerCase();
  const context = [raw, entry.title, entry.source, entry.country]
    .map(value => String(value ?? "").toLowerCase())
    .join(" ");

  if (/company|ksb|mass leave|company leave|office leave/.test(context)) return "company";
  if (/collective|cuti bersama/.test(context)) return "collective";
  return "national";
}

function holidayPriority(type: CalendarHolidayRecord["type"]): number {
  return type === "company" ? 3 : type === "collective" ? 2 : 1;
}

export function mergeCalendarHolidays(remoteValue: unknown): CalendarHolidayRecord[] {
  const remote = Array.isArray(remoteValue) ? remoteValue : [];
  const merged = new Map<string, CalendarHolidayRecord>();

  BUNDLED_HOLIDAYS_2026.forEach(holiday => merged.set(holiday.date, holiday));

  remote.forEach(entry => {
    if (!entry || typeof entry !== "object") return;
    const candidate = entry as Record<string, unknown>;
    const date = jakartaDateKey(candidate.date ?? candidate.startDate ?? candidate.holidayDate);
    const title = String(candidate.title ?? candidate.name ?? candidate.description ?? "").trim();
    if (!date || !title) return;

    const next: CalendarHolidayRecord = {
      date,
      title,
      type:inferHolidayType(candidate),
      source:String(candidate.source ?? "").trim() || undefined,
    };

    const previous = merged.get(date);
    if (!previous || holidayPriority(next.type) >= holidayPriority(previous.type)) {
      merged.set(date, next);
    }
  });

  return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
}
