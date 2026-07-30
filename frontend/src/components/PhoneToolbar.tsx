import { ActionIcon, Badge, Button, Group, Paper, Select, Stack, Text, TextInput } from "@mantine/core";
import { Braces, Plus, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";
import type { PhoneSpecFilter, SelectedSpecFilter, SortKey } from "../types";

type PhoneToolbarProps = {
  query: string;
  brand: string;
  series: string;
  sortKey: SortKey;
  brands: Array<[string, number]>;
  seriesOptions: Array<[string, number]>;
  specFilterOptions: PhoneSpecFilter[];
  selectedSpecFilters: SelectedSpecFilter[];
  pendingSpecKey: string;
  pendingSpecValue: string;
  specFiltersLoading: boolean;
  syncing: boolean;
  headerContent?: ReactNode;
  onQueryChange: (value: string) => void;
  onBrandChange: (value: string) => void;
  onSeriesChange: (value: string) => void;
  onSortChange: (value: SortKey) => void;
  onPendingSpecKeyChange: (value: string) => void;
  onPendingSpecValueChange: (value: string) => void;
  onAddSpecFilter: () => void;
  onRemoveSpecFilter: (key: string, value: string) => void;
  onRefresh: () => void;
  onSync: () => void;
  onOpenSocmark: () => void;
  onClear: () => void;
};

export function PhoneToolbar({
  query,
  brand,
  series,
  sortKey,
  brands,
  seriesOptions,
  specFilterOptions,
  selectedSpecFilters,
  pendingSpecKey,
  pendingSpecValue,
  specFiltersLoading,
  syncing,
  headerContent,
  onQueryChange,
  onBrandChange,
  onSeriesChange,
  onSortChange,
  onPendingSpecKeyChange,
  onPendingSpecValueChange,
  onAddSpecFilter,
  onRemoveSpecFilter,
  onRefresh,
  onSync,
  onOpenSocmark,
  onClear
}: PhoneToolbarProps) {
  const activeSpecOption = specFilterOptions.find((option) => option.key === pendingSpecKey);
  const selectedSpecIdentities = new Set(selectedSpecFilters.map((filter) => `${filter.key}=${filter.value}`));
  const availableSpecValues =
    activeSpecOption?.values.filter((option) => !selectedSpecIdentities.has(`${pendingSpecKey}=${option.value}`)).slice(0, 240) ?? [];
  const canAddSpecFilter = Boolean(pendingSpecKey && pendingSpecValue);
  const hasActiveFilters =
    query.trim() ||
    brand !== "all" ||
    series !== "all" ||
    sortKey !== "release_desc" ||
    selectedSpecFilters.length > 0;

  return (
    <Paper component="aside" withBorder radius="md" p="md" className="filter-panel" aria-label="筛选工具">
      {headerContent ? (
        <div className="filter-dashboard-header workspace-dashboard-header">{headerContent}</div>
      ) : (
        <Group justify="space-between" className="filter-panel-header">
          <Stack gap={0}>
            <Text size="xs" fw={800} tt="uppercase" c="teal.7">
              Filters
            </Text>
            <Text fw={800}>筛选与排序</Text>
          </Stack>
          <SlidersHorizontal size={18} />
        </Group>
      )}

      <Stack gap="sm" className="filter-stack">
        <TextInput
          size="sm"
          label="关键词"
          leftSection={<Search size={18} />}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="型号、品牌、芯片、电池"
        />

        <Select
          size="sm"
          label="品牌"
          value={brand}
          onChange={(value) => onBrandChange(value ?? "all")}
          data={[
            { value: "all", label: "全部品牌" },
            ...brands.map(([name, count]) => ({ value: name, label: `${name} (${count})` }))
          ]}
          searchable
        />

        <Select
          size="sm"
          label="系列"
          value={series}
          onChange={(value) => onSeriesChange(value ?? "all")}
          data={[
            { value: "all", label: "全部系列" },
            ...seriesOptions.map(([name, count]) => ({ value: name, label: `${name} (${count})` }))
          ]}
          searchable
        />

        <Select
          size="sm"
          label="排序"
          value={sortKey}
          onChange={(value) => onSortChange((value ?? "release_desc") as SortKey)}
          data={[
            { value: "release_desc", label: "发布时间降序" },
            { value: "score", label: "评分最高" },
            { value: "price_asc", label: "价格从低到高" },
            { value: "price_desc", label: "价格从高到低" },
            { value: "name", label: "名称" }
          ]}
        />

        <details className="advanced-filter-block" aria-label="详情参数筛选">
          <summary className="advanced-filter-title">
            <span>详情参数</span>
            <em>{specFiltersLoading ? "加载中" : `${specFilterOptions.length.toLocaleString("zh-CN")} 项`}</em>
          </summary>

          <Stack gap="sm" mt="sm">
            <Select
              size="sm"
              label="参数名"
              value={pendingSpecKey || null}
              onChange={(value) => onPendingSpecKeyChange(value ?? "")}
              data={specFilterOptions.map((option) => ({ value: option.key, label: `${option.label} (${option.values.length})` }))}
              placeholder="选择详情参数"
              searchable
            />

            <Select
              size="sm"
              label="参数值"
              value={pendingSpecValue || null}
              onChange={(value) => onPendingSpecValueChange(value ?? "")}
              disabled={!pendingSpecKey}
              data={availableSpecValues.map((option) => ({ value: option.value, label: `${option.value} (${option.phone_count})` }))}
              placeholder={pendingSpecKey ? "选择参数值" : "先选参数名"}
              searchable
            />

            <Button size="sm" leftSection={<Plus size={14} />} type="button" onClick={onAddSpecFilter} disabled={!canAddSpecFilter} variant="light">
              添加参数条件
            </Button>

            {selectedSpecFilters.length > 0 && (
              <Group gap="xs" className="selected-spec-filters" aria-label="已选详情参数">
                {selectedSpecFilters.map((filter) => (
                  <Badge key={`${filter.key}-${filter.value}`} variant="light" color="teal">
                    <Group gap={4} wrap="nowrap">
                      <span>{filter.label} / {filter.value}</span>
                      <ActionIcon variant="subtle" color="gray" size="xs" onClick={() => onRemoveSpecFilter(filter.key, filter.value)} aria-label="移除参数条件">
                        <X size={12} />
                      </ActionIcon>
                    </Group>
                  </Badge>
                ))}
              </Group>
            )}
          </Stack>
        </details>
      </Stack>

      <Group className="filter-actions" gap="xs" mt="md" wrap="wrap">
        <Button size="sm" variant="light" leftSection={<Braces size={18} />} onClick={onOpenSocmark} type="button">
          接口
        </Button>
        <Button size="sm" variant="light" leftSection={<RefreshCw size={18} />} onClick={onRefresh} type="button">
          刷新
        </Button>
        <Button size="sm" leftSection={<RefreshCw size={18} />} onClick={onSync} type="button" loading={syncing}>
          同步酷安
        </Button>
        <Button size="sm" variant="subtle" color="gray" leftSection={<X size={14} />} onClick={onClear} type="button" disabled={!hasActiveFilters}>
          重置
        </Button>
      </Group>
    </Paper>
  );
}
