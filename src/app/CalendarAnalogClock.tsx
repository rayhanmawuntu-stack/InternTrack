import { useEffect, useMemo, useRef } from "react";

type Props = {
  cx: number;
  cy: number;
  radius?: number;
};

function handAngleValues(date: Date) {
  const seconds = date.getSeconds() + date.getMilliseconds() / 1000;
  const minutes = date.getMinutes() + seconds / 60;
  const hours = (date.getHours() % 12) + minutes / 60;
  return {
    hour: hours * 30,
    minute: minutes * 6,
    second: seconds * 6,
  };
}

export default function CalendarAnalogClock({ cx, cy, radius = 63 }: Props) {
  const hourRef = useRef<SVGGElement>(null);
  const minuteRef = useRef<SVGGElement>(null);
  const secondRef = useRef<SVGGElement>(null);

  const numerals = useMemo(() =>
    Array.from({ length: 12 }, (_, index) => {
      const value = index + 1;
      const angle = value * 30 - 90;
      const radians = angle * Math.PI / 180;
      const numeralRadius = radius - 15;
      return {
        value,
        x: cx + Math.cos(radians) * numeralRadius,
        y: cy + Math.sin(radians) * numeralRadius,
      };
    }), [cx, cy, radius]);

  const initial = handAngleValues(new Date());

  useEffect(() => {
    let frame = 0;

    const update = () => {
      const angles = handAngleValues(new Date());
      hourRef.current?.setAttribute("transform", `rotate(${angles.hour} ${cx} ${cy})`);
      minuteRef.current?.setAttribute("transform", `rotate(${angles.minute} ${cx} ${cy})`);
      secondRef.current?.setAttribute("transform", `rotate(${angles.second} ${cx} ${cy})`);
      frame = requestAnimationFrame(update);
    };

    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [cx, cy]);

  return (
    <g aria-label="Live analog clock">
      <defs>
        <radialGradient id="calendarAnalogFace" cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.30)" />
          <stop offset="55%" stopColor="rgba(244,114,182,0.15)" />
          <stop offset="100%" stopColor="rgba(65,12,43,0.55)" />
        </radialGradient>
      </defs>

      <circle cx={cx} cy={cy} r={radius}
        fill="url(#calendarAnalogFace)"
        stroke="rgba(255,205,224,0.58)"
        strokeWidth={1.4}
        style={{ filter:"drop-shadow(0 0 14px rgba(244,114,182,0.30))" }} />

      {Array.from({ length: 60 }, (_, index) => {
        const angle = index * 6 - 90;
        const radians = angle * Math.PI / 180;
        const major = index % 5 === 0;
        const innerRadius = radius - (major ? 8 : 5);
        const outerRadius = radius - 3;
        return (
          <line key={index}
            x1={cx + Math.cos(radians) * innerRadius}
            y1={cy + Math.sin(radians) * innerRadius}
            x2={cx + Math.cos(radians) * outerRadius}
            y2={cy + Math.sin(radians) * outerRadius}
            stroke={major ? "rgba(255,255,255,0.58)" : "rgba(255,255,255,0.22)"}
            strokeWidth={major ? 1.1 : 0.55}
            strokeLinecap="round" />
        );
      })}

      {numerals.map(({ value, x, y }) => (
        <text key={value} x={x} y={y + 0.5}
          textAnchor="middle" dominantBaseline="middle"
          fill="rgba(255,255,255,0.92)"
          fontSize={value >= 10 ? 7.4 : 8.2}
          fontWeight={800}
          style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", userSelect:"none" }}>
          {value}
        </text>
      ))}

      <g ref={hourRef} transform={`rotate(${initial.hour} ${cx} ${cy})`}>
        <line x1={cx} y1={cy + 4} x2={cx} y2={cy - radius * 0.42}
          stroke="rgba(255,255,255,0.92)" strokeWidth={4.2} strokeLinecap="round" />
      </g>
      <g ref={minuteRef} transform={`rotate(${initial.minute} ${cx} ${cy})`}>
        <line x1={cx} y1={cy + 5} x2={cx} y2={cy - radius * 0.60}
          stroke="#f9a8d4" strokeWidth={2.7} strokeLinecap="round" />
      </g>
      <g ref={secondRef} transform={`rotate(${initial.second} ${cx} ${cy})`}>
        <line x1={cx} y1={cy + radius * 0.18} x2={cx} y2={cy - radius * 0.72}
          stroke="#fb7185" strokeWidth={1.15} strokeLinecap="round" />
        <circle cx={cx} cy={cy - radius * 0.72} r={1.6} fill="#fb7185" />
      </g>

      <circle cx={cx} cy={cy} r={5.4} fill="#fff7fb" stroke="#e11d48" strokeWidth={2.2} />
      <circle cx={cx} cy={cy} r={2} fill="#e11d48" />
    </g>
  );
}
