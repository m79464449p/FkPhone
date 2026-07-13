import type { KeyboardEvent } from "react";
import type { CSSProperties } from "react";
import { ChevronDown, ExternalLink, HardDrive, MemoryStick, RefreshCw, Search, ShoppingBag, Trash2 } from "lucide-react";
import { RAM_FILTER_OPTIONS, STORAGE_FILTER_OPTIONS } from "../constants";
import type { GoofishListing } from "../types";
import { formatDuration, formatPrice } from "../utils/format";
import { formatGoofishEngagement, inferGoofishSpecs } from "../utils/goofish";

type GoofishPanelProps = {
  keywordInput: string;
  storageFilter: string;
  ramFilter: string;
  listings: GoofishListing[];
  loading: boolean;
  searching: boolean;
  searchElapsedSeconds: number;
  message: string;
  error: string;
  onKeywordInputChange: (value: string) => void;
  onStorageFilterChange: (value: string) => void;
  onRamFilterChange: (value: string) => void;
  onSearch: () => void;
  onCancelSearch: () => void;
  onRefresh: () => void;
  onResetSession: () => void;
};

export function GoofishPanel({
  keywordInput,
  storageFilter,
  ramFilter,
  listings,
  loading,
  searching,
  searchElapsedSeconds,
  message,
  error,
  onKeywordInputChange,
  onStorageFilterChange,
  onRamFilterChange,
  onSearch,
  onCancelSearch,
  onRefresh,
  onResetSession
}: GoofishPanelProps) {
  function handleKeywordKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || searching) return;
    event.preventDefault();
    onSearch();
  }

  return (
    <section className="goofish-panel" aria-label="闲鱼搜索">
      <header className="goofish-header">
        <div>
          <span className="detail-kicker">Goofish</span>
          <h2>闲鱼监控</h2>
        </div>
        <span className="goofish-count">
          <ShoppingBag size={16} />
          {listings.length.toLocaleString("zh-CN")} 条
        </span>
      </header>

      <div className="goofish-controls">
        <label className="search-field">
          <Search size={18} />
          <input
            value={keywordInput}
            onChange={(event) => onKeywordInputChange(event.target.value)}
            onKeyDown={handleKeywordKeyDown}
            placeholder="关键词，用逗号分隔"
          />
        </label>
        <button className="icon-button" type="button" onClick={onSearch} disabled={searching}>
          <RefreshCw size={18} />
          {searching ? "等待登录/搜索" : "搜索闲鱼"}
        </button>
        <button className="icon-button secondary-button" type="button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={18} />
          {loading ? "刷新中" : "刷新列表"}
        </button>
        <button
          className="icon-button secondary-button"
          type="button"
          onClick={onResetSession}
          disabled={searching}
          title="清空服务器端闲鱼 Cookie 和浏览器 profile"
        >
          <Trash2 size={18} />
          清空登录态
        </button>
      </div>

      <div className="goofish-filter-row" aria-label="闲鱼筛选条件">
        <label className="spec-filter-field">
          <HardDrive size={18} />
          <span>存储容量</span>
          <select value={storageFilter} onChange={(event) => onStorageFilterChange(event.target.value)}>
            <option value="">全部</option>
            {STORAGE_FILTER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <ChevronDown className="select-chevron" size={18} />
        </label>
        <label className="spec-filter-field">
          <MemoryStick size={18} />
          <span>运行内存</span>
          <select value={ramFilter} onChange={(event) => onRamFilterChange(event.target.value)}>
            <option value="">全部</option>
            {RAM_FILTER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <ChevronDown className="select-chevron" size={18} />
        </label>
      </div>

      {message && <div className="sync-message">{message}</div>}
      {searching && (
        <div className="sync-message goofish-wait-message">
          <span>
            正在检查闲鱼登录态，已等待 {formatDuration(searchElapsedSeconds)}；如果弹出 Chromium 窗口，请在 10 分钟内扫码登录。
          </span>
          <button className="inline-cancel-button" type="button" onClick={onCancelSearch}>
            取消等待
          </button>
        </div>
      )}
      {error && <div className="sync-message error-message">闲鱼接口失败：{error}</div>}

      <div className="goofish-table-wrap">
        <table className="goofish-table">
          <thead>
            <tr>
              <th>商品</th>
              <th>价格</th>
              <th>地区</th>
              <th>热度</th>
              <th>关键词</th>
              <th>链接</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((listing, index) => {
              const specs = inferGoofishSpecs(listing);
              return (
                <tr key={listing.item_id} style={{ "--item-index": index } as CSSProperties}>
                  <td>
                    <a className="goofish-title-link" href={listing.source_url} target="_blank" rel="noreferrer">
                      {listing.title}
                    </a>
                    <div className="goofish-spec-grid" aria-label="闲鱼商品关键信息">
                      {specs.map((spec) => (
                        <span className="goofish-spec" key={`${listing.item_id}-${spec.label}`}>
                          <em>{spec.label}：</em>
                          <b>{spec.value}</b>
                        </span>
                      ))}
                    </div>
                    <span>{listing.seller_credit || "信用暂无"}</span>
                  </td>
                  <td>
                    <span className="goofish-price">{formatPrice(listing.price)}</span>
                  </td>
                  <td>{listing.location || "-"}</td>
                  <td>
                    <span className="goofish-engagement">{formatGoofishEngagement(listing)}</span>
                  </td>
                  <td>{listing.keywords.join(", ") || "-"}</td>
                  <td>
                    <a className="goofish-open-button" href={listing.source_url} target="_blank" rel="noreferrer">
                      打开闲鱼
                      <ExternalLink size={14} />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && listings.length === 0 && <div className="empty-table">暂无闲鱼商品</div>}
      </div>
    </section>
  );
}
