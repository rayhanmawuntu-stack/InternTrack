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
    let timer = 0;
    let visible = true;

    const schedule = () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      if (!visible || document.visibilityState !== "visible") return;

      const lowSpec = document.documentElement.classList.contains("it-low-spec");
      // A once-per-second tick cuts Calendar clock work by about 97% compared
      // with the normal 30 FPS sweep while remaining accurate and readable.
      const delay = lowSpec ? 1000 : 1000 / 30;
      timer = window.setTimeout(() => {
        frame = requestAnimationFrame(applyTime);
      }, delay);
    };

    const applyTime = () => {
      if (!visible || document.visibilityState !== "visible") return;

      const angles = handAngleValues(new Date());
      hourRef.current?.setAttribute("transform", `rotate(${angles.hour} ${cx} ${cy})`);
      minuteRef.current?.setAttribute("transform", `rotate(${angles.minute} ${cx} ${cy})`);
      secondRef.current?.setAttribute("transform", `rotate(${angles.second} ${cx} ${cy})`);
      schedule();
    };

    const start = () => schedule();

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      start();
    }, { rootMargin:"40px" });

    if (rootRef.current) observer.observe(rootRef.current);
    document.addEventListener("visibilitychange", start);
    start();

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
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
          stroke="var(--it-ink)"
          strokeOpacity={0.72}
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
          fill="#fff"
          stroke="var(--it-primary)"
          strokeWidth={2.2}
          style={{ filter:"drop-shadow(0 0 7px rgba(var(--it-accent-rgb),0.48))" }}
        />
      </g>

      <g ref={minuteRef} transform={`rotate(${initial.minute} ${cx} ${cy})`}>
        <line
          x1={cx}
          y1={cy - radius + 9}
          x2={cx}
          y2={cy - radius * 0.20}
          stroke="var(--it-accent-light)"
          strokeWidth={3.1}
          strokeLinecap="round"
          style={{ filter:"drop-shadow(0 2px 4px rgba(20,0,12,0.48))" }}
        />
        <circle
          cx={cx}
          cy={cy - radius + 9}
          r={4.1}
          fill="var(--it-accent-light)"
          stroke="var(--it-primary-dark)"
          strokeWidth={1.8}
          style={{ filter:"drop-shadow(0 0 6px rgba(var(--it-accent-light-rgb),0.5))" }}
        />
      </g>

      <g ref={secondRef} transform={`rotate(${initial.second} ${cx} ${cy})`}>
        <line
          x1={cx}
          y1={cy - radius + 5}
          x2={cx}
          y2={cy - radius * 0.05}
          stroke="var(--it-primary)"
          strokeWidth={1.25}
          strokeLinecap="round"
          style={{ filter:"drop-shadow(0 1px 3px rgba(20,0,12,0.42))" }}
        />
        <circle
          cx={cx}
          cy={cy - radius + 5}
          r={2.8}
          fill="var(--it-primary)"
          stroke="var(--it-primary-dark)"
          strokeWidth={1.2}
          style={{ filter:"drop-shadow(0 0 5px rgba(var(--it-primary-rgb),0.55))" }}
        />
      </g>
    </g>
  );
}
