import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  ArrowDownUp,
  Database,
  ExternalLink,
  MonitorSmartphone,
  RefreshCw,
  Search,
  Server,
  SlidersHorizontal,
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

type SortKey = "updated" | "score" | "price_asc" | "price_desc" | "name";

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
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<Phone | null>(null);
  const [versionCache, setVersionCache] = useState<Record<string, PhoneVersion[]>>({});
  const [versionLoading, setVersionLoading] = useState(false);
  const [versionError, setVersionError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

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
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, brand, sortKey]);

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
          fetch_versions: false
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = (await response.json()) as {
        inserted: number;
        updated: number;
        skipped_unchanged: number;
      };
      setSyncMessage(
        `新增 ${result.inserted}，更新 ${result.updated}，未变化 ${result.skipped_unchanged}`
      );
      await loadPhones();
    } catch (err) {
      setSyncMessage(`同步失败：${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setSyncing(false);
    }
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
      if (sortKey === "score") return b.score - a.score || compareName(a, b);
      if (sortKey === "price_asc") return comparePrice(a, b, "asc");
      if (sortKey === "price_desc") return comparePrice(a, b, "desc");
      if (sortKey === "name") return compareName(a, b);
      return 0;
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
        </div>
      </section>

      <section className="summary-grid" aria-label="数据概览">
        <Metric label="手机数量" value={phones.length.toLocaleString("zh-CN")} />
        <Metric label="品牌数量" value={brandTotal.toLocaleString("zh-CN")} />
        <Metric label="均价" value={formatPrice(Math.round(averagePrice))} />
        <Metric label="平均评分" value={formatScore(Math.round(averageScore))} />
      </section>

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
            <option value="updated">最近采集</option>
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

      {selectedPhone && (
        <VersionPanel
          phone={selectedPhone}
          versions={versionCache[selectedPhone.id] ?? []}
          loading={versionLoading}
          error={versionError}
          onClose={() => setSelectedPhone(null)}
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

function VersionPanel({
  phone,
  versions,
  loading,
  error,
  onClose
}: {
  phone: Phone;
  versions: PhoneVersion[];
  loading: boolean;
  error: string;
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
          <VersionSummary versions={versions} />
        )}
      </aside>
    </div>
  );
}

function VersionSummary({ versions }: { versions: PhoneVersion[] }) {
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
          {versions.map((version) => (
            <span className="sku-tag" key={version.config_id}>
              <strong>{version.title}</strong>
              <em>{formatPrice(version.price)}</em>
            </span>
          ))}
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

function sortLabel(sortKey: SortKey) {
  const labels: Record<SortKey, string> = {
    updated: "最近采集",
    score: "评分最高",
    price_asc: "价格从低到高",
    price_desc: "价格从高到低",
    name: "名称"
  };
  return labels[sortKey];
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
