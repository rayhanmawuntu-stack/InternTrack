from pathlib import Path

path = Path('src/app/App.tsx')
text = path.read_text(encoding='utf-8')

if '@keyframes bootProgress' in text:
    print('Boot progress bar is already applied.')
    raise SystemExit(0)

old_loader = '''            <>
              <div className="w-5 h-5 rounded-full" style={{ border:"2px solid rgba(255,255,255,0.18)", borderTopColor:"rgba(255,255,255,0.9)", animation:"itSpin 0.8s linear infinite" }} />
              <p className="text-[11px]" style={{ color:"rgba(255,255,255,0.35)" }}>Loading directly from Google Sheets…</p>
            </>'''
new_loader = '''            <div className="w-full max-w-[250px] pt-1" role="progressbar" aria-label="Loading InternTrack">
              <div className="h-1.5 rounded-full overflow-hidden relative"
                style={{
                  background:"rgba(255,255,255,0.12)",
                  border:"1px solid rgba(255,255,255,0.16)",
                  boxShadow:"inset 0 1px 3px rgba(0,0,0,0.22)",
                }}>
                <div className="absolute inset-y-0 rounded-full"
                  style={{
                    width:"42%",
                    background:"linear-gradient(90deg,#fbcfe8 0%,#f472b6 48%,#e11d48 100%)",
                    boxShadow:"0 0 8px rgba(244,114,182,0.75), 0 0 18px rgba(225,29,72,0.42)",
                    animation:"bootProgress 1.25s cubic-bezier(0.65,0,0.35,1) infinite",
                  }} />
              </div>
            </div>'''

if old_loader not in text:
    raise RuntimeError('Could not locate the existing boot spinner and loading text.')
text = text.replace(old_loader, new_loader, 1)

old_styles = '''          @keyframes itSpin { to { transform: rotate(360deg); } }
          @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }'''
new_styles = '''          @keyframes bootProgress {
            0%   { left:-44%; opacity:0.72; }
            45%  { opacity:1; }
            100% { left:102%; opacity:0.78; }
          }
          @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }'''

if old_styles not in text:
    raise RuntimeError('Could not locate the boot animation styles.')
text = text.replace(old_styles, new_styles, 1)

path.write_text(text, encoding='utf-8')
print('Replaced the boot spinner and loading text with a pink progress bar.')
