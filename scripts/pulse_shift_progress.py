from pathlib import Path

path = Path("src/app/App.tsx")
source = path.read_text(encoding="utf-8")

if "@keyframes shiftLightPulse" in source:
    print("Pulsing shift light bar is already applied.")
    raise SystemExit(0)

old_keyframes = '''            @keyframes pulseGlow {
              0%   { box-shadow: 0 0 0 0   rgba(225,29,72,0.55); }
              60%  { box-shadow: 0 0 0 6px rgba(225,29,72,0.0);  }
              100% { box-shadow: 0 0 0 0   rgba(225,29,72,0.0);  }
            }
            @keyframes shimmer {
              0%   { background-position: -200% 0; }
              100% { background-position:  200% 0; }
            }'''

new_keyframes = '''            @keyframes shiftLightPulse {
              0%, 100% {
                box-shadow:
                  0 0 5px rgba(249,168,212,0.65),
                  0 0 11px rgba(244,114,182,0.38),
                  0 0 18px rgba(225,29,72,0.18);
                filter: brightness(1);
              }
              50% {
                box-shadow:
                  0 0 8px rgba(255,255,255,0.9),
                  0 0 18px rgba(249,168,212,0.9),
                  0 0 30px rgba(225,29,72,0.55);
                filter: brightness(1.18);
              }
            }
            @keyframes shiftLightSweep {
              0%   { transform: translateX(-140%); opacity: 0; }
              20%  { opacity: 0.95; }
              80%  { opacity: 0.95; }
              100% { transform: translateX(340%); opacity: 0; }
            }'''

if old_keyframes not in source:
    raise RuntimeError("Could not find the existing shift progress animations.")
source = source.replace(old_keyframes, new_keyframes, 1)

old_bar = '''                <div className="h-2 rounded-full overflow-visible relative" style={{ background:"rgba(255,255,255,0.2)" }}>
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
                </div>'''

new_bar = '''                <div className="h-2.5 rounded-full relative" style={{
                  background:"rgba(255,255,255,0.18)",
                  border:"1px solid rgba(255,255,255,0.28)",
                  boxShadow:"inset 0 1px 3px rgba(61,10,32,0.08)",
                }}>
                  <div className="h-full rounded-full transition-all duration-1000 relative overflow-hidden"
                    style={{
                      width:`${shiftProg}%`,
                      minWidth: clockedIn && shiftProg > 0 ? 8 : 0,
                      background:"linear-gradient(90deg,#fbcfe8 0%,#f472b6 45%,#e11d48 100%)",
                      opacity: clockedIn ? 1 : 0.32,
                      animation: clockedIn ? "shiftLightPulse 1.55s ease-in-out infinite" : "none",
                    }}>
                    {clockedIn && shiftProg > 0 && (
                      <div style={{
                        position:"absolute",
                        top:"-80%",
                        left:0,
                        width:"28%",
                        height:"260%",
                        borderRadius:"999px",
                        background:"radial-gradient(circle,rgba(255,255,255,0.98) 0%,rgba(255,255,255,0.52) 28%,rgba(249,168,212,0) 72%)",
                        animation:"shiftLightSweep 1.9s linear infinite",
                        pointerEvents:"none",
                      }} />
                    )}
                  </div>
                </div>'''

if old_bar not in source:
    raise RuntimeError("Could not find the existing shift progress bar.")
source = source.replace(old_bar, new_bar, 1)

path.write_text(source, encoding="utf-8")
print("Applied pulsing pink light animation to the shift progress bar.")
