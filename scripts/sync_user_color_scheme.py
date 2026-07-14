from pathlib import Path

path = Path("src/app/App.tsx")
source = path.read_text(encoding="utf-8")

if "userSelectedColorSchemeV1" in source:
    print("User-selected color scheme is already synchronized.")
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str) -> None:
    global source
    if old not in source:
        raise RuntimeError(f"Could not find expected source for {label}.")
    source = source.replace(old, new, 1)


replace_once(
    'import { STORE } from "../lib/cloudStore";\n',
    'import { STORE } from "../lib/cloudStore";\nimport { applyUserColorScheme, normalizeUserColorScheme, USER_COLOR_SCHEMES, type UserColorScheme } from "../lib/userTheme";\n',
    "theme imports",
)

replace_once(
    '''};

/* ─── Constants ───────────────────────────────────────────── */''',
    '''};

// userSelectedColorSchemeV1: each profile owns and restores its selected palette.
function savedUserColorScheme(userId: string): UserColorScheme {
  const settings = LS.settings(userId) || {};
  return normalizeUserColorScheme(settings.appearance?.colorScheme);
}

/* ─── Constants ───────────────────────────────────────────── */''',
    "theme settings helper",
)

replace_once(
    '''  const [leaving, setLeaving]   = useState(false);
  const [selected, setSelected] = useState<User>(users[0]);

  function enter()''',
    '''  const [leaving, setLeaving]   = useState(false);
  const [selected, setSelected] = useState<User>(users[0]);

  useEffect(() => {
    if (selected) applyUserColorScheme(savedUserColorScheme(selected.id));
  }, [selected?.id]);

  function enter()''',
    "sign-in theme preview",
)

replace_once(
    '''  const actEndRef = useRef<HTMLDivElement>(null);
  const activityCountRef = useRef<number | null>(null);

  function restoreClockState''',
    '''  const actEndRef = useRef<HTMLDivElement>(null);
  const activityCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user) return;
    applyUserColorScheme(savedUserColorScheme(user.id));
  }, [user?.id, cloudRevision]);

  function restoreClockState''',
    "active user theme restoration",
)

replace_once(
    '''  const [localHours, setLocalHours] = useState(workHours);
  const [saved, setSaved]     = useState(false);''',
    '''  const [localHours, setLocalHours] = useState(workHours);
  const [colorScheme, setColorScheme] = useState<UserColorScheme>(() => savedUserColorScheme(user.id));
  const [saved, setSaved]     = useState(false);''',
    "settings theme state",
)

replace_once(
    '''      profile: { email:form.email, phone:form.phone, mentor:form.mentor },
      notifications:notifs,
    });''',
    '''      profile: { email:form.email, phone:form.phone, mentor:form.mentor },
      notifications:notifs,
      appearance:{ colorScheme },
    });''',
    "settings theme persistence",
)

replace_once(
    '''    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }
  function deleteProfile()''',
    '''    applyUserColorScheme(colorScheme);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }
  function selectColorScheme(nextScheme: UserColorScheme) {
    setColorScheme(nextScheme);
    applyUserColorScheme(nextScheme);
    const currentSettings = LS.settings(user.id) || {};
    LS.saveSettings(user.id, {
      ...currentSettings,
      appearance:{ ...(currentSettings.appearance || {}), colorScheme:nextScheme },
    });
    void STORE.syncNow().catch(error => console.error("Color scheme sync failed.", error));
  }
  function deleteProfile()''',
    "theme selection handler",
)

notification_anchor = '''      <GlassCard>
        <div className="flex items-center gap-2 mb-5 pb-4" style={{ borderBottom:"1px solid rgba(255,255,255,0.25)" }}>
          <span className="text-sm">🔔</span>
          <span className="font-bold text-sm text-[#3d0a20]">Notifications</span>
        </div>'''

appearance_card = '''      <GlassCard>
        <div className="flex items-center gap-2 mb-5 pb-4" style={{ borderBottom:"1px solid rgba(255,255,255,0.25)" }}>
          <span className="text-sm">🎨</span>
          <span className="font-bold text-sm" style={{ color:"var(--it-ink)" }}>Color Scheme</span>
        </div>
        <p className="text-xs mb-4" style={{ color:"color-mix(in srgb,var(--it-ink) 58%,transparent)" }}>
          This palette is saved separately for {user.firstName} and follows the selected profile across devices.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {USER_COLOR_SCHEMES.map(theme => {
            const active = colorScheme === theme.id;
            return (
              <button key={theme.id} type="button" onClick={() => selectColorScheme(theme.id)}
                className="rounded-2xl px-3 py-3 text-left transition-all"
                style={active
                  ? { background:"rgba(255,255,255,0.42)", border:"2px solid var(--it-primary)", boxShadow:"0 5px 18px rgba(var(--it-primary-rgb),0.22)", transform:"translateY(-1px)" }
                  : { background:"rgba(255,255,255,0.18)", border:"1px solid rgba(255,255,255,0.38)" }
                }>
                <span className="flex h-7 overflow-hidden rounded-full mb-2" style={{ boxShadow:"inset 0 0 0 1px rgba(255,255,255,0.42)" }}>
                  {theme.swatches.map((swatch, index) => <span key={index} className="flex-1" style={{ background:swatch }} />)}
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold" style={{ color:"var(--it-ink)" }}>{theme.label}</span>
                  {active && <span className="w-2 h-2 rounded-full" style={{ background:"var(--it-primary)", boxShadow:"0 0 8px rgba(var(--it-primary-rgb),0.6)" }} />}
                </span>
              </button>
            );
          })}
        </div>
      </GlassCard>

''' + notification_anchor

replace_once(notification_anchor, appearance_card, "appearance settings card")

# Convert the recurring rose palette into CSS variables. Semantic status colors
# (success, warning, absence, national/company holiday) remain independent.
replacements = {
    "#fda4c8":"var(--it-bg-soft)",
    "#e879a0":"var(--it-bg-mid)",
    "#db2777":"var(--it-bg-deep)",
    "#ff80c0":"var(--it-accent-bright)",
    "#fce4ec":"var(--it-accent-wash)",
    "#fbcfe8":"var(--it-accent-pale)",
    "#f9a8d4":"var(--it-accent-light)",
    "#f472b6":"var(--it-accent)",
    "#be185d":"var(--it-primary-dark)",
    "#e11d48":"var(--it-primary)",
    "rgba(225,29,72,":"rgba(var(--it-primary-rgb),",
    "rgba(244,114,182,":"rgba(var(--it-accent-rgb),",
    "rgba(249,168,212,":"rgba(var(--it-accent-light-rgb),",
    "rgba(190,24,93,":"rgba(var(--it-primary-dark-rgb),",
    "rgba(180,30,80,":"rgba(var(--it-primary-dark-rgb),",
}
for old, new in replacements.items():
    source = source.replace(old, new)

# Destructive actions stay red rather than inheriting the decorative palette.
source = source.replace(
    'linear-gradient(135deg,#fb7185,var(--it-primary))',
    'linear-gradient(135deg,#fb7185,#e11d48)',
)

path.write_text(source, encoding="utf-8")
print("Synchronized the full interface with each user's selected color scheme.")
