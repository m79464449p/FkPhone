import type { GoofishListing, GoofishSpec } from "../types";

export function parseKeywords(value: string) {
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

export function formatGoofishEngagement(listing: GoofishListing) {
  const parts = [];
  if (listing.want_count != null) parts.push(`${listing.want_count}人想要`);
  if (listing.browse_count != null) parts.push(`${listing.browse_count}浏览`);
  return parts.length ? parts.join(" | ") : "-";
}

export function inferGoofishSpecs(listing: GoofishListing): GoofishSpec[] {
  const text = `${listing.title} ${listing.raw_text}`.replace(/\s+/g, " ");
  const memoryPair = text.match(/(\d{1,2})\s*(?:GB|G)?\s*[+＋]\s*(\d{2,4})\s*(?:GB|G|TB)?/i);
  const ram = memoryPair ? `${memoryPair[1]}GB` : findFirst(text, [/运行内存[:：]?\s*(\d{1,2})\s*(?:GB|G)/i, /\b(12|16|24|8)\s*(?:GB|G)\s*(?:运存|运行)/i]);
  const storage = memoryPair ? normalizeStorage(memoryPair[2]) : findStorage(text);
  return [
    { label: "品牌", value: inferGoofishBrand(text) },
    { label: "型号", value: inferGoofishModel(text) },
    { label: "存储容量", value: storage || "未知" },
    { label: "运行内存", value: ram || "未知" },
    { label: "版本", value: inferGoofishVersion(text) },
    { label: "拆修和功能", value: inferGoofishRepair(text) }
  ];
}

export function matchesGoofishSpecFilters(listing: GoofishListing, storageFilter: string, ramFilter: string) {
  const filters = {
    storage: normalizeSpecFilter(storageFilter),
    ram: normalizeSpecFilter(ramFilter)
  };
  if (!filters.storage && !filters.ram) return true;

  const specs = inferGoofishSpecs(listing);
  const storage = normalizeSpecFilter(specs.find((spec) => spec.label === "存储容量")?.value ?? "");
  const ram = normalizeSpecFilter(specs.find((spec) => spec.label === "运行内存")?.value ?? "");

  return (!filters.storage || storage === filters.storage) && (!filters.ram || ram === filters.ram);
}

function normalizeSpecFilter(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "未知") return "";
  return normalizeStorage(trimmed);
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
