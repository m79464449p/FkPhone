import { ArrowDownUp, SearchX } from "lucide-react";
import type { Phone, SortKey } from "../types";
import { sortLabel } from "../utils/phone";
import { PhoneCard } from "./PhoneCard";

type PhoneResultsProps = {
  phones: Phone[];
  totalCount: number;
  visibleCount: number;
  sortKey: SortKey;
  loading: boolean;
  error: string;
  canLoadMore: boolean;
  onLoadMore: () => void;
  onOpenVersions: (phone: Phone) => void;
};

export function PhoneResults({
  phones,
  totalCount,
  visibleCount,
  sortKey,
  loading,
  error,
  canLoadMore,
  onLoadMore,
  onOpenVersions
}: PhoneResultsProps) {
  return (
    <>
      <section className="result-header" aria-label="列表状态">
        <div>
          <strong>{totalCount.toLocaleString("zh-CN")}</strong>
          <span> 条结果</span>
        </div>
        <div className="result-meta">
          <span className="muted">已展示 {Math.min(visibleCount, totalCount).toLocaleString("zh-CN")}</span>
          <span className="muted">
            <ArrowDownUp size={15} /> {sortLabel(sortKey)}
          </span>
        </div>
      </section>

      {loading && <div className="state-box">正在加载数据</div>}
      {error && <div className="state-box error-box">接口连接失败：{error}</div>}

      {!loading && !error && (
        <>
          {totalCount === 0 ? (
            <div className="state-box empty-state">
              <SearchX size={24} />
              <strong>没有匹配机型</strong>
              <span>换一个关键词或品牌筛选</span>
            </div>
          ) : (
            <section className="phone-grid" aria-label="手机列表">
              {phones.map((phone, index) => (
                <PhoneCard key={phone.id} phone={phone} index={index} onOpenVersions={onOpenVersions} />
              ))}
            </section>
          )}

          {canLoadMore && (
            <div className="load-more-row">
              <button className="load-more" type="button" onClick={onLoadMore}>
                加载更多
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
