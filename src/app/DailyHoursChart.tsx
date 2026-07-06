import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type DailyHoursPoint = {
  day: string;
  label: string;
  hours: number;
};

const tooltipStyle = {
  contentStyle: {
    background:"rgba(255,255,255,0.85)",
    backdropFilter:"blur(12px)",
    border:"1px solid rgba(255,255,255,0.5)",
    borderRadius:12,
    fontSize:11,
    color:"#3d0a20",
    boxShadow:"0 4px 20px rgba(180,30,80,0.12)",
  },
  cursor:{ fill:"rgba(244,114,182,0.08)" },
};

export default function DailyHoursChart({ data }: { data: DailyHoursPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top:4, right:4, bottom:0, left:-20 }}>
        <defs>
          <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f472b6" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#f472b6" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.3)" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize:10, fill:"rgba(61,10,32,0.4)" }}
          axisLine={false}
          tickLine={false}
          interval={1}
          tickFormatter={(value:string) => String(new Date(value).getDate())}
        />
        <YAxis
          domain={[0,"auto"]}
          tick={{ fontSize:10, fill:"rgba(61,10,32,0.4)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          {...tooltipStyle}
          labelFormatter={(_, payload) => payload[0]?.payload?.label ?? ""}
          formatter={(value:number) => [`${value}h`,"Hours"]}
        />
        <Area
          type="monotone"
          dataKey="hours"
          stroke="#e11d48"
          strokeWidth={2}
          fill="url(#hoursGrad)"
          dot={{ r:3, fill:"#e11d48", stroke:"#fff", strokeWidth:1.5 }}
          activeDot={{ r:5, fill:"#e11d48" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
