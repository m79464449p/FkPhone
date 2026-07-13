import { ChevronDown, Plus, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import type { PerformanceFloor, PhoneSpecFilter, SelectedSpecFilter, SortKey } from "../types";

type PhoneToolbarProps = {
  query: string;
  brand: string;
  series: string;
  sortKey: SortKey;
  performanceFloor: PerformanceFloor;
  brands: Array<[string, number]>;
  seriesOptions: Array<[string, number]>;
  specFilterOptions: PhoneSpecFilter[];
  selectedSpecFilters: SelectedSpecFilter[];
  pendingSpecKey: string;
  pendingSpecValue: string;
  specFiltersLoading: boolean;
  syncing: boolean;
  onQueryChange: (value: string) => void;
  onBrandChange: (value: string) => void;
  onSeriesChange: (value: string) => void;
  onSortChange: (value: SortKey) => void;
  onPerformanceFloorChange: (value: PerformanceFloor) => void;
  onPendingSpecKeyChange: (value: string) => void;
  onPendingSpecValueChange: (value: string) => void;
  onAddSpecFilter: () => void;
  onRemoveSpecFilter: (key: string, value: string) => void;
  onRefresh: () => void;
  onSync: () => void;
  onClear: () => void;
};

export function PhoneToolbar({
  query,
  brand,
  series,
  sortKey,
  performanceFloor,
  brands,
  seriesOptions,
  specFilterOptions,
  selectedSpecFilters,
  pendingSpecKey,
  pendingSpecValue,
  specFiltersLoading,
  syncing,
  onQueryChange,
  onBrandChange,
  onSeriesChange,
  onSortChange,
  onPerformanceFloorChange,
  onPendingSpecKeyChange,
  onPendingSpecValueChange,
  onAddSpecFilter,
  onRemoveSpecFilter,
  onRefresh,
  onSync,
  onClear
}: PhoneToolbarProps) {
  const quickBrands = brands.slice(0, 10);
  const quickSeries = seriesOptions.filter(([name]) => name !== "全部系列").slice(0, 8);
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
    performanceFloor ||
    selectedSpecFilters.length > 0;

  return (
    <aside className="filter-panel" aria-label="筛选工具">
      <div className="filter-panel-header">
        <div>
          <span className="detail-kicker">Filters</span>
          <h2>筛选与排序</h2>
        </div>
        <SlidersHorizontal size={18} />
      </div>

      <div className="filter-stack">
        <label className="filter-field">
          <span>关键词</span>
          <div className="search-field">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="型号、品牌、芯片、电池"
            />
          </div>
        </label>

        <label className="filter-field">
          <span>品牌</span>
          <label className="select-field">
            <select value={brand} onChange={(event) => onBrandChange(event.target.value)}>
              <option value="all">全部品牌</option>
              {brands.map(([name, count]) => (
                <option key={name} value={name}>
                  {name} ({count})
                </option>
              ))}
            </select>
            <ChevronDown className="select-chevron" size={18} />
          </label>
        </label>

        <label className="filter-field">
          <span>系列</span>
          <label className="select-field">
            <select value={series} onChange={(event) => onSeriesChange(event.target.value)}>
              <option value="all">全部系列</option>
              {seriesOptions.map(([name, count]) => (
                <option key={name} value={name}>
                  {name} ({count})
                </option>
              ))}
            </select>
            <ChevronDown className="select-chevron" size={18} />
          </label>
        </label>

        <label className="filter-field">
          <span>排序</span>
          <label className="select-field">
            <select value={sortKey} onChange={(event) => onSortChange(event.target.value as SortKey)}>
              <option value="release_desc">发布时间降序</option>
              <option value="score">评分最高</option>
              <option value="price_asc">价格从低到高</option>
              <option value="price_desc">价格从高到低</option>
              <option value="name">名称</option>
            </select>
            <ChevronDown className="select-chevron" size={18} />
          </label>
        </label>

        <div className="quick-brand-group" aria-label="常用品牌">
          {quickBrands.map(([name, count]) => (
            <button
              className={brand === name ? "active" : ""}
              key={name}
              type="button"
              onClick={() => onBrandChange(name)}
              title={`${name} ${count} 款`}
            >
              <span>{name}</span>
              <em>{count}</em>
            </button>
          ))}
        </div>

        <label className="filter-field">
          <span>性能不低于</span>
          <label className="select-field">
            <select value={performanceFloor} onChange={(event) => onPerformanceFloorChange(event.target.value as PerformanceFloor)}>
              <option value="">不限性能档</option>
              <option value="snapdragon_8_gen3">骁龙 8 Gen3 级</option>
              <option value="snapdragon_8_elite">骁龙 8 至尊版级</option>
              <option value="snapdragon_8_elite_gen5">骁龙 8 至尊版 Gen5 级</option>
            </select>
            <ChevronDown className="select-chevron" size={18} />
          </label>
        </label>

        <div className="quick-brand-group quick-series-group" aria-label="常用系列">
          {quickSeries.map(([name, count]) => (
            <button
              className={series === name ? "active" : ""}
              key={name}
              type="button"
              onClick={() => onSeriesChange(name)}
              title={`${name} ${count} 款`}
            >
              <span>{name}</span>
              <em>{count}</em>
            </button>
          ))}
        </div>

        <details className="advanced-filter-block" aria-label="详情参数筛选">
          <summary className="advanced-filter-title">
            <span>详情参数</span>
            <em>{specFiltersLoading ? "加载中" : `${specFilterOptions.length.toLocaleString("zh-CN")} 项`}</em>
          </summary>

          <label className="filter-field">
            <span>参数名</span>
            <label className="select-field">
              <select value={pendingSpecKey} onChange={(event) => onPendingSpecKeyChange(event.target.value)}>
                <option value="">选择详情参数</option>
                {specFilterOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label} ({option.values.length})
                  </option>
                ))}
              </select>
              <ChevronDown className="select-chevron" size={18} />
            </label>
          </label>

          <label className="filter-field">
            <span>参数值</span>
            <label className="select-field">
              <select
                value={pendingSpecValue}
                onChange={(event) => onPendingSpecValueChange(event.target.value)}
                disabled={!pendingSpecKey}
              >
                <option value="">{pendingSpecKey ? "选择参数值" : "先选参数名"}</option>
                {availableSpecValues.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value} ({option.phone_count})
                  </option>
                ))}
              </select>
              <ChevronDown className="select-chevron" size={18} />
            </label>
          </label>

          <button className="text-button add-spec-filter-button" type="button" onClick={onAddSpecFilter} disabled={!canAddSpecFilter}>
            <Plus size={14} />
            添加参数条件
          </button>

          {selectedSpecFilters.length > 0 && (
            <div className="selected-spec-filters" aria-label="已选详情参数">
              {selectedSpecFilters.map((filter) => (
                <span className="selected-spec-chip" key={`${filter.key}-${filter.value}`}>
                  <strong>{filter.label}</strong>
                  <em>{filter.value}</em>
                  <button type="button" onClick={() => onRemoveSpecFilter(filter.key, filter.value)} aria-label="移除参数条件">
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </details>

      </div>

      <div className="filter-actions">
        <button className="icon-button" onClick={onRefresh} type="button">
          <RefreshCw size={18} />
          刷新
        </button>
        <button className="icon-button secondary-button" onClick={onSync} type="button" disabled={syncing}>
          <RefreshCw size={18} />
          {syncing ? "同步中" : "同步酷安"}
        </button>
        <button className="text-button clear-filter-button" onClick={onClear} type="button" disabled={!hasActiveFilters}>
          <X size={14} />
          重置
        </button>
      </div>
    </aside>
  );
}
