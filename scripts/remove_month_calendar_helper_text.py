from pathlib import Path

path = Path('src/app/ScrollableMonthCalendar.tsx')
text = path.read_text(encoding='utf-8')

old = '''          <p className="text-[9px] uppercase tracking-[0.2em] mt-0.5" style={{ color: "rgba(249,168,212,0.64)" }}>
            Scroll through full months
          </p>
'''

if old in text:
    text = text.replace(old, '', 1)
    path.write_text(text, encoding='utf-8')
    print('Removed month Calendar helper text.')
else:
    print('Month Calendar helper text is already removed.')
