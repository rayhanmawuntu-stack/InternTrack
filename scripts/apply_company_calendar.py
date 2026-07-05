from pathlib import Path

APP = Path('src/app/App.tsx')
BACKEND = Path('apps-script/Code.gs')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'Could not find expected block for {label}.')
    return text.replace(old, new, 1)


def patch_app() -> bool:
    text = APP.read_text(encoding='utf-8')
    if 'type CalendarHoliday' in text and 'Company Mass Leave' in text and 'placeholder="e.g. Business Controlling Intern"' in text:
        print('Frontend company calendar changes already applied.')
        return False

    text = replace_once(
        text,
        'type Note = { id: string; title: string; content: string; tags: NoteTag[]; createdAt: string; updatedAt: string; gradient: number; };',
        'type Note = { id: string; title: string; content: string; tags: NoteTag[]; createdAt: string; updatedAt: string; gradient: number; };\n'
        'type CalendarHoliday = { date: string; title: string; type: "national" | "company" | "collective"; source?: string; };',
        'holiday type',
    )
    text = replace_once(
        text,
        '  saveSettings: (uid: string, value: any) => STORE.setItem(`it_settings_${uid}`, JSON.stringify(value)),\n};',
        '  saveSettings: (uid: string, value: any) => STORE.setItem(`it_settings_${uid}`, JSON.stringify(value)),\n'
        '  holidays:   (): CalendarHoliday[] => { try { return JSON.parse(STORE.getItem("it_holidays_id") || "[]"); } catch { return []; } },\n};',
        'holiday store',
    )
    text = text.replace('const DEPARTMENTS = ["Design","Engineering","Marketing","Analytics","Operations","HR","Finance","Product"];\n', '')
    text = text.replace('const ROLES       = ["Design Intern","Software Engineering Intern","Marketing Intern","Data Analytics Intern","Operations Intern","HR Intern","Finance Intern","Product Intern"];\n', '')

    text = replace_once(
        text,
        '  const [form, setForm]       = useState({ name:"", role: ROLES[0], department: DEPARTMENTS[0] });',
        '  const [form, setForm]       = useState({ name:"", role:"", department:"" });',
        'free-text initial state',
    )
    text = replace_once(
        text,
        '    if (!form.name.trim()) e.name = "Full name is required";\n    if (Object.keys(e).length) { setErrors(e); return; }',
        '    if (!form.name.trim()) e.name = "Full name is required";\n'
        '    if (!form.role.trim()) e.role = "Intern role is required";\n'
        '    if (!form.department.trim()) e.department = "Department is required";\n'
        '    if (Object.keys(e).length) { setErrors(e); return; }',
        'onboarding validation',
    )
    text = replace_once(
        text,
        '      role: form.role, department: form.department,',
        '      role: form.role.trim(), department: form.department.trim(),',
        'trim onboarding profile fields',
    )

    old_role = '''            {/* Role */}\n            <div>\n              <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color:"rgba(255,255,255,0.4)" }}>Role</label>\n              <select value={form.role} onChange={e => setForm(p => ({...p, role:e.target.value}))}\n                className="w-full px-4 py-3 rounded-2xl text-sm text-white outline-none transition-all appearance-none cursor-pointer"\n                style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.14)", backdropFilter:"blur(12px)" }}>\n                {ROLES.map(r => <option key={r} value={r} style={{ background:"#1a1a1e", color:"#fff" }}>{r}</option>)}\n              </select>\n            </div>'''
    new_role = '''            {/* Intern role */}\n            <div>\n              <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color:"rgba(255,255,255,0.4)" }}>Intern Role</label>\n              <input\n                value={form.role}\n                onChange={e => { setForm(p => ({...p, role:e.target.value})); setErrors(p => ({...p, role:""})); }}\n                onKeyDown={e => e.key === "Enter" && submit()}\n                placeholder="e.g. Business Controlling Intern"\n                className="w-full px-4 py-3 rounded-2xl text-sm text-white outline-none transition-all placeholder:text-white/20"\n                style={{ background:"rgba(255,255,255,0.08)", border: errors.role ? "1px solid rgba(251,113,133,0.8)" : "1px solid rgba(255,255,255,0.14)", backdropFilter:"blur(12px)" }}\n              />\n              {errors.role && <p className="text-[11px] mt-1" style={{ color:"#fb7185" }}>{errors.role}</p>}\n            </div>'''
    text = replace_once(text, old_role, new_role, 'intern role input')

    old_department = '''            {/* Department */}\n            <div>\n              <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color:"rgba(255,255,255,0.4)" }}>Department</label>\n              <select value={form.department} onChange={e => setForm(p => ({...p, department:e.target.value}))}\n                className="w-full px-4 py-3 rounded-2xl text-sm text-white outline-none transition-all appearance-none cursor-pointer"\n                style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.14)", backdropFilter:"blur(12px)" }}>\n                {DEPARTMENTS.map(d => <option key={d} value={d} style={{ background:"#1a1a1e", color:"#fff" }}>{d}</option>)}\n              </select>\n            </div>'''
    new_department = '''            {/* Department */}\n            <div>\n              <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color:"rgba(255,255,255,0.4)" }}>Department</label>\n              <input\n                value={form.department}\n                onChange={e => { setForm(p => ({...p, department:e.target.value})); setErrors(p => ({...p, department:""})); }}\n                onKeyDown={e => e.key === "Enter" && submit()}\n                placeholder="e.g. Finance & Controlling"\n                className="w-full px-4 py-3 rounded-2xl text-sm text-white outline-none transition-all placeholder:text-white/20"\n                style={{ background:"rgba(255,255,255,0.08)", border: errors.department ? "1px solid rgba(251,113,133,0.8)" : "1px solid rgba(255,255,255,0.14)", backdropFilter:"blur(12px)" }}\n              />\n              {errors.department && <p className="text-[11px] mt-1" style={{ color:"#fb7185" }}>{errors.department}</p>}\n            </div>'''
    text = replace_once(text, old_department, new_department, 'department input')

    text = replace_once(
        text,
        '{navTab === "calendar"   && <CalendarView user={user} now={now} />}',
        '{navTab === "calendar"   && <CalendarView user={user} now={now} cloudRevision={cloudRevision} />}',
        'calendar cloud revision',
    )
    text = replace_once(
        text,
        'function CalendarView({ user, now }: { user:User; now:Date }) {',
        'function CalendarView({ user, now, cloudRevision }: { user:User; now:Date; cloudRevision:number }) {',
        'calendar signature',
    )
    text = replace_once(
        text,
        '  const [events, setEvents]     = useState<CalEvent[]>(() => CAL_LS(user.id));\n  const [selEv, setSelEv]',
        '  const [events, setEvents]     = useState<CalEvent[]>(() => CAL_LS(user.id));\n'
        '  const [holidays, setHolidays] = useState<CalendarHoliday[]>(() => LS.holidays());\n'
        '  const [selEv, setSelEv]',
        'calendar holiday state',
    )
    text = replace_once(
        text,
        '  useEffect(() => {\n    CAL_SAVE(user.id, events);\n    void STORE.syncNow().catch(error => console.error("Calendar sync failed.", error));\n  }, [events]);\n\n  const selDateObj',
        '  useEffect(() => {\n    CAL_SAVE(user.id, events);\n    void STORE.syncNow().catch(error => console.error("Calendar sync failed.", error));\n  }, [events]);\n\n'
        '  useEffect(() => {\n    setEvents(CAL_LS(user.id));\n    setHolidays(LS.holidays());\n  }, [user.id, cloudRevision]);\n\n'
        '  const selDateObj',
        'calendar holiday refresh',
    )
    text = replace_once(
        text,
        '  const dayEvents   = assignTracks(events.filter(e => e.date === selDate));\n  const selEvObj',
        '  const dayEvents   = assignTracks(events.filter(e => e.date === selDate));\n'
        '  const dayHoliday  = holidays.find(h => h.date === selDate) ?? null;\n'
        '  const isCompanyHoliday = dayHoliday?.type === "company";\n'
        '  const selEvObj',
        'selected holiday',
    )
    text = replace_once(
        text,
        '      {/* ── Main clock card ── */}\n      <div className="rounded-2xl overflow-hidden"',
        '''      {dayHoliday && (\n        <div className="flex items-start gap-3 rounded-2xl px-4 py-3"\n          style={{\n            background: isCompanyHoliday ? "rgba(16,185,129,0.16)" : "rgba(167,139,250,0.20)",\n            border: isCompanyHoliday ? "1px solid rgba(16,185,129,0.32)" : "1px solid rgba(167,139,250,0.38)",\n            backdropFilter:"blur(18px)", WebkitBackdropFilter:"blur(18px)"\n          }}>\n          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"\n            style={{ background:isCompanyHoliday ? "rgba(5,150,105,0.14)" : "rgba(124,58,237,0.16)", color:isCompanyHoliday ? "#047857" : "#7c3aed" }}>\n            <Calendar size={17} />\n          </div>\n          <div className="min-w-0">\n            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color:isCompanyHoliday ? "#047857" : "#7c3aed" }}>\n              {isCompanyHoliday ? "Company Mass Leave" : "Indonesia National Holiday"}\n            </p>\n            <p className="text-sm font-bold text-[#3d0a20] mt-0.5">{dayHoliday.title}</p>\n          </div>\n        </div>\n      )}\n\n      {/* ── Main clock card ── */}\n      <div className="rounded-2xl overflow-hidden"''',
        'holiday banner',
    )
    text = replace_once(
        text,
        '          const evCnt = events.filter(e => e.date === ds).length;\n          return (\n            <button key={i} onClick=',
        '          const evCnt = events.filter(e => e.date === ds).length;\n'
        '          const holiday = holidays.find(h => h.date === ds);\n'
        '          const companyHoliday = holiday?.type === "company";\n'
        '          return (\n            <button key={i} title={holiday ? holiday.title : undefined} onClick=',
        'date strip holiday lookup',
    )
    text = replace_once(
        text,
        '''                {evCnt > 0\n                  ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background:isSel?"rgba(255,255,255,0.28)":"rgba(244,114,182,0.22)", color:isSel?"white":"#be185d" }}>{evCnt}</span>\n                  : isT && !isSel ? <span className="w-1.5 h-1.5 rounded-full" style={{ background:"#e11d48" }} /> : null\n                }''',
        '''                {holiday\n                  ? <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background:isSel?"rgba(255,255,255,0.28)":companyHoliday?"rgba(16,185,129,0.20)":"rgba(167,139,250,0.24)", color:isSel?"white":companyHoliday?"#047857":"#7c3aed" }}>{companyHoliday ? "KSB" : "LIBUR"}</span>\n                  : evCnt > 0\n                    ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background:isSel?"rgba(255,255,255,0.28)":"rgba(244,114,182,0.22)", color:isSel?"white":"#be185d" }}>{evCnt}</span>\n                    : isT && !isSel ? <span className="w-1.5 h-1.5 rounded-full" style={{ background:"#e11d48" }} /> : null\n                }''',
        'date strip holiday badge',
    )

    text = replace_once(
        text,
        '  const [attRecords, setAttRecords] = useState<AttRecord[]>(() => LS.att(user.id));\n  const [showLogForm, setShowLogForm]',
        '  const [attRecords, setAttRecords] = useState<AttRecord[]>(() => LS.att(user.id));\n'
        '  const [holidays, setHolidays] = useState<CalendarHoliday[]>(() => LS.holidays());\n'
        '  const [showLogForm, setShowLogForm]',
        'attendance holiday state',
    )
    text = replace_once(
        text,
        '  useEffect(() => {\n    setAttRecords(LS.att(user.id));\n  }, [user.id, cloudRevision]);',
        '  useEffect(() => {\n    setAttRecords(LS.att(user.id));\n    setHolidays(LS.holidays());\n  }, [user.id, cloudRevision]);',
        'attendance holiday refresh',
    )
    text = replace_once(
        text,
        '  function statusForDate(d: Date): AttStatus {\n    if (d > now && d.toDateString() !== now.toDateString()) return "future";\n    const dow = d.getDay();\n    if (dow === 0 || dow === 6) return "holiday";\n    const iso = localDateKey(d);',
        '  function statusForDate(d: Date): AttStatus {\n    if (d > now && d.toDateString() !== now.toDateString()) return "future";\n'
        '    const iso = localDateKey(d);\n'
        '    if (holidays.some(h => h.date === iso)) return "holiday";\n'
        '    const dow = d.getDay();\n    if (dow === 0 || dow === 6) return "holiday";',
        'attendance holiday status',
    )
    text = replace_once(
        text,
        '              const m = STATUS_META[r.status];\n              return (\n                <div key={i} className=',
        '              const m = STATUS_META[r.status];\n'
        '              const holiday = holidays.find(h => h.date === localDateKey(r.date));\n'
        '              return (\n                <div key={i} title={holiday ? holiday.title : undefined} className=',
        'attendance holiday tooltip',
    )

    APP.write_text(text, encoding='utf-8')
    print('Applied free-text profile fields and national/company holiday UI.')
    return True


def patch_backend() -> bool:
    text = BACKEND.read_text(encoding='utf-8')
    if 'companySpecificHolidays2026_' in text:
        print('Backend company holidays already applied.')
        return False

    text = replace_once(
        text,
        '''  indonesiaNationalHolidays2026_().forEach(function(holiday) {\n    byDate[holiday.date] = {\n      date: holiday.date,\n      title: holiday.title,\n      type: 'national',\n      country: 'Indonesia',\n      source: holiday.source || 'SKB 3 Menteri — Libur Nasional 2026',\n      updatedAt: updatedAt\n    };\n  });\n\n  const holidays = Object.keys(byDate)''',
        '''  indonesiaNationalHolidays2026_().forEach(function(holiday) {\n    byDate[holiday.date] = {\n      date: holiday.date,\n      title: holiday.title,\n      type: 'national',\n      country: 'Indonesia',\n      source: holiday.source || 'SKB 3 Menteri — Libur Nasional 2026',\n      updatedAt: updatedAt\n    };\n  });\n\n  companySpecificHolidays2026_().forEach(function(holiday) {\n    byDate[holiday.date] = {\n      date: holiday.date,\n      title: holiday.title,\n      type: 'company',\n      country: 'Indonesia',\n      source: holiday.source,\n      updatedAt: updatedAt\n    };\n  });\n\n  const holidays = Object.keys(byDate)''',
        'merge company holidays',
    )
    text = replace_once(
        text,
        '''function doPost(e) {''',
        '''function companySpecificHolidays2026_() {\n  const source = 'PT KSB Indonesia & PT KSB Sales Indonesia - Company Calendar 2026';\n  return [\n    { date: '2026-03-20', title: 'Idul Fitri 1447 H Leave', source: source },\n    { date: '2026-03-23', title: 'Idul Fitri 1447 H Leave', source: source },\n    { date: '2026-03-24', title: 'Idul Fitri 1447 H Leave', source: source },\n    { date: '2026-03-25', title: 'Idul Fitri 1447 H Leave', source: source },\n    { date: '2026-03-26', title: 'Idul Fitri 1447 H Leave', source: source },\n    { date: '2026-03-27', title: 'Idul Fitri 1447 H Leave', source: source },\n    { date: '2026-05-26', title: 'Idul Adha 1447 H Leave', source: source },\n    { date: '2026-12-24', title: 'Christmas Leave', source: source }\n  ];\n}\n\nfunction doPost(e) {''',
        'company holiday function',
    )
    text = text.replace('version: 6,', 'version: 7,', 1)
    BACKEND.write_text(text, encoding='utf-8')
    print('Added PT KSB company mass-leave dates to the backend.')
    return True


changed = patch_app() | patch_backend()
print('Changes written.' if changed else 'No changes required.')
