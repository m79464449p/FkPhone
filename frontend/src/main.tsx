import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  ArrowDownUp,
  Check,
  Columns3,
  Database,
  ExternalLink,
  MonitorSmartphone,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  X
} from "lucide-react";
import "./styles.css";

type Phone = {
  id: string;
  name: string;
  brand: string;
  score: number;
  source: string | null;
  source_product_id: string | null;
  price: number | null;
  specs: string | null;
  image_url: string | null;
  source_url: string | null;
  version_count: number;
};

type SortKey = "release_desc" | "score" | "price_asc" | "price_desc" | "name";
type WorkspaceTab = "parameters" | "goofish";

type VersionSpec = {
  group: string;
  subgroup: string;
  name: string;
  value: string;
};

type PhoneVersion = {
  config_id: string;
  phone_id: string;
  title: string;
  price: number | null;
  specs: VersionSpec[];
  source_url: string | null;
};

type CompareSelection = {
  config_id: string;
  phone_name: string;
  title: string;
};

type CompareColumn = {
  config_id: string;
  phone_id: string;
  phone_name: string;
  title: string;
  price: number | null;
  source_url: string | null;
};

type CompareRow = {
  group: string;
  subgroup: string;
  name: string;
  values: Record<string, string | null>;
};

type PhoneCompare = {
  columns: CompareColumn[];
  rows: CompareRow[];
};

type GoofishListing = {
  item_id: string;
  title: string;
  price: number | null;
  location: string | null;
  want_count: number | null;
  browse_count: number | null;
  seller_credit: string | null;
  source_url: string;
  raw_text: string;
  keywords: string[];
  last_seen_at: string | null;
};

type GoofishSearchResponse = {
  status: string;
  keywords: string[];
  inserted: number;
  updated: number;
  matched: number;
  login_required: boolean;
  message: string | null;
};

type GoofishSpec = {
  label: string;
  value: string;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const PAGE_SIZE = 48;

function formatPrice(price: number | null) {
  if (price == null) return "暂无价格";
  return `¥${price.toLocaleString("zh-CN")}`;
}

function formatScore(score: number) {
  if (!score) return "暂无评分";
  return (score / 10).toFixed(1);
}

function App() {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("release_desc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<Phone | null>(null);
  const [versionCache, setVersionCache] = useState<Record<string, PhoneVersion[]>>({});
  const [versionLoading, setVersionLoading] = useState(false);
  const [versionError, setVersionError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [compareSelection, setCompareSelection] = useState<CompareSelection[]>([]);
  const [compareData, setCompareData] = useState<PhoneCompare | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);
  const [goofishKeywordInput, setGoofishKeywordInput] = useState("turbo5max, tubro5max");
  const [goofishFilterKeyword, setGoofishFilterKeyword] = useState("turbo5max");
  const [goofishListings, setGoofishListings] = useState<GoofishListing[]>([]);
  const [goofishLoading, setGoofishLoading] = useState(false);
  const [goofishSearching, setGoofishSearching] = useState(false);
  const [goofishSearchStartedAt, setGoofishSearchStartedAt] = useState<number | null>(null);
  const [goofishSearchElapsedSeconds, setGoofishSearchElapsedSeconds] = useState(0);
  const [goofishMessage, setGoofishMessage] = useState("");
  const [goofishError, setGoofishError] = useState("");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("parameters");
  const compareRequestId = useRef(0);
  const goofishSearchAbortRef = useRef<AbortController | null>(null);

  async function loadPhones() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/phones`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as Phone[];
      setPhones(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPhones();
    void loadGoofishListings();
  }, []);

  useEffect(() => {
    if (!goofishSearching || goofishSearchStartedAt === null) {
      setGoofishSearchElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      setGoofishSearchElapsedSeconds(Math.floor((Date.now() - goofishSearchStartedAt) / 1000));
    };
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [goofishSearching, goofishSearchStartedAt]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, brand, sortKey]);

  useEffect(() => {
    if (!compareOpen) return;
    if (compareSelection.length < 2) {
      compareRequestId.current += 1;
      setCompareData(null);
      setCompareError("至少选择 2 个版本");
      setCompareLoading(false);
      return;
    }

    void loadCompareData(compareSelection);
  }, [compareOpen, compareSelection]);

  async function openVersions(phone: Phone) {
    setSelectedPhone(phone);
    setVersionError("");
    if (versionCache[phone.id]) return;

    setVersionLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/phones/${phone.id}/versions`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as PhoneVersion[];
      setVersionCache((cache) => ({ ...cache, [phone.id]: data }));
    } catch (err) {
      setVersionError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setVersionLoading(false);
    }
  }

  async function syncCoolapkOnce() {
    setSyncing(true);
    setSyncMessage("");
    try {
      const response = await fetch(`${API_BASE}/api/crawl/coolapk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          max_pages: 1,
          fetch_versions: true
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = (await response.json()) as {
        inserted: number;
        updated: number;
        skipped_unchanged: number;
        version_inserted: number;
        version_updated: number;
        version_skipped_unchanged: number;
      };
      setSyncMessage(
        `手机新增 ${result.inserted}，更新 ${result.updated}，未变化 ${result.skipped_unchanged}；参数新增 ${result.version_inserted}，更新 ${result.version_updated}，未变化 ${result.version_skipped_unchanged}`
      );
      await loadPhones();
    } catch (err) {
      setSyncMessage(`同步失败：${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setSyncing(false);
    }
  }

  async function loadGoofishListings(keyword = goofishFilterKeyword) {
    setGoofishLoading(true);
    setGoofishError("");
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (keyword.trim()) params.set("keyword", keyword.trim());
      const response = await fetch(`${API_BASE}/api/goofish/listings?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as GoofishListing[];
      setGoofishListings(data);
    } catch (err) {
      setGoofishError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setGoofishLoading(false);
    }
  }

  async function searchGoofish() {
    const keywords = parseKeywords(goofishKeywordInput);
    if (keywords.length === 0) {
      setGoofishError("请输入至少一个关键词");
      return;
    }

    setGoofishSearching(true);
    setGoofishSearchStartedAt(Date.now());
    setGoofishMessage("");
    setGoofishError("");
    const abortController = new AbortController();
    goofishSearchAbortRef.current = abortController;
    try {
      const response = await fetch(`${API_BASE}/api/goofish/search`, {
        method: "POST",
        signal: abortController.signal,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          keywords,
          max_results_per_keyword: 30,
          login_timeout_seconds: 600
        })
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `HTTP ${response.status}`);
      }
      const result = (await response.json()) as GoofishSearchResponse;
      setGoofishMessage(
        result.login_required
          ? result.message || "闲鱼需要重新登录。请在弹出的扫码窗口完成登录后重试。"
          : `闲鱼命中 ${result.matched} 条，新增 ${result.inserted}，更新 ${result.updated}`
      );
      const nextKeyword = keywords[0] ?? "";
      setGoofishFilterKeyword(nextKeyword);
      await loadGoofishListings(nextKeyword);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setGoofishMessage("已取消闲鱼搜索");
      } else {
        setGoofishError(err instanceof Error ? err.message : "搜索失败");
      }
    } finally {
      if (goofishSearchAbortRef.current === abortController) {
        goofishSearchAbortRef.current = null;
      }
      setGoofishSearching(false);
      setGoofishSearchStartedAt(null);
    }
  }

  async function cancelGoofishSearch() {
    goofishSearchAbortRef.current?.abort();
    setGoofishSearching(false);
    setGoofishSearchStartedAt(null);
    setGoofishMessage("正在取消闲鱼搜索...");
    try {
      await fetch(`${API_BASE}/api/goofish/search`, { method: "DELETE" });
      setGoofishMessage("已取消闲鱼搜索");
    } catch (err) {
      setGoofishError(err instanceof Error ? err.message : "取消失败");
    }
  }

  function toggleCompareVersion(phone: Phone, version: PhoneVersion) {
    setCompareData(null);
    setCompareError("");
    setCompareSelection((selection) => {
      if (selection.some((item) => item.config_id === version.config_id)) {
        return selection.filter((item) => item.config_id !== version.config_id);
      }
      if (selection.length >= 6) return selection;
      return [
        ...selection,
        {
          config_id: version.config_id,
          phone_name: phone.name,
          title: version.title
        }
      ];
    });
  }

  async function loadCompareData(selection: CompareSelection[]) {
    const requestId = ++compareRequestId.current;
    setCompareError("");
    if (selection.length < 2) {
      setCompareError("至少选择 2 个版本");
      return;
    }

    setCompareLoading(true);
    try {
      const params = new URLSearchParams();
      for (const item of selection) {
        params.append("config_ids", item.config_id);
      }
      const response = await fetch(`${API_BASE}/api/phones/compare?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as PhoneCompare;
      if (requestId !== compareRequestId.current) return;
      setCompareData(data);
    } catch (err) {
      if (requestId !== compareRequestId.current) return;
      setCompareData(null);
      setCompareError(err instanceof Error ? err.message : "加载失败");
    } finally {
      if (requestId !== compareRequestId.current) return;
      setCompareLoading(false);
    }
  }

  function openComparePanel() {
    setCompareOpen(true);
  }

  function removeCompareVersion(configId: string) {
    setCompareData(null);
    setCompareSelection((selection) => selection.filter((item) => item.config_id !== configId));
  }

  const brands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const phone of phones) {
      counts.set(phone.brand, (counts.get(phone.brand) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
      .slice(0, 28);
  }, [phones]);
  const brandTotal = useMemo(
    () => new Set(phones.map((phone) => phone.brand)).size,
    [phones]
  );

  const filteredPhones = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const result = phones.filter((phone) => {
      const matchesBrand = brand === "all" || phone.brand === brand;
      const matchesQuery =
        !normalizedQuery ||
        `${phone.name} ${phone.brand} ${phone.specs ?? ""}`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesBrand && matchesQuery;
    });

    return result.sort((a, b) => {
      if (sortKey === "release_desc") return compareReleaseDateDesc(a, b);
      if (sortKey === "score") return b.score - a.score || compareName(a, b);
      if (sortKey === "price_asc") return comparePrice(a, b, "asc");
      if (sortKey === "price_desc") return comparePrice(a, b, "desc");
      if (sortKey === "name") return compareName(a, b);
      return compareReleaseDateDesc(a, b);
    });
  }, [phones, query, brand, sortKey]);

  const visiblePhones = filteredPhones.slice(0, visibleCount);
  const pricedPhones = phones.filter((phone) => phone.price != null);
  const averagePrice =
    pricedPhones.reduce((sum, phone) => sum + (phone.price ?? 0), 0) /
    Math.max(pricedPhones.length, 1);
  const averageScore =
    phones.reduce((sum, phone) => sum + phone.score, 0) / Math.max(phones.length, 1);

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">FkPhone</p>
          <h1>手机数据看板</h1>
        </div>
        <div className="status-strip" aria-label="项目模块状态">
          <span>
            <MonitorSmartphone size={16} /> frontend
          </span>
          <span>
            <Server size={16} /> backend
          </span>
          <span>
            <Database size={16} /> database
          </span>
          <button
            className="top-sync-button"
            onClick={() => void syncCoolapkOnce()}
            type="button"
            disabled={syncing}
          >
            <RefreshCw size={16} />
            {syncing ? "同步中" : "手动同步"}
          </button>
        </div>
      </section>

      <section className="summary-grid" aria-label="数据概览">
        <Metric label="手机数量" value={phones.length.toLocaleString("zh-CN")} />
        <Metric label="品牌数量" value={brandTotal.toLocaleString("zh-CN")} />
        <Metric label="均价" value={formatPrice(Math.round(averagePrice))} />
        <Metric label="平均评分" value={formatScore(Math.round(averageScore))} />
      </section>

      <nav className="workspace-tabs" aria-label="功能切换">
        <button
          className={activeTab === "parameters" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("parameters")}
          aria-current={activeTab === "parameters" ? "page" : undefined}
        >
          <SlidersHorizontal size={17} />
          参数
          <span>{phones.length.toLocaleString("zh-CN")}</span>
        </button>
        <button
          className={activeTab === "goofish" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("goofish")}
          aria-current={activeTab === "goofish" ? "page" : undefined}
        >
          <ShoppingBag size={17} />
          闲鱼
          <span>{goofishListings.length.toLocaleString("zh-CN")}</span>
        </button>
      </nav>

      {activeTab === "goofish" && (
        <GoofishPanel
          keywordInput={goofishKeywordInput}
          filterKeyword={goofishFilterKeyword}
          listings={goofishListings}
          loading={goofishLoading}
          searching={goofishSearching}
          searchElapsedSeconds={goofishSearchElapsedSeconds}
          message={goofishMessage}
          error={goofishError}
          onKeywordInputChange={setGoofishKeywordInput}
          onFilterKeywordChange={setGoofishFilterKeyword}
          onSearch={() => void searchGoofish()}
          onCancelSearch={() => void cancelGoofishSearch()}
          onRefresh={() => void loadGoofishListings()}
        />
      )}

      {activeTab === "parameters" && (
        <>
          <section className="toolbar" aria-label="筛选工具">
            <label className="search-field">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索型号、品牌、芯片、电池"
              />
            </label>

            <label className="select-field">
              <span>品牌</span>
              <select value={brand} onChange={(event) => setBrand(event.target.value)}>
                <option value="all">全部品牌</option>
                {brands.map(([name, count]) => (
                  <option key={name} value={name}>
                    {name} ({count})
                  </option>
                ))}
              </select>
            </label>

            <label className="select-field">
              <span>排序</span>
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
              >
                <option value="release_desc">发布时间降序</option>
                <option value="score">评分最高</option>
                <option value="price_asc">价格从低到高</option>
                <option value="price_desc">价格从高到低</option>
                <option value="name">名称</option>
              </select>
            </label>

            <button className="icon-button" onClick={() => void loadPhones()} type="button">
              <RefreshCw size={18} />
              刷新
            </button>
            <button
              className="icon-button secondary-button"
              onClick={() => void syncCoolapkOnce()}
              type="button"
              disabled={syncing}
            >
              <RefreshCw size={18} />
              {syncing ? "同步中" : "同步酷安"}
            </button>
          </section>

          {syncMessage && <div className="sync-message">{syncMessage}</div>}

          <section className="result-header" aria-label="列表状态">
            <div>
              <strong>{filteredPhones.length.toLocaleString("zh-CN")}</strong>
              <span> 条结果</span>
            </div>
            <span className="muted">
              <ArrowDownUp size={15} /> {sortLabel(sortKey)}
            </span>
          </section>

          {loading && <div className="state-box">正在加载数据</div>}
          {error && <div className="state-box error-box">接口连接失败：{error}</div>}

          {!loading && !error && (
            <>
              <section className="phone-grid" aria-label="手机列表">
                {visiblePhones.map((phone) => (
                  <article className="phone-card" key={phone.id}>
                    <div className="phone-image">
                      {phone.image_url ? (
                        <img src={phone.image_url} alt={phone.name} loading="lazy" />
                      ) : (
                        <MonitorSmartphone size={32} />
                      )}
                    </div>
                    <div className="phone-content">
                      <div className="phone-title-row">
                        <h2>{phone.name}</h2>
                        <span className="brand-chip">{phone.brand}</span>
                      </div>
                      <p className="specs">{phone.specs || "暂无规格"}</p>
                      <div className="phone-meta">
                        <span>{formatPrice(phone.price)}</span>
                        <span>{formatScore(phone.score)} 分</span>
                        <span>{phone.version_count || 0} 个版本</span>
                      </div>
                      <div className="phone-actions">
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => void openVersions(phone)}
                          disabled={!phone.version_count}
                        >
                          <SlidersHorizontal size={14} />
                          版本参数
                        </button>
                        {phone.source_url && (
                          <a
                            className="source-link"
                            href={phone.source_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            酷安 #{phone.source_product_id}
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </section>

              {visibleCount < filteredPhones.length && (
                <div className="load-more-row">
                  <button
                    className="load-more"
                    type="button"
                    onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  >
                    加载更多
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {selectedPhone && (
        <VersionPanel
          phone={selectedPhone}
          versions={versionCache[selectedPhone.id] ?? []}
          loading={versionLoading}
          error={versionError}
          selectedConfigIds={compareSelection.map((item) => item.config_id)}
          onToggleCompare={toggleCompareVersion}
          onClose={() => setSelectedPhone(null)}
        />
      )}

      {compareSelection.length > 0 && (
        <CompareDock
          selection={compareSelection}
          onOpen={() => void openComparePanel()}
          onRemove={removeCompareVersion}
          onClear={() => {
            setCompareData(null);
            setCompareSelection([]);
          }}
        />
      )}

      {compareOpen && (
        <ComparePanel
          data={compareData}
          loading={compareLoading}
          error={compareError}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function GoofishPanel({
  keywordInput,
  filterKeyword,
  listings,
  loading,
  searching,
  searchElapsedSeconds,
  message,
  error,
  onKeywordInputChange,
  onFilterKeywordChange,
  onSearch,
  onCancelSearch,
  onRefresh
}: {
  keywordInput: string;
  filterKeyword: string;
  listings: GoofishListing[];
  loading: boolean;
  searching: boolean;
  searchElapsedSeconds: number;
  message: string;
  error: string;
  onKeywordInputChange: (value: string) => void;
  onFilterKeywordChange: (value: string) => void;
  onSearch: () => void;
  onCancelSearch: () => void;
  onRefresh: () => void;
}) {
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
            placeholder="关键词，用逗号分隔"
          />
        </label>
        <button className="icon-button" type="button" onClick={onSearch} disabled={searching}>
          <RefreshCw size={18} />
          {searching ? "等待登录/搜索" : "搜索闲鱼"}
        </button>
        <label className="search-field compact-field">
          <Search size={18} />
          <input
            value={filterKeyword}
            onChange={(event) => onFilterKeywordChange(event.target.value)}
            placeholder="列表关键词"
          />
        </label>
        <button
          className="icon-button secondary-button"
          type="button"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw size={18} />
          {loading ? "刷新中" : "刷新列表"}
        </button>
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
            {listings.map((listing) => {
              const specs = inferGoofishSpecs(listing);
              return (
                <tr key={listing.item_id}>
                  <td>
                    <a
                      className="goofish-title-link"
                      href={listing.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
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

function VersionPanel({
  phone,
  versions,
  loading,
  error,
  selectedConfigIds,
  onToggleCompare,
  onClose
}: {
  phone: Phone;
  versions: PhoneVersion[];
  loading: boolean;
  error: string;
  selectedConfigIds: string[];
  onToggleCompare: (phone: Phone, version: PhoneVersion) => void;
  onClose: () => void;
}) {
  return (
    <div className="detail-overlay" role="dialog" aria-modal="true" aria-label={`${phone.name} 版本参数`}>
      <aside className="detail-panel">
        <header className="detail-header">
          <div>
            <span className="detail-kicker">{phone.brand}</span>
            <h2>{phone.name}</h2>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </header>

        {loading && <div className="state-box">正在加载版本参数</div>}
        {error && <div className="state-box error-box">版本参数加载失败：{error}</div>}

        {!loading && !error && versions.length === 0 && (
          <div className="state-box">暂无版本参数</div>
        )}

        {!loading && !error && versions.length > 0 && (
          <VersionSummary
            phone={phone}
            versions={versions}
            selectedConfigIds={selectedConfigIds}
            onToggleCompare={onToggleCompare}
          />
        )}
      </aside>
    </div>
  );
}

function VersionSummary({
  phone,
  versions,
  selectedConfigIds,
  onToggleCompare
}: {
  phone: Phone;
  versions: PhoneVersion[];
  selectedConfigIds: string[];
  onToggleCompare: (phone: Phone, version: PhoneVersion) => void;
}) {
  const representative = versions[0];
  const featuredSpecs = pickFeaturedSpecs(representative.specs);

  return (
    <div className="version-summary">
      <section className="sku-section" aria-label="SKU 版本">
        <div className="section-title">
          <h3>SKU</h3>
          <span>{versions.length} 个版本</span>
        </div>
        <div className="sku-tags">
          {versions.map((version) => {
            const selected = selectedConfigIds.includes(version.config_id);
            return (
              <button
                className={`sku-tag ${selected ? "selected" : ""}`}
                key={version.config_id}
                type="button"
                onClick={() => onToggleCompare(phone, version)}
              >
                {selected ? <Check size={14} /> : <Plus size={14} />}
                <strong>{version.title}</strong>
                <em>{formatPrice(version.price)}</em>
              </button>
            );
          })}
        </div>
      </section>

      <section className="parameter-section" aria-label="参数摘要">
        <div className="section-title">
          <h3>参数</h3>
          <span>{representative.specs.length} 项参数</span>
        </div>
        <dl className="spec-list">
          {featuredSpecs.map((spec) => (
            <div
              className="spec-row"
              key={`${representative.config_id}-${spec.group}-${spec.subgroup}-${spec.name}`}
            >
              <dt>{spec.name}</dt>
              <dd>{spec.value}</dd>
            </div>
          ))}
        </dl>

        {representative.source_url && (
          <a
            className="source-link"
            href={representative.source_url}
            target="_blank"
            rel="noreferrer"
          >
            参数原页
            <ExternalLink size={14} />
          </a>
        )}
      </section>
    </div>
  );
}

function CompareDock({
  selection,
  onOpen,
  onRemove,
  onClear
}: {
  selection: CompareSelection[];
  onOpen: () => void;
  onRemove: (configId: string) => void;
  onClear: () => void;
}) {
  return (
    <section className="compare-dock" aria-label="对比栏">
      <div className="compare-dock-items">
        {selection.map((item) => (
          <span className="compare-chip" key={item.config_id}>
            <strong>{item.phone_name}</strong>
            <em>{item.title}</em>
            <button type="button" onClick={() => onRemove(item.config_id)} aria-label="移除">
              <X size={14} />
            </button>
          </span>
        ))}
      </div>
      <div className="compare-dock-actions">
        <button className="text-button" type="button" onClick={onClear}>
          <Trash2 size={14} />
          清空
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={onOpen}
          disabled={selection.length < 2}
        >
          <Columns3 size={16} />
          对比 {selection.length}
        </button>
      </div>
    </section>
  );
}

function ComparePanel({
  data,
  loading,
  error,
  onClose
}: {
  data: PhoneCompare | null;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  return (
    <div className="detail-overlay" role="dialog" aria-modal="true" aria-label="参数对比">
      <aside className="compare-panel">
        <header className="detail-header">
          <div>
            <span className="detail-kicker">Compare</span>
            <h2>参数对比</h2>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </header>

        {loading && <div className="state-box">正在生成对比</div>}
        {error && <div className="state-box error-box">对比加载失败：{error}</div>}
        {!loading && !error && data && <CompareTable data={data} />}
      </aside>
    </div>
  );
}

function CompareTable({ data }: { data: PhoneCompare }) {
  return (
    <div className="compare-table-wrap">
      <table className="compare-table">
        <thead>
          <tr>
            <th>参数</th>
            {data.columns.map((column) => (
              <th key={column.config_id}>
                <strong>{column.phone_name}</strong>
                <span>{column.title}</span>
                <em>{formatPrice(column.price)}</em>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={`${row.group}-${row.subgroup}-${row.name}`}>
              <th>
                <strong>{row.name}</strong>
                <span>{[row.group, row.subgroup].filter(Boolean).join(" / ")}</span>
              </th>
              {data.columns.map((column) => (
                <td key={`${row.name}-${column.config_id}`}>
                  {row.values[column.config_id] || "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function pickFeaturedSpecs(specs: VersionSpec[]) {
  const wanted = [
    "芯片",
    "RAM & ROM",
    "屏幕",
    "电池容量",
    "充电",
    "后置主摄",
    "前置主摄",
    "重量",
    "发布时间"
  ];
  const selected: VersionSpec[] = [];
  for (const name of wanted) {
    const found = specs.find((spec) => spec.name === name);
    if (found) selected.push(found);
  }
  return selected.length > 0 ? selected.slice(0, 9) : specs.slice(0, 9);
}

function compareName(a: Phone, b: Phone) {
  return a.name.localeCompare(b.name, "zh-CN");
}

function comparePrice(a: Phone, b: Phone, direction: "asc" | "desc") {
  if (a.price == null && b.price == null) return compareName(a, b);
  if (a.price == null) return 1;
  if (b.price == null) return -1;
  const left = a.price;
  const right = b.price;
  return direction === "asc" ? left - right : right - left;
}

function compareReleaseDateDesc(a: Phone, b: Phone) {
  return getReleaseTimestamp(b) - getReleaseTimestamp(a) || compareName(a, b);
}

function getReleaseTimestamp(phone: Phone) {
  const specs = phone.specs ?? "";
  const zhDate = specs.match(/(\d{4})年\s*(\d{1,2})月(?:\s*(\d{1,2})日)?/);
  const slashDate = specs.match(/(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?/);
  const match = zhDate ?? slashDate;
  if (!match) return 0;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3] ?? 1);
  return Date.UTC(year, month - 1, day);
}

function sortLabel(sortKey: SortKey) {
  const labels: Record<SortKey, string> = {
    release_desc: "发布时间降序",
    score: "评分最高",
    price_asc: "价格从低到高",
    price_desc: "价格从高到低",
    name: "名称"
  };
  return labels[sortKey];
}

function parseKeywords(value: string) {
  const seen = new Set<string>();
  return value
    .split(/[,，\n]/)
    .map((keyword) => keyword.trim())
    .filter((keyword) => {
      if (!keyword || seen.has(keyword)) return false;
      seen.add(keyword);
      return true;
    });
}

function formatGoofishEngagement(listing: GoofishListing) {
  const parts = [];
  if (listing.want_count != null) parts.push(`${listing.want_count}人想要`);
  if (listing.browse_count != null) parts.push(`${listing.browse_count}浏览`);
  return parts.length ? parts.join(" | ") : "-";
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} 秒`;
  return `${minutes} 分 ${seconds.toString().padStart(2, "0")} 秒`;
}

function inferGoofishSpecs(listing: GoofishListing): GoofishSpec[] {
  const text = `${listing.title} ${listing.raw_text}`.replace(/\s+/g, " ");
  const memoryPair = text.match(/(\d{1,2})\s*(?:GB|G)?\s*[+＋]\s*(\d{2,4})\s*(?:GB|G|TB)?/i);
  const ram = memoryPair ? `${memoryPair[1]}GB` : findFirst(text, [/运行内存[:：]?\s*(\d{1,2})\s*(?:GB|G)/i, /\b(12|16|24|8)\s*(?:GB|G)\s*(?:运存|运行)/i]);
  const storage = memoryPair
    ? normalizeStorage(memoryPair[2])
    : findStorage(text);
  const specs: GoofishSpec[] = [
    { label: "品牌", value: inferGoofishBrand(text) },
    { label: "型号", value: inferGoofishModel(text) },
    { label: "存储容量", value: storage || "未知" },
    { label: "运行内存", value: ram || "未知" },
    { label: "版本", value: inferGoofishVersion(text) },
    { label: "拆修和功能", value: inferGoofishRepair(text) }
  ];
  return specs;
}

function inferGoofishBrand(text: string) {
  if (/MIUI|小米|REDMI|红米/i.test(text)) return "MIUI/小米";
  if (/iPhone|Apple|苹果/i.test(text)) return "Apple/苹果";
  if (/荣耀/i.test(text)) return "荣耀";
  if (/华为/i.test(text)) return "华为";
  if (/OPPO/i.test(text)) return "OPPO";
  if (/vivo|iQOO/i.test(text)) return /iQOO/i.test(text) ? "iQOO" : "vivo";
  return "未知";
}

function inferGoofishModel(text: string) {
  const normalized = text.replace(/\s+/g, " ");
  if (/(?:REDMI|红米)?\s*(?:Turbo|Tubro)\s*5\s*Max|(?:红米)?\s*t(?:urbo|ubro)?5max|红米\s*t5max/i.test(normalized)) {
    return "REDMI Turbo 5 Max";
  }
  if (/(?:REDMI|红米)?\s*(?:Turbo|Tubro)\s*5(?!\s*Max)|(?:红米)?\s*t(?:urbo|ubro)?5(?!max)/i.test(normalized)) {
    return "REDMI Turbo 5";
  }
  const redmi = normalized.match(/(?:REDMI|红米)\s*[A-Za-z0-9]+(?:\s*(?:Pro|Max|Ultra|至尊版))?/i);
  if (redmi) return cleanSpecValue(redmi[0]);
  return "未知";
}

function inferGoofishVersion(text: string) {
  if (/大陆国行|国行|国行版|中国大陆版/.test(text)) return "大陆国行";
  if (/港版/.test(text)) return "港版";
  if (/美版/.test(text)) return "美版";
  if (/日版/.test(text)) return "日版";
  return "未知";
}

function inferGoofishRepair(text: string) {
  if (/无任何维修|无维修|无拆无修|全原无拆修|无拆修/.test(text)) return "无任何维修";
  if (/功能全好|功能正常|功能全正常/.test(text)) return "功能正常";
  if (/拆修|维修|进水|暗病/.test(text)) return "需核实";
  return "未知";
}

function findStorage(text: string) {
  const explicit = text.match(/(?:存储容量|内存|容量)[:：]?\s*(\d{2,4})\s*(GB|G|TB)/i);
  if (explicit) return normalizeStorage(`${explicit[1]}${explicit[2]}`);
  const values = [...text.matchAll(/\b(\d{2,4})\s*(GB|G|TB)\b/gi)]
    .map((match) => normalizeStorage(`${match[1]}${match[2]}`))
    .filter((value) => {
      const numeric = Number(value.replace(/\D/g, ""));
      return value.includes("TB") || numeric >= 32;
    });
  return values[0] || "";
}

function normalizeStorage(value: string) {
  const match = String(value).match(/(\d{1,4})\s*(GB|G|TB)?/i);
  if (!match) return "";
  const rawUnit = (match[2] || "GB").toUpperCase();
  const unit = rawUnit === "G" ? "GB" : rawUnit;
  return `${match[1]}${unit}`;
}

function findFirst(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return `${match[1]}GB`;
  }
  return "";
}

function cleanSpecValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
