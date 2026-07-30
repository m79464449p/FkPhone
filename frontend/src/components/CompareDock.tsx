import { ActionIcon, Button, Group, Paper, Text } from "@mantine/core";
import { Columns3, Trash2, X } from "lucide-react";
import type { CompareSelection } from "../types";

type CompareDockProps = {
  selection: CompareSelection[];
  onOpen: () => void;
  onRemove: (configId: string) => void;
  onClear: () => void;
};

export function CompareDock({ selection, onOpen, onRemove, onClear }: CompareDockProps) {
  return (
    <Paper withBorder radius="md" shadow="md" p="md" className="compare-dock" aria-label="对比栏">
      <Group justify="space-between" align="center" gap="md" wrap="nowrap" className="compare-dock-content">
        <div className="compare-dock-items">
          {selection.map((item) => (
            <div className="compare-chip" key={item.config_id}>
              <span>
                <Text component="strong">{item.phone_name}</Text>
                <Text component="em">{item.title}</Text>
              </span>
              <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => onRemove(item.config_id)} aria-label="移除">
                <X size={12} />
              </ActionIcon>
            </div>
          ))}
        </div>
        <Group className="compare-dock-actions" gap="xs">
          <Button size="sm" variant="subtle" leftSection={<Trash2 size={14} />} onClick={onClear}>
            清空
          </Button>
          <Button size="sm" leftSection={<Columns3 size={16} />} onClick={onOpen} disabled={selection.length < 2}>
            对比 {selection.length}
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}
