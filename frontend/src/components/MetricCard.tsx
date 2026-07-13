import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "teal" | "blue" | "red" | "slate";
  index?: number;
};

export function MetricCard({ label, value, detail, icon: Icon, tone = "slate", index = 0 }: MetricCardProps) {
  return (
    <article className={`metric-card metric-card-${tone}`} style={{ "--item-index": index } as CSSProperties}>
      <div className="metric-card-top">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <em>{detail}</em>
    </article>
  );
}
