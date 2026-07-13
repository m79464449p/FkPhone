import type { Phone, SortKey, VersionSpec } from "../types";

export function pickFeaturedSpecs(specs: VersionSpec[]) {
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

export function compareName(a: Phone, b: Phone) {
  return a.name.localeCompare(b.name, "zh-CN");
}

export function comparePrice(a: Phone, b: Phone, direction: "asc" | "desc") {
  if (a.price == null && b.price == null) return compareName(a, b);
  if (a.price == null) return 1;
  if (b.price == null) return -1;
  const left = a.price;
  const right = b.price;
  return direction === "asc" ? left - right : right - left;
}

export function compareReleaseDateDesc(a: Phone, b: Phone) {
  return getReleaseTimestamp(b) - getReleaseTimestamp(a) || compareName(a, b);
}

export function getReleaseTimestamp(phone: Phone) {
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

export function sortLabel(sortKey: SortKey) {
  const labels: Record<SortKey, string> = {
    release_desc: "发布时间降序",
    score: "评分最高",
    price_asc: "价格从低到高",
    price_desc: "价格从高到低",
    name: "名称"
  };
  return labels[sortKey];
}
