from pathlib import Path

path = Path("src/app/App.tsx")
source = path.read_text(encoding="utf-8")

if "shiftGlowV3" in source:
    print("Cross-device shift glow is already applied.")
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

new_keyframes = '''            /* shiftGlowV3: dedicated halo plus compositor-friendly motion. */
            @keyframes shiftGlowPulse {
              0%, 100% {
                opacity: 0.48;
                transform: translate3d(0,-50%,0) scaleY(0.82);
              }
              50% {
                opacity: 0.95;
                transform: translate3d(0,-50%,0) scaleY(1.38);
              }
            }
            @keyframes shiftLightPulse {
              0%, 100% {
                opacity: 0.86;
                transform: scaleY(0.92);
              }
              50% {
                opacity: 1;
                transform: scaleY(1.12);
              }
            }
            @keyframes shiftLightSweep {
              0%   { transform: translate3d(-160%,0,0); opacity: 0; }
              18%  { opacity: 0.95; }
              82%  { opacity: 0.95; }
              100% { transform: translate3d(420%,0,0); opacity: 0; }
            }
            @keyframes shiftLightBeacon {
              0%, 100% {
                transform: translate3d(-50%,-50%,0) scale(0.84);
                opacity: 0.76;
              }
              50% {
                transform: translate3d(-50%,-50%,0) scale(1.46);
                opacity: 1;
              }
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

new_bar = '''                <div className="it-shift-progress-track h-3 rounded-full relative overflow-visible" style={{
                  background:"rgba(255,255,255,0.18)",
                  border:"1px solid rgba(255,255,255,0.30)",
                  boxShadow:"inset 0 1px 3px rgba(61,10,32,0.10)",
                  isolation:"isolate",
                }}>
                  <div
                    className={`it-shift-progress-glow ${clockedIn ? "is-active" : ""}`}
                    style={{
                      position:"absolute",
                      zIndex:0,
                      top:"50%",
                      left:0,
                      width:`${shiftProg}%`,
                      minWidth: clockedIn && shiftProg > 0 ? 12 : 0,
                      height:18,
                      borderRadius:"999px",
                      background:"linear-gradient(90deg,rgba(251,207,232,0.86),rgba(244,114,182,0.92),rgba(225,29,72,0.88))",
                      boxShadow:"0 0 9px rgba(249,168,212,0.95), 0 0 20px rgba(244,114,182,0.78), 0 0 38px rgba(225,29,72,0.52)",
                      opacity: clockedIn && shiftProg > 0 ? 0.72 : 0,
                      transform:"translate3d(0,-50%,0)",
                      transformOrigin:"center",
                      animation: clockedIn && shiftProg > 0 ? "shiftGlowPulse 1.45s ease-in-out infinite" : "none",
                      willChange: clockedIn ? "transform, opacity" : "auto",
                      pointerEvents:"none",
                    }}
                  />
                  <div className="it-shift-progress-fill h-full rounded-full transition-[width] duration-700 relative overflow-hidden"
                    style={{
                      zIndex:1,
                      width:`${shiftProg}%`,
                      minWidth: clockedIn && shiftProg > 0 ? 10 : 0,
                      background:"linear-gradient(90deg,#fbcfe8 0%,#f472b6 48%,#e11d48 100%)",
                      boxShadow: clockedIn && shiftProg > 0
                        ? "0 0 5px rgba(255,255,255,0.82), 0 0 11px rgba(249,168,212,0.88), 0 0 18px rgba(225,29,72,0.58)"
                        : "none",
                      opacity: clockedIn ? 1 : 0.32,
                      transformOrigin:"center",
                      animation: clockedIn ? "shiftLightPulse 1.45s ease-in-out infinite" : "none",
                      willChange: clockedIn ? "transform, opacity" : "auto",
                      WebkitBackfaceVisibility:"hidden",
                      backfaceVisibility:"hidden",
                    }}>
                    {clockedIn && shiftProg > 0 && (
                      <div className="it-shift-progress-sweep" style={{
                        position:"absolute",
                        top:"-60%",
                        left:0,
                        width:"30%",
                        height:"220%",
                        borderRadius:"999px",
                        background:"linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.98) 50%,transparent 100%)",
                        animation:"shiftLightSweep 1.75s linear infinite",
                        willChange:"transform, opacity",
                        pointerEvents:"none",
                      }} />
                    )}
                  </div>
                  {clockedIn && shiftProg > 0 && shiftProg < 100 && (
                    <div className="it-shift-progress-beacon" style={{
                      position:"absolute",
                      zIndex:2,
                      top:"50%",
                      left:`${Math.max(1.5, shiftProg)}%`,
                      width:11,
                      height:11,
                      borderRadius:"50%",
                      background:"#fff7fb",
                      border:"2px solid #e11d48",
                      boxShadow:"0 0 8px rgba(255,255,255,0.95), 0 0 16px rgba(249,168,212,0.98), 0 0 28px rgba(225,29,72,0.75)",
                      animation:"shiftLightBeacon 1.45s ease-in-out infinite",
                      willChange:"transform, opacity",
                      pointerEvents:"none",
                    }} />
                  )}
                </div>'''

if old_bar not in source:
    raise RuntimeError("Could not find the existing shift progress bar.")
source = source.replace(old_bar, new_bar, 1)

path.write_text(source, encoding="utf-8")
print("Applied cross-device glow and pulse to the shift progress bar.")
