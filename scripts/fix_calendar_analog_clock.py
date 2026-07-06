from pathlib import Path

path = Path('src/app/App.tsx')
text = path.read_text(encoding='utf-8')

if 'const analogHourAngle' in text:
    print('Calendar analog clock fix already applied.')
    raise SystemExit(0)

old_vars = '''  const curH        = now.getHours() + now.getMinutes() / 60;
  const dayName     = selDateObj.toLocaleDateString("en-US",{ weekday:"long" });'''
new_vars = '''  const curH        = now.getHours() + now.getMinutes() / 60;
  const analogHourAngle = ((now.getHours() % 12) + now.getMinutes() / 60 + now.getSeconds() / 3600) * 30 - 90;
  const analogMinuteAngle = (now.getMinutes() + now.getSeconds() / 60) * 6 - 90;
  const analogSecondAngle = now.getSeconds() * 6 - 90;
  const analogPoint = (angle:number, radius:number) => {
    const radians = angle * Math.PI / 180;
    return [CX + Math.cos(radians) * radius, CY + Math.sin(radians) * radius] as [number, number];
  };
  const [hourX, hourY] = analogPoint(analogHourAngle, 34);
  const [minuteX, minuteY] = analogPoint(analogMinuteAngle, 48);
  const [secondX, secondY] = analogPoint(analogSecondAngle, 54);
  const dayName     = selDateObj.toLocaleDateString("en-US",{ weekday:"long" });'''
if old_vars not in text:
    raise RuntimeError('Could not locate Calendar clock variables.')
text = text.replace(old_vars, new_vars, 1)

old_face = '''            {/* Inner clock face fill */}
            <circle cx={CX} cy={CY} r={97}  fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
            <circle cx={CX} cy={CY} r={70}  fill="rgba(255,255,255,0.07)" />'''
new_face = '''            {/* Inner analog clock face */}
            <circle cx={CX} cy={CY} r={97} fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
            <circle cx={CX} cy={CY} r={70} fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.24)" strokeWidth={1} />
            {Array.from({ length:60 }, (_, i) => {
              const angle = i * 6 - 90;
              const major = i % 5 === 0;
              const [x1,y1] = analogPoint(angle, major ? 60 : 63);
              const [x2,y2] = analogPoint(angle, 67);
              return <line key={`analog-tick-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={major ? "rgba(61,10,32,0.55)" : "rgba(61,10,32,0.22)"}
                strokeWidth={major ? 1.6 : 0.7} strokeLinecap="round" />;
            })}'''
if old_face not in text:
    raise RuntimeError('Could not locate inner clock face.')
text = text.replace(old_face, new_face, 1)

start = text.find('            {/* Current time indicator (today only) */}')
end = text.find('            {/* Empty state label */}', start)
if start < 0 or end < 0:
    raise RuntimeError('Could not locate current-time clock block.')
new_block = '''            {/* Real analog clock hands in the center */}
            {isToday ? (
              <g style={{ transition:"transform 0.2s linear" }}>
                <line x1={CX} y1={CY} x2={hourX} y2={hourY}
                  stroke="#7c3d52" strokeWidth={4.6} strokeLinecap="round" />
                <line x1={CX} y1={CY} x2={minuteX} y2={minuteY}
                  stroke="#be185d" strokeWidth={3} strokeLinecap="round" />
                <line x1={CX} y1={CY + 8} x2={secondX} y2={secondY}
                  stroke="#e11d48" strokeWidth={1.3} strokeLinecap="round" />
                <circle cx={CX} cy={CY} r={6.2} fill="#fff" stroke="#e11d48" strokeWidth={2.5} />
                <circle cx={CX} cy={CY} r={2.2} fill="#e11d48" />
              </g>
            ) : (
              <g>
                <circle cx={CX} cy={CY} r={5} fill="rgba(61,10,32,0.18)" />
                <text x={CX} y={CY + 20} textAnchor="middle" fill="rgba(61,10,32,0.40)" fontSize={8} fontWeight={600}
                  style={{ fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                  {dayName.slice(0, 3).toUpperCase()}
                </text>
              </g>
            )}

            <text x={CX} y={CY + 82} textAnchor="middle" fill="rgba(61,10,32,0.55)" fontSize={10} fontWeight={700}
              style={{ fontFamily:"'DM Mono',monospace" }}>
              {isToday ? now.toLocaleTimeString("en-US",{ hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:true }) : selDateObj.toLocaleDateString("en-US",{ month:"short", day:"numeric" })}
            </text>

'''
text = text[:start] + new_block + text[end:]

path.write_text(text, encoding='utf-8')
print('Rebuilt Calendar center as a true analog clock with live hands.')
