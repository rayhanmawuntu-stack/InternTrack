from pathlib import Path

app_path = Path("src/app/App.tsx")
app = app_path.read_text(encoding="utf-8")

if "remainingThemeSyncV1" not in app:
    app = app.replace(
        "// userSelectedColorSchemeV1: each profile owns and restores its selected palette.",
        "// userSelectedColorSchemeV1: each profile owns and restores its selected palette.\n// remainingThemeSyncV1: replace fixed text and surface colors across generated views.",
        1,
    )
    app = app.replace("#3d0a20", "var(--it-ink)")
    app = app.replace("#2b091b", "var(--it-ink)")
    app = app.replace("rgba(61,10,32,", "rgba(var(--it-ink-rgb),")
    app_path.write_text(app, encoding="utf-8")

month_path = Path("src/app/ScrollableMonthCalendar.tsx")
month = month_path.read_text(encoding="utf-8")
if "remainingThemeSyncV1" not in month:
    month = month.replace(
        'export default function ScrollableMonthCalendar({',
        '// remainingThemeSyncV1: Calendar accents follow the active user palette.\nexport default function ScrollableMonthCalendar({',
        1,
    )
    month = month.replace("#f9a8d4", "var(--it-accent-light)")
    month = month.replace("#2b091b", "var(--it-ink)")
    month = month.replace("rgba(249,168,212,", "rgba(var(--it-accent-light-rgb),")
    month = month.replace("rgba(244,114,182,", "rgba(var(--it-accent-rgb),")
    month = month.replace("rgba(225,29,72,", "rgba(var(--it-primary-rgb),")
    month_path.write_text(month, encoding="utf-8")

forms_path = Path("src/app/ReportEntryForms.tsx")
forms = forms_path.read_text(encoding="utf-8")
if "remainingThemeSyncV1" not in forms:
    forms = forms.replace(
        'const inputClass =',
        '// remainingThemeSyncV1: report entry controls use the selected user palette.\nconst inputClass =',
        1,
    )
    forms = forms.replace("#3d0a20", "var(--it-ink)")
    forms = forms.replace("#f472b6", "var(--it-accent)")
    forms = forms.replace("#e11d48", "var(--it-primary)")
    forms = forms.replace("#be185d", "var(--it-primary-dark)")
    forms = forms.replace("rgba(180,30,80,", "rgba(var(--it-primary-dark-rgb),")
    forms = forms.replace(
        'linear-gradient(135deg,#a78bfa,#7c3aed)',
        'linear-gradient(135deg,var(--it-accent),var(--it-primary))',
    )
    forms = forms.replace('color:"#7c3aed"', 'color:"var(--it-primary-dark)"')
    forms_path.write_text(forms, encoding="utf-8")

styles_path = Path("src/styles/performance.css")
styles = styles_path.read_text(encoding="utf-8")
if "--it-ink-rgb:" not in styles:
    styles = styles.replace("  --it-ink: #3d0a20;", "  --it-ink: #3d0a20;\n  --it-ink-rgb: 61,10,32;", 1)
styles = styles.replace("rgba(249,168,212,", "rgba(var(--it-accent-light-rgb),")
styles = styles.replace("rgba(244,114,182,", "rgba(var(--it-accent-rgb),")
styles = styles.replace("rgba(225,29,72,", "rgba(var(--it-primary-rgb),")
styles = styles.replace("rgba(190,24,93,", "rgba(var(--it-primary-dark-rgb),")
styles_path.write_text(styles, encoding="utf-8")

print("Applied the selected user palette to remaining interface components.")
