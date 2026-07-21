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
    '''const NAV_ITEMS = [''',
    '''// userSelectedColorSchemeV1: each profile owns and restores its selected palette.
function savedUserColorScheme(userId: string): UserColorScheme {
  const settings = LS.settings(userId) || {};
  return normalizeUserColorScheme(settings.appearance?.colorScheme);
}

const NAV_ITEMS = [''',
    "theme settings helper",
)

new_signin_anchor = '''  const [leaving, setLeaving]   = useState(false);
  const [selected, setSelected] = useState<User>(users[0]);
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {'''
new_signin_replacement = '''  const [leaving, setLeaving]   = useState(false);
  const [selected, setSelected] = useState<User>(users[0]);
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (selected) applyUserColorScheme(savedUserColorScheme(selected.id));
  }, [selected?.id]);

  useEffect(() => {'''
old_signin_anchor = '''  const [leaving, setLeaving]   = useState(false);
  const [selected, setSelected] = useState<User>(users[0]);

  function enter()'''
old_signin_replacement = '''  const [leaving, setLeaving]   = useState(false);
  const [selected, setSelected] = useState<User>(users[0]);

  useEffect(() => {
    if (selected) applyUserColorScheme(savedUserColorScheme(selected.id));
  }, [selected?.id]);

  function enter()'''
if new_signin_anchor in source:
    replace_once(new_signin_anchor, new_signin_replacement, "PIN sign-in theme preview")
elif old_signin_anchor in source:
    replace_once(old_signin_anchor, old_signin_replacement, "legacy sign-in theme preview")
else:
    raise RuntimeError("Could not find expected source for sign-in theme preview.")

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

new_delete_anchor = '''    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }
  async function deleteProfile()'''
old_delete_anchor = '''    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }
  function deleteProfile()'''
delete_replacement = '''    applyUserColorScheme(colorScheme);
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
  {delete_signature}'''
if new_delete_anchor in source:
    replace_once(new_delete_anchor, delete_replacement.replace("{delete_signature}", "async function deleteProfile()"), "PIN theme selection handler")
elif old_delete_anchor in source:
    replace_once(old_delete_anchor, delete_replacement.replace("{delete_signature}", "function deleteProfile()"), "legacy theme selection handler")
else:
    raise RuntimeError("Could not find expected source for theme selection handler.")

notification_anchor = '''      <GlassCard>
        <div className="flex items-center gap-2 mb-5 pb-4" style={{ borderBottom:"1px solid rgba(255,255,255,0.09)" }}>
          <span className="text-sm">🔔</span>
          <span className="font-bold text-sm text-[#f7f7f8]">Notifications</span>
        </div>'''

appearance_card = '''      <GlassCard>
        <div className="flex items-center gap-2 mb-5 pb-4" style={{ borderBottom:"1px solid rgba(255,255,255,0.09)" }}>
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

styles_path = Path("src/styles/performance.css")
styles = styles_path.read_text(encoding="utf-8")
theme_css = r'''

/* userSelectedColorSchemeV1: defaults plus utility-class compatibility. */
:root {
  --it-primary: #e11d48;
  --it-primary-dark: #be185d;
  --it-primary-rgb: 225,29,72;
  --it-primary-dark-rgb: 190,24,93;
  --it-accent: #f472b6;
  --it-accent-rgb: 244,114,182;
  --it-accent-light: #f9a8d4;
  --it-accent-light-rgb: 249,168,212;
  --it-accent-pale: #fbcfe8;
  --it-accent-wash: #fce4ec;
  --it-accent-bright: #ff80c0;
  --it-bg-soft: #fda4c8;
  --it-bg-mid: #e879a0;
  --it-bg-deep: #db2777;
  --it-bg-end: #be185d;
  --it-ink: #3d0a20;
}

html[data-it-color-scheme] {
  --background: var(--it-accent-light);
  --primary: var(--it-primary);
  --secondary-foreground: var(--it-primary-dark);
  --accent: var(--it-accent);
  --ring: var(--it-accent);
  --chart-1: var(--it-primary);
  --chart-2: var(--it-accent);
  --chart-3: var(--it-primary-dark);
}

html[data-it-color-scheme] .it-app-shell [class*="text-pink-"],
html[data-it-color-scheme] .it-signin-screen [class*="text-pink-"],
html[data-it-color-scheme] .it-loading-screen [class*="text-pink-"] {
  color: var(--it-primary-dark) !important;
}

html[data-it-color-scheme] .it-app-shell [class*="bg-pink-"],
html[data-it-color-scheme] .it-signin-screen [class*="bg-pink-"] {
  background-color: var(--it-accent-pale) !important;
}

html[data-it-color-scheme] .it-app-shell [class*="border-pink-"] {
  border-color: var(--it-accent) !important;
}

html[data-it-color-scheme] .it-app-shell [class*="accent-pink-"] {
  accent-color: var(--it-primary) !important;
}

html[data-it-color-scheme] .it-app-shell [class*="placeholder:text-pink-"]::placeholder {
  color: color-mix(in srgb, var(--it-accent) 45%, transparent) !important;
}

html[data-it-color-scheme] .it-app-shell [class*="hover:bg-pink-"]:hover,
html[data-it-color-scheme] .it-signin-screen [class*="hover:bg-pink-"]:hover {
  background-color: color-mix(in srgb, var(--it-accent-pale) 74%, white) !important;
}

html[data-it-color-scheme] .it-main input:focus,
html[data-it-color-scheme] .it-main textarea:focus,
html[data-it-color-scheme] .it-main select:focus {
  border-color: rgba(var(--it-accent-rgb),0.58) !important;
  box-shadow: 0 0 0 3px rgba(var(--it-accent-rgb),0.12), 0 6px 18px rgba(var(--it-primary-dark-rgb),0.08);
}

html[data-it-color-scheme] .it-shift-progress-glow.is-active {
  box-shadow: 0 0 8px rgba(var(--it-accent-light-rgb),0.92), 0 0 18px rgba(var(--it-accent-rgb),0.72), 0 0 30px rgba(var(--it-primary-rgb),0.48) !important;
}
'''

if "userSelectedColorSchemeV1: defaults" not in styles:
    styles_path.write_text(styles.rstrip() + theme_css + "\n", encoding="utf-8")

print("Synchronized the full interface with each user's selected color scheme.")
