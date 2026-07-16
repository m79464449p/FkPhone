import { ArrowLeft, Braces, Play, RefreshCw, Server, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../constants";

type SocmarkEndpoint = {
  key: string;
  method: "GET" | "POST";
  path: string;
  description: string;
  sample_payload?: Record<string, unknown> | null;
};

type SocmarkCatalog = {
  base_urls: string[];
  endpoints: SocmarkEndpoint[];
  header_notes: Record<string, string>;
};

type SocmarkCallResult = {
  endpoint: string;
  method: string;
  path: string;
  base_url: string;
  url: string;
  request_payload: Record<string, unknown>;
  request_body_text: string;
  request_body_sent_text: string;
  request_headers: Record<string, string>;
  header_status: HeaderStatus[];
  status_code: number;
  response_headers: Record<string, string>;
  server_response_key?: string | null;
  body: unknown;
  body_text: string;
  decrypted_body_text?: string | null;
};

type HeaderStatus = {
  key: string;
  state: "generated" | "missing";
  note: string;
};

type LocalPhone = {
  id: string;
  name: string;
  brand: string;
  score: number;
  price: number | null;
  specs: string | null;
};

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseObjectJson(text: string, label: string) {
  if (!text.trim()) return {};
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${label} 必须是 JSON object`);
  }
  return parsed as Record<string, unknown>;
}

const DEFAULT_APK_OPTIONS = {
  interceptor_a: "null",
  interceptor_b: "kjcvxyuRyGibKX9KylmGXPsB6HRSgI4Y0jE/P8xNKAcbtZhAwj4IomVvH0gp9Q02",
  interceptor_c: "KhBJ3k7xHB20phvV8OcUlA==",
  battery_value: "dadgagahah",
  board_value: "abc",
  dynamic_dex_value: "abcde",
  time_offset_ms: 0
};

export function SocmarkApiPage() {
  const [catalog, setCatalog] = useState<SocmarkCatalog | null>(null);
  const [selectedEndpointKey, setSelectedEndpointKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [payloadText, setPayloadText] = useState("{}");
  const [datastr, setDatastr] = useState("abcde");
  const [uniid, setUniid] = useState("");
  const [headersText, setHeadersText] = useState("{}");
  const [apkOptionsText, setApkOptionsText] = useState(prettyJson(DEFAULT_APK_OPTIONS));
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [calling, setCalling] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<SocmarkCallResult | null>(null);
  const [localPhones, setLocalPhones] = useState<LocalPhone[]>([]);
  const [localDataMessage, setLocalDataMessage] = useState("");

  useEffect(() => {
    async function loadCatalog() {
      setLoadingCatalog(true);
      setMessage("");
      try {
        const response = await fetch(`${API_BASE}/api/socmark/endpoints`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as SocmarkCatalog;
        setCatalog(data);
        const firstEndpoint = data.endpoints.find((endpoint) => endpoint.key === "scoreenc") ?? data.endpoints[0];
        setSelectedEndpointKey(firstEndpoint?.key ?? "");
        setBaseUrl(data.base_urls[0] ?? "");
        setPayloadText(prettyJson(firstEndpoint?.sample_payload ?? {}));
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "接口目录加载失败");
      } finally {
        setLoadingCatalog(false);
      }
    }

    void loadCatalog();
  }, []);

  useEffect(() => {
    async function loadLocalPhones() {
      try {
        const response = await fetch(`${API_BASE}/api/phones`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as LocalPhone[];
        setLocalPhones(data.slice(0, 5));
        setLocalDataMessage(`本地库已有 ${data.length.toLocaleString("zh-CN")} 条手机数据`);
      } catch (err) {
        setLocalDataMessage(err instanceof Error ? `本地数据读取失败：${err.message}` : "本地数据读取失败");
      }
    }

    void loadLocalPhones();
  }, []);

  const selectedEndpoint = useMemo(
    () => catalog?.endpoints.find((endpoint) => endpoint.key === selectedEndpointKey) ?? null,
    [catalog, selectedEndpointKey]
  );

  function changeEndpoint(key: string) {
    const endpoint = catalog?.endpoints.find((item) => item.key === key);
    setSelectedEndpointKey(key);
    setPayloadText(prettyJson(endpoint?.sample_payload ?? {}));
    setResult(null);
    setMessage("");
  }

  function resetPayload() {
    setPayloadText(prettyJson(selectedEndpoint?.sample_payload ?? {}));
  }

  function formatPayload() {
    try {
      setPayloadText(prettyJson(parseObjectJson(payloadText, "请求体")));
      setHeadersText(prettyJson(parseObjectJson(headersText, "额外 headers")));
      setApkOptionsText(prettyJson(parseObjectJson(apkOptionsText, "APK 高级参数")));
      setMessage("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "JSON 格式错误");
    }
  }

  async function callEndpoint() {
    if (!selectedEndpoint) return;

    setCalling(true);
    setMessage("");
    setResult(null);
    try {
      const payload = selectedEndpoint.method === "GET" ? {} : parseObjectJson(payloadText, "请求体");
      const headers = parseObjectJson(headersText, "额外 headers") as Record<string, string>;
      const apk_options = parseObjectJson(apkOptionsText, "APK 高级参数");
      const response = await fetch(`${API_BASE}/api/socmark/call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          endpoint: selectedEndpoint.key,
          base_url: baseUrl,
          payload,
          datastr,
          uniid: uniid || null,
          headers,
          apk_options
        })
      });
      const text = await response.text();
      if (!response.ok) throw new Error(text || `HTTP ${response.status}`);
      setResult(JSON.parse(text) as SocmarkCallResult);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "调用失败");
    } finally {
      setCalling(false);
    }
  }

  function returnDashboard() {
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  return (
    <main className="app-shell socmark-shell">
      <section className="socmark-topbar">
        <a
          className="socmark-back"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            returnDashboard();
          }}
        >
          <ArrowLeft size={16} />
          返回看板
        </a>
        <div>
          <p className="eyebrow">Socmark API</p>
          <h1>手机性能排行接口调试</h1>
        </div>
        <button className="header-sync-button" type="button" onClick={() => window.location.reload()} disabled={loadingCatalog}>
          <RefreshCw size={16} />
          刷新目录
        </button>
      </section>

      <section className="socmark-alert">
        <ShieldAlert size={18} />
        <span>
          实际看板数据来自后端本地库 <strong>/api/phones</strong>，当前已有 <strong>{localDataMessage || "读取中"}</strong>。
          这里调的是 APK 上游接口：已补 native battery、混淆 headers 和 Lfe 加密请求体；如果服务端返回错误哨兵会在响应里标出。
        </span>
      </section>

      <section className="socmark-panel socmark-local-data">
        <div>
          <p className="eyebrow">Local Data</p>
          <h2>{localDataMessage || "正在读取本地数据..."}</h2>
        </div>
        <div className="socmark-local-list">
          {localPhones.map((phone) => (
            <span key={phone.id}>
              <strong>{phone.name}</strong>
              <em>{phone.score ? `${(phone.score / 10).toFixed(1)} 分` : "暂无评分"}</em>
            </span>
          ))}
        </div>
        <a className="text-button" href="/" onClick={(event) => {
          event.preventDefault();
          returnDashboard();
        }}>
          查看看板数据
        </a>
      </section>

      <section className="socmark-layout">
        <section className="socmark-panel">
          <div className="socmark-panel-title">
            <Server size={18} />
            <h2>请求</h2>
          </div>

          <label className="socmark-field">
            <span>接口</span>
            <select value={selectedEndpointKey} onChange={(event) => changeEndpoint(event.target.value)} disabled={!catalog}>
              {(catalog?.endpoints ?? []).map((endpoint) => (
                <option key={endpoint.key} value={endpoint.key}>
                  {endpoint.method} /{endpoint.path} - {endpoint.description}
                </option>
              ))}
            </select>
          </label>

          <label className="socmark-field">
            <span>上游地址</span>
            <select value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} disabled={!catalog}>
              {(catalog?.base_urls ?? []).map((url) => (
                <option key={url} value={url}>
                  {url}
                </option>
              ))}
            </select>
          </label>

          <div className="socmark-grid">
            <label className="socmark-field">
              <span>datastr</span>
              <input value={datastr} onChange={(event) => setDatastr(event.target.value)} placeholder="abcde" />
            </label>
            <label className="socmark-field">
              <span>uniid</span>
              <input value={uniid} onChange={(event) => setUniid(event.target.value)} placeholder="留空自动生成" />
            </label>
          </div>

          <label className="socmark-field">
            <span>请求体 JSON</span>
            <textarea
              value={payloadText}
              onChange={(event) => setPayloadText(event.target.value)}
              disabled={selectedEndpoint?.method === "GET"}
              spellCheck={false}
            />
          </label>

          <label className="socmark-field">
            <span>额外 headers JSON</span>
            <textarea value={headersText} onChange={(event) => setHeadersText(event.target.value)} spellCheck={false} />
          </label>

          <label className="socmark-field">
            <span>APK 高级参数 JSON</span>
            <textarea value={apkOptionsText} onChange={(event) => setApkOptionsText(event.target.value)} spellCheck={false} />
          </label>

          <div className="socmark-actions">
            <button className="text-button" type="button" onClick={formatPayload}>
              <Braces size={15} />
              格式化
            </button>
            <button className="text-button" type="button" onClick={resetPayload}>
              重置样例
            </button>
            <button className="icon-button" type="button" onClick={() => void callEndpoint()} disabled={calling || loadingCatalog || !selectedEndpoint}>
              <Play size={16} />
              {calling ? "调用中" : "调用接口"}
            </button>
          </div>

          {message && <div className="state-box error-box">{message}</div>}
        </section>

        <section className="socmark-panel">
          <div className="socmark-panel-title">
            <Braces size={18} />
            <h2>响应</h2>
          </div>

          {!result && <div className="state-box">{loadingCatalog ? "正在读取后端接口目录..." : "还没有调用结果"}</div>}

          {result && (
            <div className="socmark-response">
              <div className="socmark-status-row">
                <strong>HTTP {result.status_code}</strong>
                <span>{result.method} {result.url}</span>
              </div>

              <h3>Header 复现状态</h3>
              <div className="socmark-header-status">
                {result.header_status.map((item) => (
                  <span key={item.key} className={item.state === "generated" ? "is-generated" : "is-missing"} title={item.note}>
                    <code>{item.key}</code>
                    <em>{item.state === "generated" ? "已生成" : "缺参数"}</em>
                  </span>
                ))}
              </div>

              <h3>响应体</h3>
              <pre>{result.body !== null ? prettyJson(result.body) : result.body_text}</pre>

              <h3>解密状态</h3>
              <pre>
                {prettyJson({
                  server_response_key: result.server_response_key ?? null,
                  decrypted_body_text: result.decrypted_body_text ?? null
                })}
              </pre>

              <h3>请求体明文</h3>
              <pre>{result.request_body_text || "{}"}</pre>

              <h3>实际上游请求体</h3>
              <pre>{result.request_body_sent_text || "(empty)"}</pre>

              <h3>响应 headers</h3>
              <pre>{prettyJson(result.response_headers)}</pre>

              <h3>实际请求 headers</h3>
              <pre>{prettyJson(result.request_headers)}</pre>
            </div>
          )}
        </section>
      </section>

      {catalog && (
        <section className="socmark-panel socmark-notes">
          <h2>已同步 headers 线索</h2>
          {Object.entries(catalog.header_notes).map(([key, note]) => (
            <p key={key}>
              <code>{key}</code>
              <span>{note}</span>
            </p>
          ))}
        </section>
      )}
    </main>
  );
}
