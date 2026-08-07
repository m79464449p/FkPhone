import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Image,
  Modal,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Textarea,
  Text,
  TextInput
} from "@mantine/core";
import { ChevronLeft, ChevronRight, ExternalLink, HardDrive, KeyRound, MemoryStick, RefreshCw, Search, ShoppingBag, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { CSSProperties } from "react";
import { API_BASE, RAM_FILTER_OPTIONS, STORAGE_FILTER_OPTIONS } from "../constants";
import type { GoofishListing, GoofishLoginStatus } from "../types";
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
  loginOpen: boolean;
  loginStatus: GoofishLoginStatus | null;
  loginBusy: boolean;
  onLoginClose: () => void;
  onSendSms: (phone: string) => Promise<void>;
  onVerifyLogin: (code: string) => Promise<void>;
  onLoginClick: (x: number, y: number) => Promise<void>;
  onLoginDrag: (startX: number, startY: number, endX: number, endY: number) => Promise<void>;
  onImportCookie: (cookie: string) => Promise<void>;
  onSearch: () => void;
  onCancelSearch: () => void;
  onRefresh: () => void;
  onResetSession: () => void;
};

type PreviewState = {
  title: string;
  images: string[];
  index: number;
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
  loginOpen,
  loginStatus,
  loginBusy,
  onLoginClose,
  onSendSms,
  onVerifyLogin,
  onLoginClick,
  onLoginDrag,
  onImportCookie,
  onSearch,
  onCancelSearch,
  onRefresh,
  onResetSession
}: GoofishPanelProps) {
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [cookieModalOpen, setCookieModalOpen] = useState(false);
  const [cookieInput, setCookieInput] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const loginPointerStart = useRef<{ x: number; y: number } | null>(null);

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
    return "unknown";
  }

  function getCreditBadgeColor(tone: string) {
    if (tone === "excellent") return "teal";
    if (tone === "good") return "blue";
    if (tone === "fair") return "yellow";
    return "gray";
  }

  function getListingImages(listing: GoofishListing) {
    return Array.from(new Set([...(listing.image_urls || []), listing.image_url].filter(Boolean) as string[]));
  }

  function openPreview(title: string, images: string[], index = 0) {
    if (images.length === 0) return;
    setPreview({ title, images, index });
  }

  function movePreview(current: PreviewState | null, direction: number) {
    if (!current || current.images.length === 0) return current;
    return {
      ...current,
      index: (current.index + direction + current.images.length) % current.images.length
    };
  }

  function getLoginImagePoint(event: ReactPointerEvent<HTMLImageElement>) {
    const image = event.currentTarget;
    const bounds = image.getBoundingClientRect();
    const imageRatio = image.naturalWidth / image.naturalHeight;
    const boundsRatio = bounds.width / bounds.height;
    const renderedWidth = boundsRatio > imageRatio ? bounds.height * imageRatio : bounds.width;
    const renderedHeight = boundsRatio > imageRatio ? bounds.height : bounds.width / imageRatio;
    const offsetX = (bounds.width - renderedWidth) / 2;
    const offsetY = (bounds.height - renderedHeight) / 2;
    return {
      x: Math.max(0, Math.min(image.naturalWidth, Math.round((event.clientX - bounds.left - offsetX) * (image.naturalWidth / renderedWidth)))),
      y: Math.max(0, Math.min(image.naturalHeight, Math.round((event.clientY - bounds.top - offsetY) * (image.naturalHeight / renderedHeight))))
    };
  }

  function handleLoginPointerDown(event: ReactPointerEvent<HTMLImageElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    loginPointerStart.current = getLoginImagePoint(event);
  }

  function handleLoginPointerUp(event: ReactPointerEvent<HTMLImageElement>) {
    event.preventDefault();
    const start = loginPointerStart.current;
    loginPointerStart.current = null;
    if (!start) return;
    const end = getLoginImagePoint(event);
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    if (distance < 8) {
      void onLoginClick(end.x, end.y);
    } else {
      void onLoginDrag(start.x, start.y, end.x, end.y);
    }
  }

  return (
    <Paper component="section" withBorder radius="md" p="md" className="goofish-panel" aria-label="闲鱼搜索">
      {headerContent && <div className="workspace-dashboard-header goofish-dashboard-header">{headerContent}</div>}

      <Stack gap="sm">
        <div className="goofish-controls">
          <TextInput
            className="workspace-search-input goofish-keyword-field"
            label="关键词"
            leftSection={<Search size={18} />}
            value={keywordInput}
            onChange={(event) => onKeywordInputChange(event.target.value)}
            onKeyDown={handleKeywordKeyDown}
            placeholder="关键词，用逗号分隔"
          />
          <Button
            className="goofish-primary-search"
            size="sm"
            leftSection={<RefreshCw size={18} />}
            onClick={onSearch}
            disabled={searching}
            variant="light"
          >
            {searching ? "搜索中" : "搜索闲鱼"}
          </Button>
        </div>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" className="goofish-filter-row" aria-label="闲鱼筛选条件">
          <TextInput
            label="名称筛选"
            leftSection={<Search size={18} />}
            value={nameFilter}
            onChange={(event) => onNameFilterChange(event.target.value)}
            placeholder="全部"
            aria-label="按名称筛选闲鱼商品"
          />
          <Select
            label="存储容量"
            leftSection={<HardDrive size={18} />}
            data={STORAGE_FILTER_OPTIONS}
            value={storageFilter || null}
            onChange={(value) => onStorageFilterChange(value ?? "")}
            placeholder="全部"
            clearable
            searchable
          />
          <Select
            label="运行内存"
            leftSection={<MemoryStick size={18} />}
            data={RAM_FILTER_OPTIONS}
            value={ramFilter || null}
            onChange={(value) => onRamFilterChange(value ?? "")}
            placeholder="全部"
            clearable
            searchable
          />
        </SimpleGrid>

        <Group gap="xs" wrap="wrap" className="goofish-action-group goofish-search-actions">
          <Button size="sm" leftSection={<ShoppingBag size={18} />} onClick={onLogin} disabled={searching} variant="light">
            登录闲鱼
          </Button>
          <Button size="sm" leftSection={<KeyRound size={18} />} onClick={() => setCookieModalOpen(true)} disabled={searching} variant="light">
            导入 Cookie
          </Button>
          <Button size="sm" leftSection={<RefreshCw size={18} />} onClick={onRefresh} disabled={loading} variant="light">
            {loading ? "刷新中" : "刷新列表"}
          </Button>
          <Button size="sm" color="gray" variant="subtle" leftSection={<Trash2 size={18} />} onClick={onResetSession} disabled={searching}>
            清空登录态
          </Button>
        </Group>

        {message && <Alert variant="light" color="gray">{message}</Alert>}
        {searching && (
          <Alert variant="light" color="teal" title={`正在检查登录状态并搜索，已用时 ${formatDuration(searchElapsedSeconds)}`}>
            {loginOpen
              ? "请在登录窗口完成验证，验证成功后会继续处理搜索。"
              : "正在检查服务器上的闲鱼登录状态，验证通过后会自动开始搜索，请稍候。"}
            <Button mt="sm" size="xs" variant="subtle" onClick={onCancelSearch}>
              取消搜索
            </Button>
          </Alert>
        )}
        {error && <Alert variant="light" color="red">闲鱼接口失败：{error}</Alert>}

        <Modal opened={loginOpen} onClose={onLoginClose} title="登录闲鱼" centered size="lg">
          <Stack gap="sm">
            <Alert variant="light" color={loginStatus?.status === "success" ? "teal" : "gray"}>
              {loginStatus?.message || "正在启动服务器登录会话..."}
            </Alert>
            {loginStatus?.status !== "success" && loginStatus?.status !== "awaiting_scan" && (
              <>
                <Group align="flex-end" wrap="wrap">
                  <TextInput
                    label="手机号"
                    value={loginPhone}
                    onChange={(event) => setLoginPhone(event.currentTarget.value)}
                    placeholder="中国大陆手机号"
                    style={{ flex: "1 1 220px" }}
                  />
                  <Button
                    variant="light"
                    loading={loginBusy}
                    disabled={!loginStatus?.active || !/^1\d{10}$/.test(loginPhone.trim())}
                    onClick={() => void onSendSms(loginPhone)}
                  >
                    获取验证码
                  </Button>
                </Group>
                <Group align="flex-end" wrap="wrap">
                  <TextInput
                    label="短信验证码"
                    value={loginCode}
                    onChange={(event) => setLoginCode(event.currentTarget.value)}
                    placeholder="验证码"
                    style={{ flex: "1 1 220px" }}
                  />
                  <Button
                    loading={loginBusy}
                    disabled={!loginStatus?.active || !/^\d{4,8}$/.test(loginCode.trim())}
                    onClick={() => void onVerifyLogin(loginCode)}
                  >
                    验证并登录
                  </Button>
                </Group>
              </>
            )}
            {loginStatus?.screenshot_available && (
              <div className="goofish-login-screen">
                <Text size="xs" c="dimmed">
                  {loginStatus.status === "awaiting_scan" ? "请用闲鱼 App 扫描二维码" : "服务器登录画面"}
                </Text>
                <img
                  src={`${API_BASE}/api/goofish/login/screenshot?v=${loginStatus.screenshot_version}`}
                  alt="闲鱼服务器登录画面"
                  draggable={false}
                  onPointerDown={handleLoginPointerDown}
                  onPointerUp={handleLoginPointerUp}
                />
              </div>
            )}
            <Group justify="flex-end">
              <Button variant="subtle" color="gray" onClick={onLoginClose}>
                {loginStatus?.status === "success" ? "完成" : "取消"}
              </Button>
            </Group>
          </Stack>
        </Modal>

        <Modal opened={cookieModalOpen} onClose={() => setCookieModalOpen(false)} title="导入闲鱼 Cookie" centered>
          <Stack gap="sm">
            <Textarea
              label="Cookie 内容"
              description="粘贴浏览器中 goofish.com 的 Cookie JSON 或 Cookie 请求头文本。"
              minRows={6}
              autosize
              value={cookieInput}
              onChange={(event) => setCookieInput(event.currentTarget.value)}
              placeholder="_m_h5_tk=...; unb=..."
            />
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setCookieModalOpen(false)}>取消</Button>
              <Button
                leftSection={<Upload size={16} />}
                disabled={!cookieInput.trim()}
                onClick={async () => {
                  await onImportCookie(cookieInput);
                  setCookieInput("");
                  setCookieModalOpen(false);
                }}
              >
                导入并验证
              </Button>
            </Group>
          </Stack>
        </Modal>

        <ScrollArea type="auto" className="goofish-table-wrap">
          <Table striped highlightOnHover withTableBorder withColumnBorders className="goofish-table">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>商品</Table.Th>
                <Table.Th>价格</Table.Th>
                <Table.Th>地区</Table.Th>
                <Table.Th>热度</Table.Th>
                <Table.Th>关键词</Table.Th>
                <Table.Th>链接</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {listings.map((listing, index) => {
                const specs = inferGoofishSpecs(listing);
                const sellerCredit = listing.seller_credit || "信用暂无";
                const creditTone = getCreditTone(sellerCredit);
                const imageUrls = getListingImages(listing);
                const displayImageUrl = getDisplayImageUrl(imageUrls[0] || null);
                return (
                  <Table.Tr key={listing.item_id} style={{ "--item-index": index } as CSSProperties}>
                    <Table.Td className="goofish-product-cell">
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
                          <Text fw={700} size="sm" className="goofish-title-link">
                            {listing.title}
                          </Text>
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
                    </Table.Td>
                    <Table.Td>
                      <Text fw={800} c="orange">
                        {formatPrice(listing.price)}
                      </Text>
                    </Table.Td>
                    <Table.Td>{listing.location || "-"}</Table.Td>
                    <Table.Td>
                      <span className="goofish-engagement" aria-label="闲鱼热度">
                        <span className="goofish-engagement-row">
                          <b>{listing.want_count != null ? listing.want_count.toLocaleString("zh-CN") : "-"}</b>
                          <em>人想要</em>
                        </span>
                        <span className="goofish-engagement-row">
                          <b>{listing.browse_count != null ? listing.browse_count.toLocaleString("zh-CN") : "-"}</b>
                          <em>人浏览</em>
                        </span>
                        <Badge variant="light" color={getCreditBadgeColor(creditTone)} className={`goofish-credit-stamp ${creditTone}`}>
                          {sellerCredit}
                        </Badge>
                      </span>
                    </Table.Td>
                    <Table.Td>{listing.keywords.join(", ") || "-"}</Table.Td>
                    <Table.Td>
                      <Button component="a" href={listing.source_url} target="_blank" rel="noreferrer" size="xs" variant="light" rightSection={<ExternalLink size={14} />}>
                        打开闲鱼
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
        {!loading && listings.length === 0 && <Alert variant="light" color="gray">暂无闲鱼商品</Alert>}
      </Stack>

      <Modal opened={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.title ?? "商品图片预览"} size="xl" centered>
        {preview && (
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text size="sm" c="dimmed">
                {preview.index + 1} / {preview.images.length}
              </Text>
              <Group gap="xs">
                <ActionIcon variant="light" onClick={() => setPreview((current) => movePreview(current, -1))} disabled={preview.images.length < 2} aria-label="上一张">
                  <ChevronLeft size={18} />
                </ActionIcon>
                <ActionIcon variant="light" onClick={() => setPreview((current) => movePreview(current, 1))} disabled={preview.images.length < 2} aria-label="下一张">
                  <ChevronRight size={18} />
                </ActionIcon>
              </Group>
            </Group>
            <Image
              src={getDisplayImageUrl(preview.images[preview.index]) || ""}
              alt={preview.title}
              fit="contain"
              h={560}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          </Stack>
        )}
      </Modal>
    </Paper>
  );
}
