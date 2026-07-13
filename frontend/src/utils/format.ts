export function formatPrice(price: number | null) {
  if (price == null) return "暂无价格";
  return `¥${price.toLocaleString("zh-CN")}`;
}

export function formatScore(score: number) {
  if (!score) return "暂无评分";
  return (score / 10).toFixed(1);
}

export function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} 秒`;
  return `${minutes} 分 ${seconds.toString().padStart(2, "0")} 秒`;
}
