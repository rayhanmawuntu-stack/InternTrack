from pathlib import Path
import re

path = Path('src/app/App.tsx')
text = path.read_text(encoding='utf-8')

if 'it-boot-theme' in text:
    print('Boot-screen app theme is already applied.')
    raise SystemExit(0)

old_tokens = '''const G = {
  sidebar: { background:"rgba(255,255,255,0.28)", backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)", borderRight:"1px solid rgba(255,255,255,0.4)" } as React.CSSProperties,
  input:   { background:"rgba(255,255,255,0.22)", border:"1px solid rgba(255,255,255,0.45)" } as React.CSSProperties,
  pill:    { background:"rgba(255,255,255,0.22)", border:"1px solid rgba(255,255,255,0.4)"  } as React.CSSProperties,
};'''
new_tokens = '''const G = {
  sidebar: { background:"rgba(17,17,20,0.84)", backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)", borderRight:"1px solid rgba(255,255,255,0.10)", boxShadow:"12px 0 40px rgba(0,0,0,0.16)" } as React.CSSProperties,
  input:   { background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.14)", color:"#f7f7f8" } as React.CSSProperties,
  pill:    { background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", color:"#f7f7f8" } as React.CSSProperties,
};'''
if old_tokens not in text:
    raise RuntimeError('Could not locate the global glass tokens.')
text = text.replace(old_tokens, new_tokens, 1)

start = text.find('  /* ── Dashboard ── */')
end = text.find('/* ─── Google Sheets hydration gate', start)
if start < 0 or end < 0:
    raise RuntimeError('Could not locate the signed-in app theme range.')

segment = text[start:end]
segment = segment.replace(
    'className="it-app-shell flex h-[100dvh] overflow-hidden"',
    'className="it-app-shell it-boot-theme flex h-[100dvh] overflow-hidden"',
    1,
)

old_animation = '''        @keyframes dashEnter {
          from { opacity: 0; transform: scale(0.96); filter: blur(10px); }
          to   { opacity: 1; transform: scale(1);    filter: blur(0);    }
        }'''
new_animation = '''        @keyframes dashEnter {
          from { opacity: 0; transform: scale(0.96); filter: blur(10px); }
          to   { opacity: 1; transform: scale(1);    filter: blur(0);    }
        }
        .it-boot-theme {
          color: #f7f7f8;
          background: #0c0c0e;
          color-scheme: dark;
        }
        .it-boot-theme input,
        .it-boot-theme textarea,
        .it-boot-theme select {
          color: #f7f7f8 !important;
          caret-color: #f472b6;
        }
        .it-boot-theme input::placeholder,
        .it-boot-theme textarea::placeholder {
          color: rgba(255,255,255,0.30) !important;
        }
        .it-boot-theme select option {
          background: #17171b;
          color: #f7f7f8;
        }
        .it-boot-theme .recharts-cartesian-axis-tick-value,
        .it-boot-theme .recharts-legend-item-text {
          fill: rgba(255,255,255,0.52) !important;
          color: rgba(255,255,255,0.52) !important;
        }
        .it-boot-theme .recharts-cartesian-grid line {
          stroke: rgba(255,255,255,0.08) !important;
        }
        .it-boot-theme [class*="hover:bg-pink-50"]:hover,
        .it-boot-theme [class*="hover:bg-white"]:hover {
          background: rgba(255,255,255,0.08) !important;
        }
        .it-boot-theme ::selection {
          background: rgba(244,114,182,0.38);
          color: white;
        }
        .it-boot-theme ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.16);
          border-radius: 999px;
        }'''
if old_animation not in segment:
    raise RuntimeError('Could not locate the dashboard animation style block.')
segment = segment.replace(old_animation, new_animation, 1)

old_background = '''      <div className="fixed inset-0 -z-10" style={{ background:"linear-gradient(145deg,#fda4c8 0%,#f472b6 25%,#e879a0 50%,#db2777 70%,#be185d 100%)" }} />
      <div className="fixed -z-10 rounded-full" style={{ width:600, height:600, bottom:-120, right:-120, background:"radial-gradient(circle,#ff80c0 0%,#f9a8d4 45%,transparent 70%)", filter:"blur(60px)", opacity:0.9 }} />
      <div className="fixed -z-10 rounded-full" style={{ width:420, height:420, top:-60, left:-60, background:"radial-gradient(circle,#fce4ec 0%,#fbcfe8 50%,transparent 75%)", filter:"blur(48px)", opacity:0.8 }} />
      <div className="fixed -z-10 rounded-full" style={{ width:280, height:280, top:"38%", right:"18%", background:"radial-gradient(circle,#f43f5e55 0%,transparent 80%)", filter:"blur(36px)" }} />'''
new_background = '''      <div className="fixed inset-0 -z-10" style={{ background:"radial-gradient(circle at 14% 0%,rgba(126,179,255,0.13),transparent 30%), radial-gradient(circle at 78% 8%,rgba(244,114,182,0.10),transparent 28%), linear-gradient(145deg,#0c0c0e 0%,#121216 48%,#08080a 100%)" }} />
      <div className="fixed -z-10 rounded-full" style={{ width:620, height:620, bottom:-180, right:-140, background:"radial-gradient(circle,rgba(155,111,212,0.20) 0%,rgba(126,179,255,0.08) 42%,transparent 72%)", filter:"blur(76px)", opacity:0.72 }} />
      <div className="fixed -z-10 rounded-full" style={{ width:470, height:470, top:-140, left:-100, background:"radial-gradient(circle,rgba(160,196,255,0.20) 0%,rgba(155,111,212,0.09) 48%,transparent 74%)", filter:"blur(68px)", opacity:0.66 }} />
      <div className="fixed -z-10 rounded-full" style={{ width:320, height:320, top:"34%", right:"14%", background:"radial-gradient(circle,rgba(244,114,182,0.11) 0%,transparent 78%)", filter:"blur(54px)" }} />'''
if old_background not in segment:
    raise RuntimeError('Could not locate the bright dashboard background.')
segment = segment.replace(old_background, new_background, 1)

segment = segment.replace('#3d0a20', '#f7f7f8')
segment = segment.replace('rgba(61,10,32,', 'rgba(255,255,255,')
segment = segment.replace('hover:bg-pink-50', 'hover:bg-white/10')
segment = segment.replace('background:"rgba(255,255,255,0.88)"', 'background:"rgba(18,18,21,0.96)"')
segment = segment.replace('background:"white"', 'background:"rgba(255,255,255,0.10)"')

alpha_map = {
    '0.60':'0.18', '0.58':'0.17', '0.55':'0.16', '0.52':'0.15',
    '0.50':'0.15', '0.48':'0.14', '0.45':'0.14', '0.42':'0.13',
    '0.40':'0.12', '0.38':'0.12', '0.35':'0.11', '0.32':'0.10',
    '0.30':'0.10', '0.28':'0.09', '0.26':'0.08', '0.25':'0.08',
    '0.24':'0.08', '0.22':'0.07', '0.20':'0.07', '0.18':'0.06',
    '0.16':'0.055', '0.15':'0.05', '0.14':'0.05', '0.12':'0.045',
    '0.10':'0.04',
}

def darken_background(match):
    alpha = match.group(1)
    mapped = alpha_map.get(alpha, alpha)
    return f'background:"rgba(255,255,255,{mapped})"'

segment = re.sub(r'background:"rgba\(255,255,255,(0\.\d+)\)"', darken_background, segment)
segment = re.sub(
    r'border:"1px solid rgba\(255,255,255,(0\.\d+)\)"',
    lambda match: 'border:"1px solid rgba(255,255,255,0.12)"' if float(match.group(1)) >= 0.18 else match.group(0),
    segment,
)
segment = re.sub(
    r'borderBottom:"1px solid rgba\(255,255,255,(0\.\d+)\)"',
    'borderBottom:"1px solid rgba(255,255,255,0.09)"',
    segment,
)
segment = re.sub(
    r'borderTop:"1px solid rgba\(255,255,255,(0\.\d+)\)"',
    'borderTop:"1px solid rgba(255,255,255,0.09)"',
    segment,
)

text = text[:start] + segment + text[end:]
path.write_text(text, encoding='utf-8')
print('Applied the boot-screen charcoal glass theme across the signed-in app.')
