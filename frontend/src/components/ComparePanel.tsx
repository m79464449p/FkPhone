import { Alert, Badge, Group, Modal, ScrollArea, SegmentedControl, Table, Text } from "@mantine/core";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import type { CompareRow, PhoneCompare } from "../types";
import { formatPrice } from "../utils/format";

type ComparePanelProps = {
  data: PhoneCompare | null;
  loading: boolean;
  error: string;
  onClose: () => void;
};

export function ComparePanel({ data, loading, error, onClose }: ComparePanelProps) {
  return (
    <Modal
      opened
      onClose={onClose}
      title="参数对比"
      size="min(1560px, calc(100vw - 32px))"
      centered
      classNames={{
        overlay: "compare-modal-overlay",
        content: "compare-modal",
        body: "compare-modal-body",
        header: "compare-modal-header"
      }}
    >
      {loading && <Alert variant="light" color="teal">正在生成对比</Alert>}
      {error && <Alert variant="light" color="red">对比加载失败：{error}</Alert>}
      {!loading && !error && data && (
        <CompareContent data={data} />
      )}
    </Modal>
  );
}

function CompareContent({ data }: { data: PhoneCompare }) {
  const [viewMode, setViewMode] = useState("all");
  const rowMeta = useMemo(() => analyzeCompareRows(data), [data]);
  const differenceCount = rowMeta.filter((item) => item.isDifferent).length;
  const visibleRows = viewMode === "diff" ? rowMeta.filter((item) => item.isDifferent) : rowMeta;

  return (
    <div className="compare-panel">
      <Group justify="space-between" align="flex-start" gap="md" className="compare-summary">
        <div>
          <Text size="xs" fw={800} tt="uppercase" className="compare-eyebrow">
            Compare
          </Text>
          <Text fw={800} fz="lg">
            参数对比
          </Text>
        </div>
        <Group gap="xs" className="compare-summary-actions">
          <Badge variant="light" color="teal">{data.columns.length} 个版本</Badge>
          <Badge variant="light" color="blue">{data.rows.length} 项参数</Badge>
          <Badge variant="light" color="yellow">{differenceCount} 个差异</Badge>
          <SegmentedControl
            size="xs"
            value={viewMode}
            onChange={setViewMode}
            data={[
              { label: "全部", value: "all" },
              { label: "仅差异", value: "diff" }
            ]}
          />
        </Group>
      </Group>
      <CompareTable data={data} rows={visibleRows} />
    </div>
  );
}

type CompareRowMeta = {
  row: CompareRow;
  isDifferent: boolean;
  normalizedValues: Record<string, string>;
};

function CompareTable({ data, rows }: { data: PhoneCompare; rows: CompareRowMeta[] }) {
  return (
    <ScrollArea h="min(68vh, 680px)" type="auto" className="compare-table-wrap">
      <Table className="compare-table">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>
              <div className="compare-param-head">
                <Text component="strong">参数</Text>
                <Text component="span">规格项</Text>
              </div>
            </Table.Th>
            {data.columns.map((column) => (
              <Table.Th key={column.config_id}>
                <div className="compare-column-card">
                  <Text component="strong">{column.phone_name}</Text>
                  <Text component="span">{column.title}</Text>
                  <Text component="em">{formatPrice(column.price)}</Text>
                </div>
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map(({ row, isDifferent, normalizedValues }, index) => (
            <Table.Tr
              key={`${row.group}-${row.subgroup}-${row.name}`}
              data-different={isDifferent || undefined}
              style={{ "--item-index": index } as CSSProperties}
            >
              <Table.Th>
                <div className="compare-param-cell">
                  <Group gap="xs" wrap="nowrap">
                    <Text component="strong">{row.name}</Text>
                    {isDifferent && <Badge size="xs" color="yellow" variant="light" className="compare-diff-badge">差异</Badge>}
                  </Group>
                  <Text component="span">
                    {[row.group, row.subgroup].filter(Boolean).join(" / ")}
                  </Text>
                </div>
              </Table.Th>
              {data.columns.map((column) => (
                <Table.Td
                  key={`${row.name}-${column.config_id}`}
                  data-different={isDifferent && normalizedValues[column.config_id] !== "-" ? true : undefined}
                  data-empty={!row.values[column.config_id]}
                >
                  {row.values[column.config_id] || "-"}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
          {rows.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={data.columns.length + 1} className="compare-empty-row">
                当前选择的版本没有可展示的差异项
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}

function analyzeCompareRows(data: PhoneCompare): CompareRowMeta[] {
  return data.rows.map((row) => {
    const normalizedValues = Object.fromEntries(
      data.columns.map((column) => [column.config_id, normalizeCompareValue(row.values[column.config_id])])
    );
    const uniqueValues = new Set(Object.values(normalizedValues));
    return {
      row,
      normalizedValues,
      isDifferent: uniqueValues.size > 1
    };
  });
}

function normalizeCompareValue(value: string | null | undefined) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  return normalized || "-";
}
