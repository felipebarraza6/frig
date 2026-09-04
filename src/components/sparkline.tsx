"use client";

interface SparklineProps {
  data: number[];
  className?: string;
  color?: string;
  fill?: boolean;
}

export function Sparkline({
  data,
  className = "h-16 w-full",
  color = "currentColor",
  fill = true,
}: SparklineProps) {
  if (data.length === 0) return null;

  const width = 200;
  const height = 60;
  const padding = 4;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const getX = (i: number) => padding + (i / Math.max(data.length - 1, 1)) * chartW;
  const getY = (v: number) => padding + chartH - ((v - min) / range) * chartH;

  const path = data.reduce((acc, d, i) => {
    const px = getX(i);
    const py = getY(d);
    if (i === 0) return `M ${px},${py}`;
    const prevX = getX(i - 1);
    const prevY = getY(data[i - 1]);
    const cpX = prevX + (px - prevX) / 2;
    return `${acc} C ${cpX},${prevY} ${cpX},${py} ${px},${py}`;
  }, "");

  const areaPath = `${path} L ${getX(data.length - 1)},${height - padding} L ${getX(0)},${height - padding} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio="none">
      {fill && (
        <path
          d={areaPath}
          fill={color}
          fillOpacity="0.12"
          className="text-primary"
          style={{ fill: color }}
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((d, i) => (
        <circle
          key={i}
          cx={getX(i)}
          cy={getY(d)}
          r="2"
          fill={color}
        />
      ))}
    </svg>
  );
}
