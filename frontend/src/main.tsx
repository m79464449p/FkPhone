import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { BadgeCheck, ChartNoAxesColumnIncreasing, CircleDollarSign, SearchCheck, ShoppingBag, Smartphone } from "lucide-react";
import { API_BASE, PAGE_SIZE } from "./constants";
import { CompareDock } from "./components/CompareDock";
import { ComparePanel } from "./components/ComparePanel";
import { GoofishPanel } from "./components/GoofishPanel";
import { MetricCard } from "./components/MetricCard";
import { PhoneResults } from "./components/PhoneResults";
import { PhoneToolbar } from "./components/PhoneToolbar";
import { RankingPanel } from "./components/RankingPanel";
import { SocmarkApiPage } from "./components/SocmarkApiPage";
import { VersionPanel } from "./components/VersionPanel";
import { WorkspaceTabs } from "./components/WorkspaceTabs";
import type {
  CompareSelection,
  GoofishListing,
  GoofishLoginStatus,
  GoofishSearchResponse,
  PerformanceFloor,
  Phone,
  PhoneCompare,
  PhoneSpecFilter,
  PhoneVersion,
  SelectedSpecFilter,
  SortKey,
  WorkspaceTab
} from "./types";
import { formatPrice, formatScore } from "./utils/format";
import { normalizePhoneBrand, normalizePhoneSeries } from "./utils/brand";
import { matchesGoofishSpecFilters, parseKeywords } from "./utils/goofish";
import { compareName, comparePrice, compareReleaseDateDesc } from "./utils/phone";
import { theme } from "./theme";
import "@mantine/core/styles.css";
import "./styles.css";

function isSocmarkPath() {
  return (
    window.location.pathname.endsWith("/socmark") ||
    window.location.search.includes("page=socmark") ||
    window.location.hash === "#socmark"
  );
}

function openSocmarkPage() {
  window.history.pushState({}, "", "/socmark");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function RootApp() {
  const [isSocmark, setIsSocmark] = useState(isSocmarkPath);

  useEffect(() => {
    const syncRoute = () => setIsSocmark(isSocmarkPath());
    window.addEventListener("popstate", syncRoute);
    window.addEventListener("hashchange", syncRoute);
    return () => {
      window.removeEventListener("popstate", syncRoute);
      window.removeEventListener("hashchange", syncRoute);
    };
  }, []);

  return isSocmark ? <SocmarkApiPage /> : <App onOpenSocmark={openSocmarkPage} />;
}

type AppProps = {
  onOpenSocmark: () => void;
};

function App({ onOpenSocmark }: AppProps) {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("all");
  const [series, setSeries] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("release_desc");
  const [performanceFloor, setPerformanceFloor] = useState<PerformanceFloor>("");
  const [specFilterOptions, setSpecFilterOptions] = useState<PhoneSpecFilter[]>([]);
  const [specFiltersLoading, setSpecFiltersLoading] = useState(false);
  const [selectedSpecFilters, setSelectedSpecFilters] = useState<SelectedSpecFilter[]>([]);
  const [pendingSpecKey, setPendingSpecKey] = useState("");
  const [pendingSpecValue, setPendingSpecValue] = useState("");
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
  const [goofishKeywordInput, setGoofishKeywordInput] = useState("");
  const [goofishNameFilter, setGoofishNameFilter] = useState("");
  const [goofishStorageFilter, setGoofishStorageFilter] = useState("");
  const [goofishRamFilter, setGoofishRamFilter] = useState("");
  const [goofishListings, setGoofishListings] = useState<GoofishListing[]>([]);
  const [goofishLoading, setGoofishLoading] = useState(false);
  const [goofishSearching, setGoofishSearching] = useState(false);
  const [goofishSearchStartedAt, setGoofishSearchStartedAt] = useState<number | null>(null);
  const [goofishSearchElapsedSeconds, setGoofishSearchElapsedSeconds] = useState(0);
  const [goofishMessage, setGoofishMessage] = useState("");
  const [goofishError, setGoofishError] = useState("");
  const [goofishLoginOpen, setGoofishLoginOpen] = useState(false);
  const [goofishLoginStatus, setGoofishLoginStatus] = useState<GoofishLoginStatus | null>(null);
  const [goofishLoginBusy, setGoofishLoginBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("parameters");
  const compareRequestId = useRef(0);
  const goofishSearchAbortRef = useRef<AbortController | null>(null);

  async function loadPhones(filters = selectedSpecFilters, floor = performanceFloor) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      for (const filter of filters) {
        params.append("spec_filter", `${filter.key}=${filter.value}`);
      }
      if (floor) {
        params.set("performance_floor", floor);
      }
      const queryString = params.toString();
      const response = await fetch(`${API_BASE}/api/phones${queryString ? `?${queryString}` : ""}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as Phone[];
      setPhones(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadSpecFilterOptions() {
    setSpecFiltersLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/phones/spec-filters`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as PhoneSpecFilter[];
      setSpecFilterOptions(data);
    } catch {
      setSpecFilterOptions([]);
    } finally {
      setSpecFiltersLoading(false);
    }
  }

  async function loadGoofishListings() {
    setGoofishLoading(true);
    setGoofishError("");
    try {
      const params = new URLSearchParams({ limit: "20" });
      const response = await fetch(`${API_BASE}/api/goofish/listings?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as GoofishListing[];
      setGoofishListings(data);
    } catch (err) {
      setGoofishError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setGoofishLoading(false);
    }
  }

  useEffect(() => {
    void loadPhones([], "");
    void loadSpecFilterOptions();
    void loadGoofishListings();
  }, []);

  useEffect(() => {
    void loadPhones(selectedSpecFilters, performanceFloor);
  }, [selectedSpecFilters, performanceFloor]);

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
    if (!goofishLoginOpen || !goofishLoginStatus?.active) return;

    let stopped = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/goofish/login`, { cache: "no-store" });
        if (!response.ok) throw new Error(await readErrorMessage(response));
        const status = (await response.json()) as GoofishLoginStatus;
        if (stopped) return;
        setGoofishLoginStatus(status);
        setGoofishMessage(status.message);
        if (!status.active) {
          setGoofishSearching(false);
          setGoofishSearchStartedAt(null);
          if (status.status === "success") await loadGoofishListings();
          return;
        }
      } catch (err) {
        if (!stopped) setGoofishError(err instanceof Error ? err.message : "登录状态获取失败");
      }
      if (!stopped) timer = window.setTimeout(poll, 1500);
    };
    timer = window.setTimeout(poll, 800);
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [goofishLoginOpen, goofishLoginStatus?.active]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, brand, series, sortKey, selectedSpecFilters, performanceFloor]);

  useEffect(() => {
    setSeries("all");
  }, [brand]);

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
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
      if (!response.ok) throw new Error(await readErrorMessage(response));
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

  async function readErrorMessage(response: Response) {
    try {
      const data = (await response.json()) as { detail?: unknown };
      if (typeof data.detail === "string" && data.detail.trim()) {
        return data.detail.trim();
      }
      if (data.detail && typeof data.detail === "object") {
        const detail = data.detail as { message?: unknown; detail?: unknown };
        if (typeof detail.message === "string" && detail.message.trim()) {
          return detail.message.trim();
        }
        if (typeof detail.detail === "string" && detail.detail.trim()) {
          return detail.detail.trim();
        }
        return JSON.stringify(data.detail);
      }
    } catch {
      // Fall back to the status code when the backend does not return JSON.
    }
    return `HTTP ${response.status}`;
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
        throw new Error(await readErrorMessage(response));
      }
      const result = (await response.json()) as GoofishSearchResponse;
      setGoofishMessage(
        result.login_required
          ? result.message || "闲鱼需要重新登录。请在弹出的扫码窗口完成登录后重试。"
          : `闲鱼命中 ${result.matched} 条，新增 ${result.inserted}，更新 ${result.updated}`
      );
      await loadGoofishListings();
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

  async function loginGoofish() {
    setGoofishSearching(true);
    setGoofishSearchStartedAt(Date.now());
    setGoofishMessage("正在连接闲鱼登录页...");
    setGoofishError("");
    setGoofishLoginOpen(true);
    try {
      const response = await fetch(`${API_BASE}/api/goofish/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          login_timeout_seconds: 600
        })
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const result = (await response.json()) as GoofishLoginStatus;
      setGoofishLoginStatus(result);
      setGoofishMessage(result.message);
    } catch (err) {
      setGoofishError(err instanceof Error ? err.message : "登录失败");
      setGoofishSearching(false);
      setGoofishSearchStartedAt(null);
    }
  }

  async function sendGoofishSms(phone: string) {
    await updateGoofishLogin("/api/goofish/login/sms", { phone });
  }

  async function verifyGoofishLogin(code: string) {
    await updateGoofishLogin("/api/goofish/login/verify", { code });
  }

  async function clickGoofishLogin(x: number, y: number) {
    await updateGoofishLogin("/api/goofish/login/click", { x, y }, false);
  }

  async function dragGoofishLogin(startX: number, startY: number, endX: number, endY: number) {
    await updateGoofishLogin("/api/goofish/login/drag", {
      start_x: startX,
      start_y: startY,
      end_x: endX,
      end_y: endY
    }, false);
  }

  async function updateGoofishLogin(path: string, body: object, showBusy = true) {
    if (showBusy) setGoofishLoginBusy(true);
    setGoofishError("");
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      const status = (await response.json()) as GoofishLoginStatus;
      setGoofishLoginStatus(status);
      setGoofishMessage(status.message);
    } catch (err) {
      setGoofishError(err instanceof Error ? err.message : "登录操作失败");
    } finally {
      if (showBusy) setGoofishLoginBusy(false);
    }
  }

  async function cancelGoofishLogin() {
    try {
      await fetch(`${API_BASE}/api/goofish/login`, { method: "DELETE" });
    } finally {
      setGoofishLoginOpen(false);
      setGoofishLoginStatus(null);
      setGoofishSearching(false);
      setGoofishSearchStartedAt(null);
    }
  }

  async function importGoofishCookie(cookie: string) {
    setGoofishMessage("正在导入闲鱼 Cookie...");
    setGoofishError("");
    try {
      const response = await fetch(`${API_BASE}/api/goofish/cookie`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie })
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      const result = (await response.json()) as { message: string };
      setGoofishMessage(result.message);
    } catch (err) {
      setGoofishError(err instanceof Error ? err.message : "Cookie 导入失败");
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

  async function resetGoofishSession() {
    const confirmed = window.confirm("确定清空服务器端闲鱼登录态吗？清空后线上需要重新导入 Cookie，或临时开启可视化登录。");
    if (!confirmed) return;

    setGoofishMessage("正在清空服务器端闲鱼登录态...");
    setGoofishError("");
    try {
      const response = await fetch(`${API_BASE}/api/goofish/session`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const result = (await response.json()) as {
        cookie_file_removed: boolean;
        profile_removed: boolean;
        search_cancelled: boolean;
        message: string;
      };
      const removed = [
        result.cookie_file_removed ? "Cookie 文件" : "",
        result.profile_removed ? "浏览器 profile" : "",
        result.search_cancelled ? "进行中的搜索" : ""
      ].filter(Boolean);
      setGoofishMessage(`${result.message}${removed.length ? ` 已清理：${removed.join("、")}` : " 当前没有可清理的登录态。"}`);
    } catch (err) {
      setGoofishError(err instanceof Error ? err.message : "清空登录态失败");
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
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
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

  function removeCompareVersion(configId: string) {
    setCompareData(null);
    setCompareSelection((selection) => selection.filter((item) => item.config_id !== configId));
  }

  function changePendingSpecKey(key: string) {
    setPendingSpecKey(key);
    setPendingSpecValue("");
  }

  function addSpecFilter() {
    if (!pendingSpecKey || !pendingSpecValue) return;
    const option = specFilterOptions.find((item) => item.key === pendingSpecKey);
    if (!option) return;

    const nextFilter = {
      key: option.key,
      label: option.label,
      value: pendingSpecValue
    };
    setSelectedSpecFilters((filters) => {
      if (filters.some((filter) => filter.key === nextFilter.key && filter.value === nextFilter.value)) return filters;
      return [...filters, nextFilter];
    });
    setPendingSpecValue("");
  }

  function removeSpecFilter(key: string, value: string) {
    setSelectedSpecFilters((filters) => filters.filter((filter) => filter.key !== key || filter.value !== value));
  }

  const brands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const phone of phones) {
      const normalizedBrand = normalizePhoneBrand(phone);
      counts.set(normalizedBrand, (counts.get(normalizedBrand) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
      .slice(0, 28);
  }, [phones]);

  const brandTotal = useMemo(() => new Set(phones.map((phone) => normalizePhoneBrand(phone))).size, [phones]);

  const seriesOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const phone of phones) {
      const normalizedBrand = normalizePhoneBrand(phone);
      if (brand !== "all" && normalizedBrand !== brand) continue;
      const normalizedSeries = normalizePhoneSeries(phone);
      counts.set(normalizedSeries, (counts.get(normalizedSeries) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"));
  }, [phones, brand]);

  const filteredPhones = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const result = phones.filter((phone) => {
      const normalizedBrand = normalizePhoneBrand(phone);
      const normalizedSeries = normalizePhoneSeries(phone);
      const matchesBrand = brand === "all" || normalizedBrand === brand;
      const matchesSeries = series === "all" || normalizedSeries === series;
      const matchesQuery =
        !normalizedQuery ||
        `${phone.name} ${phone.brand} ${normalizedBrand} ${normalizedSeries} ${phone.specs ?? ""}`.toLowerCase().includes(normalizedQuery);
      return matchesBrand && matchesSeries && matchesQuery;
    });

    return result.sort((a, b) => {
      if (sortKey === "release_desc") return compareReleaseDateDesc(a, b);
      if (sortKey === "score") return b.score - a.score || compareName(a, b);
      if (sortKey === "price_asc") return comparePrice(a, b, "asc");
      if (sortKey === "price_desc") return comparePrice(a, b, "desc");
      if (sortKey === "name") return compareName(a, b);
      return compareReleaseDateDesc(a, b);
    });
  }, [phones, query, brand, series, sortKey]);

  const visiblePhones = filteredPhones.slice(0, visibleCount);
  const filteredGoofishListings = useMemo(() => {
    const normalizedNameFilter = goofishNameFilter.trim().toLowerCase();
    return goofishListings.filter((listing) => {
      const matchesName =
        !normalizedNameFilter ||
        `${listing.title} ${listing.raw_text} ${listing.keywords.join(" ")}`.toLowerCase().includes(normalizedNameFilter);
      return matchesName && matchesGoofishSpecFilters(listing, goofishStorageFilter, goofishRamFilter);
    });
  }, [goofishListings, goofishNameFilter, goofishStorageFilter, goofishRamFilter]);
  const pricedPhones = filteredPhones.filter((phone) => phone.price != null);
  const averagePrice = pricedPhones.reduce((sum, phone) => sum + (phone.price ?? 0), 0) / Math.max(pricedPhones.length, 1);
  const averageScore = filteredPhones.reduce((sum, phone) => sum + phone.score, 0) / Math.max(filteredPhones.length, 1);
  const pricedGoofishListings = filteredGoofishListings.filter((listing) => listing.price != null);
  const averageGoofishPrice =
    pricedGoofishListings.reduce((sum, listing) => sum + (listing.price ?? 0), 0) / Math.max(pricedGoofishListings.length, 1);
  const totalGoofishWantCount = filteredGoofishListings.reduce((sum, listing) => sum + (listing.want_count ?? 0), 0);
  const metricCards =
    activeTab === "goofish"
      ? [
          {
            label: "闲鱼结果",
            value: filteredGoofishListings.length.toLocaleString("zh-CN"),
            detail: `${goofishListings.length.toLocaleString("zh-CN")} 条已缓存`,
            icon: ShoppingBag,
            tone: "teal" as const
          },
          {
            label: "筛选规格",
            value: [goofishNameFilter.trim(), goofishStorageFilter, goofishRamFilter].filter(Boolean).join(" / ") || "全部",
            detail: "当前筛选条件",
            icon: SearchCheck,
            tone: "blue" as const
          },
          {
            label: "闲鱼均价",
            value: formatPrice(Math.round(averageGoofishPrice)),
            detail: `${pricedGoofishListings.length.toLocaleString("zh-CN")} 条有价`,
            icon: CircleDollarSign,
            tone: "red" as const
          },
          {
            label: "想要人数",
            value: totalGoofishWantCount.toLocaleString("zh-CN"),
            detail: "当前结果合计",
            icon: ChartNoAxesColumnIncreasing,
            tone: "slate" as const
          }
        ]
      : activeTab === "ranking"
        ? [
            {
              label: "榜单来源",
              value: "SOCPK",
              detail: "极客湾移动芯片排行",
              icon: ChartNoAxesColumnIncreasing,
              tone: "teal" as const
            },
            {
              label: "榜单数量",
              value: "4",
              detail: "综合 / CPU / GPU / 能效",
              icon: BadgeCheck,
              tone: "blue" as const
            },
            {
              label: "展示方式",
              value: "内嵌",
              detail: "iframe 直接查看原榜单",
              icon: Smartphone,
              tone: "red" as const
            },
            {
              label: "当前页签",
              value: "排行",
              detail: "参数后，闲鱼前",
              icon: SearchCheck,
              tone: "slate" as const
            }
          ]
      : [
          {
            label: brand === "all" && series === "all" ? "手机数量" : "当前结果",
            value: filteredPhones.length.toLocaleString("zh-CN"),
            detail:
              brand === "all" && series === "all"
                ? `${phones.length.toLocaleString("zh-CN")} 条总量`
                : [brand !== "all" ? brand : "", series !== "all" ? series : ""].filter(Boolean).join(" / "),
            icon: Smartphone,
            tone: "teal" as const
          },
          {
            label: brand === "all" ? "品牌数量" : "系列数量",
            value: (brand === "all" ? brandTotal : seriesOptions.length).toLocaleString("zh-CN"),
            detail: brand === "all" ? `${brands.length.toLocaleString("zh-CN")} 个常用筛选` : `${brand} 下可选系列`,
            icon: BadgeCheck,
            tone: "blue" as const
          },
          {
            label: "均价",
            value: formatPrice(Math.round(averagePrice)),
            detail: `${pricedPhones.length.toLocaleString("zh-CN")} 条有价`,
            icon: CircleDollarSign,
            tone: "red" as const
          },
          {
            label: "平均评分",
            value: formatScore(Math.round(averageScore)),
            detail: "当前结果均值",
            icon: ChartNoAxesColumnIncreasing,
            tone: "slate" as const
          }
        ];

  const workspaceOverview = (
    <section className="workspace-control-row" aria-label="工作区控制">
      <WorkspaceTabs
        activeTab={activeTab}
        phoneCount={phones.length}
        goofishCount={goofishListings.length}
        onChange={setActiveTab}
      />

      <section className="summary-grid" aria-label="数据概览">
        {metricCards.map((metric, index) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            detail={metric.detail}
            icon={metric.icon}
            tone={metric.tone}
            index={index}
          />
        ))}
      </section>
    </section>
  );

  return (
    <main className="app-shell">
      {activeTab === "goofish" && (
        <GoofishPanel
          headerContent={workspaceOverview}
          keywordInput={goofishKeywordInput}
          nameFilter={goofishNameFilter}
          storageFilter={goofishStorageFilter}
          ramFilter={goofishRamFilter}
          listings={filteredGoofishListings}
          loading={goofishLoading}
          searching={goofishSearching}
          searchElapsedSeconds={goofishSearchElapsedSeconds}
          message={goofishMessage}
          error={goofishError}
          onKeywordInputChange={setGoofishKeywordInput}
          onNameFilterChange={setGoofishNameFilter}
          onStorageFilterChange={setGoofishStorageFilter}
          onRamFilterChange={setGoofishRamFilter}
          onLogin={() => void loginGoofish()}
          loginOpen={goofishLoginOpen}
          loginStatus={goofishLoginStatus}
          loginBusy={goofishLoginBusy}
          onLoginClose={() => void cancelGoofishLogin()}
          onSendSms={sendGoofishSms}
          onVerifyLogin={verifyGoofishLogin}
          onLoginClick={clickGoofishLogin}
          onLoginDrag={dragGoofishLogin}
          onImportCookie={importGoofishCookie}
          onSearch={() => void searchGoofish()}
          onCancelSearch={() => void cancelGoofishSearch()}
          onRefresh={() => void loadGoofishListings()}
          onResetSession={() => void resetGoofishSession()}
        />
      )}

      {activeTab === "parameters" && (
        <section className="parameter-workspace" aria-label="参数工作区">
          <section className="results-workspace" aria-label="参数结果">
            <PhoneToolbar
              query={query}
              brand={brand}
              series={series}
              sortKey={sortKey}
              brands={brands}
              seriesOptions={seriesOptions}
              specFilterOptions={specFilterOptions}
              selectedSpecFilters={selectedSpecFilters}
              pendingSpecKey={pendingSpecKey}
              pendingSpecValue={pendingSpecValue}
              specFiltersLoading={specFiltersLoading}
              syncing={syncing}
              headerContent={workspaceOverview}
              onQueryChange={setQuery}
              onBrandChange={setBrand}
              onSeriesChange={setSeries}
              onSortChange={setSortKey}
              onPendingSpecKeyChange={changePendingSpecKey}
              onPendingSpecValueChange={setPendingSpecValue}
              onAddSpecFilter={addSpecFilter}
              onRemoveSpecFilter={removeSpecFilter}
              onRefresh={() => void loadPhones(selectedSpecFilters, performanceFloor)}
              onSync={() => void syncCoolapkOnce()}
              onOpenSocmark={onOpenSocmark}
              onClear={() => {
                setQuery("");
                setBrand("all");
                setSeries("all");
                setSortKey("release_desc");
                setPerformanceFloor("");
                setSelectedSpecFilters([]);
                setPendingSpecKey("");
                setPendingSpecValue("");
              }}
            />

            {syncMessage && <div className="sync-message">{syncMessage}</div>}

            <PhoneResults
              phones={visiblePhones}
              totalCount={filteredPhones.length}
              visibleCount={visiblePhones.length}
              sortKey={sortKey}
              loading={loading}
              error={error}
              canLoadMore={visibleCount < filteredPhones.length}
              onLoadMore={() => setVisibleCount((count) => count + PAGE_SIZE)}
              onOpenVersions={(phone) => void openVersions(phone)}
            />
          </section>
        </section>
      )}

      {activeTab === "ranking" && <RankingPanel headerContent={workspaceOverview} />}

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
          onOpen={() => setCompareOpen(true)}
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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <RootApp />
    </MantineProvider>
  </React.StrictMode>
);
