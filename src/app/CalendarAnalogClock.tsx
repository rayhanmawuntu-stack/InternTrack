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

export default function CalendarAnalogClock({ cx, cy, radius = 157 }: Props) {
  const rootRef = useRef<SVGGElement>(null);
  const hourRef = useRef<SVGGElement>(null);
  const minuteRef = useRef<SVGGElement>(null);
  const secondRef = useRef<SVGGElement>(null);

  const numerals = useMemo(() =>
    [12, 3, 6, 9].map(value => {
      const angle = value * 30 - 90;
      const radians = angle * Math.PI / 180;
      const numeralRadius = radius - 18;
      return {
        value,
        x: cx + Math.cos(radians) * numeralRadius,
        y: cy + Math.sin(radians) * numeralRadius,
      };
    }), [cx, cy, radius]);

  const initial = handAngleValues(new Date());

  useEffect(() => {
    let frame = 0;
    let visible = true;
    let lastFrame = 0;
    const frameInterval = 1000 / 30;

    const applyTime = (time: number) => {
      if (!visible || document.visibilityState !== "visible") return;
      if (time - lastFrame < frameInterval) {
        frame = requestAnimationFrame(applyTime);
        return;
      }

      lastFrame = time;
      const angles = handAngleValues(new Date());
      hourRef.current?.setAttribute("transform", `rotate(${angles.hour} ${cx} ${cy})`);
      minuteRef.current?.setAttribute("transform", `rotate(${angles.minute} ${cx} ${cy})`);
      secondRef.current?.setAttribute("transform", `rotate(${angles.second} ${cx} ${cy})`);
      frame = requestAnimationFrame(applyTime);
    };

    const start = () => {
      cancelAnimationFrame(frame);
      if (visible && document.visibilityState === "visible") {
        frame = requestAnimationFrame(applyTime);
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      start();
    }, { rootMargin:"80px" });

    if (rootRef.current) observer.observe(rootRef.current);
    document.addEventListener("visibilitychange", start);
    start();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", start);
    };
  }, [cx, cy]);

  return (
    <g ref={rootRef} aria-label="Live analog clock" pointerEvents="none">
      {numerals.map(({ value, x, y }) => (
        <text key={value} x={x} y={y + 1}
          textAnchor="middle" dominantBaseline="middle"
          fill="rgba(255,255,255,0.94)"
          fontSize={value === 12 ? 11 : 10.5}
          fontWeight={800}
          paintOrder="stroke"
          stroke="rgba(57,8,34,0.72)"
          strokeWidth={2.2}
          style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", userSelect:"none" }}>
          {value}
        </text>
      ))}

      <g ref={hourRef} transform={`rotate(${initial.hour} ${cx} ${cy})`}>
        <line
          x1={cx}
          y1={cy - radius + 7}
          x2={cx}
          y2={cy - radius * 0.48}
          stroke="rgba(255,255,255,0.96)"
          strokeWidth={5.2}
          strokeLinecap="round"
          style={{ filter:"drop-shadow(0 2px 4px rgba(20,0,12,0.48))" }}
        />
        <circle
          cx={cx}
          cy={cy - radius + 7}
          r={5.2}
          fill="#fff7fb"
          stroke="#e11d48"
          strokeWidth={2.2}
          style={{ filter:"drop-shadow(0 0 7px rgba(244,114,182,0.48))" }}
        />
      </g>
      <g ref={minuteRef} transform={`rotate(${initial.minute} ${cx} ${cy})`}>
        <line x1={cx} y1={cy + 10} x2={cx} y2={cy - radius * 0.70}
          stroke="#f9a8d4" strokeWidth={3.1} strokeLinecap="round"
          style={{ filter:"drop-shadow(0 2px 4px rgba(20,0,12,0.48))" }} />
      </g>
      <g ref={secondRef} transform={`rotate(${initial.second} ${cx} ${cy})`}>
        <line x1={cx} y1={cy + radius * 0.16} x2={cx} y2={cy - radius * 0.84}
          stroke="#fb7185" strokeWidth={1.25} strokeLinecap="round"
          style={{ filter:"drop-shadow(0 1px 3px rgba(20,0,12,0.42))" }} />
        <circle cx={cx} cy={cy - radius * 0.84} r={1.8} fill="#fb7185" />
      </g>

      <circle cx={cx} cy={cy} r={6.2} fill="#fff7fb" stroke="#e11d48" strokeWidth={2.5} />
      <circle cx={cx} cy={cy} r={2.2} fill="#e11d48" />
    </g>
  );
}
