import { useEffect, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, HardDrive, MemoryStick, RefreshCw, Search, ShoppingBag, Trash2, X } from "lucide-react";
import { RAM_FILTER_OPTIONS, STORAGE_FILTER_OPTIONS } from "../constants";
import type { GoofishListing } from "../types";
import { formatDuration, formatPrice } from "../utils/format";
import { inferGoofishSpecs } from "../utils/goofish";
import { getDisplayImageUrl } from "../utils/images";

type GoofishPanelProps = {
  headerContent?: ReactNode;
  keywordInput: string;
  nameFilter: string;
  storageFilter: string;
  ramFilter: string;
  listings: GoofishListing[];
  loading: boolean;
  searching: boolean;
  searchElapsedSeconds: number;
  message: string;
  error: string;
  onKeywordInputChange: (value: string) => void;
  onNameFilterChange: (value: string) => void;
  onStorageFilterChange: (value: string) => void;
  onRamFilterChange: (value: string) => void;
  onLogin: () => void;
  onSearch: () => void;
  onCancelSearch: () => void;
  onRefresh: () => void;
  onResetSession: () => void;
};

export function GoofishPanel({
  headerContent,
  keywordInput,
  nameFilter,
  storageFilter,
  ramFilter,
  listings,
  loading,
  searching,
  searchElapsedSeconds,
  message,
  error,
  onKeywordInputChange,
  onNameFilterChange,
  onStorageFilterChange,
  onRamFilterChange,
  onLogin,
  onSearch,
  onCancelSearch,
  onRefresh,
  onResetSession
}: GoofishPanelProps) {
  const [preview, setPreview] = useState<{ title: string; images: string[]; index: number } | null>(null);

  useEffect(() => {
    if (!preview) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setPreview(null);
      }
      if (event.key === "ArrowLeft") {
        setPreview((current) => movePreview(current, -1));
      }
      if (event.key === "ArrowRight") {
        setPreview((current) => movePreview(current, 1));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [preview]);

  function handleKeywordKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || searching) return;
    event.preventDefault();
    onSearch();
  }

  function getCreditTone(credit: string) {
    if (/暂无|未知|无/.test(credit)) return "unknown";
    if (/极好|优秀|很好|优质/.test(credit)) return "excellent";
    if (/良好|较好|好/.test(credit)) return "good";
    if (/一般|普通/.test(credit)) return "fair";
    return "default";
  }

  function getListingImages(listing: GoofishListing) {
    return Array.from(new Set([...(listing.image_urls || []), listing.image_url].filter(Boolean) as string[]));
  }

  function openPreview(title: string, images: string[], index = 0) {
    if (images.length === 0) return;
    setPreview({ title, images, index });
  }

  function movePreview(current: typeof preview, direction: number) {
    if (!current || current.images.length === 0) return current;
    return {
      ...current,
      index: (current.index + direction + current.images.length) % current.images.length
    };
  }

  return (
    <section className="goofish-panel" aria-label="闲鱼搜索">
      {headerContent && <div className="workspace-dashboard-header goofish-dashboard-header">{headerContent}</div>}

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
        <button className="icon-button secondary-button" type="button" onClick={onLogin} disabled={searching}>
          <ShoppingBag size={18} />
          登录闲鱼
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
          <Search size={18} />
          <span>名称筛选</span>
          <input
            value={nameFilter}
            onChange={(event) => onNameFilterChange(event.target.value)}
            placeholder="全部"
            aria-label="按名称筛选闲鱼商品"
          />
        </label>
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
              const sellerCredit = listing.seller_credit || "信用暂无";
              const imageUrls = getListingImages(listing);
              const displayImageUrl = getDisplayImageUrl(imageUrls[0] || null);
              return (
                <tr key={listing.item_id} style={{ "--item-index": index } as CSSProperties}>
                  <td className="goofish-product-cell">
                    <div className="goofish-product-layout">
                      <button
                        className="goofish-thumb"
                        type="button"
                        onClick={() => openPreview(listing.title, imageUrls)}
                        disabled={imageUrls.length === 0}
                        aria-label="预览商品图片"
                      >
                        {displayImageUrl ? (
                          <img
                            src={displayImageUrl}
                            alt={listing.title}
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                              event.currentTarget.parentElement?.classList.add("image-missing");
                            }}
                          />
                        ) : (
                          <span>无图</span>
                        )}
                        {imageUrls.length > 1 && <em className="goofish-image-count">{imageUrls.length}</em>}
                      </button>
                      <div className="goofish-product-main">
                        <span className="goofish-title-link">
                          {listing.title}
                        </span>
                        <div className="goofish-spec-grid" aria-label="闲鱼商品关键信息">
                          {specs.map((spec) => (
                            <span className="goofish-spec" key={`${listing.item_id}-${spec.label}`}>
                              <em>{spec.label}：</em>
                              <b>{spec.value}</b>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="goofish-price">{formatPrice(listing.price)}</span>
                  </td>
                  <td>{listing.location || "-"}</td>
                  <td>
                    <span className="goofish-engagement" aria-label="闲鱼热度">
                      <span className="goofish-engagement-row">
                        <b>{listing.want_count != null ? listing.want_count.toLocaleString("zh-CN") : "-"}</b>
                        <em>人想要</em>
                      </span>
                      <span className="goofish-engagement-row">
                        <b>{listing.browse_count != null ? listing.browse_count.toLocaleString("zh-CN") : "-"}</b>
                        <em>人浏览</em>
                      </span>
                      <span className={`goofish-credit-stamp ${getCreditTone(sellerCredit)}`}>{sellerCredit}</span>
                    </span>
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
      {preview && createPortal(
        <div className="image-preview-backdrop" role="dialog" aria-modal="true" aria-label="商品图片预览" onClick={() => setPreview(null)}>
          <div className="image-preview-shell" onClick={(event) => event.stopPropagation()}>
            <button className="image-preview-close" type="button" onClick={() => setPreview(null)} aria-label="关闭预览">
              <X size={20} />
            </button>
            <div className="image-preview-stage">
              <button
                className="image-preview-nav previous"
                type="button"
                onClick={() => setPreview((current) => movePreview(current, -1))}
                disabled={preview.images.length < 2}
                aria-label="上一张"
              >
                <ChevronLeft size={28} />
              </button>
              <img
                key={preview.images[preview.index]}
                src={getDisplayImageUrl(preview.images[preview.index]) || ""}
                alt={preview.title}
                onLoad={(event) => {
                  event.currentTarget.style.display = "";
                  event.currentTarget.parentElement?.classList.remove("image-missing");
                }}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                  event.currentTarget.parentElement?.classList.add("image-missing");
                }}
              />
              <button
                className="image-preview-nav next"
                type="button"
                onClick={() => setPreview((current) => movePreview(current, 1))}
                disabled={preview.images.length < 2}
                aria-label="下一张"
              >
                <ChevronRight size={28} />
              </button>
            </div>
            <div className="image-preview-footer">
              <span>{preview.title}</span>
              <b>
                {preview.index + 1} / {preview.images.length}
              </b>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
