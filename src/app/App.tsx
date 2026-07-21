import { useState, useEffect, useRef } from "react";
import { STORE } from "../lib/cloudStore";
import { PinAuthError } from "../lib/cloudStore";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Clock, Calendar, BarChart2, FileText, Settings, CheckCircle,
  LogOut, Plus, Edit3, LayoutDashboard, ClipboardList, StickyNote,
  Zap, TrendingUp, ChevronDown, Download, Filter, ArrowUpRight, ArrowDownRight, Minus, UserPlus, Trash2,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

/* ─── Types ─────────────────────────────────────────────── */
type User = {
  id: string; name: string; firstName: string;
  role: string; department: string; initials: string; startDate: string;
  hasPin?: boolean;
};
type ActivityEntry = {
  id: string; title: string; description: string; time: string; // ISO string
  color: "green" | "blue" | "amber" | "violet";
};
type AttRecord = { date: string; clockIn: string | null; clockOut: string | null; type?: "present" | "late" | "wfh" | "absent"; };
type NoteTag = "Work Log" | "Learnings" | "Blockers" | "Tomorrow";
type Note = { id: string; title: string; content: string; tags: NoteTag[]; createdAt: string; updatedAt: string; gradient: number; };
type CalendarHoliday = { date: string; title: string; type: "national" | "company" | "collective"; source?: string; };

/* ─── Google Sheets data helpers (memory only while open) ── */
const LS = {
  users:      (): User[]         => { try { return JSON.parse(STORE.getItem("it_users") || "[]"); } catch { return []; } },
  saveUsers:  (u: User[])        => STORE.setItem("it_users", JSON.stringify(u)),
  activities: (uid: string): ActivityEntry[] => { try { return JSON.parse(STORE.getItem(`it_act_${uid}`) || "[]"); } catch { return []; } },
  saveAct:    (uid: string, a: ActivityEntry[]) => STORE.setItem(`it_act_${uid}`, JSON.stringify(a)),
  note:       (uid: string): string => STORE.getItem(`it_note_${uid}`) || "",
  saveNote:   (uid: string, n: string) => STORE.setItem(`it_note_${uid}`, n),
  att:        (uid: string): AttRecord[] => { try { return JSON.parse(STORE.getItem(`it_att_${uid}`) || "[]"); } catch { return []; } },
  saveAtt:    (uid: string, r: AttRecord[]) => STORE.setItem(`it_att_${uid}`, JSON.stringify(r)),
  workHours:  (uid: string): number => { const v = parseFloat(STORE.getItem(`it_wh_${uid}`) || ""); return isNaN(v) ? 9 : v; },
  saveWorkHours: (uid: string, h: number) => STORE.setItem(`it_wh_${uid}`, String(h)),
  notes:      (uid: string): Note[] => { try { return JSON.parse(STORE.getItem(`it_notesv2_${uid}`) || "[]"); } catch { return []; } },
  saveNotes:  (uid: string, n: Note[]) => STORE.setItem(`it_notesv2_${uid}`, JSON.stringify(n)),
  settings:   (uid: string): any => { try { return JSON.parse(STORE.getItem(`it_settings_${uid}`) || "null"); } catch { return null; } },
  saveSettings: (uid: string, value: any) => STORE.setItem(`it_settings_${uid}`, JSON.stringify(value)),
  holidays:   (): CalendarHoliday[] => { try { return JSON.parse(STORE.getItem("it_holidays_id") || "[]"); } catch { return []; } },
};

/* ─── Constants ──────────────────────────────────────────── */
const NAV_ITEMS = [
  { id: "dashboard",  label: "Dashboard",  Icon: LayoutDashboard },
  { id: "attendance", label: "Attendance", Icon: ClipboardList   },
  { id: "calendar",   label: "Calendar",   Icon: Calendar        },
  { id: "reports",    label: "Reports",    Icon: BarChart2       },
  { id: "notes",      label: "My Notes",   Icon: StickyNote      },
];
const DOT_COLOR = { green:"#22c55e", blue:"#3b82f6", amber:"#f59e0b", violet:"#8b5cf6" };
const DOT_BG    = { green:"rgba(34,197,94,0.18)", blue:"rgba(59,130,246,0.18)", amber:"rgba(245,158,11,0.18)", violet:"rgba(139,92,246,0.18)" };
const TAG_STYLE: Record<NoteTag,{bg:string;text:string}> = {
  "Work Log": { bg:"rgba(244,114,182,0.25)", text:"#be185d" },
  Learnings:  { bg:"rgba(96,165,250,0.22)",  text:"#1d4ed8" },
  Blockers:   { bg:"rgba(251,113,133,0.22)", text:"#b91c1c" },
  Tomorrow:   { bg:"rgba(52,211,153,0.22)",  text:"#065f46" },
};

/* ─── Helpers ────────────────────────────────────────────── */
const fmt12   = (d: Date) => d.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", hour12:true });
const fmtFull = (d: Date) => d.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" });
const fmtMs   = (ms: number) => { const h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000); return h > 0 ? `${h}h ${String(m).padStart(2,"0")}m` : `${m}m`; };
const uid     = () => Math.random().toString(36).slice(2,9);
const greet   = (d: Date) => { const h = d.getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
const initials = (name: string) => name.trim().split(/\s+/).map(n => n[0]?.toUpperCase() ?? "").join("").slice(0,2);
const localDateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const parseLocalDateKey = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

/* ─── Glass tokens ───────────────────────────────────────── */
const G = {
  sidebar: { background:"rgba(255,255,255,0.28)", backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)", borderRight:"1px solid rgba(255,255,255,0.4)" } as React.CSSProperties,
  input:   { background:"rgba(255,255,255,0.22)", border:"1px solid rgba(255,255,255,0.45)" } as React.CSSProperties,
  pill:    { background:"rgba(255,255,255,0.22)", border:"1px solid rgba(255,255,255,0.4)"  } as React.CSSProperties,
};

/* ═══════════════════════════════════════════════════════════
   ONBOARDING  (first boot — no users — dark, image-4 style)
════════════════════════════════════════════════════════════ */
function OnboardingScreen({ onCreated }: { onCreated: (u: User) => void }) {
  const [step, setStep]       = useState<"welcome"|"register">("welcome");
  const [leaving, setLeaving] = useState(false);
  const [form, setForm]       = useState({ name:"", role:"", department:"", pin:"", confirmPin:"" });
  const [errors, setErrors]   = useState<Record<string,string>>({});
  const [submitting, setSubmitting] = useState(false);

  function startLeave(cb: () => void) { setLeaving(true); setTimeout(cb, 650); }

  async function submit() {
    const e: Record<string,string> = {};
    if (!form.name.trim()) e.name = "Full name is required";
    if (!form.role.trim()) e.role = "Intern role is required";
    if (!form.department.trim()) e.department = "Department is required";
    if (!/^\d{6}$/.test(form.pin)) e.pin = "Use exactly 6 digits";
    if (form.confirmPin !== form.pin) e.confirmPin = "PINs do not match";
    if (Object.keys(e).length) { setErrors(e); return; }
    const firstName = form.name.trim().split(" ")[0];
    const user: User = {
      id: uid(), name: form.name.trim(), firstName,
      role: form.role.trim(), department: form.department.trim(),
      initials: initials(form.name),
      startDate: localDateKey(new Date()),
      hasPin: true,
    };
    setSubmitting(true);
    setErrors({});
    try {
      await STORE.registerProfile(user, form.pin);
      const hydratedUser = LS.users().find(entry => entry.id === user.id) || user;
      startLeave(() => onCreated(hydratedUser));
    } catch (error) {
      setErrors({ submit:error instanceof Error ? error.message : "Unable to create this profile." });
      setSubmitting(false);
    }
  }

  return (
    <div className="it-onboarding-screen min-h-[100dvh] flex flex-col items-center justify-center py-8 relative overflow-x-hidden overflow-y-auto"
      style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", background:"#0c0c0e",
        opacity: leaving ? 0 : 1,
        transform: leaving ? "scale(1.06)" : "scale(1)",
        filter: leaving ? "blur(12px)" : "blur(0px)",
        transition:"opacity 0.65s cubic-bezier(0.4,0,0.2,1), transform 0.65s cubic-bezier(0.4,0,0.2,1), filter 0.65s cubic-bezier(0.4,0,0.2,1)",
      }}>

      {/* Big blob hero — centered top, like image-4 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/4 pointer-events-none"
        style={{ width:520, height:520, borderRadius:"50%",
          background:"radial-gradient(ellipse at 40% 38%, #7eb3ff 0%, #9b6fd4 30%, #d4956a 55%, transparent 75%)",
          filter:"blur(72px)", opacity:0.72 }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{ width:260, height:260, borderRadius:"50%",
          background:"radial-gradient(circle, #a0c4ff 0%, transparent 70%)",
          filter:"blur(40px)", opacity:0.35 }} />

      {/* Content */}
      <div className="relative z-10 w-full max-w-xs px-6 flex flex-col items-center"
        style={{ animation:"fadeUp 0.7s ease both" }}>

        {step === "welcome" && <>
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
            style={{ background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)", backdropFilter:"blur(12px)" }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="8" r="4" fill="white"/>
              <circle cx="6"  cy="10" r="3" fill="white" opacity="0.7"/>
              <circle cx="22" cy="10" r="3" fill="white" opacity="0.7"/>
              <path d="M2 24c0-4.418 3.582-8 8-8h8c4.418 0 8 3.582 8 8" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
              <path d="M0 22c0-2.761 1.79-4 4-4" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.5"/>
              <path d="M28 22c0-2.761-1.79-4-4-4" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.5"/>
            </svg>
          </div>

          <h1 className="text-2xl font-black text-white text-center mb-2" style={{ letterSpacing:"-0.03em" }}>
            Welcome to InternTrack
          </h1>
          <p className="text-sm text-center mb-8 leading-relaxed" style={{ color:"rgba(255,255,255,0.45)" }}>
            Track attendance, log activities, and stay on top of your internship — all in one place.
          </p>

          <button onClick={() => startLeave(() => { setLeaving(false); setStep("register"); })}
            className="w-full py-3.5 rounded-full font-bold text-sm text-[#0c0c0e] mb-4 transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background:"#ffffff", boxShadow:"0 4px 24px rgba(255,255,255,0.2)" }}>
            Get Started
          </button>

          <p className="text-xs" style={{ color:"rgba(255,255,255,0.35)" }}>
            By continuing, you agree to our{" "}
            <span className="underline cursor-pointer" style={{ color:"rgba(255,255,255,0.6)" }}>Terms of Service</span>
            {" "}and{" "}
            <span className="underline cursor-pointer" style={{ color:"rgba(255,255,255,0.6)" }}>Privacy Policy</span>.
          </p>
        </>}

        {step === "register" && <>
          <div className="w-full mb-6 text-center">
            <h2 className="text-xl font-black text-white mb-1" style={{ letterSpacing:"-0.03em" }}>Create your profile</h2>
            <p className="text-xs" style={{ color:"rgba(255,255,255,0.4)" }}>This sets up your personal attendance dashboard.</p>
          </div>

          <div className="w-full space-y-3 mb-6">
            {/* Full name */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color:"rgba(255,255,255,0.4)" }}>Full Name</label>
              <input
                autoFocus
                value={form.name}
                onChange={e => { setForm(p => ({...p, name:e.target.value})); setErrors(p => ({...p, name:""})); }}
                onKeyDown={e => e.key === "Enter" && submit()}
                placeholder="e.g. Mia Tanaka"
                className="w-full px-4 py-3 rounded-2xl text-sm text-white outline-none transition-all placeholder:text-white/20"
                style={{ background:"rgba(255,255,255,0.08)", border: errors.name ? "1px solid rgba(251,113,133,0.8)" : "1px solid rgba(255,255,255,0.14)", backdropFilter:"blur(12px)" }}
              />
              {errors.name && <p className="text-[11px] mt-1" style={{ color:"#fb7185" }}>{errors.name}</p>}
            </div>

            {/* Intern role */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color:"rgba(255,255,255,0.4)" }}>Intern Role</label>
              <input
                value={form.role}
                onChange={e => { setForm(p => ({...p, role:e.target.value})); setErrors(p => ({...p, role:""})); }}
                onKeyDown={e => e.key === "Enter" && submit()}
                placeholder="e.g. Business Controlling Intern"
                className="w-full px-4 py-3 rounded-2xl text-sm text-white outline-none transition-all placeholder:text-white/20"
                style={{ background:"rgba(255,255,255,0.08)", border: errors.role ? "1px solid rgba(251,113,133,0.8)" : "1px solid rgba(255,255,255,0.14)", backdropFilter:"blur(12px)" }}
              />
              {errors.role && <p className="text-[11px] mt-1" style={{ color:"#fb7185" }}>{errors.role}</p>}
            </div>

            {/* Department */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color:"rgba(255,255,255,0.4)" }}>Department</label>
              <input
                value={form.department}
                onChange={e => { setForm(p => ({...p, department:e.target.value})); setErrors(p => ({...p, department:""})); }}
                onKeyDown={e => e.key === "Enter" && submit()}
                placeholder="e.g. Finance & Controlling"
                className="w-full px-4 py-3 rounded-2xl text-sm text-white outline-none transition-all placeholder:text-white/20"
                style={{ background:"rgba(255,255,255,0.08)", border: errors.department ? "1px solid rgba(251,113,133,0.8)" : "1px solid rgba(255,255,255,0.14)", backdropFilter:"blur(12px)" }}
              />
              {errors.department && <p className="text-[11px] mt-1" style={{ color:"#fb7185" }}>{errors.department}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color:"rgba(255,255,255,0.4)" }}>6-digit PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={6}
                  value={form.pin}
                  onChange={e => { setForm(p => ({...p, pin:e.target.value.replace(/\D/g, "").slice(0,6)})); setErrors(p => ({...p, pin:"", submit:""})); }}
                  placeholder="••••••"
                  className="w-full px-4 py-3 rounded-2xl text-sm text-white text-center tracking-[0.35em] outline-none transition-all placeholder:text-white/20"
                  style={{ background:"rgba(255,255,255,0.08)", border: errors.pin ? "1px solid rgba(251,113,133,0.8)" : "1px solid rgba(255,255,255,0.14)", backdropFilter:"blur(12px)" }}
                />
                {errors.pin && <p className="text-[11px] mt-1" style={{ color:"#fb7185" }}>{errors.pin}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color:"rgba(255,255,255,0.4)" }}>Confirm PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={6}
                  value={form.confirmPin}
                  onChange={e => { setForm(p => ({...p, confirmPin:e.target.value.replace(/\D/g, "").slice(0,6)})); setErrors(p => ({...p, confirmPin:"", submit:""})); }}
                  onKeyDown={e => e.key === "Enter" && void submit()}
                  placeholder="••••••"
                  className="w-full px-4 py-3 rounded-2xl text-sm text-white text-center tracking-[0.35em] outline-none transition-all placeholder:text-white/20"
                  style={{ background:"rgba(255,255,255,0.08)", border: errors.confirmPin ? "1px solid rgba(251,113,133,0.8)" : "1px solid rgba(255,255,255,0.14)", backdropFilter:"blur(12px)" }}
                />
                {errors.confirmPin && <p className="text-[11px] mt-1" style={{ color:"#fb7185" }}>{errors.confirmPin}</p>}
              </div>
            </div>
          </div>

          {errors.submit && <p className="w-full text-[11px] text-center mb-3" style={{ color:"#fb7185" }}>{errors.submit}</p>}

          <button onClick={() => void submit()} disabled={submitting}
            className="w-full py-3.5 rounded-full font-bold text-sm text-[#0c0c0e] mb-4 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:scale-100"
            style={{ background:"#ffffff", boxShadow:"0 4px 24px rgba(255,255,255,0.18)" }}>
            {submitting ? "Securing profile…" : "Create Profile"}
          </button>

          <button onClick={() => { setStep("welcome"); setErrors({}); }} disabled={submitting}
            className="text-xs" style={{ color:"rgba(255,255,255,0.35)" }}>
            ← Back
          </button>
        </>}
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(24px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SIGN-IN  (returning users — dark, consistent with onboarding)
════════════════════════════════════════════════════════════ */
function SignInScreen({ users, onSelect, onAddNew }: { users: User[]; onSelect: (u: User) => void; onAddNew: () => void }) {
  const [leaving, setLeaving]   = useState(false);
  const [selected, setSelected] = useState<User>(users[0]);
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPin("");
    setAuthError("");
  }, [selected?.id]);

  async function enter() {
    if (!selected || !/^\d{6}$/.test(pin)) {
      setAuthError("Enter your 6-digit PIN.");
      return;
    }
    setSubmitting(true);
    setAuthError("");
    try {
      await STORE.unlockProfile(selected.id, pin, !selected.hasPin);
      const hydratedUser = LS.users().find(user => user.id === selected.id) || selected;
      setLeaving(true);
      setTimeout(() => onSelect(hydratedUser), 650);
    } catch (error) {
      if (error instanceof PinAuthError) {
        if (error.lockedUntil) {
          const unlockTime = new Date(error.lockedUntil).toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" });
          setAuthError(`${error.message} Available again at ${unlockTime}.`);
        } else if (error.attemptsRemaining != null) {
          setAuthError(`${error.message} ${error.attemptsRemaining} attempt${error.attemptsRemaining === 1 ? "" : "s"} remaining.`);
        } else setAuthError(error.message);
      } else setAuthError(error instanceof Error ? error.message : "Unable to verify this PIN.");
      setPin("");
      setSubmitting(false);
    }
  }

  return (
    <div className="it-signin-screen min-h-[100dvh] flex flex-col items-center justify-center py-8 relative overflow-x-hidden overflow-y-auto"
      style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", background:"#0c0c0e",
        opacity: leaving ? 0 : 1,
        transform: leaving ? "scale(1.06)" : "scale(1)",
        filter: leaving ? "blur(12px)" : "blur(0px)",
        transition:"opacity 0.65s cubic-bezier(0.4,0,0.2,1), transform 0.65s cubic-bezier(0.4,0,0.2,1), filter 0.65s cubic-bezier(0.4,0,0.2,1)",
      }}>

      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/4 pointer-events-none"
        style={{ width:500, height:500, borderRadius:"50%",
          background:"radial-gradient(ellipse at 40% 38%, #7eb3ff 0%, #9b6fd4 30%, #d4956a 55%, transparent 75%)",
          filter:"blur(72px)", opacity:0.65 }} />

      <div className="relative z-10 w-full max-w-xs px-6 flex flex-col items-center"
        style={{ animation:"fadeUp 0.7s ease both" }}>

        {/* Logotype */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex gap-0 leading-none mb-1">
            <span className="text-2xl font-black text-white" style={{ letterSpacing:"-0.04em" }}>Intern</span>
            <span className="text-2xl font-black" style={{ letterSpacing:"-0.04em", background:"linear-gradient(135deg,#f472b6,#be185d)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Track</span>
          </div>
          <p className="text-xs" style={{ color:"rgba(255,255,255,0.35)" }}>Who's clocking in today?</p>
        </div>

        {/* Profile cards */}
        <div className="w-full space-y-2 mb-5">
          {users.map(u => {
            const active = u.id === selected.id;
            return (
              <button key={u.id} onClick={() => setSelected(u)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all"
                style={active
                  ? { background:"rgba(244,114,182,0.18)", border:"1.5px solid rgba(244,114,182,0.45)" }
                  : { background:"rgba(255,255,255,0.06)", border:"1.5px solid rgba(255,255,255,0.1)" }
                }>
                <DarkAvatar initials={u.initials} size={36} active={active} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-white truncate">{u.name}</p>
                  <p className="text-[11px] truncate" style={{ color:"rgba(255,255,255,0.4)" }}>{u.role}</p>
                </div>
                <div className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all"
                  style={{ borderColor: active ? "#e11d48" : "rgba(255,255,255,0.2)", background: active ? "#e11d48" : "transparent" }}>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="w-full mb-4">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color:"rgba(255,255,255,0.42)" }}>
              {selected?.hasPin ? "Security PIN" : "Create security PIN"}
            </label>
            {!selected?.hasPin && <span className="text-[9px]" style={{ color:"rgba(255,255,255,0.32)" }}>First secure sign-in</span>}
          </div>
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={6}
            value={pin}
            onChange={event => { setPin(event.target.value.replace(/\D/g, "").slice(0, 6)); setAuthError(""); }}
            onKeyDown={event => event.key === "Enter" && void enter()}
            placeholder="••••••"
            aria-label={selected?.hasPin ? "Enter 6-digit PIN" : "Create a 6-digit PIN"}
            className="w-full px-4 py-3.5 rounded-2xl text-center text-base text-white tracking-[0.55em] outline-none transition-all placeholder:text-white/20"
            style={{ background:"rgba(255,255,255,0.08)", border:authError ? "1px solid rgba(251,113,133,0.75)" : "1px solid rgba(255,255,255,0.14)", backdropFilter:"blur(12px)" }}
          />
          {authError && <p role="alert" className="text-[11px] mt-1.5 px-1 leading-4" style={{ color:"#fb7185" }}>{authError}</p>}
          {!selected?.hasPin && !authError && (
            <p className="text-[10px] mt-1.5 px-1 leading-4" style={{ color:"rgba(255,255,255,0.34)" }}>
              This existing profile has no PIN yet. The PIN you enter now will become its PIN.
            </p>
          )}
        </div>

        <button onClick={() => void enter()} disabled={submitting || pin.length !== 6}
          className="w-full py-3.5 rounded-full font-bold text-sm text-[#0c0c0e] mb-3 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
          style={{ background:"#ffffff", boxShadow:"0 4px 24px rgba(255,255,255,0.18)" }}>
          {submitting ? "Verifying…" : selected?.hasPin ? "Verify & Enter" : "Set PIN & Enter"}
        </button>

        <button onClick={onAddNew} disabled={submitting}
          className="flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
          style={{ color:"rgba(255,255,255,0.4)" }}>
          <UserPlus size={13} /> Add new profile
        </button>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(24px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN APP
════════════════════════════════════════════════════════════ */
function InternTrackApp() {
  // Resolve the initial screen from the Google Sheets snapshot loaded at startup
  const initialUsers = LS.users();
  const [screen, setScreen]   = useState<"onboard"|"signin"|"app">(initialUsers.length === 0 ? "onboard" : "signin");
  const [addingNew, setAddingNew] = useState(false);
  const [user, setUser]       = useState<User | null>(null);
  const [navTab, setNavTab]   = useState("dashboard");
  const [internOpen, setInternOpen] = useState(false);
  const [clockedIn, setClockedIn]   = useState(false);
  const [clockInTime, setClockInTime]   = useState<Date | null>(null);
  const [clockOutTime, setClockOutTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [now, setNow]         = useState(new Date());
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [actInput, setActInput]     = useState("");
  const [actDesc, setActDesc]       = useState("");
  const [actColor, setActColor]     = useState<ActivityEntry["color"]>("blue");
  const [showActForm, setShowActForm] = useState(false);
  const [note, setNote]         = useState("");
  const [workHours, setWorkHours] = useState(() => user ? LS.workHours(user.id) : 9);
  const [noteSavedAt, setNoteSavedAt] = useState<Date | null>(null);
  const [activeTags, setActiveTags]   = useState<NoteTag[]>([]);
  const [cloudRevision, setCloudRevision] = useState(0);
  const actEndRef = useRef<HTMLDivElement>(null);
  const activityCountRef = useRef<number | null>(null);

  function restoreClockState(userId: string, reference = new Date()) {
    const today = localDateKey(reference);
    const record = LS.att(userId).find(r =>
      r.date === today || Boolean(r.clockIn && localDateKey(new Date(r.clockIn)) === today)
    );
    const nextClockIn = record?.clockIn ? new Date(record.clockIn) : null;
    const nextClockOut = record?.clockOut ? new Date(record.clockOut) : null;

    setClockInTime(nextClockIn);
    setClockOutTime(nextClockOut);
    setClockedIn(Boolean(nextClockIn && !nextClockOut));
    setElapsed(nextClockIn
      ? Math.max(0, (nextClockOut?.getTime() ?? Date.now()) - nextClockIn.getTime())
      : 0);
  }

  async function secureSignOut() {
    await STORE.signOut();
    setUser(null);
    setAddingNew(false);
    setInternOpen(false);
    setNavTab("dashboard");
    setScreen(LS.users().length ? "signin" : "onboard");
  }

  // Load per-user data and restore today's shared clock session.
  useEffect(() => {
    if (!user) return;
    const storedActivities = LS.activities(user.id);
    activityCountRef.current = storedActivities.length;
    setActivities(storedActivities);
    setWorkHours(LS.workHours(user.id));
    setNote(LS.note(user.id));
    setActiveTags([]);
    restoreClockState(user.id);
  }, [user?.id]);

  // Pull changes made on another device whenever this tab becomes active, and
  // periodically while it remains open. No UI changes are required.
  useEffect(() => {
    const unsubscribe = STORE.subscribe((changedKeys) => {
      setCloudRevision(value => value + 1);

      if (changedKeys.includes("it_users")) {
        const syncedUsers = LS.users();
        if (user) {
          const syncedUser = syncedUsers.find(entry => entry.id === user.id);
          if (syncedUser) {
            setUser(current => current?.id === syncedUser.id ? syncedUser : current);
          } else {
            setUser(null);
            setScreen(syncedUsers.length ? "signin" : "onboard");
          }
        } else if (screen === "onboard" && syncedUsers.length) {
          setScreen("signin");
        }
      }

      if (user && changedKeys.includes(`it_att_${user.id}`)) restoreClockState(user.id);
    });

    const refreshCloud = () => {
      if (document.visibilityState === "visible") {
        void STORE.refresh().catch(error => {
          if (error instanceof PinAuthError && error.code.startsWith("SESSION_")) {
            void secureSignOut();
          } else console.error("Cloud refresh failed.", error);
        });
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshCloud();
    };

    window.addEventListener("focus", refreshCloud);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const refreshTimer = window.setInterval(refreshCloud, 30000);

    return () => {
      unsubscribe();
      window.removeEventListener("focus", refreshCloud);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(refreshTimer);
    };
  }, [user?.id, screen]);

  // Persist activities
  useEffect(() => {
    if (!user) return;
    LS.saveAct(user.id, activities);
    void STORE.syncNow().catch(error => console.error("Activity sync failed.", error));
  }, [activities]);

  // Clock ticker
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
      if (clockedIn && clockInTime) setElapsed(Date.now() - clockInTime.getTime());
    }, 1000);
    return () => clearInterval(t);
  }, [clockedIn, clockInTime]);

  useEffect(() => {
    const previousCount = activityCountRef.current;
    if (previousCount !== null && activities.length > previousCount) {
      actEndRef.current?.scrollIntoView({ behavior:"smooth", block:"nearest" });
    }
    activityCountRef.current = activities.length;
  }, [activities.length]);

  // Flexible shift: workday duration anchored to clock-in time
  const WORK_DURATION_MS = workHours * 60 * 60 * 1000;
  const workStart  = clockInTime ?? (() => { const d = new Date(); d.setHours(9,0,0,0); return d; })();
  const endOfShift = new Date(workStart.getTime() + WORK_DURATION_MS);
  const shiftProg  = clockedIn && clockInTime
    ? Math.min(100, Math.max(0, Math.round(((now.getTime() - clockInTime.getTime()) / WORK_DURATION_MS) * 100)))
    : 0;

  function doClockIn() {
    if (!user) return;
    const ts = new Date();
    const today = localDateKey(ts);
    const att = LS.att(user.id);
    const existing = att.find(r =>
      r.date === today || Boolean(r.clockIn && localDateKey(new Date(r.clockIn)) === today)
    );

    // A session may have been started on another device. Reuse it instead of
    // creating a duplicate entry.
    if (existing?.clockIn) {
      restoreClockState(user.id, ts);
      return;
    }

    const next = [...att, { date:today, clockIn:ts.toISOString(), clockOut:null, type:"present" as const }];
    LS.saveAtt(user.id, next);
    setClockedIn(true); setClockInTime(ts); setClockOutTime(null); setElapsed(0);
    void STORE.syncNow();
  }
  function doClockOut() {
    if (!user) return;
    const ts = new Date();
    const today = localDateKey(ts);
    const att = LS.att(user.id);
    const recordIndex = att.findIndex(r =>
      r.date === today || Boolean(r.clockIn && localDateKey(new Date(r.clockIn)) === today)
    );

    if (recordIndex < 0 || !att[recordIndex].clockIn) {
      // Refresh once in case this device was asleep while another device clocked in.
      void STORE.refresh().then(() => restoreClockState(user.id));
      return;
    }

    const next = att.map((record, index) => index === recordIndex
      ? { ...record, clockOut: ts.toISOString() }
      : record);
    LS.saveAtt(user.id, next);
    setClockedIn(false); setClockOutTime(ts);
    setElapsed(Math.max(0, ts.getTime() - new Date(next[recordIndex].clockIn!).getTime()));
    void STORE.syncNow();
  }
  function addActivity() {
    if (!actInput.trim()) return;
    setActivities(p => [...p, { id:uid(), title:actInput.trim(), description:actDesc.trim(), time:new Date().toISOString(), color:actColor }]);
    setActInput(""); setActDesc(""); setShowActForm(false);
  }
  function saveNote() {
    if (!user || !note.trim()) return;
    LS.saveNote(user.id, note);
    // Also persist as a named note in the notes array
    const today = localDateKey(new Date());
    const existing = LS.notes(user.id);
    const todayNote = existing.find(n => n.createdAt.slice(0, 10) === today && n.tags.includes("Work Log"));
    const now2 = new Date().toISOString();
    if (todayNote) {
      const updated = existing.map(n => n.id === todayNote.id ? { ...n, content: note, updatedAt: now2 } : n);
      LS.saveNotes(user.id, updated);
    } else {
      const newNote: Note = { id: uid(), title: `${new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"})} Notes`, content: note, tags: activeTags.length ? activeTags : ["Work Log"], createdAt: now2, updatedAt: now2, gradient: 0 };
      LS.saveNotes(user.id, [newNote, ...existing]);
    }
    void STORE.syncNow().catch(error => console.error("Quick note sync failed.", error));
    setNoteSavedAt(new Date());
  }

  const totalLogged = clockedIn && clockInTime ? elapsed : (!clockedIn && clockInTime && clockOutTime ? clockOutTime.getTime()-clockInTime.getTime() : 0);
  const allUsers = LS.users();

  /* ── Screen routing ── */
  if (screen === "onboard" || addingNew) {
    return <OnboardingScreen onCreated={(u) => { setUser(u); setAddingNew(false); setScreen("app"); }} />;
  }
  if (screen === "signin") {
    return (
      <SignInScreen
        users={allUsers}
        onSelect={(u) => { setUser(u); setScreen("app"); }}
        onAddNew={() => setAddingNew(true)}
      />
    );
  }
  if (!user) return null;

  /* ── Dashboard ── */
  return (
    <div className="it-app-shell flex h-[100dvh] overflow-hidden" style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", animation:"dashEnter 0.7s cubic-bezier(0.22,1,0.36,1) both" }}>
      <style>{`
        @keyframes dashEnter {
          from { opacity: 0; transform: scale(0.96); filter: blur(10px); }
          to   { opacity: 1; transform: scale(1);    filter: blur(0);    }
        }
      `}</style>

      {/* Background */}
      <div className="fixed inset-0 -z-10" style={{ background:"linear-gradient(145deg,#fda4c8 0%,#f472b6 25%,#e879a0 50%,#db2777 70%,#be185d 100%)" }} />
      <div className="fixed -z-10 rounded-full" style={{ width:600, height:600, bottom:-120, right:-120, background:"radial-gradient(circle,#ff80c0 0%,#f9a8d4 45%,transparent 70%)", filter:"blur(60px)", opacity:0.9 }} />
      <div className="fixed -z-10 rounded-full" style={{ width:420, height:420, top:-60, left:-60, background:"radial-gradient(circle,#fce4ec 0%,#fbcfe8 50%,transparent 75%)", filter:"blur(48px)", opacity:0.8 }} />
      <div className="fixed -z-10 rounded-full" style={{ width:280, height:280, top:"38%", right:"18%", background:"radial-gradient(circle,#f43f5e55 0%,transparent 80%)", filter:"blur(36px)" }} />

      {/* ── SIDEBAR (desktop only) ── */}
      <aside className="w-[200px] shrink-0 hidden md:flex flex-col sticky top-0 h-full overflow-y-auto" style={G.sidebar}>
        {/* Logotype */}
        <div className="flex flex-col gap-1 px-5 py-5" style={{ borderBottom:"1px solid rgba(255,255,255,0.3)" }}>
          <div className="flex items-center">
            <div className="flex flex-col leading-none">
              <span className="font-black text-xl text-[#3d0a20]" style={{ letterSpacing:"-0.03em" }}>Intern</span>
              <span className="font-black text-xl" style={{ letterSpacing:"-0.03em", background:"linear-gradient(135deg,#f472b6,#be185d)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Track</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className="text-[10px] font-semibold text-pink-300 uppercase tracking-widest px-2 mb-2">Main</p>
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const active = navTab === id;
            return (
              <button key={id} onClick={() => setNavTab(id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all text-left"
                style={active
                  ? { background:"rgba(255,255,255,0.35)", color:"#be185d", fontWeight:600, boxShadow:"inset 0 1px 0 rgba(255,255,255,0.6)" }
                  : { color:"rgba(61,10,32,0.7)" }
                }>
                <Icon size={15} /> {label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 pb-4 space-y-1" style={{ borderTop:"1px solid rgba(255,255,255,0.25)", paddingTop:12 }}>
          <button onClick={() => setNavTab("settings")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all text-left"
            style={navTab === "settings"
              ? { background:"rgba(255,255,255,0.35)", color:"#be185d", fontWeight:600 }
              : { color:"rgba(61,10,32,0.7)" }
            }>
            <Settings size={15} /> Settings
          </button>

          {/* User switcher */}
          <div className="relative mt-1">
            <button onClick={() => setInternOpen(v => !v)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/20 transition-all">
              <GlassAvatar initials={user.initials} size={30} />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-semibold text-[#3d0a20] truncate leading-tight">{user.name}</p>
                <p className="text-[10px] text-pink-400 truncate">{user.role}</p>
              </div>
              <ChevronDown size={12} className="text-pink-300 shrink-0 transition-transform" style={{ transform: internOpen ? "rotate(180deg)" : "none" }} />
            </button>

            {internOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl overflow-hidden z-30"
                style={{ background:"rgba(255,255,255,0.88)", backdropFilter:"blur(20px)", boxShadow:"0 -8px 32px rgba(180,30,80,0.18)", border:"1px solid rgba(255,255,255,0.5)" }}>
                {allUsers.map(u => (
                  <button key={u.id} onClick={() => { setUser(u); setInternOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-pink-50 transition-colors text-left"
                    style={{ borderBottom:"1px solid rgba(244,114,182,0.1)" }}>
                    <GlassAvatar initials={u.initials} size={24} />
                    <div>
                      <p className="text-xs font-semibold text-[#3d0a20]">{u.name}</p>
                      <p className="text-[10px] text-pink-400">{u.role}</p>
                    </div>
                  </button>
                ))}
                <button onClick={() => { setInternOpen(false); setAddingNew(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-pink-50 transition-colors text-left">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background:"rgba(244,114,182,0.2)" }}>
                    <UserPlus size={11} className="text-pink-500" />
                  </div>
                  <p className="text-xs font-semibold text-pink-500">Add new profile</p>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="it-main flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-4 md:px-7 py-5 md:py-6 pb-28 md:pb-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5 md:mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#3d0a20]">
              {navTab === "dashboard" ? `${greet(now)}, ${user.firstName}` :
               navTab === "attendance" ? "Attendance" :
               navTab === "settings"   ? "Settings" :
               navTab === "reports"    ? "Reports" :
               navTab === "calendar"   ? "Calendar" : "My Notes"}
            </h1>
            <p className="text-xs md:text-sm mt-0.5" style={{ color:"rgba(61,10,32,0.55)" }}>
              {navTab === "dashboard"  ? "Here's your attendance overview for today" :
               navTab === "attendance" ? `Monthly overview for ${user.firstName}` :
               navTab === "settings"   ? "Manage your profile, preferences and notifications" :
               navTab === "reports"    ? `Performance & attendance insights for ${user.firstName}` : ""}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-xl px-3 py-2" style={{ ...G.pill, color:"#7c3d52" }}>
            <Calendar size={13} className="text-pink-400" />
            <span className="text-xs font-medium">{fmtFull(now)}</span>
          </div>
        </div>

        {/* Tab content */}
        {navTab === "attendance" && <AttendanceView user={user} now={now} cloudRevision={cloudRevision} />}
        {navTab === "settings"   && <SettingsView user={user} workHours={workHours} onWorkHoursChange={(h) => { setWorkHours(h); LS.saveWorkHours(user.id, h); }} onUserChange={(u) => { setUser(u); const users = LS.users().map(x => x.id === u.id ? u : x); LS.saveUsers(users); }} onSignOut={secureSignOut} />}
        {navTab === "reports"    && <ReportsView user={user} activities={activities} attRecords={LS.att(user.id)} />}
        {navTab === "calendar"   && <CalendarView user={user} now={now} cloudRevision={cloudRevision} />}
        {navTab === "notes"      && <NotesView user={user} now={now} />}
        {navTab !== "dashboard" && navTab !== "attendance" && navTab !== "settings" && navTab !== "reports" && navTab !== "calendar" && navTab !== "notes" && (
          <div className="flex items-center justify-center h-64">
            <p className="text-sm" style={{ color:"rgba(61,10,32,0.35)" }}>This section is coming soon.</p>
          </div>
        )}

        {navTab === "dashboard" && (<>
          {/* Stat cards */}
          <div className="it-stat-grid grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard icon={<Clock size={16}/>}       iconBg="rgba(251,146,60,0.18)"  iconColor="#ea580c" label="Hours Today"     value={totalLogged > 0 ? fmtMs(totalLogged) : "—"} />
            <StatCard icon={<CheckCircle size={16}/>} iconBg="rgba(52,211,153,0.18)"  iconColor="#059669" label="Days Present"    value={String(LS.att(user.id).filter(r => r.clockIn).length)} />
            <StatCard icon={<TrendingUp size={16}/>}  iconBg="rgba(244,114,182,0.22)" iconColor="#be185d" label="Tasks Logged"    value={String(activities.length)} />
            <StatCard icon={<Zap size={16}/>}          iconBg="rgba(250,204,21,0.22)"  iconColor="#a16207" label="Notes Saved"     value={noteSavedAt ? "1" : "0"} />
          </div>

          {/* Calendar widget */}
          <div className="it-calendar-section mb-5">
            <CalendarWidget now={now} onLogActivity={(title) => {
              setActivities(p => [...p, { id:uid(), title, description:"", time:new Date().toISOString(), color:"blue" }]);
            }} />
          </div>

          {/* Clock row */}
          <style>{`
            @keyframes pulseGlow {
              0%   { box-shadow: 0 0 0 0   rgba(225,29,72,0.55); }
              60%  { box-shadow: 0 0 0 6px rgba(225,29,72,0.0);  }
              100% { box-shadow: 0 0 0 0   rgba(225,29,72,0.0);  }
            }
            @keyframes shimmer {
              0%   { background-position: -200% 0; }
              100% { background-position:  200% 0; }
            }
          `}</style>
          <div className="it-clock-grid grid grid-cols-1 md:grid-cols-2 gap-4 mb-5 items-stretch">

            {/* ── Clock In ── */}
            <div className="it-clock-card rounded-2xl p-5 flex flex-col"
              style={{ background:"rgba(255,255,255,0.22)", backdropFilter:"blur(22px)", WebkitBackdropFilter:"blur(22px)", border:"1px solid rgba(255,255,255,0.40)", boxShadow:"0 6px 40px rgba(180,30,80,0.10), inset 0 1px 0 rgba(255,255,255,0.58)" }}>
              <p className="text-[10px] font-semibold text-pink-300 uppercase tracking-widest mb-3">Clock In</p>

              {/* Time display */}
              <div className="text-3xl md:text-4xl font-bold text-[#3d0a20] tabular-nums mb-3 leading-none" style={{ fontFamily:"'DM Mono',monospace" }}>
                {clockInTime ? fmt12(clockInTime) : "—"}
              </div>

              {/* Status row */}
              <div className="flex items-center gap-2.5 mb-4">
                {clockedIn
                  ? <StatusPill color="#22c55e" bg="rgba(34,197,94,0.18)" label="Clocked In" />
                  : clockInTime
                    ? <StatusPill color="#f472b6" bg="rgba(244,114,182,0.2)" label="Clocked Out" />
                    : <StatusPill color="rgba(200,180,190,0.7)" bg="rgba(255,255,255,0.12)" label="Not yet" />
                }
                {clockedIn && (
                  <span className="text-xs" style={{ color:"rgba(61,10,32,0.5)" }}>
                    Session: {fmtMs(elapsed)}
                  </span>
                )}
              </div>

              {/* Spacer so button stays at bottom */}
              <div className="flex-1" />

              <GradientButton onClick={doClockIn} disabled={clockedIn} dimmed={clockedIn}
                dimStyle={{ background:"rgba(255,255,255,0.22)", color:"rgba(61,10,32,0.42)" }}>
                <CheckCircle size={14} />
                {clockedIn ? "Already Clocked In" : "Clock In Now"}
              </GradientButton>
            </div>

            {/* ── Clock Out ── */}
            <div className="it-clock-card rounded-2xl p-5 flex flex-col"
              style={{ background:"rgba(255,255,255,0.22)", backdropFilter:"blur(22px)", WebkitBackdropFilter:"blur(22px)", border:"1px solid rgba(255,255,255,0.40)", boxShadow:"0 6px 40px rgba(180,30,80,0.10), inset 0 1px 0 rgba(255,255,255,0.58)" }}>
              <p className="text-[10px] font-semibold text-pink-300 uppercase tracking-widest mb-3">Clock Out</p>

              {/* Time display */}
              <div className="text-3xl md:text-4xl font-bold text-[#3d0a20] tabular-nums mb-3 leading-none" style={{ fontFamily:"'DM Mono',monospace" }}>
                {clockOutTime ? fmt12(clockOutTime) : "—"}
              </div>

              {/* Status + end-of-shift row */}
              <div className="flex flex-wrap items-center justify-between gap-y-1.5 gap-x-2 mb-4">
                {clockOutTime
                  ? <StatusPill color="#22c55e" bg="rgba(34,197,94,0.18)" label="Clocked Out" />
                  : <StatusPill color="rgba(200,180,190,0.7)" bg="rgba(255,255,255,0.12)" label="Not yet" />
                }
                <span className="text-xs whitespace-nowrap" style={{ color:"rgba(61,10,32,0.45)" }}>
                  End: {fmt12(endOfShift)}
                </span>
              </div>

              {/* Shift progress — always present, dims when not active */}
              <div className="mb-4">
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span style={{ color:"rgba(61,10,32,0.5)" }}>Shift Progress</span>
                  <span className="font-semibold" style={{ color: clockedIn ? "#e11d48" : "rgba(61,10,32,0.3)" }}>
                    {shiftProg}%
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-visible relative" style={{ background:"rgba(255,255,255,0.2)" }}>
                  <div className="h-full rounded-full transition-all duration-1000 relative overflow-hidden"
                    style={{ width:`${shiftProg}%`, background:"linear-gradient(90deg,#f9a8d4,#e11d48)", opacity: clockedIn ? 1 : 0.35 }}>
                    {clockedIn && (
                      <div style={{
                        position:"absolute", inset:0,
                        background:"linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.45) 50%,transparent 100%)",
                        backgroundSize:"200% 100%",
                        animation:"shimmer 2.2s ease-in-out infinite",
                      }} />
                    )}
                  </div>
                  {clockedIn && shiftProg > 2 && shiftProg < 100 && (
                    <div style={{
                      position:"absolute", top:"50%", left:`${shiftProg}%`,
                      transform:"translate(-50%,-50%)",
                      width:8, height:8, borderRadius:"50%",
                      background:"#e11d48",
                      animation:"pulseGlow 1.8s ease-out infinite",
                    }} />
                  )}
                </div>
                <div className="flex justify-between text-[10px] mt-1.5" style={{ color:"rgba(61,10,32,0.35)" }}>
                  <span>{fmt12(workStart)}</span>
                  <span>{fmt12(endOfShift)}</span>
                </div>
              </div>

              {/* Spacer so button aligns with left card */}
              <div className="flex-1" />

              <GradientButton onClick={doClockOut} disabled={!clockedIn} dimmed={!clockedIn}
                dimStyle={{ background:"rgba(255,255,255,0.22)", color:"rgba(61,10,32,0.42)" }}>
                <LogOut size={14} />
                {clockedIn ? "Clock Out Now" : clockOutTime ? "Already Clocked Out" : "Not Clocked In"}
              </GradientButton>
            </div>
          </div>

          {/* Activity + Notes */}
          <div className="it-dashboard-lower grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {/* Activity */}
            <GlassCard noPad className="it-dashboard-panel h-full min-h-[440px]">
              <div className="flex items-center justify-between px-5 pt-5 pb-3" style={{ borderBottom:"1px solid rgba(255,255,255,0.28)" }}>
                <div className="flex items-center gap-2">
                  <ClipboardList size={15} className="text-pink-300" />
                  <span className="font-semibold text-sm text-[#3d0a20]">Today's Activity</span>
                </div>
                <span className="text-xs font-semibold text-pink-500 rounded-full px-2.5 py-0.5" style={{ background:"rgba(244,114,182,0.2)" }}>
                  {activities.length} {activities.length === 1 ? "entry" : "entries"}
                </span>
              </div>

              <div className="overflow-y-auto flex-1 min-h-0 px-5 py-3 space-y-0.5" style={{ minHeight:202 }}>
                {activities.length === 0
                  ? <div className="h-full flex items-center justify-center">
                      <EmptyState icon={<ClipboardList size={20} className="text-pink-200" />} text="No activity logged yet." sub="Start by logging what you're working on." />
                    </div>
                  : activities.map(a => (
                    <div key={a.id} className="flex items-start gap-3 py-2.5 group" style={{ borderBottom:"1px solid rgba(255,255,255,0.2)" }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background:DOT_BG[a.color] }}>
                        <span className="w-2 h-2 rounded-full" style={{ background:DOT_COLOR[a.color] }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#3d0a20] leading-tight">{a.title}</p>
                        {a.description && <p className="text-xs mt-0.5 leading-relaxed" style={{ color:"rgba(61,10,32,0.55)" }}>{a.description}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        <span className="text-[11px] tabular-nums" style={{ color:"rgba(61,10,32,0.4)", fontFamily:"'DM Mono',monospace" }}>{fmt12(new Date(a.time))}</span>
                        <button onClick={() => setActivities(p => p.filter(x => x.id !== a.id))}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all hover:bg-rose-100 text-pink-300 hover:text-rose-400">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))
                }
                <div ref={actEndRef} />
              </div>

              {showActForm && (
                <div className="px-5 py-3 space-y-2" style={{ borderTop:"1px solid rgba(255,255,255,0.25)" }}>
                  <input value={actInput} onChange={e => setActInput(e.target.value)} onKeyDown={e => e.key==="Enter" && addActivity()}
                    placeholder="Activity title" autoFocus
                    className="w-full px-3 py-2 rounded-xl text-sm text-[#3d0a20] outline-none placeholder:text-pink-300/60" style={G.input} />
                  <input value={actDesc} onChange={e => setActDesc(e.target.value)}
                    placeholder="Short description (optional)"
                    className="w-full px-3 py-2 rounded-xl text-sm text-[#3d0a20] outline-none placeholder:text-pink-300/60" style={G.input} />
                  <div className="flex gap-2 items-center">
                    <div className="flex gap-1.5">
                      {(["green","blue","amber","violet"] as const).map(c => (
                        <button key={c} onClick={() => setActColor(c)} className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                          style={{ background:DOT_COLOR[c], outline: actColor===c ? `2px solid ${DOT_COLOR[c]}` : "none", outlineOffset:2 }} />
                      ))}
                    </div>
                    <div className="flex gap-2 ml-auto">
                      <button onClick={() => setShowActForm(false)} className="text-xs px-2 py-1" style={{ color:"rgba(61,10,32,0.5)" }}>Cancel</button>
                      <button onClick={addActivity} disabled={!actInput.trim()}
                        className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg disabled:opacity-40"
                        style={{ background:"linear-gradient(135deg,#f472b6,#e11d48)" }}>Add</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="px-5 pb-5 pt-2 shrink-0" style={{ borderTop:"1px solid rgba(255,255,255,0.25)" }}>
                <p className="text-[11px] mb-3" style={{ color:"rgba(61,10,32,0.4)" }}>
                  {activities.length} {activities.length === 1 ? "activity" : "activities"} logged today
                </p>
                <GradientButton onClick={() => setShowActForm(v => !v)} disabled={false} dimmed={false} dimStyle={{}}>
                  <Plus size={14} /> Log New Activity
                </GradientButton>
              </div>
            </GlassCard>

            {/* Notes */}
            <GlassCard noPad className="it-dashboard-panel h-full min-h-[440px]">
              <div className="flex items-center justify-between px-5 pt-5 pb-3" style={{ borderBottom:"1px solid rgba(255,255,255,0.28)" }}>
                <div className="flex items-center gap-2">
                  <FileText size={15} className="text-pink-300" />
                  <span className="font-semibold text-sm text-[#3d0a20]">Daily Notes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Edit3 size={13} className="text-pink-300" />
                  <span className="text-xs" style={{ color:"rgba(61,10,32,0.4)", fontFamily:"'DM Mono',monospace" }}>
                    {now.toLocaleDateString("en-US",{ month:"short", day:"numeric" })}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 px-5 py-3 flex-wrap" style={{ borderBottom:"1px solid rgba(255,255,255,0.25)" }}>
                {(["Work Log","Learnings","Blockers","Tomorrow"] as NoteTag[]).map(t => {
                  const on = activeTags.includes(t);
                  return (
                    <button key={t} onClick={() => setActiveTags(p => p.includes(t) ? p.filter(x=>x!==t) : [...p,t])}
                      className="text-xs font-semibold px-2.5 py-1 rounded-full transition-all"
                      style={on ? TAG_STYLE[t] : { background:"rgba(255,255,255,0.18)", color:"rgba(61,10,32,0.45)", border:"1px solid rgba(255,255,255,0.3)" }}>
                      {t}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 px-5 py-3">
                {note === "" && <p className="text-xs mb-2" style={{ color:"rgba(61,10,32,0.3)" }}>Write your thoughts, blockers, or goals for today…</p>}
                <textarea value={note} onChange={e => setNote(e.target.value)}
                  placeholder="Start writing…"
                  className="w-full resize-none text-sm text-[#3d0a20] outline-none leading-relaxed placeholder:text-pink-200/60"
                  style={{ minHeight:148, background:"transparent" }} />
              </div>

              <div className="px-5 pb-5 pt-2" style={{ borderTop:"1px solid rgba(255,255,255,0.25)" }}>
                <p className="text-[11px] mb-3" style={{ color:"rgba(61,10,32,0.4)" }}>
                  {note.length} characters{noteSavedAt ? ` · Last saved ${fmt12(noteSavedAt)}` : " · Not yet saved"}
                </p>
                <GradientButton onClick={saveNote} disabled={false} dimmed={false} dimStyle={{}}>
                  <CheckCircle size={14} /> Save Note
                </GradientButton>
              </div>
            </GlassCard>
          </div>
        </>)}
      </main>

      {/* ── MOBILE BOTTOM NAV PILL ── */}
      <nav className="it-mobile-nav md:hidden fixed bottom-5 z-40">
        <div className="it-mobile-nav-pill flex items-center gap-1 px-2 py-2 rounded-full"
          style={{ background:"rgba(255,255,255,0.32)", backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)", border:"1px solid rgba(255,255,255,0.55)", boxShadow:"0 8px 32px rgba(180,30,80,0.18), inset 0 1px 0 rgba(255,255,255,0.7)" }}>
          {[
            ...NAV_ITEMS,
            { id:"settings", label:"Settings", Icon: Settings },
          ].map(({ id, Icon }) => {
            const active = navTab === id;
            return (
              <button key={id} onClick={() => setNavTab(id)}
                className="it-mobile-nav-button w-11 h-11 flex items-center justify-center rounded-full transition-all"
                style={active
                  ? { background:"linear-gradient(135deg,#f472b6,#e11d48)", boxShadow:"0 3px 12px rgba(225,29,72,0.4)" }
                  : {}
                }>
                <Icon size={19} style={{ color: active ? "#fff" : "rgba(61,10,32,0.5)" }} />
              </button>
            );
          })}
        </div>
      </nav>

    </div>
  );
}

/* ─── Calendar Widget ────────────────────────────────────── */
function CalendarWidget({ now, onLogActivity }: { now: Date; onLogActivity: (title: string) => void }) {
  const [view, setView]       = useState<"weekly"|"monthly">("weekly");
  const [noteVal, setNoteVal] = useState("");
  const [offset, setOffset]   = useState(0); // week offset (0 = current week)

  const today = now;

  // Build the 7-day strip centered on today + offset weeks
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 3 + i + offset * 7);
    return d;
  });

  // Build a 5-week month grid
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstDow   = monthStart.getDay();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthCells  = Array.from({ length: firstDow + daysInMonth }, (_, i) => {
    if (i < firstDow) return null;
    const d = new Date(today.getFullYear(), today.getMonth(), i - firstDow + 1);
    return d;
  });

  const focusedDay = view === "weekly" ? weekDays[3] : today;
  const monthName  = focusedDay.toLocaleDateString("en-US", { month: "long" });
  const dayNum     = today.getDate();

  function submitNote() {
    if (!noteVal.trim()) return;
    onLogActivity(noteVal.trim());
    setNoteVal("");
  }

  const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  return (
    <div className="rounded-2xl p-5 overflow-hidden"
      style={{ background:"rgba(255,255,255,0.22)", backdropFilter:"blur(22px)", WebkitBackdropFilter:"blur(22px)", border:"1px solid rgba(255,255,255,0.40)", boxShadow:"0 6px 40px rgba(180,30,80,0.10), inset 0 1px 0 rgba(255,255,255,0.58)" }}>

      {/* Top row: toggle + month/day */}
      <div className="flex items-start justify-between mb-4">
        {/* Weekly / Monthly pill toggle */}
        <div className="flex items-center gap-1 p-1 rounded-2xl" style={{ background:"rgba(255,255,255,0.18)", border:"1px solid rgba(255,255,255,0.35)" }}>
          {(["weekly","monthly"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all capitalize"
              style={view === v
                ? { background:"#ffffff", color:"#1a0a10", boxShadow:"0 2px 8px rgba(180,30,80,0.12)" }
                : { color:"rgba(61,10,32,0.5)" }
              }>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* Large month + day */}
        <div className="flex items-baseline gap-3 pr-1">
          <span className="font-black text-[2.6rem] leading-none text-[#3d0a20]" style={{ letterSpacing:"-0.04em", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {monthName}
          </span>
          <span className="font-black text-[2.6rem] leading-none" style={{ letterSpacing:"-0.04em", fontFamily:"'Plus Jakarta Sans',sans-serif", background:"linear-gradient(135deg,#f472b6,#be185d)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            {dayNum}
          </span>
        </div>
      </div>

      {/* ── Weekly strip ── */}
      {view === "weekly" && (
        <div className="relative">
          {/* Prev / next week nav */}
          <button onClick={() => setOffset(o => o - 1)}
            className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full flex items-center justify-center text-pink-400 hover:bg-white/30 transition-all text-base font-bold">‹</button>
          <button onClick={() => setOffset(o => o + 1)}
            className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full flex items-center justify-center text-pink-400 hover:bg-white/30 transition-all text-base font-bold">›</button>

          <div className="grid grid-cols-7 gap-0.5 sm:gap-1 px-1 sm:px-4">
            {/* Day name row */}
            {weekDays.map((d, i) => (
              <div key={i} className="text-center">
                <p className="text-[9px] sm:text-[10px] font-semibold mb-1.5 sm:mb-2" style={{ color:"rgba(61,10,32,0.45)" }}>
                  {DAY_LABELS[d.getDay()]}
                </p>
              </div>
            ))}
            {/* Day number row */}
            {weekDays.map((d, i) => {
              const isToday = d.toDateString() === today.toDateString();
              const isPast  = d < today && !isToday;
              return (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all"
                    style={isToday
                      ? { background:"linear-gradient(135deg,#f472b6,#e11d48)", boxShadow:"0 4px 14px rgba(225,29,72,0.38)" }
                      : { background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.25)" }
                    }>
                    <span className="text-xs sm:text-sm font-bold tabular-nums"
                      style={{ color: isToday ? "#fff" : isPast ? "rgba(61,10,32,0.35)" : "#3d0a20", fontFamily:"'DM Mono',monospace" }}>
                      {d.getDate()}
                    </span>
                  </div>
                  {isToday && (
                    <span className="w-1 h-1 rounded-full mt-1" style={{ background:"#e11d48" }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Monthly grid ── */}
      {view === "monthly" && (
        <div>
          {/* Day name header */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold py-1" style={{ color:"rgba(61,10,32,0.4)" }}>{d}</div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((d, i) => {
              if (!d) return <div key={`e${i}`} />;
              const isToday = d.toDateString() === today.toDateString();
              const isPast  = d < today && !isToday;
              return (
                <div key={i} className="aspect-square flex items-center justify-center rounded-xl transition-all"
                  style={isToday
                    ? { background:"linear-gradient(135deg,#f472b6,#e11d48)", boxShadow:"0 2px 10px rgba(225,29,72,0.35)" }
                    : { background:"rgba(255,255,255,0.12)" }
                  }>
                  <span className="text-xs font-semibold tabular-nums"
                    style={{ color: isToday ? "#fff" : isPast ? "rgba(61,10,32,0.3)" : "#3d0a20" }}>
                    {d.getDate()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom: note input + log button */}
      <div className="it-calendar-note-row flex items-center gap-3 mt-4 pt-4" style={{ borderTop:"1px solid rgba(255,255,255,0.28)" }}>
        <div className="it-calendar-note-input flex-1 min-w-0 flex items-center gap-2 px-3.5 py-2.5 rounded-full" style={{ background:"rgba(255,255,255,0.18)", border:"1px solid rgba(255,255,255,0.38)" }}>
          <Edit3 size={13} className="text-pink-300 shrink-0" />
          <input
            value={noteVal}
            onChange={e => setNoteVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submitNote()}
            placeholder="Add a note…"
            className="flex-1 min-w-0 text-sm bg-transparent outline-none text-[#3d0a20] placeholder:text-pink-300/50"
          />
        </div>
        <button onClick={submitNote} disabled={!noteVal.trim()}
          className="it-calendar-log-button flex-none flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold text-white whitespace-nowrap transition-all hover:scale-105 disabled:opacity-40 disabled:scale-100"
          style={{ background:"linear-gradient(135deg,#f472b6,#e11d48)", boxShadow:"0 3px 12px rgba(225,29,72,0.3)" }}>
          <Plus size={13} /> Log Activity
        </button>
      </div>
    </div>
  );
}

/* ─── Notes View ─────────────────────────────────────────── */
const NOTE_GRADIENTS = [
  // Rose flame
  `radial-gradient(ellipse at 25% 75%, rgba(253,164,184,0.85) 0%, transparent 55%),
   radial-gradient(ellipse at 75% 20%, rgba(190,24,93,0.9) 0%, transparent 50%),
   linear-gradient(145deg, #3d0a20, #881337)`,
  // Violet haze
  `radial-gradient(ellipse at 30% 30%, rgba(216,180,254,0.8) 0%, transparent 50%),
   radial-gradient(ellipse at 75% 75%, rgba(109,40,217,0.9) 0%, transparent 50%),
   linear-gradient(145deg, #1e0a35, #3b0764)`,
  // Amber dawn
  `radial-gradient(ellipse at 65% 20%, rgba(253,230,138,0.85) 0%, transparent 50%),
   radial-gradient(ellipse at 25% 80%, rgba(217,119,6,0.85) 0%, transparent 50%),
   linear-gradient(145deg, #292005, #713f12)`,
  // Teal tide
  `radial-gradient(ellipse at 70% 30%, rgba(153,246,228,0.8) 0%, transparent 50%),
   radial-gradient(ellipse at 25% 75%, rgba(13,148,136,0.9) 0%, transparent 50%),
   linear-gradient(145deg, #021e1c, #134e4a)`,
  // Coral blaze
  `radial-gradient(ellipse at 50% 20%, rgba(254,205,211,0.85) 0%, transparent 45%),
   radial-gradient(ellipse at 80% 80%, rgba(225,29,72,0.85) 0%, transparent 50%),
   linear-gradient(145deg, #2d0512, #9f1239)`,
  // Blue aurora
  `radial-gradient(ellipse at 30% 40%, rgba(191,219,254,0.8) 0%, transparent 50%),
   radial-gradient(ellipse at 75% 65%, rgba(29,78,216,0.9) 0%, transparent 50%),
   linear-gradient(145deg, #040e2e, #1e3a8a)`,
];

// Bento pattern: col span per index (repeating)
const BENTO: { col: number; minH: number }[] = [
  { col: 2, minH: 180 },
  { col: 1, minH: 150 },
  { col: 1, minH: 150 },
  { col: 1, minH: 130 },
  { col: 1, minH: 130 },
  { col: 2, minH: 120 },
];

const TAG_COLORS_DARK: Record<NoteTag, { bg: string; text: string }> = {
  "Work Log": { bg: "rgba(244,114,182,0.3)",  text: "#fce7f3" },
  Learnings:  { bg: "rgba(147,197,253,0.28)", text: "#dbeafe" },
  Blockers:   { bg: "rgba(252,165,165,0.28)", text: "#fee2e2" },
  Tomorrow:   { bg: "rgba(110,231,183,0.28)", text: "#d1fae5" },
};

function NotesView({ user, now }: { user: User; now: Date }) {
  const [notes, setNotes]       = useState<Note[]>(() => LS.notes(user.id));
  const [filter, setFilter]     = useState<NoteTag | "All">("All");
  const [editing, setEditing]   = useState<Note | null>(null);
  const [isNew, setIsNew]       = useState(false);
  const [form, setForm]         = useState({ title: "", content: "", tags: [] as NoteTag[], gradient: 0 });

  useEffect(() => {
    LS.saveNotes(user.id, notes);
    void STORE.syncNow().catch(error => console.error("Notes sync failed.", error));
  }, [notes]);

  const filtered = filter === "All" ? notes : notes.filter(n => n.tags.includes(filter));

  function openNew() {
    const n: Note = { id: uid(), title: "", content: "", tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), gradient: notes.length % NOTE_GRADIENTS.length };
    setForm({ title: "", content: "", tags: [], gradient: n.gradient });
    setEditing(n);
    setIsNew(true);
  }

  function openEdit(n: Note) {
    setForm({ title: n.title, content: n.content, tags: n.tags, gradient: n.gradient });
    setEditing(n);
    setIsNew(false);
  }

  function saveNote() {
    if (!editing) return;
    const now2 = new Date().toISOString();
    const updated: Note = { ...editing, title: form.title || "Untitled", content: form.content, tags: form.tags, gradient: form.gradient, updatedAt: now2, ...(isNew ? { createdAt: now2 } : {}) };
    setNotes(p => isNew ? [updated, ...p] : p.map(n => n.id === updated.id ? updated : n));
    setEditing(null);
  }

  function deleteNote(id: string) {
    setNotes(p => p.filter(n => n.id !== id));
    setEditing(null);
  }

  function toggleTag(t: NoteTag) {
    setForm(p => ({ ...p, tags: p.tags.includes(t) ? p.tags.filter(x => x !== t) : [...p.tags, t] }));
  }

  const fmtRelative = (iso: string) => {
    const d = new Date(iso), diff = Date.now() - d.getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
    return d.toLocaleDateString("en-US",{ month:"short", day:"numeric" });
  };

  /* ── Editor overlay ── */
  if (editing) {
    const grad = NOTE_GRADIENTS[form.gradient];
    return (
      <div className="min-h-[70vh] flex flex-col">
        {/* Editor card */}
        <div className="rounded-3xl overflow-hidden flex flex-col flex-1" style={{ background: grad, minHeight: 420 }}>
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <button onClick={() => setEditing(null)}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full transition-all hover:bg-white/20"
              style={{ color:"rgba(255,255,255,0.75)" }}>
              ← Back
            </button>
            <div className="flex items-center gap-2">
              {!isNew && (
                <button onClick={() => deleteNote(editing.id)}
                  className="p-2 rounded-full hover:bg-white/15 transition-all"
                  style={{ color:"rgba(255,255,255,0.6)" }}>
                  <Trash2 size={15} />
                </button>
              )}
              <button onClick={saveNote}
                className="flex items-center gap-1.5 text-sm font-bold px-4 py-1.5 rounded-full transition-all hover:scale-105"
                style={{ background:"rgba(255,255,255,0.22)", color:"#fff", border:"1px solid rgba(255,255,255,0.4)", boxShadow:"0 2px 12px rgba(0,0,0,0.15)" }}>
                <CheckCircle size={13} /> Save
              </button>
            </div>
          </div>

          {/* Title input */}
          <input
            value={form.title}
            onChange={e => setForm(p => ({...p, title: e.target.value}))}
            placeholder="Note title…"
            className="mx-5 mb-2 bg-transparent outline-none font-black text-white placeholder:text-white/30 text-2xl"
            style={{ letterSpacing:"-0.02em" }}
          />

          {/* Content textarea */}
          <textarea
            value={form.content}
            onChange={e => setForm(p => ({...p, content: e.target.value}))}
            placeholder="Start writing…"
            autoFocus
            className="flex-1 mx-5 mb-4 bg-transparent outline-none resize-none text-sm leading-relaxed"
            style={{ color:"rgba(255,255,255,0.85)", minHeight:200, caretColor:"white" }}
          />

          {/* Tags + gradient picker */}
          <div className="px-5 pb-5 space-y-3 border-t border-white/10 pt-3">
            <div className="flex flex-wrap gap-2">
              {(["Work Log","Learnings","Blockers","Tomorrow"] as NoteTag[]).map(t => {
                const on = form.tags.includes(t);
                return (
                  <button key={t} onClick={() => toggleTag(t)}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full transition-all"
                    style={on ? TAG_COLORS_DARK[t] : { background:"rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.5)" }}>
                    {t}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color:"rgba(255,255,255,0.4)" }}>Color</span>
              <div className="flex gap-1.5">
                {NOTE_GRADIENTS.map((g, i) => (
                  <button key={i} onClick={() => setForm(p => ({...p, gradient: i}))}
                    className="w-5 h-5 rounded-full transition-all hover:scale-110"
                    style={{ background: g.split("\n").at(-1)?.trim().replace(/^linear-gradient\([^,]+,\s*/,"").replace(/,[^)]+\)$/,"").trim() || "#e11d48", outline: form.gradient === i ? "2px solid white" : "none", outlineOffset: 2 }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Bento grid ── */
  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-[#3d0a20]" style={{ letterSpacing:"-0.02em" }}>Your notes</h2>
          <p className="text-xs mt-0.5" style={{ color:"rgba(61,10,32,0.45)" }}>{notes.length} {notes.length === 1 ? "note" : "notes"}</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-bold text-white transition-all hover:scale-105"
          style={{ background:"linear-gradient(135deg,#f472b6,#e11d48)", boxShadow:"0 4px 14px rgba(225,29,72,0.32)" }}>
          <Plus size={14} /> New Note
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth:"none" }}>
        {(["All","Work Log","Learnings","Blockers","Tomorrow"] as (NoteTag|"All")[]).map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className="shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all"
            style={filter === t
              ? { background:"linear-gradient(135deg,#f472b6,#e11d48)", color:"#fff", boxShadow:"0 2px 10px rgba(225,29,72,0.3)" }
              : { background:"rgba(255,255,255,0.22)", backdropFilter:"blur(12px)", color:"rgba(61,10,32,0.55)", border:"1px solid rgba(255,255,255,0.4)" }
            }>
            {t}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background:"rgba(255,255,255,0.22)", border:"1px solid rgba(255,255,255,0.35)" }}>
            <StickyNote size={22} className="text-pink-300" />
          </div>
          <p className="text-sm font-semibold text-[#3d0a20]/50">No notes yet</p>
          <button onClick={openNew}
            className="text-xs font-bold px-4 py-2 rounded-full text-white transition-all hover:scale-105"
            style={{ background:"linear-gradient(135deg,#f472b6,#e11d48)" }}>
            Write your first note
          </button>
        </div>
      )}

      {/* Bento grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((note, i) => {
            const pattern = BENTO[Math.min(i, BENTO.length - 1)] ?? { col: 1, minH: 160 };
            const col = filtered.length === 1 ? 2 : (i === 0 && filtered.length > 2 ? 2 : pattern.col);
            const grad = NOTE_GRADIENTS[note.gradient % NOTE_GRADIENTS.length];
            const preview = note.content.slice(0, 120);
            return (
              <button key={note.id}
                onClick={() => openEdit(note)}
                className="text-left rounded-3xl p-4 flex flex-col justify-between transition-all hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
                style={{
                  gridColumn: `span ${col}`,
                  minHeight: pattern.minH,
                  background: grad,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                }}>
                {/* Title */}
                <div className="min-w-0">
                  <p className="font-black text-white text-sm sm:text-base leading-tight mb-2 break-words" style={{ letterSpacing:"-0.02em" }}>
                    {note.title || "Untitled"}
                  </p>
                  {preview && (
                    <p className="text-xs leading-relaxed line-clamp-3 break-words" style={{ color:"rgba(255,255,255,0.65)" }}>
                      {preview}{note.content.length > 120 ? "…" : ""}
                    </p>
                  )}
                </div>
                {/* Bottom: tags + time */}
                <div className="mt-3 flex items-end justify-between gap-2 min-w-0">
                  <div className="flex flex-wrap gap-1">
                    {note.tags.slice(0, 2).map(t => (
                      <span key={t} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={TAG_COLORS_DARK[t]}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] shrink-0" style={{ color:"rgba(255,255,255,0.4)", fontFamily:"'DM Mono',monospace" }}>
                    {fmtRelative(note.updatedAt)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Shared sub-components ──────────────────────────────── */
function GlassCard({ children, noPad = false, className = "" }: { children: React.ReactNode; noPad?: boolean; className?: string }) {
  return (
    <div className={`rounded-2xl ${noPad ? "" : "p-5"} flex flex-col ${className}`}
      style={{ background:"rgba(255,255,255,0.22)", backdropFilter:"blur(22px)", WebkitBackdropFilter:"blur(22px)", border:"1px solid rgba(255,255,255,0.40)", boxShadow:"0 6px 40px rgba(180,30,80,0.10), inset 0 1px 0 rgba(255,255,255,0.58)" }}>
      {children}
    </div>
  );
}
function StatCard({ icon, iconBg, iconColor, label, value }: { icon:React.ReactNode; iconBg:string; iconColor:string; label:string; value:string }) {
  return (
    <div className="rounded-2xl px-3 py-3 sm:px-5 sm:py-4 flex items-center gap-2 sm:gap-4 min-w-0"
      style={{ background:"rgba(255,255,255,0.22)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.40)", boxShadow:"0 4px 24px rgba(180,30,80,0.08), inset 0 1px 0 rgba(255,255,255,0.55)" }}>
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background:iconBg, color:iconColor }}>{icon}</div>
      <div className="min-w-0">
        <p className="text-base sm:text-xl font-bold text-[#3d0a20] leading-tight tabular-nums truncate">{value}</p>
        <p className="text-[10px] sm:text-xs mt-0.5 truncate" style={{ color:"rgba(61,10,32,0.5)" }}>{label}</p>
      </div>
    </div>
  );
}
function GlassAvatar({ initials, size }: { initials: string; size: number }) {
  return (
    <div className="shrink-0 rounded-full flex items-center justify-center text-white font-bold"
      style={{ width:size, height:size, fontSize: size < 26 ? 9 : size < 32 ? 11 : 13,
        background:"linear-gradient(135deg,rgba(249,168,212,0.9),rgba(190,24,93,0.9))",
        backdropFilter:"blur(8px)", boxShadow:"0 2px 8px rgba(190,24,93,0.3), inset 0 1px 0 rgba(255,255,255,0.4)" }}>
      {initials}
    </div>
  );
}
function DarkAvatar({ initials, size, active }: { initials:string; size:number; active:boolean }) {
  return (
    <div className="shrink-0 rounded-full flex items-center justify-center text-white font-bold"
      style={{ width:size, height:size, fontSize: size < 30 ? 11 : 13,
        background: active ? "linear-gradient(135deg,#f472b6,#be185d)" : "rgba(255,255,255,0.12)",
        boxShadow: active ? "0 2px 10px rgba(190,24,93,0.4)" : "none" }}>
      {initials}
    </div>
  );
}
function StatusPill({ color, bg, label }: { color:string; bg:string; label:string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1"
      style={{ background:bg, color:"#3d0a20", border:"1px solid rgba(255,255,255,0.35)" }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background:color }} /> {label}
    </span>
  );
}
function GradientButton({ children, onClick, disabled, dimmed, dimStyle }: {
  children:React.ReactNode; onClick:()=>void; disabled:boolean; dimmed:boolean; dimStyle:React.CSSProperties;
}) {
  return (
    <button onClick={disabled ? undefined : onClick}
      className="it-primary-action w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
      style={dimmed
        ? { cursor:"default", ...dimStyle }
        : { background:"linear-gradient(135deg,#f472b6,#e11d48)", color:"#fff", boxShadow:"0 4px 16px rgba(225,29,72,0.30)", cursor:"pointer" }
      }>
      {children}
    </button>
  );
}
function EmptyState({ icon, text, sub }: { icon:React.ReactNode; text:string; sub?:string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      {icon}
      <p className="text-sm font-medium text-[#3d0a20]/60">{text}</p>
      {sub && <p className="text-xs text-center" style={{ color:"rgba(61,10,32,0.35)" }}>{sub}</p>}
    </div>
  );
}

/* ─── Calendar View ─────────────────────────────────────── */
type CalEvent = { id:string; title:string; date:string; startHour:number; endHour:number; color:string; };

const CAL_LS   = (uid:string):CalEvent[]   => { try { return JSON.parse(STORE.getItem(`it_cal_${uid}`) || "[]"); } catch { return []; } };
const CAL_SAVE = (uid:string, ev:CalEvent[]) => STORE.setItem(`it_cal_${uid}`, JSON.stringify(ev));

// Clock geometry: 7 AM – 7 PM on the dial
const CLK_S = 7, CLK_E = 19, CLK_HRS = CLK_E - CLK_S;
const CX = 185, CY = 185;
const TRACKS = [{ or:122, ir:103 }, { or:145, ir:126 }, { or:168, ir:149 }];
const EV_COLORS = ["#f472b6","#fb7185","#a78bfa","#60a5fa","#2dd4bf","#fbbf24"];

function h2deg(h:number)  { return ((h - CLK_S) / CLK_HRS) * 360 - 90; }
function pol(deg:number, r:number): [number,number] {
  const rad = deg * Math.PI / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}
function arcPath(sh:number, eh:number, or_:number, ir:number): string | null {
  const s = Math.max(sh, CLK_S), e = Math.min(eh, CLK_E);
  if (s >= e) return null;
  const sa = h2deg(s), ea = h2deg(e);
  const laf = ((e - s) / CLK_HRS) * 360 > 180 ? 1 : 0;
  const [x1,y1] = pol(sa, or_), [x2,y2] = pol(ea, or_);
  const [x3,y3] = pol(ea, ir),  [x4,y4] = pol(sa, ir);
  return `M${x1.toFixed(1)},${y1.toFixed(1)} A${or_},${or_} 0 ${laf},1 ${x2.toFixed(1)},${y2.toFixed(1)} L${x3.toFixed(1)},${y3.toFixed(1)} A${ir},${ir} 0 ${laf},0 ${x4.toFixed(1)},${y4.toFixed(1)} Z`;
}
function assignTracks(evs:CalEvent[]): (CalEvent & {track:number})[] {
  const sorted = [...evs].sort((a,b) => a.startHour - b.startHour);
  const ends: number[] = [];
  return sorted.map(e => {
    let t = ends.findIndex(end => end <= e.startHour);
    if (t === -1) { t = ends.length; ends.push(e.endHour); }
    else ends[t] = e.endHour;
    return { ...e, track: Math.min(t, TRACKS.length - 1) };
  });
}
function fmtH(h:number) {
  const hr = Math.floor(h), mn = Math.round((h - hr) * 60);
  const ap = hr >= 12 ? "PM" : "AM", h12 = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return `${h12}${mn > 0 ? `:${String(mn).padStart(2,"0")}` : ""} ${ap}`;
}

function CalendarView({ user, now, cloudRevision }: { user:User; now:Date; cloudRevision:number }) {
  const todayStr = localDateKey(now);
  const [selDate, setSelDate]   = useState(todayStr);
  const [events, setEvents]     = useState<CalEvent[]>(() => CAL_LS(user.id));
  const [holidays, setHolidays] = useState<CalendarHoliday[]>(() => LS.holidays());
  const [selEv, setSelEv]       = useState<string|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ title:"", startTime:"09:00", endTime:"10:00", color:EV_COLORS[0] });

  useEffect(() => {
    CAL_SAVE(user.id, events);
    void STORE.syncNow().catch(error => console.error("Calendar sync failed.", error));
  }, [events]);

  useEffect(() => {
    setEvents(CAL_LS(user.id));
    setHolidays(LS.holidays());
  }, [user.id, cloudRevision]);

  const selDateObj  = new Date(selDate + "T12:00:00");
  const dayEvents   = assignTracks(events.filter(e => e.date === selDate));
  const dayHoliday  = holidays.find(h => h.date === selDate) ?? null;
  const isCompanyHoliday = dayHoliday?.type === "company";
  const selEvObj    = selEv ? events.find(e => e.id === selEv) ?? null : null;
  const isToday     = selDate === todayStr;
  const curH        = now.getHours() + now.getMinutes() / 60;
  const dayName     = selDateObj.toLocaleDateString("en-US",{ weekday:"long" });

  // 7-day strip centered on today
  const strip = Array.from({ length:7 }, (_,i) => {
    const d = new Date(now); d.setDate(now.getDate() - 3 + i); return d;
  });

  function addEvent() {
    if (!form.title.trim()) return;
    const [sh,sm] = form.startTime.split(":").map(Number);
    const [eh,em] = form.endTime.split(":").map(Number);
    setEvents(p => [...p, { id:uid(), title:form.title.trim(), date:selDate, startHour:sh+sm/60, endHour:eh+em/60, color:form.color }]);
    setShowForm(false); setForm({ title:"", startTime:"09:00", endTime:"10:00", color:EV_COLORS[0] });
  }
  function deleteEvent(id:string) { setEvents(p => p.filter(e => e.id !== id)); setSelEv(null); }

  // Hour labels inside the dial (7a … 7p)
  const hourLabels = Array.from({ length: CLK_HRS + 1 }, (_, i) => {
    const h = CLK_S + i;
    const [x,y] = pol(h2deg(h), 84);
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return { x, y, label: `${h12}${h >= 12 ? "p" : "a"}` };
  });

  const glassInputSt: React.CSSProperties = { background:"rgba(255,255,255,0.28)", border:"1px solid rgba(255,255,255,0.5)" };

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-pink-400 uppercase tracking-widest">
            {selDateObj.toLocaleDateString("en-US",{ month:"long", day:"numeric", year:"numeric" })}
          </p>
          <h2 className="text-xl font-bold text-[#3d0a20] mt-0.5">Your {dayName}</h2>
        </div>
        <button onClick={() => { setShowForm(true); setSelEv(null); }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold text-white transition-all hover:scale-105"
          style={{ background:"linear-gradient(135deg,#f472b6,#e11d48)", boxShadow:"0 4px 14px rgba(225,29,72,0.3)" }}>
          <Plus size={14} /> New Event
        </button>
      </div>

      {dayHoliday && (
        <div className="flex items-start gap-3 rounded-2xl px-4 py-3"
          style={{
            background: isCompanyHoliday ? "rgba(16,185,129,0.16)" : "rgba(167,139,250,0.20)",
            border: isCompanyHoliday ? "1px solid rgba(16,185,129,0.32)" : "1px solid rgba(167,139,250,0.38)",
            backdropFilter:"blur(18px)", WebkitBackdropFilter:"blur(18px)"
          }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background:isCompanyHoliday ? "rgba(5,150,105,0.14)" : "rgba(124,58,237,0.16)", color:isCompanyHoliday ? "#047857" : "#7c3aed" }}>
            <Calendar size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color:isCompanyHoliday ? "#047857" : "#7c3aed" }}>
              {isCompanyHoliday ? "Company Mass Leave" : "Indonesia National Holiday"}
            </p>
            <p className="text-sm font-bold text-[#3d0a20] mt-0.5">{dayHoliday.title}</p>
          </div>
        </div>
      )}

      {/* ── Main clock card ── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background:"rgba(255,255,255,0.22)", backdropFilter:"blur(22px)", WebkitBackdropFilter:"blur(22px)", border:"1px solid rgba(255,255,255,0.40)", boxShadow:"0 6px 40px rgba(180,30,80,0.10), inset 0 1px 0 rgba(255,255,255,0.58)" }}>

        {/* SVG radial clock */}
        <div className="p-5 pb-3">
          <svg viewBox="0 0 370 370" style={{ width:"100%", maxWidth:480, display:"block", margin:"0 auto" }}
            onClick={e => { if ((e.target as SVGElement).tagName === "svg") { setSelEv(null); setShowForm(false); } }}>

            {/* Subtle concentric guide rings */}
            {TRACKS.map((t,i) => (
              <g key={i}>
                <circle cx={CX} cy={CY} r={t.or} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={0.6} />
                <circle cx={CX} cy={CY} r={t.ir} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={0.6} />
              </g>
            ))}
            {/* Outermost boundary */}
            <circle cx={CX} cy={CY} r={172} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={1} />

            {/* Inner clock face fill */}
            <circle cx={CX} cy={CY} r={97}  fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
            <circle cx={CX} cy={CY} r={70}  fill="rgba(255,255,255,0.07)" />

            {/* Hour tick marks */}
            {Array.from({ length: CLK_HRS + 1 }, (_, i) => {
              const angle = h2deg(CLK_S + i);
              const [x1,y1] = pol(angle, 168); const [x2,y2] = pol(angle, 176);
              return <line key={i} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} strokeLinecap="round" />;
            })}
            {/* Half-hour ticks */}
            {Array.from({ length: CLK_HRS }, (_, i) => {
              const angle = h2deg(CLK_S + i + 0.5);
              const [x1,y1] = pol(angle, 170); const [x2,y2] = pol(angle, 174);
              return <line key={i} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeLinecap="round" />;
            })}

            {/* Hour labels */}
            {hourLabels.map(({ x, y, label }, i) => (
              <text key={i} x={x.toFixed(1)} y={y.toFixed(1)} textAnchor="middle" dominantBaseline="middle"
                fill="rgba(61,10,32,0.5)" fontSize={8.5} fontWeight={600}
                style={{ fontFamily:"'DM Mono',monospace" }}>
                {label}
              </text>
            ))}

            {/* ── Event arcs ── */}
            {dayEvents.map(ev => {
              const t = TRACKS[Math.min(ev.track, TRACKS.length - 1)];
              const path = arcPath(ev.startHour, ev.endHour, t.or, t.ir);
              if (!path) return null;
              const midAngle = (h2deg(Math.max(ev.startHour, CLK_S)) + h2deg(Math.min(ev.endHour, CLK_E))) / 2;
              const midR = (t.or + t.ir) / 2;
              const [tx, ty] = pol(midAngle, midR);
              const isSel = selEv === ev.id;
              const duration = ev.endHour - ev.startHour;
              return (
                <g key={ev.id} style={{ cursor:"pointer" }}
                  onClick={e => { e.stopPropagation(); setSelEv(isSel ? null : ev.id); setShowForm(false); }}>
                  <path d={path} fill={ev.color} fillOpacity={isSel ? 1 : 0.82}
                    stroke="rgba(255,255,255,0.55)" strokeWidth={isSel ? 1.5 : 0.6}
                    style={{ filter: isSel ? `drop-shadow(0 0 7px ${ev.color}99)` : "none", transition:"all 0.15s ease" }} />
                  {duration >= 0.65 && (
                    <text x={tx.toFixed(1)} y={ty.toFixed(1)} textAnchor="middle" dominantBaseline="middle"
                      transform={`rotate(${(midAngle + 90).toFixed(1)},${tx.toFixed(1)},${ty.toFixed(1)})`}
                      fill="white" fontSize={7.5} fontWeight={700}
                      style={{ pointerEvents:"none", userSelect:"none", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                      {ev.title.length > 15 ? ev.title.slice(0,14) + "…" : ev.title}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Current time indicator (today only) */}
            {isToday && curH >= CLK_S && curH <= CLK_E && (() => {
              const angle = h2deg(curH);
              const [lx, ly] = pol(angle, 172);
              return (
                <g>
                  <line x1={CX} y1={CY} x2={lx.toFixed(1)} y2={ly.toFixed(1)}
                    stroke="#e11d48" strokeWidth={1.5} strokeLinecap="round" opacity={0.75} />
                  <circle cx={CX} cy={CY} r={4.5} fill="#e11d48" />
                  <circle cx={lx.toFixed(1)} cy={ly.toFixed(1)} r={3} fill="#e11d48" opacity={0.8} />
                </g>
              );
            })()}

            {/* Center display */}
            <text x={CX} y={CY - 9} textAnchor="middle" fill="rgba(61,10,32,0.65)" fontSize={14} fontWeight={700}
              style={{ fontFamily:"'DM Mono',monospace" }}>
              {isToday ? now.toLocaleTimeString("en-US",{ hour:"2-digit", minute:"2-digit", hour12:true }) : "——"}
            </text>
            <text x={CX} y={CY + 9} textAnchor="middle" fill="rgba(61,10,32,0.32)" fontSize={8} fontWeight={500}
              style={{ fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
              {isToday ? "now" : dayName.slice(0, 3).toUpperCase()}
            </text>

            {/* Empty state label */}
            {dayEvents.length === 0 && (
              <text x={CX} y={CY + 130} textAnchor="middle" fill="rgba(61,10,32,0.28)" fontSize={10} fontWeight={500}
                style={{ fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                No events · tap + to add one
              </text>
            )}
          </svg>
        </div>

        {/* ── Event detail card ── */}
        {selEvObj && (
          <div className="mx-5 mb-4 rounded-2xl p-4 transition-all"
            style={{ background:`${selEvObj.color}1a`, border:`1.5px solid ${selEvObj.color}44`, backdropFilter:"blur(12px)" }}>
            <div className="flex items-start justify-between mb-1.5">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5" style={{ background:selEvObj.color }} />
                <p className="font-bold text-sm text-[#3d0a20]">{selEvObj.title}</p>
              </div>
              <button onClick={() => setSelEv(null)} className="text-xs w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors" style={{ color:"rgba(61,10,32,0.4)" }}>✕</button>
            </div>
            <p className="text-xs ml-5 mb-3" style={{ color:"rgba(61,10,32,0.5)", fontFamily:"'DM Mono',monospace" }}>
              {fmtH(selEvObj.startHour)} → {fmtH(selEvObj.endHour)}
              <span className="ml-2 opacity-60">({Math.round((selEvObj.endHour - selEvObj.startHour) * 60)} min)</span>
            </p>
            <div className="flex justify-end">
              <button onClick={() => deleteEvent(selEvObj.id)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:scale-105"
                style={{ background:"rgba(251,113,133,0.2)", color:"#be123c" }}>
                <Trash2 size={11} /> Remove
              </button>
            </div>
          </div>
        )}

        {/* ── Add event form ── */}
        {showForm && (
          <div className="mx-5 mb-4 rounded-2xl p-4"
            style={{ background:"rgba(255,255,255,0.25)", border:"1px solid rgba(255,255,255,0.45)", backdropFilter:"blur(16px)" }}>
            <p className="text-[10px] font-semibold text-pink-400 uppercase tracking-widest mb-3">New Event — {selDateObj.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</p>
            <div className="space-y-2.5">
              <input value={form.title} onChange={e => setForm(p => ({...p,title:e.target.value}))}
                onKeyDown={e => e.key === "Enter" && addEvent()}
                placeholder="Event title…" autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl text-sm text-[#3d0a20] outline-none placeholder:text-pink-300/50"
                style={glassInputSt} />
              <div className="grid grid-cols-2 gap-2">
                {([["Start","startTime"],["End","endTime"]] as [string,string][]).map(([lbl,key]) => (
                  <div key={key}>
                    <label className="block text-[10px] font-semibold text-pink-400 uppercase tracking-widest mb-1">{lbl}</label>
                    <input type="time" value={(form as any)[key]} onChange={e => setForm(p => ({...p,[key]:e.target.value}))}
                      className="w-full px-3 py-2 rounded-xl text-sm text-[#3d0a20] outline-none"
                      style={{ ...glassInputSt, fontFamily:"'DM Mono',monospace" }} />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-semibold text-pink-400 uppercase tracking-widest">Color</span>
                {EV_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(p => ({...p,color:c}))}
                    className="w-6 h-6 rounded-full transition-all hover:scale-110"
                    style={{ background:c, outline: form.color === c ? "2.5px solid white" : "none", outlineOffset:2, boxShadow: form.color === c ? `0 0 0 1px ${c}` : "none" }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background:"rgba(255,255,255,0.22)", color:"rgba(61,10,32,0.55)" }}>Cancel</button>
              <button onClick={addEvent} disabled={!form.title.trim()}
                className="flex-[2] py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.01] disabled:opacity-40"
                style={{ background:"linear-gradient(135deg,#f472b6,#e11d48)", boxShadow:"0 3px 12px rgba(225,29,72,0.28)" }}>
                Add Event
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Date strip ── */}
      <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth:"none" }}>
        {strip.map((d, i) => {
          const ds    = localDateKey(d);
          const isSel = ds === selDate;
          const isT   = ds === todayStr;
          const evCnt = events.filter(e => e.date === ds).length;
          const holiday = holidays.find(h => h.date === ds);
          const companyHoliday = holiday?.type === "company";
          return (
            <button key={i} title={holiday ? holiday.title : undefined} onClick={() => { setSelDate(ds); setSelEv(null); setShowForm(false); }}
              className="flex flex-col items-center gap-1 px-5 py-3 rounded-2xl shrink-0 transition-all hover:scale-[1.03]"
              style={isSel
                ? { background:"linear-gradient(135deg,#f472b6,#e11d48)", boxShadow:"0 4px 16px rgba(225,29,72,0.38)" }
                : { background:"rgba(255,255,255,0.22)", backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", border:"1px solid rgba(255,255,255,0.4)" }
              }>
              <span className="text-[10px] font-semibold" style={{ color:isSel ? "rgba(255,255,255,0.72)" : "rgba(61,10,32,0.42)" }}>
                {d.toLocaleDateString("en-US",{ weekday:"short" })}
              </span>
              <span className="text-xl font-black tabular-nums leading-none" style={{ color:isSel ? "#fff" : "#3d0a20", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                {d.getDate()}
              </span>
              <div className="h-3 flex items-center justify-center">
                {holiday
                  ? <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background:isSel?"rgba(255,255,255,0.28)":companyHoliday?"rgba(16,185,129,0.20)":"rgba(167,139,250,0.24)", color:isSel?"white":companyHoliday?"#047857":"#7c3aed" }}>{companyHoliday ? "KSB" : "LIBUR"}</span>
                  : evCnt > 0
                    ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background:isSel?"rgba(255,255,255,0.28)":"rgba(244,114,182,0.22)", color:isSel?"white":"#be185d" }}>{evCnt}</span>
                    : isT && !isSel ? <span className="w-1.5 h-1.5 rounded-full" style={{ background:"#e11d48" }} /> : null
                }
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Attendance View ────────────────────────────────────── */
type AttStatus = "present"|"absent"|"late"|"wfh"|"holiday"|"future";
const STATUS_META: Record<AttStatus,{label:string;color:string;bg:string;dot:string}> = {
  present: { label:"Present", color:"#059669", bg:"rgba(52,211,153,0.18)",  dot:"#22c55e" },
  late:    { label:"Late",    color:"#b45309", bg:"rgba(251,191,36,0.22)",  dot:"#f59e0b" },
  absent:  { label:"Absent",  color:"#be123c", bg:"rgba(251,113,133,0.22)", dot:"#fb7185" },
  wfh:     { label:"WFH",     color:"#1d4ed8", bg:"rgba(96,165,250,0.22)",  dot:"#60a5fa" },
  holiday: { label:"Holiday", color:"#7c3aed", bg:"rgba(167,139,250,0.22)", dot:"#a78bfa" },
  future:  { label:"—",       color:"rgba(61,10,32,0.3)", bg:"rgba(255,255,255,0.1)", dot:"rgba(255,255,255,0.3)" },
};
function AttendanceView({ user, now, cloudRevision }: { user:User; now:Date; cloudRevision:number }) {
  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [attRecords, setAttRecords] = useState<AttRecord[]>(() => LS.att(user.id));
  const [holidays, setHolidays] = useState<CalendarHoliday[]>(() => LS.holidays());
  const [showLogForm, setShowLogForm] = useState(false);
  const [logForm, setLogForm] = useState({
    date: (() => { const d = new Date(now); d.setDate(d.getDate()-1); return localDateKey(d); })(),
    clockIn: "09:00",
    clockOut: "18:00",
    type: "present" as "present"|"late"|"wfh"|"absent",
  });
  const [logError, setLogError] = useState("");

  useEffect(() => {
    setAttRecords(LS.att(user.id));
    setHolidays(LS.holidays());
  }, [user.id, cloudRevision]);

  function saveRecord() {
    const { date, clockIn, clockOut, type } = logForm;
    if (!date) { setLogError("Please select a date."); return; }
    if (date >= localDateKey(now)) { setLogError("Date must be in the past."); return; }
    if (type !== "absent" && clockIn >= clockOut) { setLogError("Clock-out must be after clock-in."); return; }

    const [cih, cim] = clockIn.split(":").map(Number);
    const [coh, com] = clockOut.split(":").map(Number);
    const base = new Date(date + "T00:00:00");
    const ciDate = new Date(base); ciDate.setHours(cih, cim, 0, 0);
    const coDate = new Date(base); coDate.setHours(coh, com, 0, 0);

    const updated = attRecords.filter(r => r.date !== date);
    updated.push({
      date,
      clockIn:  type === "absent" ? null : ciDate.toISOString(),
      clockOut: type === "absent" ? null : coDate.toISOString(),
      type,
    });
    LS.saveAtt(user.id, updated);
    setAttRecords(updated);
    void STORE.syncNow().catch(error => console.error("Attendance sync failed.", error));
    setShowLogForm(false);
    setLogError("");
  }

  function deleteRecord(date: string) {
    const updated = attRecords.filter(r => r.date !== date);
    LS.saveAtt(user.id, updated);
    setAttRecords(updated);
    void STORE.syncNow().catch(error => console.error("Attendance deletion sync failed.", error));
  }

  const year = viewDate.getFullYear(), month = viewDate.getMonth();
  const days     = new Date(year, month+1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const monthLabel = viewDate.toLocaleDateString("en-US",{ month:"long", year:"numeric" });
  const canNext = new Date(year, month+1, 1) <= new Date(now.getFullYear(), now.getMonth(), 1);

  function statusForDate(d: Date): AttStatus {
    if (d > now && d.toDateString() !== now.toDateString()) return "future";
    const iso = localDateKey(d);
    if (holidays.some(h => h.date === iso)) return "holiday";
    const dow = d.getDay();
    if (dow === 0 || dow === 6) return "holiday";
    const rec = attRecords.find(r => r.date === iso);
    if (!rec) return d < now ? "absent" : "future";
    if (rec.type) return rec.type;
    if (rec.clockIn) {
      const ci = new Date(rec.clockIn);
      return (ci.getHours() > 9 || (ci.getHours() === 9 && ci.getMinutes() > 15)) ? "late" : "present";
    }
    return "absent";
  }

  const records = Array.from({ length:days }, (_, i) => {
    const d = new Date(year, month, i+1);
    const status = statusForDate(d);
    const iso = localDateKey(d);
    const rec = attRecords.find(r => r.date === iso);
    return { date:d, status, clockIn: rec?.clockIn ? fmt12(new Date(rec.clockIn)) : "—", clockOut: rec?.clockOut ? fmt12(new Date(rec.clockOut)) : "—" };
  });

  const counts = records.reduce((a,r) => { if (r.status !== "future") a[r.status]=(a[r.status]||0)+1; return a; }, {} as Record<string,number>);
  const workdays = records.filter(r=>r.status!=="holiday"&&r.status!=="future").length;
  const present  = (counts["present"]||0)+(counts["wfh"]||0);
  const rate     = workdays > 0 ? Math.round((present/workdays)*100) : 0;
  const pastRecords = records.filter(r=>r.status!=="future"&&r.status!=="holiday").slice().reverse();

  const glassInput: React.CSSProperties = { background:"rgba(255,255,255,0.25)", border:"1px solid rgba(255,255,255,0.45)" };
  const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm text-[#3d0a20] outline-none transition-all";

  const TYPE_OPTS: { value: typeof logForm.type; label: string; color: string }[] = [
    { value:"present", label:"Present", color:"#059669" },
    { value:"late",    label:"Late",    color:"#b45309" },
    { value:"wfh",     label:"WFH",     color:"#1d4ed8" },
    { value:"absent",  label:"Absent",  color:"#be123c" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {[
          { label:"Present", value:String(counts["present"]||0), color:"#059669", bg:"rgba(52,211,153,0.55)"  },
          { label:"WFH",     value:String(counts["wfh"]    ||0), color:"#1d4ed8", bg:"rgba(96,165,250,0.55)"  },
          { label:"Late",    value:String(counts["late"]   ||0), color:"#b45309", bg:"rgba(251,191,36,0.55)"  },
          { label:"Absent",  value:String(counts["absent"] ||0), color:"#be123c", bg:"rgba(251,113,133,0.55)" },
          { label:"Rate",    value:`${rate}%`,                   color:"#be185d", bg:"rgba(244,114,182,0.55)" },
        ].map(s => (
          <div key={s.label}
            className="rounded-2xl flex flex-col items-center justify-center py-3 px-1 sm:flex-row sm:items-center sm:justify-start sm:gap-3 sm:px-4 sm:py-4"
            style={{ background:"rgba(255,255,255,0.22)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.40)", boxShadow:"0 4px 24px rgba(180,30,80,0.08), inset 0 1px 0 rgba(255,255,255,0.55)" }}>
            {/* Mobile: solid color dot */}
            <span className="block sm:hidden w-2 h-2 rounded-full mb-1.5" style={{ background: s.color }} />
            {/* Mobile: number only */}
            <p className="text-lg font-black tabular-nums leading-none sm:hidden" style={{ color: s.color, fontFamily:"'DM Mono',monospace" }}>{s.value}</p>
            {/* Desktop: icon badge + number + label */}
            <div className="hidden sm:flex w-9 h-9 rounded-xl items-center justify-center shrink-0 text-sm font-black" style={{ background:s.bg, color:s.color }}>{s.value[0]}</div>
            <div className="hidden sm:block">
              <p className="text-xl font-bold text-[#3d0a20] tabular-nums leading-tight">{s.value}</p>
              <p className="text-[11px]" style={{ color:"rgba(61,10,32,0.5)" }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        <GlassCard>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-base text-[#3d0a20]">{monthLabel}</h2>
            <div className="flex gap-1">
              <button onClick={() => setViewDate(new Date(year,month-1,1))} className="w-8 h-8 rounded-xl flex items-center justify-center text-pink-400 hover:bg-white/30 transition-all text-lg font-bold">‹</button>
              <button onClick={() => canNext && setViewDate(new Date(year,month+1,1))} disabled={!canNext} className="w-8 h-8 rounded-xl flex items-center justify-center text-pink-400 hover:bg-white/30 transition-all disabled:opacity-30 text-lg font-bold">›</button>
            </div>
          </div>
          <div className="grid grid-cols-7 mb-2">
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
              <div key={d} className="text-center text-[10px] font-semibold py-1" style={{ color:"rgba(61,10,32,0.4)" }}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length:firstDow }).map((_,i) => <div key={`e${i}`} />)}
            {records.map((r,i) => {
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
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-5 pt-4" style={{ borderTop:"1px solid rgba(255,255,255,0.25)" }}>
            {(["present","wfh","late","absent","holiday"] as AttStatus[]).map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background:STATUS_META[s].dot }} />
                <span className="text-[11px] font-medium" style={{ color:"rgba(61,10,32,0.55)" }}>{STATUS_META[s].label}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard noPad>
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3" style={{ borderBottom:"1px solid rgba(255,255,255,0.28)" }}>
            <span className="font-semibold text-sm text-[#3d0a20]">Daily Records</span>
            <button
              onClick={() => { setShowLogForm(v => !v); setLogError(""); }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:scale-105"
              style={showLogForm
                ? { background:"rgba(244,114,182,0.25)", color:"#be185d" }
                : { background:"linear-gradient(135deg,#f472b6,#e11d48)", color:"#fff", boxShadow:"0 2px 10px rgba(225,29,72,0.25)" }
              }>
              <Plus size={12} /> Log Past Attendance
            </button>
          </div>

          {/* Log form */}
          {showLogForm && (
            <div className="px-5 py-4" style={{ borderBottom:"1px solid rgba(255,255,255,0.25)" }}>
              <p className="text-[10px] font-semibold text-pink-400 uppercase tracking-widest mb-3">New Past Entry</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {/* Date */}
                <div>
                  <label className="block text-[10px] font-semibold text-pink-400 uppercase tracking-widest mb-1">Date</label>
                  <input type="date"
                    max={(() => { const d = new Date(now); d.setDate(d.getDate()-1); return localDateKey(d); })()}
                    value={logForm.date}
                    onChange={e => { setLogForm(p => ({...p, date:e.target.value})); setLogError(""); }}
                    className={inputCls} style={{ ...glassInput, fontFamily:"'DM Mono',monospace" }} />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-[10px] font-semibold text-pink-400 uppercase tracking-widest mb-1">Type</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {TYPE_OPTS.map(t => (
                      <button key={t.value} onClick={() => setLogForm(p => ({...p, type:t.value}))}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                        style={logForm.type === t.value
                          ? { background: t.color, color:"#fff", boxShadow:`0 2px 8px ${t.color}44` }
                          : { background:"rgba(255,255,255,0.2)", color:"rgba(61,10,32,0.55)", border:"1px solid rgba(255,255,255,0.35)" }
                        }>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clock In / Out — hidden when absent */}
                {logForm.type !== "absent" && (<>
                  <div>
                    <label className="block text-[10px] font-semibold text-pink-400 uppercase tracking-widest mb-1">Clock In</label>
                    <input type="time" value={logForm.clockIn}
                      onChange={e => setLogForm(p => ({...p, clockIn:e.target.value}))}
                      className={inputCls} style={{ ...glassInput, fontFamily:"'DM Mono',monospace" }} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-pink-400 uppercase tracking-widest mb-1">Clock Out</label>
                    <input type="time" value={logForm.clockOut}
                      onChange={e => setLogForm(p => ({...p, clockOut:e.target.value}))}
                      className={inputCls} style={{ ...glassInput, fontFamily:"'DM Mono',monospace" }} />
                  </div>
                </>)}
              </div>

              {logError && (
                <p className="text-xs mb-2 px-1" style={{ color:"#be123c" }}>{logError}</p>
              )}

              <div className="flex gap-2">
                <button onClick={() => { setShowLogForm(false); setLogError(""); }}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{ background:"rgba(255,255,255,0.22)", color:"rgba(61,10,32,0.5)" }}>
                  Cancel
                </button>
                <button onClick={saveRecord}
                  className="flex-[2] py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.01]"
                  style={{ background:"linear-gradient(135deg,#f472b6,#e11d48)", boxShadow:"0 3px 10px rgba(225,29,72,0.28)" }}>
                  Save Record
                </button>
              </div>
            </div>
          )}

          {/* Records list */}
          <div className="overflow-y-auto" style={{ maxHeight:"min(380px, 50dvh)" }}>
            {pastRecords.length === 0
              ? <div className="px-5 py-8 text-center"><p className="text-sm text-pink-300">No records yet. Log your first entry above.</p></div>
              : pastRecords.map((r, i) => {
                const m = STATUS_META[r.status];
                const isToday = r.date.toDateString() === now.toDateString();
                const iso = localDateKey(r.date);
                return (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-white/15 transition-colors group"
                    style={{ borderBottom:"1px solid rgba(255,255,255,0.18)" }}>
                    <div className="w-12 text-center shrink-0">
                      <p className="text-[10px] font-semibold" style={{ color:"rgba(61,10,32,0.4)" }}>
                        {r.date.toLocaleDateString("en-US",{ weekday:"short" })}
                      </p>
                      <p className="text-sm font-bold text-[#3d0a20]">{r.date.getDate()}</p>
                      {isToday && <p className="text-[9px] font-bold text-pink-500">TODAY</p>}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background:m.bg, color:m.color, border:"1px solid rgba(255,255,255,0.3)" }}>
                      {m.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px]"
                        style={{ fontFamily:"'DM Mono',monospace", color:"rgba(61,10,32,0.6)" }}>
                        <span>{r.clockIn}</span>
                        {r.clockIn !== "—" && (
                          <><span style={{ color:"rgba(61,10,32,0.3)" }}>→</span><span>{r.clockOut}</span></>
                        )}
                      </div>
                    </div>
                    {/* Edit shortcut: click to pre-fill form */}
                    <button
                      onClick={() => {
                        const rec = attRecords.find(a => a.date === iso);
                        const ci = rec?.clockIn ? new Date(rec.clockIn) : null;
                        const co = rec?.clockOut ? new Date(rec.clockOut) : null;
                        setLogForm({
                          date: iso,
                          clockIn:  ci ? `${String(ci.getHours()).padStart(2,"0")}:${String(ci.getMinutes()).padStart(2,"0")}` : "09:00",
                          clockOut: co ? `${String(co.getHours()).padStart(2,"0")}:${String(co.getMinutes()).padStart(2,"0")}` : "18:00",
                          type: r.status === "future" || r.status === "holiday" ? "present" : r.status as typeof logForm.type,
                        });
                        setShowLogForm(true);
                        setLogError("");
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all hover:bg-white/20 text-pink-400"
                      title="Edit">
                      <Edit3 size={11} />
                    </button>
                    <button
                      onClick={() => deleteRecord(iso)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all hover:bg-rose-100/30 text-pink-300 hover:text-rose-500"
                      title="Delete">
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })
            }
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

/* ─── Reports View ───────────────────────────────────────── */
const glassTooltip = { contentStyle:{ background:"rgba(255,255,255,0.85)", backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.5)", borderRadius:12, fontSize:11, color:"#3d0a20", boxShadow:"0 4px 20px rgba(180,30,80,0.12)" }, cursor:{ fill:"rgba(244,114,182,0.08)" } };

function KpiCard({ label, value, sub, trend }: { label:string; value:string; sub:string; trend:"up"|"down"|"flat" }) {
  const Icon = trend==="up" ? ArrowUpRight : trend==="down" ? ArrowDownRight : Minus;
  const tColor = trend==="up"?"#059669":trend==="down"?"#be123c":"#7c3d52";
  const tBg    = trend==="up"?"rgba(52,211,153,0.15)":trend==="down"?"rgba(251,113,133,0.15)":"rgba(255,255,255,0.18)";
  return (
    <div className="rounded-2xl px-3 py-3 sm:px-5 sm:py-4 min-w-0"
      style={{ background:"rgba(255,255,255,0.22)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.40)", boxShadow:"0 4px 24px rgba(180,30,80,0.08), inset 0 1px 0 rgba(255,255,255,0.55)" }}>
      <p className="text-[9px] sm:text-[10px] font-semibold text-pink-400 uppercase tracking-widest mb-1.5 truncate">{label}</p>
      <p className="text-lg sm:text-2xl font-bold text-[#3d0a20] tabular-nums leading-none mb-1.5 truncate">{value}</p>
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full truncate max-w-full" style={{ background:tBg, color:tColor }}>
        <Icon size={9} /><span className="truncate">{sub}</span>
      </span>
    </div>
  );
}

function ReportsView({ user, activities, attRecords }: { user:User; activities:ActivityEntry[]; attRecords:AttRecord[] }) {
  const [period, setPeriod] = useState<"week"|"month"|"quarter">("month");
  const latestAttendanceDate = attRecords.map(record => record.date).sort().slice(-1)[0] || localDateKey(new Date());
  const [reportMonth, setReportMonth] = useState(latestAttendanceDate.slice(0, 7));
  const PERIODS = [{ id:"week" as const, label:"This Week" }, { id:"month" as const, label:"This Month" }, { id:"quarter" as const, label:"This Quarter" }];

  const presentDays = attRecords.filter(r => r.clockIn).length;
  const totalHrsMs  = attRecords.reduce((s, r) => {
    if (r.clockIn && r.clockOut) return s + (new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime());
    return s;
  }, 0);
  const totalHrs = Math.round(totalHrsMs / 3600000 * 10) / 10;

  const taskColors = ["#f472b6","#a78bfa","#60a5fa","#34d399","#fbbf24"];
  const taskGroups = activities.reduce((a, act) => { const k = act.color; a[k]=(a[k]||0)+1; return a; }, {} as Record<string,number>);
  const taskBreakdown = Object.entries(taskGroups).map(([k,v],i) => ({ label: k.charAt(0).toUpperCase()+k.slice(1), count:v, color:taskColors[i%taskColors.length] }));

  // Daily hours from real att records (last 14 days)
  const dailyData = attRecords.slice(-14).map(r => {
    const d = parseLocalDateKey(r.date);
    const hrs = r.clockIn && r.clockOut ? Math.round((new Date(r.clockOut).getTime()-new Date(r.clockIn).getTime())/360000)/10 : 0;
    // Use full ISO date as key to guarantee uniqueness across month boundaries
    return { day: r.date, label: d.toLocaleDateString("en-US",{month:"short",day:"numeric"}), hours: hrs };
  });

  const hasData = attRecords.length > 0 || activities.length > 0;

  function exportMonthlyAttendancePdf() {
    const [yearValue, monthValue] = reportMonth.split("-").map(Number);
    if (!yearValue || !monthValue) return;

    const monthIndex = monthValue - 1;
    const daysInMonth = new Date(yearValue, monthValue, 0).getDate();
    const profileSettings = LS.settings(user.id) || {};
    const mentorName = String(profileSettings.profile?.mentor || "").trim() || "____________________________";
    const holidays = LS.holidays();
    const attendanceByDate = new Map(attRecords.map(record => [record.date, record]));
    const activitiesByDate = new Map<string, string[]>();

    activities.forEach(activity => {
      const activityDate = new Date(activity.time);
      if (Number.isNaN(activityDate.getTime())) return;
      const dateKey = localDateKey(activityDate);
      if (!dateKey.startsWith(reportMonth)) return;

      const activityText = [activity.title, activity.description]
        .map(value => String(value || "").trim())
        .filter(Boolean)
        .join(" - ");
      if (!activityText) return;

      const current = activitiesByDate.get(dateKey) || [];
      current.push(activityText);
      activitiesByDate.set(dateKey, current);
    });

    const formatPdfTime = (value: string | null | undefined) => {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return date.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit", second:"2-digit", hour12:true });
    };

    const body: any[] = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(yearValue, monthIndex, day, 12, 0, 0);
      const dateKey = localDateKey(date);
      const record = attendanceByDate.get(dateKey);
      const holiday = holidays.find(item => item.date === dateKey);
      const dayActivities = (activitiesByDate.get(dateKey) || []).join("; ");
      const hasWorkData = Boolean(record?.clockIn || record?.clockOut || dayActivities);
      const dateLabel = `${monthValue}/${day}/${yearValue}`;

      let specialLabel = "";
      let remarks = record?.type === "wfh" ? "WFH" : record?.type === "late" ? "LATE" : "";
      let activityText = dayActivities;

      if (record?.type === "absent") {
        specialLabel = activityText ? `LEAVE OF ABSENCE (${activityText})` : "LEAVE OF ABSENCE";
      } else if (!hasWorkData && holiday) {
        const prefix = holiday.type === "company" ? "COMPANY MASS LEAVE" : "NATIONAL HOLIDAY";
        specialLabel = `${prefix} (${holiday.title})`;
      } else if (!hasWorkData && (date.getDay() === 0 || date.getDay() === 6)) {
        specialLabel = "WEEKEND";
      } else if (!activityText && record?.clockIn) {
        activityText = record.type === "wfh" ? "Work from home" : "";
      }

      if (specialLabel) {
        body.push([
          { content:dateLabel, styles:{ halign:"center" } },
          { content:specialLabel, colSpan:4, styles:{ halign:"center", fontStyle:"bold" } },
        ]);
      } else {
        body.push([
          dateLabel,
          formatPdfTime(record?.clockIn),
          formatPdfTime(record?.clockOut),
          activityText,
          remarks ? { content:remarks, styles:{ fontStyle:"italic", halign:"center" } } : "",
        ]);
      }
    }

    const document = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
    const pageWidth = document.internal.pageSize.getWidth();
    const periodLabel = new Date(yearValue, monthIndex, 1)
      .toLocaleDateString("en-US", { month:"long", year:"numeric" })
      .toUpperCase();

    document.setTextColor(0, 0, 0);
    document.setFont("helvetica", "normal");
    document.setFontSize(9);
    document.text("Internal", pageWidth - 20, 12, { align:"right" });

    document.setFont("helvetica", "bold");
    document.setFontSize(13);
    document.text("DAFTAR HADIR PKL/MAGANG", pageWidth / 2, 28, { align:"center" });

    const labelX = 26;
    const colonX = 50;
    const valueX = 54;
    const infoRows = [
      ["NAMA", user.name.toUpperCase()],
      ["BAGIAN", user.department.toUpperCase()],
      ["PERIODE", periodLabel],
    ];

    document.setFontSize(8.5);
    infoRows.forEach((row, index) => {
      const y = 38 + index * 7;
      document.setFont("helvetica", "normal");
      document.text(row[0], labelX, y);
      document.text(":", colonX, y);
      document.setFont("helvetica", "bold");
      document.text(row[1], valueX, y);
    });

    autoTable(document, {
      startY: 57,
      head: [["Date", "Clock In", "Clock Out", "Activities", "Remarks"]],
      body,
      theme: "grid",
      margin: { left:21, right:21 },
      tableWidth: 168,
      styles: {
        font:"helvetica",
        fontSize:5.8,
        cellPadding:0.45,
        minCellHeight:4.1,
        textColor:[0,0,0],
        lineColor:[0,0,0],
        lineWidth:0.15,
        valign:"middle",
        overflow:"linebreak",
      },
      headStyles: {
        fillColor:[224,224,224],
        textColor:[0,0,0],
        fontStyle:"bold",
        fontSize:6.2,
        halign:"center",
        lineColor:[0,0,0],
        lineWidth:0.18,
      },
      columnStyles: {
        0:{ cellWidth:18, halign:"center" },
        1:{ cellWidth:22, halign:"center" },
        2:{ cellWidth:22, halign:"center" },
        3:{ cellWidth:85, halign:"center" },
        4:{ cellWidth:21, halign:"center" },
      },
      rowPageBreak:"avoid",
      showHead:"everyPage",
    });

    const tableFinalY = (document as jsPDF & { lastAutoTable?: { finalY:number } }).lastAutoTable?.finalY || 190;
    let signatureY = Math.max(tableFinalY + 20, 218);
    if (signatureY > 255) {
      document.addPage();
      signatureY = 35;
    }

    document.setFont("helvetica", "normal");
    document.setFontSize(8.5);
    document.text("Pelaksana Oleh", 25, signatureY);
    document.text("Pembimbing Oleh", 135, signatureY);
    document.text(user.name, 25, signatureY + 39, { maxWidth:55 });
    document.text(mentorName, 135, signatureY + 39, { maxWidth:55 });

    const safeName = user.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "Intern";
    document.save(`DAFTAR-HADIR-${safeName}-${reportMonth}.pdf`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background:"rgba(255,255,255,0.22)", backdropFilter:"blur(16px)", border:"1px solid rgba(255,255,255,0.38)", scrollbarWidth:"none" }}>
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
              style={period===p.id ? { background:"linear-gradient(135deg,#f472b6,#e11d48)", color:"#fff", boxShadow:"0 2px 10px rgba(225,29,72,0.28)" } : { color:"rgba(61,10,32,0.55)" }}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={reportMonth}
            onChange={event => setReportMonth(event.target.value)}
            className="min-w-0 flex-1 sm:flex-none px-3 py-2 rounded-xl text-sm text-[#3d0a20] outline-none"
            style={{ background:"rgba(255,255,255,0.22)", backdropFilter:"blur(16px)", border:"1px solid rgba(255,255,255,0.38)" }}
          />
          <button onClick={exportMonthlyAttendancePdf}
            className="flex-none flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105 whitespace-nowrap"
            style={{ background:"rgba(255,255,255,0.22)", backdropFilter:"blur(16px)", border:"1px solid rgba(255,255,255,0.38)", color:"#be185d" }}>
            <Download size={13} /> Export Monthly PDF
          </button>
        </div>
      </div>

      {!hasData ? (
        <GlassCard>
          <EmptyState icon={<BarChart2 size={28} className="text-pink-200" />} text="No data yet." sub="Clock in and log activities to see your reports here." />
        </GlassCard>
      ) : (<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Total Hours"     value={totalHrs > 0 ? `${totalHrs}h` : "—"} sub="logged so far"   trend="flat" />
          <KpiCard label="Days Present"    value={String(presentDays)}                  sub="this period"     trend={presentDays>0?"up":"flat"} />
          <KpiCard label="Tasks Logged"    value={String(activities.length)}            sub="total activities" trend={activities.length>0?"up":"flat"} />
          <KpiCard label="Avg Hours/Day"   value={presentDays > 0 ? `${Math.round(totalHrs/presentDays*10)/10}h` : "—"} sub="per shift" trend="flat" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
          <GlassCard>
            <p className="text-[10px] font-semibold text-pink-400 uppercase tracking-widest mb-4">Daily Hours</p>
            {dailyData.length === 0
              ? <EmptyState icon={<Clock size={20} className="text-pink-200" />} text="No clock-in data yet." />
              : <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={dailyData} margin={{ top:4, right:4, bottom:0, left:-20 }}>
                    <defs>
                      <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#f472b6" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#f472b6" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.3)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize:10, fill:"rgba(61,10,32,0.4)" }} axisLine={false} tickLine={false} interval={1}
                      tickFormatter={(v:string) => String(new Date(v).getDate())} />
                    <YAxis domain={[0,"auto"]} tick={{ fontSize:10, fill:"rgba(61,10,32,0.4)" }} axisLine={false} tickLine={false} />
                    <Tooltip {...glassTooltip} labelFormatter={(_,p) => p[0]?.payload?.label ?? ""} formatter={(v:number) => [`${v}h`,"Hours"]} />
                    <Area type="monotone" dataKey="hours" stroke="#e11d48" strokeWidth={2} fill="url(#hoursGrad)" dot={{ r:3, fill:"#e11d48", stroke:"#fff", strokeWidth:1.5 }} activeDot={{ r:5, fill:"#e11d48" }} />
                  </AreaChart>
                </ResponsiveContainer>
            }
          </GlassCard>

          <GlassCard>
            <p className="text-[10px] font-semibold text-pink-400 uppercase tracking-widest mb-4">Tasks by Type</p>
            {taskBreakdown.length === 0
              ? <EmptyState icon={<Zap size={20} className="text-pink-200" />} text="No tasks logged yet." />
              : <div className="space-y-3">
                  {taskBreakdown.map(t => {
                    const total = taskBreakdown.reduce((s,x)=>s+x.count,0);
                    const pct = Math.round((t.count/total)*100);
                    return (
                      <div key={t.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-[#3d0a20]">{t.label}</span>
                          <span className="tabular-nums" style={{ color:"rgba(61,10,32,0.5)", fontFamily:"'DM Mono',monospace" }}>{t.count} · {pct}%</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.28)" }}>
                          <div className="h-full rounded-full" style={{ width:`${pct}%`, background:`linear-gradient(90deg,${t.color}cc,${t.color})` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
            }
          </GlassCard>
        </div>
      </>)}
    </div>
  );
}

/* ─── Settings View ──────────────────────────────────────── */
function SettingsView({ user, workHours, onWorkHoursChange, onUserChange, onSignOut }: {
  user:User; workHours:number; onWorkHoursChange:(h:number)=>void;
  onUserChange:(u:User)=>void; onSignOut:()=>void | Promise<void>;
}) {
  const storedSettings = LS.settings(user.id) || {};
  const [form, setForm]       = useState({
    name:user.name,
    role:user.role,
    department:user.department,
    email:storedSettings.profile?.email || `${user.firstName.toLowerCase()}@interntrack.io`,
    phone:storedSettings.profile?.phone || "",
    mentor:storedSettings.profile?.mentor || "",
  });
  const [notifs, setNotifs]   = useState({
    clockReminder: storedSettings.notifications?.clockReminder ?? true,
    dailySummary: storedSettings.notifications?.dailySummary ?? true,
    weeklyReport: storedSettings.notifications?.weeklyReport ?? false,
    mentorUpdates: storedSettings.notifications?.mentorUpdates ?? true,
    systemAlerts: storedSettings.notifications?.systemAlerts ?? true,
  });
  const [localHours, setLocalHours] = useState(workHours);
  const [saved, setSaved]     = useState(false);
  const [showDanger, setShowDanger] = useState(false);

  // Preview: what would end time look like if clocked in right now
  const previewEnd = new Date(Date.now() + localHours * 3600000);

  function save() {
    const updated: User = { ...user, name:form.name.trim(), firstName:form.name.trim().split(" ")[0], role:form.role, department:form.department, initials:initials(form.name) };
    onUserChange(updated);
    onWorkHoursChange(localHours);
    LS.saveSettings(user.id, {
      profile: { email:form.email, phone:form.phone, mentor:form.mentor },
      notifications:notifs,
    });
    void STORE.syncNow();
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }
  async function deleteProfile() {
    const users = LS.users().filter(u => u.id !== user.id);
    LS.saveUsers(users);
    STORE.removeItem(`it_act_${user.id}`);
    STORE.removeItem(`it_note_${user.id}`);
    STORE.removeItem(`it_att_${user.id}`);
    STORE.removeItem(`it_wh_${user.id}`);
    STORE.removeItem(`it_notesv2_${user.id}`);
    STORE.removeItem(`it_cal_${user.id}`);
    STORE.removeItem(`it_settings_${user.id}`);
    await STORE.syncNow();
    await onSignOut();
  }

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl text-sm text-[#3d0a20] outline-none transition-all placeholder:text-pink-200";

  return (
    <div className="space-y-5 max-w-3xl">
      <GlassCard>
        <div className="flex items-center gap-2 mb-5 pb-4" style={{ borderBottom:"1px solid rgba(255,255,255,0.25)" }}>
          <span className="text-sm">👤</span>
          <span className="font-bold text-sm text-[#3d0a20]">Profile Information</span>
        </div>
        <div className="flex items-center gap-4 mb-5">
          <GlassAvatar initials={initials(form.name||user.name)} size={56} />
          <div>
            <p className="font-semibold text-[#3d0a20] text-sm">{form.name || user.name}</p>
            <p className="text-xs text-pink-400 mt-0.5">{form.role}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            ["Full Name",        "name",       "text",  "e.g. Mia Tanaka"],
            ["Role",             "role",       "text",  "e.g. Design Intern"],
            ["Department",       "department", "text",  "e.g. Product Design"],
            ["Mentor / Manager", "mentor",     "text",  "e.g. Sarah Kim"],
            ["Email",            "email",      "email", ""],
            ["Phone",            "phone",      "tel",   ""],
          ] as [string,string,string,string][]).map(([label, key, type, placeholder]) => (
            <div key={key}>
              <label className="block text-[10px] font-semibold text-pink-400 uppercase tracking-widest mb-1.5">{label}</label>
              <input
                type={type}
                value={(form as any)[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                className={inputCls + " placeholder:text-pink-200/60"}
                style={G.input}
              />
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center gap-2 mb-5 pb-4" style={{ borderBottom:"1px solid rgba(255,255,255,0.25)" }}>
          <span className="text-sm">🕘</span>
          <span className="font-bold text-sm text-[#3d0a20]">Work Hours</span>
        </div>

        {/* Quick presets */}
        <label className="block text-[10px] font-semibold text-pink-400 uppercase tracking-widest mb-2">Daily Work Duration</label>
        <div className="flex gap-2 flex-wrap mb-4">
          {[6, 7, 7.5, 8, 8.5, 9, 10].map(h => (
            <button key={h} onClick={() => setLocalHours(h)}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all hover:scale-105"
              style={localHours === h
                ? { background:"linear-gradient(135deg,#f472b6,#e11d48)", color:"#fff", boxShadow:"0 2px 10px rgba(225,29,72,0.28)" }
                : { ...G.input, color:"rgba(61,10,32,0.65)" }
              }>
              {h % 1 === 0 ? `${h}h` : `${Math.floor(h)}h ${(h % 1) * 60}m`}
            </button>
          ))}
        </div>

        {/* Custom slider */}
        <label className="block text-[10px] font-semibold text-pink-400 uppercase tracking-widest mb-2">Custom</label>
        <div className="flex items-center gap-3 mb-4">
          <input type="range" min={4} max={12} step={0.5} value={localHours}
            onChange={e => setLocalHours(parseFloat(e.target.value))}
            className="flex-1 accent-pink-500 cursor-pointer h-1.5 rounded-full"
            style={{ accentColor:"#e11d48" }}
          />
          <span className="text-sm font-bold text-[#3d0a20] tabular-nums w-14 text-right"
            style={{ fontFamily:"'DM Mono',monospace" }}>
            {localHours % 1 === 0 ? `${localHours}h` : `${Math.floor(localHours)}h ${(localHours % 1) * 60}m`}
          </span>
        </div>

        {/* Live preview */}
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{ background:"rgba(244,114,182,0.1)", border:"1px solid rgba(244,114,182,0.22)" }}>
          <span className="text-base">⏱</span>
          <p className="text-xs" style={{ color:"rgba(61,10,32,0.6)" }}>
            If you clock in <span className="font-semibold text-[#3d0a20]">now</span>, your shift ends at{" "}
            <span className="font-bold text-[#3d0a20]"
              style={{ fontFamily:"'DM Mono',monospace" }}>
              {previewEnd.toLocaleTimeString("en-US",{ hour:"2-digit", minute:"2-digit", hour12:true })}
            </span>
            {" "}·{" "}
            <span className="font-semibold text-pink-500">
              {localHours % 1 === 0 ? `${localHours} hrs` : `${Math.floor(localHours)}h ${(localHours%1)*60}m`} total
            </span>
          </p>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center gap-2 mb-5 pb-4" style={{ borderBottom:"1px solid rgba(255,255,255,0.25)" }}>
          <span className="text-sm">🔔</span>
          <span className="font-bold text-sm text-[#3d0a20]">Notifications</span>
        </div>
        {([
          ["clockReminder","Clock-in/out Reminder","Remind me 5 min before shift start and end"],
          ["dailySummary","Daily Summary","Send a summary of my day at end of shift"],
          ["weeklyReport","Weekly Report","Weekly digest every Friday afternoon"],
          ["mentorUpdates","Mentor Alerts","Notify when mentor leaves feedback"],
          ["systemAlerts","System Alerts","Important updates and announcements"],
        ] as [keyof typeof notifs, string, string][]).map(([key,label,desc]) => (
          <div key={key} className="flex items-center justify-between py-3 rounded-xl px-3 hover:bg-white/15" style={{ borderBottom:"1px solid rgba(255,255,255,0.18)" }}>
            <div>
              <p className="text-sm font-semibold text-[#3d0a20]">{label}</p>
              <p className="text-xs mt-0.5" style={{ color:"rgba(61,10,32,0.5)" }}>{desc}</p>
            </div>
            <button onClick={() => setNotifs(p=>({...p,[key]:!p[key]}))}
              className="relative rounded-full transition-all shrink-0 ml-4"
              style={{ width:40, height:22, background:notifs[key]?"linear-gradient(135deg,#f472b6,#e11d48)":"rgba(255,255,255,0.3)", boxShadow:notifs[key]?"0 2px 8px rgba(225,29,72,0.35)":"none", border:"1px solid rgba(255,255,255,0.4)" }}>
              <span className="absolute top-0.5 rounded-full bg-white transition-all" style={{ width:18, height:18, left:notifs[key]?20:2, boxShadow:"0 1px 4px rgba(0,0,0,0.15)" }} />
            </button>
          </div>
        ))}
      </GlassCard>

      <div className="it-settings-actions flex items-center justify-between gap-3 pb-2">
        <button onClick={() => setShowDanger(v=>!v)}
          className="it-settings-delete px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2"
          style={{ background:"rgba(251,113,133,0.15)", color:"#be123c", border:"1px solid rgba(251,113,133,0.3)" }}>
          <Trash2 size={13} /> Delete Profile
        </button>
        <div className="it-settings-save-group flex gap-2">
          <button onClick={() => void onSignOut()} className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all" style={{ background:"rgba(255,255,255,0.22)", color:"rgba(61,10,32,0.55)", border:"1px solid rgba(255,255,255,0.38)" }}>
            Sign Out
          </button>
          <button onClick={save} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
            style={{ background:saved?"linear-gradient(135deg,#34d399,#059669)":"linear-gradient(135deg,#f472b6,#e11d48)", boxShadow:"0 4px 16px rgba(225,29,72,0.3)" }}>
            {saved ? "✓ Saved!" : "Save Changes"}
          </button>
        </div>
      </div>

      {showDanger && (
        <div className="rounded-2xl p-5" style={{ background:"rgba(251,113,133,0.12)", border:"1px solid rgba(251,113,133,0.3)" }}>
          <p className="text-sm font-semibold text-[#3d0a20] mb-1">Delete this profile?</p>
          <p className="text-xs mb-4" style={{ color:"rgba(61,10,32,0.55)" }}>This will permanently remove {user.firstName}'s profile and all associated data. This cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={() => setShowDanger(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all" style={{ background:"rgba(255,255,255,0.3)", color:"rgba(61,10,32,0.6)" }}>Cancel</button>
            <button onClick={() => void deleteProfile()} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-all" style={{ background:"linear-gradient(135deg,#fb7185,#e11d48)" }}>Yes, Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}


/* ─── Google Sheets hydration gate ───────────────────────── */
export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;
    setReady(false);
    setError("");
    STORE.bootstrap()
      .then(() => {
        if (mounted) setReady(true);
      })
      .catch((reason) => {
        if (mounted) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => { mounted = false; };
  }, [attempt]);

  if (!ready) {
    return (
      <div className="it-loading-screen min-h-screen flex items-center justify-center relative overflow-hidden px-6"
        style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", background:"#0c0c0e" }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/4 pointer-events-none"
          style={{ width:500, height:500, borderRadius:"50%",
            background:"radial-gradient(ellipse at 40% 38%, #7eb3ff 0%, #9b6fd4 30%, #d4956a 55%, transparent 75%)",
            filter:"blur(72px)", opacity:0.65 }} />
        <div className="relative z-10 flex flex-col items-center gap-4 text-center max-w-sm" style={{ animation:"fadeUp 0.55s ease both" }}>
          <div className="flex gap-0 leading-none">
            <span className="text-2xl font-black text-white" style={{ letterSpacing:"-0.04em" }}>Intern</span>
            <span className="text-2xl font-black" style={{ letterSpacing:"-0.04em", background:"linear-gradient(135deg,#f472b6,#be185d)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Track</span>
          </div>
          {error ? (
            <>
              <p className="text-sm font-semibold text-white">Google Sheets connection required</p>
              <p className="text-xs leading-5" style={{ color:"rgba(255,255,255,0.55)" }}>{error}</p>
              <p className="text-[11px] leading-5" style={{ color:"rgba(255,255,255,0.35)" }}>
                This cloud-only build does not keep a browser copy of your data.
              </p>
              <button onClick={() => setAttempt(value => value + 1)}
                className="mt-1 px-6 py-3 rounded-full text-sm font-bold transition-all active:scale-95"
                style={{ background:"white", color:"#0c0c0e" }}>
                Retry Connection
              </button>
            </>
          ) : (
            <>
              <div className="w-5 h-5 rounded-full" style={{ border:"2px solid rgba(255,255,255,0.18)", borderTopColor:"rgba(255,255,255,0.9)", animation:"itSpin 0.8s linear infinite" }} />
              <p className="text-[11px]" style={{ color:"rgba(255,255,255,0.35)" }}>Loading directly from Google Sheets…</p>
            </>
          )}
        </div>
        <style>{`
          @keyframes itSpin { to { transform: rotate(360deg); } }
          @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        `}</style>
      </div>
    );
  }

  return <InternTrackApp />;
}
