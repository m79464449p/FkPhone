import { Card, Group, Text, ThemeIcon } from "@mantine/core";
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
    <Card withBorder radius="md" shadow="xs" className={`metric-card metric-card-${tone}`} style={{ "--item-index": index } as CSSProperties}>
      <Group justify="space-between" align="center" gap="xs" className="metric-card-top" wrap="nowrap">
        <Text size="sm" c="dimmed">
          {label}
        </Text>
        <ThemeIcon size={22} radius="md" variant="light" color={tone === "blue" ? "blue" : tone === "red" ? "red" : tone === "teal" ? "teal" : "gray"}>
          <Icon size={14} />
        </ThemeIcon>
      </Group>
      <Text fw={800} size="xl" mt={4}>
        {value}
      </Text>
      <Text size="xs" c="dimmed" mt={4}>
        {detail}
      </Text>
    </Card>
  );
}
