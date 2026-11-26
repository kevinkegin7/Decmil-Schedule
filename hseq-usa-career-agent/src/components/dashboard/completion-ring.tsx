"use client";

import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";

/** Completion percentage as a ring. The number comes from calculateProfileCompletion. */
export function CompletionRing({ percent }: { percent: number }) {
  return (
    <div className="relative size-20 shrink-0" role="img" aria-label={`Profile ${percent}% complete`}>
      <RadialBarChart
        width={80}
        height={80}
        innerRadius={30}
        outerRadius={40}
        data={[{ value: percent }]}
        startAngle={90}
        endAngle={-270}
        barSize={8}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
        <RadialBar dataKey="value" cornerRadius={8} fill="var(--chart-1)" background={{ fill: "var(--chart-track)" }} isAnimationActive={false} />
      </RadialBarChart>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">{percent}%</span>
    </div>
  );
}
