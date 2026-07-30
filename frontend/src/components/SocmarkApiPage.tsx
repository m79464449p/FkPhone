import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title
} from "@mantine/core";
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
    <Paper component="main" className="app-shell socmark-shell" withBorder radius="md" p="md">
      <Group justify="space-between" align="center" className="socmark-topbar" mb="md">
        <Button component="a" href="/" variant="light" leftSection={<ArrowLeft size={16} />} onClick={(event) => {
          event.preventDefault();
          returnDashboard();
        }}>
          返回看板
        </Button>
        <Stack gap={0} align="center">
          <Text size="xs" fw={800} tt="uppercase" c="teal.7">
            Socmark API
          </Text>
          <Title order={1}>手机性能排行接口调试</Title>
        </Stack>
        <Button leftSection={<RefreshCw size={16} />} onClick={() => window.location.reload()} loading={loadingCatalog}>
          刷新目录
        </Button>
      </Group>

      <Alert variant="light" color="teal" icon={<ShieldAlert size={18} />} className="socmark-alert" mb="md">
        实际看板数据来自后端本地库 <strong>/api/phones</strong>，当前已有 <strong>{localDataMessage || "读取中"}</strong>。
        这里调的是 APK 上游接口：已补 native battery、混淆 headers 和 Lfe 加密请求体；如果服务端返回错误哨兵会在响应里标出。
      </Alert>

      <Paper withBorder radius="md" p="md" className="socmark-panel socmark-local-data" mb="md">
        <Group justify="space-between" align="center" mb="sm">
          <Stack gap={0}>
            <Text size="xs" fw={800} tt="uppercase" c="teal.7">
              Local Data
            </Text>
            <Text fw={800}>{localDataMessage || "正在读取本地数据..."}</Text>
          </Stack>
        </Group>
        <Group gap="xs" wrap="wrap" mb="sm" className="socmark-local-list">
          {localPhones.map((phone) => (
            <Badge key={phone.id} variant="light" color="gray">
              <Stack gap={0}>
                <Text fw={700} size="xs">
                  {phone.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {phone.score ? `${(phone.score / 10).toFixed(1)} 分` : "暂无评分"}
                </Text>
              </Stack>
            </Badge>
          ))}
        </Group>
        <Button component="a" href="/" variant="subtle" onClick={(event) => {
          event.preventDefault();
          returnDashboard();
        }}>
          查看看板数据
        </Button>
      </Paper>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md" className="socmark-layout">
        <Paper withBorder radius="md" p="md" className="socmark-panel">
          <Group gap="xs" mb="md">
            <Server size={18} />
            <Title order={3}>请求</Title>
          </Group>

          <Stack gap="sm">
            <Select
              label="接口"
              value={selectedEndpointKey || null}
              onChange={(value) => changeEndpoint(value ?? "")}
              disabled={!catalog}
              data={(catalog?.endpoints ?? []).map((endpoint) => ({
                value: endpoint.key,
                label: `${endpoint.method} /${endpoint.path} - ${endpoint.description}`
              }))}
              searchable
            />

            <Select
              label="上游地址"
              value={baseUrl || null}
              onChange={(value) => setBaseUrl(value ?? "")}
              disabled={!catalog}
              data={catalog?.base_urls ?? []}
              searchable
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" className="socmark-grid">
              <TextInput label="datastr" value={datastr} onChange={(event) => setDatastr(event.target.value)} placeholder="abcde" />
              <TextInput label="uniid" value={uniid} onChange={(event) => setUniid(event.target.value)} placeholder="留空自动生成" />
            </SimpleGrid>

            <Textarea
              label="请求体 JSON"
              value={payloadText}
              onChange={(event) => setPayloadText(event.target.value)}
              disabled={selectedEndpoint?.method === "GET"}
              autosize
              minRows={8}
              spellCheck={false}
            />

            <Textarea
              label="额外 headers JSON"
              value={headersText}
              onChange={(event) => setHeadersText(event.target.value)}
              autosize
              minRows={6}
              spellCheck={false}
            />

            <Textarea
              label="APK 高级参数 JSON"
              value={apkOptionsText}
              onChange={(event) => setApkOptionsText(event.target.value)}
              autosize
              minRows={6}
              spellCheck={false}
            />

            <Group gap="xs" wrap="wrap" className="socmark-actions">
              <Button size="sm" variant="light" leftSection={<Braces size={15} />} onClick={formatPayload}>
                格式化
              </Button>
              <Button size="sm" variant="subtle" onClick={resetPayload}>
                重置样例
              </Button>
              <Button size="sm" leftSection={<Play size={16} />} onClick={() => void callEndpoint()} loading={calling} disabled={loadingCatalog || !selectedEndpoint}>
                调用接口
              </Button>
            </Group>

            {message && <Alert variant="light" color="red">{message}</Alert>}
          </Stack>
        </Paper>

        <Paper withBorder radius="md" p="md" className="socmark-panel">
          <Group gap="xs" mb="md">
            <Braces size={18} />
            <Title order={3}>响应</Title>
          </Group>

          {!result && (
            <Alert variant="light" color="gray">
              {loadingCatalog ? "正在读取后端接口目录..." : "还没有调用结果"}
            </Alert>
          )}

          {result && (
            <Stack gap="md" className="socmark-response">
              <Paper withBorder radius="md" p="sm">
                <Group justify="space-between" align="center" className="socmark-status-row">
                  <Badge variant="filled" color={result.status_code >= 400 ? "red" : "teal"}>
                    HTTP {result.status_code}
                  </Badge>
                  <Text size="sm" c="dimmed">
                    {result.method} {result.url}
                  </Text>
                </Group>
              </Paper>

              <Stack gap="sm" className="socmark-header-status">
                <Title order={4}>Header 复现状态</Title>
                <Group gap="xs" wrap="wrap">
                  {result.header_status.map((item) => (
                    <Badge key={item.key} variant={item.state === "generated" ? "filled" : "light"} color={item.state === "generated" ? "teal" : "yellow"} title={item.note}>
                      {item.key}
                    </Badge>
                  ))}
                </Group>
              </Stack>

              <SectionPanel title="响应体" content={result.body !== null ? prettyJson(result.body) : result.body_text} />
              <SectionPanel
                title="解密状态"
                content={prettyJson({
                  server_response_key: result.server_response_key ?? null,
                  decrypted_body_text: result.decrypted_body_text ?? null
                })}
              />
              <SectionPanel title="请求体明文" content={result.request_body_text || "{}"} />
              <SectionPanel title="实际上游请求体" content={result.request_body_sent_text || "(empty)"} />
              <SectionPanel title="响应 headers" content={prettyJson(result.response_headers)} />
              <SectionPanel title="实际请求 headers" content={prettyJson(result.request_headers)} />
            </Stack>
          )}
        </Paper>
      </SimpleGrid>

      {catalog && (
        <Paper withBorder radius="md" p="md" className="socmark-panel socmark-notes" mt="md">
          <Title order={3} mb="sm">
            已同步 headers 线索
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
            {Object.entries(catalog.header_notes).map(([key, note]) => (
              <Paper key={key} withBorder radius="sm" p="sm" bg="var(--mantine-color-dark-7)">
                <Text fw={800} size="sm" mb={4}>
                  <code>{key}</code>
                </Text>
                <Text size="sm" c="dimmed">
                  {note}
                </Text>
              </Paper>
            ))}
          </SimpleGrid>
        </Paper>
      )}
    </Paper>
  );
}

function SectionPanel({ title, content }: { title: string; content: string }) {
  return (
    <Paper withBorder radius="md" p="sm">
      <Title order={4} mb="xs">
        {title}
      </Title>
      <ScrollArea type="auto" h={180}>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{content}</pre>
      </ScrollArea>
    </Paper>
  );
}
