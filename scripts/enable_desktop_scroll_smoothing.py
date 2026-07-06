from pathlib import Path

path = Path('src/app/App.tsx')
text = path.read_text(encoding='utf-8')

if 'installDesktopScrollSmoothing' in text:
    print('Desktop scroll smoothing is already enabled.')
    raise SystemExit(0)

import_anchor = 'import { STORE } from "../lib/cloudStore";\n'
if import_anchor not in text:
    raise RuntimeError('Could not find cloudStore import.')
text = text.replace(
    import_anchor,
    import_anchor + 'import { installDesktopScrollSmoothing } from "../lib/smoothDesktopScroll";\n',
    1,
)

effect_anchor = '''  // Clock ticker
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
      if (clockedIn && clockInTime) setElapsed(Date.now() - clockInTime.getTime());
    }, 1000);
    return () => clearInterval(t);
  }, [clockedIn, clockInTime]);
'''
if effect_anchor not in text:
    raise RuntimeError('Could not find clock ticker effect.')
text = text.replace(
    effect_anchor,
    effect_anchor + '''\n  useEffect(() => installDesktopScrollSmoothing(), []);\n''',
    1,
)

path.write_text(text, encoding='utf-8')
print('Enabled desktop wheel smoothing in App.tsx.')
